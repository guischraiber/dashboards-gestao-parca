// api/score.js
// Função serverless (Vercel). Lê os dados salvos em /data (commitados pelo
// próprio dashboard via api/importar.js). A planilha completa NUNCA é enviada
// ao navegador do parceiro — só a(s) linha(s) que ele pode ver.
//
// Prioriza o "modelo único" (data/modelo.csv) se existir; senão cai no fluxo
// avançado de 3 planilhas (data/indicadores.csv, faturamento.csv, taxas.csv).
//
// Variável de ambiente necessária (configurar no painel do Vercel):
//   ADMIN_TOKEN -> senha simples para a visão interna (?admin=SENHA)

import fs from 'fs';
import path from 'path';
import { combinarFontes } from '../src/pages/score/lib/converterFontes.js';
import { parseModeloUnico } from '../src/pages/score/lib/parseModeloUnico.js';

function caminhoDados(nome) {
  return path.join(process.cwd(), 'data', nome);
}

function existeArquivo(nome) {
  return fs.existsSync(caminhoDados(nome));
}

function lerArquivoDados(nome) {
  return fs.readFileSync(caminhoDados(nome), 'utf8');
}

export default async function handler(req, res) {
  const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

  let linhas, avisos;
  try {
    if (existeArquivo('modelo.csv')) {
      ({ linhas, avisos } = parseModeloUnico(lerArquivoDados('modelo.csv')));
    } else {
      const indicadoresCsv = lerArquivoDados('indicadores.csv');
      const faturamentoCsv = lerArquivoDados('faturamento.csv');
      const taxasCsv = lerArquivoDados('taxas.csv');
      ({ linhas, avisos } = combinarFontes({ indicadoresCsv, faturamentoCsv, taxasCsv }));
    }
  } catch (e) {
    return res.status(500).json({
      error: 'Nenhum dado importado ainda. Use a aba "Importar Dados" na visão interna para enviar a planilha.',
      detail: String(e.message || e),
    });
  }

  const { codigo, admin } = req.query;

  // --- Rota do parceiro: retorna só as linhas daquele código (histórico dele) ---
  if (codigo) {
    const filtradas = linhas.filter(
      (row) => String(row.Codigo || '').trim().toLowerCase() === String(codigo).trim().toLowerCase()
    );
    if (filtradas.length === 0) {
      return res.status(404).json({ error: 'Código de parceiro não encontrado.' });
    }
    return res.status(200).json({ rows: filtradas });
  }

  // --- Rota interna (admin): retorna tudo, protegida por token simples ---
  if (admin) {
    if (!ADMIN_TOKEN || admin !== ADMIN_TOKEN) {
      return res.status(401).json({ error: 'Token de acesso inválido.' });
    }
    let historico = [];
    try {
      if (existeArquivo('historico.json')) {
        historico = JSON.parse(lerArquivoDados('historico.json'));
      }
    } catch {
      // se o histórico estiver corrompido, apenas não mostra, sem quebrar o resto
    }
    return res.status(200).json({ rows: linhas, avisos, historico });
  }

  return res.status(400).json({ error: 'Informe ?codigo=XXX (parceiro) ou ?admin=TOKEN (interno).' });
}
