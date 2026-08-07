// api/limparHistoricoColetaRecebimento.js
// Zera data/historicoColetaRecebimento.json (histórico de importações da aba
// Coleta x Recebimento). Não mexe nos dados em si (coletaRecebimento.csv).
// Mesmo padrão de api/limparHistoricoImportacao.js (Score) — exige ADMIN_TOKEN
// por ser uma operação destrutiva.

import { commitArquivo, credenciaisGithub } from '../src/pages/score/lib/github.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST.' });
  }

  const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
  const { admin } = req.body || {};

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
      caminho: 'data/historicoColetaRecebimento.json',
      conteudo: JSON.stringify([], null, 2),
    });
    return res.status(200).json({ ok: true, mensagem: 'Histórico de importações limpo.' });
  } catch (e) {
    return res.status(502).json({ error: 'Erro ao limpar no GitHub.', detail: String(e.message || e) });
  }
}
