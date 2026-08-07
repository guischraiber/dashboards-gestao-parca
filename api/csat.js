// api/csat.js
// Devolve as duas bases (Respostas e Disparos) do CSAT Parça, salvas no
// repositório (pasta /data), usadas pela aba CSAT (CsatApp).
//
// Usa a Git Data API (via lerArquivoGithubGrande) porque a base de Respostas
// costuma vir com texto livre nos comentários e pode passar de ~1MB.
//
// Sem exigência de token — mesmo nível de proteção das outras abas internas
// do dashboard (Weekly, SLA, Abrangência, Score, Coleta x Recebimento).

import { lerArquivoGithubGrande, lerArquivoGithub, credenciaisGithub } from '../src/pages/score/lib/github.js';

const ARQUIVO_RESPOSTAS = 'data/csatRespostas.csv';
const ARQUIVO_DISPAROS = 'data/csatDisparos.csv';
const ARQUIVO_META = 'data/csatMeta.json';
const ARQUIVO_HISTORICO = 'data/historicoCsat.json';

export default async function handler(req, res) {
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
