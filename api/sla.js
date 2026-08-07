// api/sla.js
// Endpoint único para o CSV bruto principal do SLA/Performance Coleta —
// alimenta Semana, Mês/Trimestre/Ano, Cidades, Problemas, Atrasos e
// Relatórios, todas a partir do mesmo CSV.
//
// Consolidado num único arquivo (leitura + importar + limpar histórico) pra
// caber no limite de 12 Serverless Functions do plano Hobby do Vercel — antes
// eram 3 arquivos (sla.js, importarSla.js, limparHistoricoSla.js), agora é 1
// só, roteado por método e pelo formato do corpo da requisição:
//   GET                      → devolve { csv, nome, historico }
//   POST { csv, nome }       → importa
//   POST { admin }           → limpa data/historicoSla.json (exige ADMIN_TOKEN)
//
// Usa a Git Data API (lerArquivoGithubGrande/commitArquivoGrande) em vez da
// Contents API simples, porque esse CSV acumula histórico e pode passar de
// ~1MB.
//
// Sem exigência de token pra ler/importar — mesmo nível de proteção das
// outras abas internas do dashboard.
//
// Variáveis de ambiente necessárias (já configuradas no Vercel para o Score):
//   GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH (opcional), ADMIN_TOKEN
//
// ATENÇÃO: o Vercel limita o corpo de uma requisição de API Route a ~4.5MB.
// Se o CSV bruto do SLA algum dia passar disso, o import falha antes mesmo
// de chegar aqui — nesse caso será preciso repensar o formato de envio
// (ex.: compressão no navegador antes do POST).

import {
  lerArquivoGithubGrande, commitArquivoGrande,
  lerArquivoGithub, commitArquivo,
  credenciaisGithub,
} from '../src/pages/score/lib/github.js';

const ARQUIVO_CSV = 'data/slaBruto.csv';
const ARQUIVO_META = 'data/slaBrutoMeta.json';
const ARQUIVO_HISTORICO = 'data/historicoSla.json';

async function handleGet(req, res) {
  const { token, owner, repo, branch } = credenciaisGithub();
  if (!token || !owner || !repo) {
    return res.status(500).json({ error: 'Configure GITHUB_TOKEN, GITHUB_OWNER e GITHUB_REPO no ambiente do Vercel.' });
  }

  let csv = null;
  let nome = null;
  try {
    csv = await lerArquivoGithubGrande({ owner, repo, branch, token, caminho: ARQUIVO_CSV });
    const metaTexto = await lerArquivoGithub({ owner, repo, branch, token, caminho: ARQUIVO_META });
    if (metaTexto) {
      const meta = JSON.parse(metaTexto);
      nome = meta.nome || null;
    }
  } catch (e) {
    return res.status(500).json({
      error: 'Erro ao ler o CSV do SLA no GitHub.',
      detail: String(e.message || e),
    });
  }

  let historico = [];
  try {
    const historicoTexto = await lerArquivoGithub({ owner, repo, branch, token, caminho: ARQUIVO_HISTORICO });
    if (historicoTexto) historico = JSON.parse(historicoTexto);
  } catch {
    // histórico corrompido não deve quebrar a leitura dos dados
  }

  if (csv == null) return res.status(200).json({ csv: null, nome: null, historico });
  return res.status(200).json({ csv, nome, historico });
}

async function handleImportar(req, res, csv, nome) {
  const { token, owner, repo, branch } = credenciaisGithub();
  if (!token || !owner || !repo) {
    return res.status(500).json({
      error: 'Configure GITHUB_TOKEN, GITHUB_OWNER e GITHUB_REPO no ambiente do Vercel.',
    });
  }

  try {
    await commitArquivoGrande({ owner, repo, branch, token, caminho: ARQUIVO_CSV, conteudo: csv });
    await commitArquivo({
      owner, repo, branch, token,
      caminho: ARQUIVO_META,
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
      console.warn('Não foi possível atualizar o histórico do SLA:', e);
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
  const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
  if (!ADMIN_TOKEN || admin !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Token de acesso inválido.' });
  }

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
