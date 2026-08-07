// api/coletaRecebimento.js
// Endpoint único para a base "Faturamentos Analítico" (aba "Coleta x
// Recebimento", dentro do Performance Coleta / SlaApp).
//
// Consolidado num único arquivo (leitura + importar + limpar histórico) pra
// caber no limite de 12 Serverless Functions do plano Hobby do Vercel — antes
// eram 3 arquivos (coletaRecebimento.js, importarColetaRecebimento.js,
// limparHistoricoColetaRecebimento.js), agora é 1 só, roteado por método e
// pelo formato do corpo da requisição:
//   GET                      → devolve { csv, nome, historico }
//   POST { csv, nome }       → importa (mesmo padrão do Score)
//   POST { admin }           → limpa data/historicoColetaRecebimento.json (exige ADMIN_TOKEN)
//
// A leitura continua lendo direto do filesystem da função serverless (mesmo
// padrão de api/score.js) — os dados chegam ali porque o commit no GitHub
// dispara um redeploy, que reempacota a pasta /data.
//
// Variáveis de ambiente necessárias (já configuradas no Vercel para o Score):
//   GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH (opcional), ADMIN_TOKEN

import fs from 'fs';
import path from 'path';
import { commitArquivo, lerArquivoGithub, credenciaisGithub } from '../src/pages/score/lib/github.js';

const ARQUIVO_CSV = 'data/coletaRecebimento.csv';
const ARQUIVO_META = 'data/coletaRecebimentoMeta.json';
const ARQUIVO_HISTORICO = 'data/historicoColetaRecebimento.json';

function caminhoDados(nome) {
  return path.join(process.cwd(), 'data', nome);
}
function existeArquivo(nome) {
  return fs.existsSync(caminhoDados(nome));
}
function lerArquivoDados(nome) {
  return fs.readFileSync(caminhoDados(nome), 'utf8');
}

async function handleGet(req, res) {
  let csv = null;
  let nome = null;
  try {
    if (existeArquivo('coletaRecebimento.csv')) {
      csv = lerArquivoDados('coletaRecebimento.csv');
    }
    if (existeArquivo('coletaRecebimentoMeta.json')) {
      const meta = JSON.parse(lerArquivoDados('coletaRecebimentoMeta.json'));
      nome = meta.nome || null;
    }
  } catch (e) {
    return res.status(500).json({
      error: 'Erro ao ler os dados de Coleta x Recebimento.',
      detail: String(e.message || e),
    });
  }

  let historico = [];
  try {
    if (existeArquivo('historicoColetaRecebimento.json')) {
      historico = JSON.parse(lerArquivoDados('historicoColetaRecebimento.json'));
    }
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
    await commitArquivo({ owner, repo, branch, token, caminho: ARQUIVO_CSV, conteudo: csv });
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
      console.warn('Não foi possível atualizar o histórico de Coleta x Recebimento:', e);
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
