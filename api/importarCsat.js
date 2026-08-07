// api/importarCsat.js
// Recebe as duas bases do CSAT Parça (Respostas e Disparos) e salva no
// repositório do GitHub (pasta /data), disparando um redeploy automático —
// mesmo mecanismo de api/importar.js (Score) e api/importarSla.js, usando a
// Git Data API (commitArquivoGrande) porque a base de Respostas pode passar
// do limite de ~1MB da Contents API simples.
//
// Isso substitui a persistência anterior (IndexedDB local, por navegador):
// depois desta mudança, um import feito por qualquer pessoa passa a valer
// para todo mundo que acessa o dashboard, em ~1 minuto (tempo do redeploy do
// Vercel) — sem precisar que cada colaborador reimporte as mesmas planilhas.
//
// Variáveis de ambiente necessárias (já configuradas no Vercel para o Score):
//   GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH (opcional)

import { commitArquivoGrande, commitArquivo, lerArquivoGithub, credenciaisGithub } from '../src/pages/score/lib/github.js';

const ARQUIVO_RESPOSTAS = 'data/csatRespostas.csv';
const ARQUIVO_DISPAROS = 'data/csatDisparos.csv';
const ARQUIVO_META = 'data/csatMeta.json';
const ARQUIVO_HISTORICO = 'data/historicoCsat.json';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST para importar.' });
  }

  const { respostas, disparos, nomeRespostas, nomeDisparos } = req.body || {};

  if (!respostas || typeof respostas !== 'string' || !disparos || typeof disparos !== 'string') {
    return res.status(400).json({ error: 'Envie as duas bases (respostas e disparos).' });
  }

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

    // Registra a importação no histórico (mesmo padrão do Score / SLA / Coleta x Recebimento).
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
