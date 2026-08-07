// api/sla.js
// Devolve o CSV bruto principal do SLA/Performance Coleta, salvo no
// repositório (pasta /data), usado pela aba Performance Coleta (SlaApp) —
// alimenta Semana, Mês/Trimestre/Ano, Cidades, Problemas, Atrasos e
// Relatórios, todas a partir do mesmo CSV.
//
// Usa a Git Data API (via lerArquivoGithubGrande) em vez da Contents API
// simples, porque esse CSV acumula histórico e pode passar de ~1MB.
//
// Sem exigência de token — mesmo nível de proteção das outras abas internas
// do dashboard (Weekly, CSAT, Abrangência, Score, Coleta x Recebimento).

import { lerArquivoGithubGrande, lerArquivoGithub, credenciaisGithub } from '../src/pages/score/lib/github.js';

const ARQUIVO_CSV = 'data/slaBruto.csv';
const ARQUIVO_META = 'data/slaBrutoMeta.json';
const ARQUIVO_HISTORICO = 'data/historicoSla.json';

export default async function handler(req, res) {
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
