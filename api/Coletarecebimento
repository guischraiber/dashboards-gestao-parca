// api/coletaRecebimento.js
// Devolve o CSV de "Faturamentos Analítico" salvo no repositório (pasta /data),
// usado pela aba "Coleta x Recebimento" do Performance Coleta (SlaApp).
//
// Segue exatamente o mesmo padrão de api/score.js: os dados são commitados no
// GitHub por api/importarColetaRecebimento.js e lidos aqui direto do
// filesystem da função serverless (atualizado a cada deploy do Vercel).
//
// Sem exigência de token — mesmo nível de proteção das outras abas internas
// do dashboard (Weekly, SLA, CSAT, Abrangência, Score).

import fs from 'fs';
import path from 'path';

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

  if (csv == null) {
    return res.status(200).json({ csv: null, nome: null, historico });
  }
  return res.status(200).json({ csv, nome, historico });
}
