// api/abrangencia.js
// Endpoint único para as bases (atual + anterior) da Abrangência Parça.
//
// Consolidado num único arquivo (leitura + importar + limpar histórico) pra
// caber no limite de 12 Serverless Functions do plano Hobby do Vercel — antes
// eram 3 arquivos (abrangencia.js, importarAbrangencia.js,
// limparHistoricoAbrangencia.js), agora é 1 só, roteado por método e pelo
// formato do corpo da requisição:
//   GET                      → devolve { atualCSV, atualNome, atualData, anteriorCSV, anteriorNome, anteriorData, historico }
//   POST { csv, nome }       → importa (promove o "atual" existente pra "anterior" antes de gravar)
//   POST { admin }           → limpa data/historicoAbrangencia.json (sem token — qualquer chamada limpa)
//
// Usa a Git Data API (via lerArquivoGithubGrande/commitArquivoGrande) porque
// o CSV de Abrangência acumula histórico do ano inteiro e pode passar de
// ~1MB.
//
// Sem exigência de token pra ler/importar — mesmo nível de proteção das
// outras abas internas do dashboard.
//
// Variáveis de ambiente necessárias (já configuradas no Vercel para o Score):
//   GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH (opcional)
//
// ATENÇÃO: o Vercel limita o corpo de uma requisição de API Route a ~4.5MB.
// Se o CSV de Abrangência algum dia passar disso, o import falha antes mesmo
// de chegar aqui — nesse caso será preciso repensar o formato de envio
// (ex.: compressão no navegador antes do POST).

import {
  lerArquivoGithubGrande, commitArquivoGrande,
  lerArquivoGithub, commitArquivo,
  credenciaisGithub,
} from '../src/pages/score/lib/github.js';

const ARQUIVO_ATUAL = 'data/abrangenciaAtual.csv';
const ARQUIVO_ATUAL_META = 'data/abrangenciaAtualMeta.json';
const ARQUIVO_ANTERIOR = 'data/abrangenciaAnterior.csv';
const ARQUIVO_ANTERIOR_META = 'data/abrangenciaAnteriorMeta.json';
const ARQUIVO_HISTORICO = 'data/historicoAbrangencia.json';

async function handleGet(req, res) {
  const { token, owner, repo, branch } = credenciaisGithub();
  if (!token || !owner || !repo) {
    return res.status(500).json({ error: 'Configure GITHUB_TOKEN, GITHUB_OWNER e GITHUB_REPO no ambiente do Vercel.' });
  }

  let atualCSV = null;
  let atualNome = null;
  let atualData = null;
  let anteriorCSV = null;
  let anteriorNome = null;
  let anteriorData = null;
  try {
    atualCSV = await lerArquivoGithubGrande({ owner, repo, branch, token, caminho: ARQUIVO_ATUAL });
    const atualMetaTexto = await lerArquivoGithub({ owner, repo, branch, token, caminho: ARQUIVO_ATUAL_META });
    if (atualMetaTexto) {
      const meta = JSON.parse(atualMetaTexto);
      atualNome = meta.nome || null;
      atualData = meta.importadoEm || null;
    }

    anteriorCSV = await lerArquivoGithubGrande({ owner, repo, branch, token, caminho: ARQUIVO_ANTERIOR });
    const anteriorMetaTexto = await lerArquivoGithub({ owner, repo, branch, token, caminho: ARQUIVO_ANTERIOR_META });
    if (anteriorMetaTexto) {
      const meta = JSON.parse(anteriorMetaTexto);
      anteriorNome = meta.nome || null;
      anteriorData = meta.importadoEm || null;
    }
  } catch (e) {
    return res.status(500).json({ error: 'Erro ao ler a base de Abrangência no GitHub.', detail: String(e.message || e) });
  }

  let historico = [];
  try {
    const historicoTexto = await lerArquivoGithub({ owner, repo, branch, token, caminho: ARQUIVO_HISTORICO });
    if (historicoTexto) historico = JSON.parse(historicoTexto);
  } catch {
    // histórico corrompido não deve quebrar a leitura dos dados
  }

  return res.status(200).json({
    atualCSV, atualNome, atualData,
    anteriorCSV, anteriorNome, anteriorData,
    historico,
  });
}

async function handleImportar(req, res, csv, nome) {
  const { token, owner, repo, branch } = credenciaisGithub();
  if (!token || !owner || !repo) {
    return res.status(500).json({
      error: 'Configure GITHUB_TOKEN, GITHUB_OWNER e GITHUB_REPO no ambiente do Vercel.',
    });
  }

  try {
    // 1. Lê o "atual" existente (se houver) pra promover pra "anterior".
    const atualExistenteCSV = await lerArquivoGithubGrande({ owner, repo, branch, token, caminho: ARQUIVO_ATUAL });
    const atualExistenteMetaTexto = await lerArquivoGithub({ owner, repo, branch, token, caminho: ARQUIVO_ATUAL_META });

    if (atualExistenteCSV) {
      await commitArquivoGrande({ owner, repo, branch, token, caminho: ARQUIVO_ANTERIOR, conteudo: atualExistenteCSV });
      await commitArquivo({
        owner, repo, branch, token,
        caminho: ARQUIVO_ANTERIOR_META,
        conteudo: atualExistenteMetaTexto || JSON.stringify({ nome: 'planilha.csv', importadoEm: new Date().toISOString() }, null, 2),
      });
    }

    // 2. Grava o novo upload como "atual".
    await commitArquivoGrande({ owner, repo, branch, token, caminho: ARQUIVO_ATUAL, conteudo: csv });
    await commitArquivo({
      owner, repo, branch, token,
      caminho: ARQUIVO_ATUAL_META,
      conteudo: JSON.stringify({ nome: nome || 'planilha.csv', importadoEm: new Date().toISOString() }, null, 2),
    });

    try {
      const historicoAtual = await lerArquivoGithub({ owner, repo, branch, token, caminho: ARQUIVO_HISTORICO });
      const lista = historicoAtual ? JSON.parse(historicoAtual) : [];
      lista.push({ data: new Date().toISOString(), arquivo: nome || 'planilha.csv' });
      await commitArquivo({
        owner, repo, branch, token,
        caminho: ARQUIVO_HISTORICO,
        conteudo: JSON.stringify(lista, null, 2),
      });
    } catch (e) {
      console.warn('Não foi possível atualizar o histórico da Abrangência:', e);
    }

    return res.status(200).json({
      ok: true,
      mensagem: 'Planilha enviada. O dashboard atualiza em ~1 minuto (o Vercel faz um novo deploy sozinho).',
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
    if (typeof body.csv === 'string') return handleImportar(req, res, body.csv, body.nome);
    return res.status(400).json({ error: 'Requisição inválida — envie {csv,nome} para importar ou {admin} para limpar o histórico.' });
  }

  return res.status(405).json({ error: 'Método não suportado.' });
}
