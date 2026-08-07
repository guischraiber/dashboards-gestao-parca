// api/abrangencia.js
// Devolve as bases (atual + anterior) da Abrangência Parça, salvas no
// repositório (pasta /data), usadas pela aba Abrangência (AbrangenciaApp).
//
// Usa a Git Data API (via lerArquivoGithubGrande) porque o CSV de Abrangência
// acumula histórico do ano inteiro e pode passar de ~1MB.
//
// Sem exigência de token — mesmo nível de proteção das outras abas internas
// do dashboard (Weekly, SLA, CSAT, Score, Coleta x Recebimento).

import { lerArquivoGithubGrande, lerArquivoGithub, credenciaisGithub } from '../src/pages/score/lib/github.js';

const ARQUIVO_ATUAL = 'data/abrangenciaAtual.csv';
const ARQUIVO_ATUAL_META = 'data/abrangenciaAtualMeta.json';
const ARQUIVO_ANTERIOR = 'data/abrangenciaAnterior.csv';
const ARQUIVO_ANTERIOR_META = 'data/abrangenciaAnteriorMeta.json';
const ARQUIVO_HISTORICO = 'data/historicoAbrangencia.json';

export default async function handler(req, res) {
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
