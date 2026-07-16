// api/importar.js
// Recebe o(s) CSV(s) enviados pela tela "Importar Dados" e os salva no
// repositório do GitHub (pasta /data), disparando um redeploy automático.
//
// Variáveis de ambiente necessárias (configurar no painel do Vercel):
//   GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH (opcional)
//   ADMIN_TOKEN

import { commitArquivo, lerArquivoGithub, credenciaisGithub } from '../src/pages/score/lib/github.js';

const ARQUIVOS = {
  modelo: 'data/modelo.csv',
  indicadores: 'data/indicadores.csv',
  faturamento: 'data/faturamento.csv',
  taxas: 'data/taxas.csv',
};

const HISTORICO_CAMINHO = 'data/historico.json';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST para importar.' });
  }

  const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
  const { admin, modeloCsv, indicadoresCsv, faturamentoCsv, taxasCsv, nomes } = req.body || {};

  if (!ADMIN_TOKEN || admin !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Token de acesso inválido.' });
  }

  const { token, owner, repo, branch } = credenciaisGithub();
  if (!token || !owner || !repo) {
    return res.status(500).json({
      error: 'Configure GITHUB_TOKEN, GITHUB_OWNER e GITHUB_REPO no ambiente do Vercel.',
    });
  }

  const paraSalvar = [];
  if (modeloCsv) paraSalvar.push({ tipo: 'modelo', caminho: ARQUIVOS.modelo, conteudo: modeloCsv });
  if (indicadoresCsv) paraSalvar.push({ tipo: 'indicadores', caminho: ARQUIVOS.indicadores, conteudo: indicadoresCsv });
  if (faturamentoCsv) paraSalvar.push({ tipo: 'faturamento', caminho: ARQUIVOS.faturamento, conteudo: faturamentoCsv });
  if (taxasCsv) paraSalvar.push({ tipo: 'taxas', caminho: ARQUIVOS.taxas, conteudo: taxasCsv });

  if (paraSalvar.length === 0) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  }

  try {
    for (const arq of paraSalvar) {
      await commitArquivo({ owner, repo, branch, token, caminho: arq.caminho, conteudo: arq.conteudo });
    }

    // Registra a importação no histórico (visível na aba "Importar Dados").
    try {
      const historicoAtual = await lerArquivoGithub({ owner, repo, branch, token, caminho: HISTORICO_CAMINHO });
      const lista = historicoAtual ? JSON.parse(historicoAtual) : [];
      lista.push({
        data: new Date().toISOString(),
        arquivos: paraSalvar.map((a) => (nomes && nomes[a.tipo]) || a.caminho.split('/').pop()),
      });
      await commitArquivo({
        owner, repo, branch, token,
        caminho: HISTORICO_CAMINHO,
        conteudo: JSON.stringify(lista, null, 2),
      });
    } catch (e) {
      // Falha ao registrar histórico não deve impedir a importação em si.
      console.warn('Não foi possível atualizar o histórico de importações:', e);
    }

    return res.status(200).json({
      ok: true,
      arquivosAtualizados: paraSalvar.length,
      mensagem: 'Dados enviados. O dashboard atualiza em ~1 minuto (o Vercel faz um novo deploy sozinho).',
    });
  } catch (e) {
    return res.status(502).json({ error: 'Erro ao salvar no GitHub.', detail: String(e.message || e) });
  }
}
