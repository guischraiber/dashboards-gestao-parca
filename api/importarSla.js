// api/importarSla.js
// Recebe o CSV bruto principal do SLA/Performance Coleta e salva no
// repositório do GitHub (pasta /data), disparando um redeploy automático —
// mesmo mecanismo de api/importar.js (Score) e api/importarColetaRecebimento.js,
// mas usando a Git Data API (commitArquivoGrande) porque esse CSV acumula
// histórico e pode passar do limite de ~1MB da Contents API simples.
//
// Isso substitui a persistência anterior (IndexedDB local, por navegador):
// depois desta mudança, um import feito por qualquer pessoa passa a valer
// para todo mundo que acessa o dashboard, em ~1 minuto (tempo do redeploy do
// Vercel) — sem precisar que cada colaborador reimporte a mesma planilha.
// Vale para Semana, Mês/Trimestre/Ano e as abas de detalhe (Cidades,
// Problemas, Atrasos, Relatórios), já que todas partem deste mesmo CSV.
//
// Variáveis de ambiente necessárias (já configuradas no Vercel para o Score):
//   GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH (opcional)
//
// ATENÇÃO: o Vercel limita o corpo de uma requisição de API Route a ~4.5MB.
// Se o CSV bruto do SLA algum dia passar disso, o import falha antes mesmo
// de chegar aqui — nesse caso será preciso repensar o formato de envio
// (ex.: compressão no navegador antes do POST).

import { commitArquivoGrande, commitArquivo, lerArquivoGithub, credenciaisGithub } from '../src/pages/score/lib/github.js';

const ARQUIVO_CSV = 'data/slaBruto.csv';
const ARQUIVO_META = 'data/slaBrutoMeta.json';
const ARQUIVO_HISTORICO = 'data/historicoSla.json';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST para importar.' });
  }

  const { csv, nome } = req.body || {};

  if (!csv || typeof csv !== 'string') {
    return res.status(400).json({ error: 'Nenhum arquivo CSV enviado.' });
  }

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

    // Registra a importação no histórico (mesmo padrão do Score / Coleta x Recebimento).
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
      // Falha ao registrar histórico não deve impedir a importação em si.
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
