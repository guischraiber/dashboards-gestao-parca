// api/csat.js
// Endpoint único para as duas bases do CSAT Parça (Respostas e Disparos).
//
// Consolidado num único arquivo (leitura + importar + limpar histórico) pra
// caber no limite de 12 Serverless Functions do plano Hobby do Vercel — antes
// eram 3 arquivos (csat.js, importarCsat.js, limparHistoricoCsat.js), agora é
// 1 só, roteado por método e pelo formato do corpo da requisição:
//   GET                                              → devolve { respostasCSV, disparosCSV, nomeRespostas, nomeDisparos, historico }
//   POST { respostas, disparos, nomeRespostas, nomeDisparos } → importa
//   POST { admin }                                   → limpa data/historicoCsat.json (sem token — qualquer chamada limpa)
//
// Usa a Git Data API (via lerArquivoGithubGrande/commitArquivoGrande) porque
// a base de Respostas costuma vir com texto livre nos comentários e pode
// passar de ~1MB.
//
// Sem exigência de token pra ler/importar — mesmo nível de proteção das
// outras abas internas do dashboard.
//
// Variáveis de ambiente necessárias (já configuradas no Vercel para o Score):
//   GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH (opcional)
//
// ATENÇÃO: o Vercel limita o corpo de uma requisição de API Route a ~4.5MB.
// Pra não esbarrar nisso quando a base de Respostas cresce (texto livre nos
// comentários, muitas semanas acumuladas), o front-end manda as duas bases
// comprimidas (CompressionStream "deflate" + base64) em `respostasGzip` /
// `disparosGzip` — este endpoint descomprime com zlib.inflateSync antes de
// gravar. `respostas`/`disparos` (texto puro) continuam aceitos por
// compatibilidade.

import zlib from 'zlib';
import {
  lerArquivoGithubGrande, commitArquivoGrande,
  lerArquivoGithub, commitArquivo,
  credenciaisGithub,
} from '../src/pages/score/lib/github.js';

const ARQUIVO_RESPOSTAS = 'data/csatRespostas.csv';
const ARQUIVO_DISPAROS = 'data/csatDisparos.csv';
const ARQUIVO_META = 'data/csatMeta.json';
const ARQUIVO_HISTORICO = 'data/historicoCsat.json';

async function handleGet(req, res) {
  const { token, owner, repo, branch } = credenciaisGithub();
  if (!token || !owner || !repo) {
    return res.status(500).json({ error: 'Configure GITHUB_TOKEN, GITHUB_OWNER e GITHUB_REPO no ambiente do Vercel.' });
  }

  let respostasCSV = null;
  let disparosCSV = null;
  let nomeRespostas = null;
  let nomeDisparos = null;
  try {
    respostasCSV = await lerArquivoGithubGrande({ owner, repo, branch, token, caminho: ARQUIVO_RESPOSTAS });
    disparosCSV = await lerArquivoGithubGrande({ owner, repo, branch, token, caminho: ARQUIVO_DISPAROS });
    const metaTexto = await lerArquivoGithub({ owner, repo, branch, token, caminho: ARQUIVO_META });
    if (metaTexto) {
      const meta = JSON.parse(metaTexto);
      nomeRespostas = meta.nomeRespostas || null;
      nomeDisparos = meta.nomeDisparos || null;
    }
  } catch (e) {
    return res.status(500).json({ error: 'Erro ao ler as bases do CSAT no GitHub.', detail: String(e.message || e) });
  }

  let historico = [];
  try {
    const historicoTexto = await lerArquivoGithub({ owner, repo, branch, token, caminho: ARQUIVO_HISTORICO });
    if (historicoTexto) historico = JSON.parse(historicoTexto);
  } catch {
    // histórico corrompido não deve quebrar a leitura dos dados
  }

  return res.status(200).json({ respostasCSV, disparosCSV, nomeRespostas, nomeDisparos, historico });
}

async function handleImportar(req, res, respostas, disparos, nomeRespostas, nomeDisparos) {
  const { token, owner, repo, branch } = credenciaisGithub();
  if (!token || !owner || !repo) {
    return res.status(500).json({
      error: 'Configure GITHUB_TOKEN, GITHUB_OWNER e GITHUB_REPO no ambiente do Vercel.',
    });
  }

  try {
    await commitArquivoGrande({ owner, repo, branch, token, caminho: ARQUIVO_RESPOSTAS, conteudo: respostas });
    await commitArquivoGrande({ owner, repo, branch, token, caminho: ARQUIVO_DISPAROS, conteudo: disparos });
    await commitArquivo({
      owner, repo, branch, token,
      caminho: ARQUIVO_META,
      conteudo: JSON.stringify({
        nomeRespostas: nomeRespostas || 'respostas.csv',
        nomeDisparos: nomeDisparos || 'disparos.csv',
        importadoEm: new Date().toISOString(),
      }, null, 2),
    });

    try {
      const historicoAtual = await lerArquivoGithub({ owner, repo, branch, token, caminho: ARQUIVO_HISTORICO });
      const lista = historicoAtual ? JSON.parse(historicoAtual) : [];
      lista.push({ data: new Date().toISOString(), arquivo: `${nomeRespostas || 'respostas.csv'} + ${nomeDisparos || 'disparos.csv'}` });
      await commitArquivo({
        owner, repo, branch, token,
        caminho: ARQUIVO_HISTORICO,
        conteudo: JSON.stringify(lista, null, 2),
      });
    } catch (e) {
      console.warn('Não foi possível atualizar o histórico do CSAT:', e);
    }

    return res.status(200).json({
      ok: true,
      mensagem: 'Bases enviadas. O dashboard atualiza em ~1 minuto (o Vercel faz um novo deploy sozinho).',
    });
  } catch (e) {
    return res.status(502).json({ error: 'Erro ao salvar no GitHub.', detail: String(e.message || e) });
  }
}

async function handleLimparHistorico(req, res, admin) {
  // Sem exigência de ADMIN_TOKEN — qualquer chamada autenticada pela própria
  // UI do dashboard pode limpar o histórico (mesmo padrão do restante do app).

  const { token, owner, repo, branch } = credenciaisGithub();
  if (!token || !owner || !repo) {
    return res.status(500).json({ error: 'Configure GITHUB_TOKEN, GITHUB_OWNER e GITHUB_REPO no ambiente do Vercel.' });
  }

  try {
    await commitArquivo({
      owner, repo, branch, token,
      caminho: ARQUIVO_HISTORICO,
      conteudo: JSON.stringify([], null, 2),
    });
    return res.status(200).json({ ok: true, mensagem: 'Histórico de importações limpo.' });
  } catch (e) {
    return res.status(502).json({ error: 'Erro ao limpar no GitHub.', detail: String(e.message || e) });
  }
}

export default async function handler(req, res) {
  if (req.method === 'GET') return handleGet(req, res);

  if (req.method === 'POST') {
    const body = req.body || {};
    if (body.admin !== undefined) return handleLimparHistorico(req, res, body.admin);
    if (typeof body.respostasGzip === 'string' && typeof body.disparosGzip === 'string') {
      let respostas, disparos;
      try {
        respostas = zlib.inflateSync(Buffer.from(body.respostasGzip, 'base64')).toString('utf8');
        disparos = zlib.inflateSync(Buffer.from(body.disparosGzip, 'base64')).toString('utf8');
      } catch (e) {
        return res.status(400).json({ error: 'Não consegui descomprimir as bases recebidas.', detail: String(e.message || e) });
      }
      return handleImportar(req, res, respostas, disparos, body.nomeRespostas, body.nomeDisparos);
    }
    if (typeof body.respostas === 'string' && typeof body.disparos === 'string') {
      return handleImportar(req, res, body.respostas, body.disparos, body.nomeRespostas, body.nomeDisparos);
    }
    return res.status(400).json({ error: 'Requisição inválida — envie {respostasGzip,disparosGzip,...} (ou {respostas,disparos,...}) para importar, ou {admin} para limpar o histórico.' });
  }

  return res.status(405).json({ error: 'Método não suportado.' });
}
