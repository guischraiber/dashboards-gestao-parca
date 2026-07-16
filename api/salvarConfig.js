// api/salvarConfig.js
// Recebe uma configuração nova (pesos, faixas de nota, faixas finais), valida,
// e salva em data/config.json no GitHub — disparando redeploy automático.

import { commitArquivo, credenciaisGithub } from '../src/pages/score/lib/github.js';

function validar(config) {
  const erros = [];

  const { pesos, faixasIndicador, faixasFinais } = config || {};

  if (!pesos || typeof pesos.sla !== 'number' || typeof pesos.agendamento !== 'number' || typeof pesos.csat !== 'number') {
    erros.push('Pesos inválidos ou incompletos.');
  } else {
    const soma = pesos.sla + pesos.agendamento + pesos.csat;
    if (Math.abs(soma - 1) > 0.005) {
      erros.push(`Os pesos precisam somar 100%. Hoje somam ${(soma * 100).toFixed(1)}%.`);
    }
    if (pesos.sla < 0 || pesos.agendamento < 0 || pesos.csat < 0) {
      erros.push('Pesos não podem ser negativos.');
    }
  }

  ['sla', 'agendamento', 'csat'].forEach((pilar) => {
    const faixas = faixasIndicador?.[pilar];
    if (!Array.isArray(faixas) || faixas.length !== 5) {
      erros.push(`Faixas de nota de ${pilar} precisam ter exatamente 5 linhas (notas 1 a 5).`);
      return;
    }
    faixas.forEach((f, i) => {
      if (typeof f.min !== 'number' || typeof f.max !== 'number' || f.min > f.max) {
        erros.push(`Faixa de nota ${f.nota ?? i + 1} de ${pilar} tem min/max inválido.`);
      }
    });
  });

  if (!Array.isArray(faixasFinais) || faixasFinais.length !== 5) {
    erros.push('Faixas finais precisam ter exatamente 5 linhas.');
  } else {
    faixasFinais.forEach((f, i) => {
      if (typeof f.min !== 'number' || typeof f.max !== 'number' || f.min > f.max) {
        erros.push(`Faixa final "${f.label || i + 1}" tem min/max inválido.`);
      }
      if (typeof f.ajustePP !== 'number') {
        erros.push(`Faixa final "${f.label || i + 1}" precisa de um ajuste de taxa numérico (pode ser 0).`);
      }
      if (!f.label) {
        erros.push(`Faixa final ${i + 1} precisa de um nome.`);
      }
    });
  }

  return erros;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST.' });
  }

  const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
  const { admin, config } = req.body || {};

  if (!ADMIN_TOKEN || admin !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Token de acesso inválido.' });
  }

  const erros = validar(config);
  if (erros.length > 0) {
    return res.status(400).json({ error: 'Configuração inválida.', erros });
  }

  const { token, owner, repo, branch } = credenciaisGithub();
  if (!token || !owner || !repo) {
    return res.status(500).json({ error: 'Configure GITHUB_TOKEN, GITHUB_OWNER e GITHUB_REPO no ambiente do Vercel.' });
  }

  try {
    await commitArquivo({
      owner, repo, branch, token,
      caminho: 'data/config.json',
      conteudo: JSON.stringify(config, null, 2),
    });
    return res.status(200).json({
      ok: true,
      mensagem: 'Regras salvas. O dashboard atualiza em ~1 minuto (o Vercel faz um novo deploy sozinho).',
    });
  } catch (e) {
    return res.status(502).json({ error: 'Erro ao salvar no GitHub.', detail: String(e.message || e) });
  }
}
