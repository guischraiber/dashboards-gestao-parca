// Lê o "modelo único" de importação (uma linha por parceiro por mês, preenchido
// diretamente pelo time) e produz as linhas no formato que agruparEProcessar espera.
// Bem mais simples que converterFontes.js porque não precisa casar nomes entre
// 3 planilhas diferentes — é um único arquivo já no formato certo.

import Papa from 'papaparse';
import { gerarCodigo, cicloDoMesChave, ANO_CONSIDERADO, MES_INICIO_PROGRAMA } from './converterFontes.js';

function paraNumero(v) {
  if (v == null) return null;
  let s = String(v).trim();
  if (s === '') return null;
  s = s.replace(/[^0-9,.\-]/g, ''); // tira %, espaços e outros caracteres, mantém dígitos/,/./-
  if (s === '') return null;

  const ultimaVirgula = s.lastIndexOf(',');
  const ultimoPonto = s.lastIndexOf('.');

  if (ultimaVirgula > -1 && ultimoPonto > -1) {
    // Os dois aparecem: o que estiver mais à direita é o separador decimal de verdade
    if (ultimaVirgula > ultimoPonto) {
      s = s.replace(/\./g, '').replace(',', '.'); // formato BR: 15.000,00
    } else {
      s = s.replace(/,/g, ''); // formato US: 15,000.00
    }
  } else if (ultimaVirgula > -1) {
    s = s.replace(',', '.'); // só vírgula: assume decimal BR (92,5)
  }

  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

export function parseModeloUnico(csvTexto) {
  const linhasCsv = Papa.parse(csvTexto, { header: true, skipEmptyLines: true }).data;
  const linhas = [];
  const avisos = [];

  linhasCsv.forEach((row) => {
    const parceiro = String(row.Parceiro || '').trim();
    const mes = String(row.Mes || '').trim();
    if (!parceiro || !mes) return; // linha em branco, ignora silenciosamente

    if (!mes.startsWith(ANO_CONSIDERADO) || mes < MES_INICIO_PROGRAMA) {
      return; // fora do escopo do programa (mesma regra do fluxo avançado)
    }

    // Aceita o nome novo da coluna ("Faturamento Reversa") e o antigo
    // ("Faturamento_mes"), pra não quebrar planilhas já preenchidas antes da mudança.
    // Reversa: aceita o nome novo, o nome anterior com espaço, e o mais antigo ainda.
    const faturamentoReversa = paraNumero(row['Faturamento Reversa'] ?? row.Faturamento_Reversa ?? row.Faturamento_mes);
    const taxaReversa = paraNumero(row['Taxa Reversa'] ?? row.Taxa_Reversa_pct ?? row.Taxa_Base_pct);

    // Devolução é opcional — nem todo parceiro atua nos 2 tipos de processo.
    // Se a célula estiver em branco, o tipo simplesmente não entra no
    // relatório de impacto financeiro desse parceiro.
    const faturamentoDevolucao = paraNumero(row['Faturamento Devolução'] ?? row.Faturamento_Devolucao);
    const taxaDevolucao = paraNumero(row['Taxa Devolução'] ?? row.Taxa_Devolucao_pct);

    const sla = paraNumero(row.SLA_pct);
    const agendamento = paraNumero(row.Agendamento_pct);
    const csat = paraNumero(row.CSAT_pct);

    // Reversa continua obrigatória pra o mês entrar no cálculo — mas a
    // ponderação do score entre os meses do ciclo usa Reversa + Devolução
    // combinadas. Devolução em si não entra nessa checagem de obrigatoriedade.
    if (faturamentoReversa == null || sla == null || agendamento == null || csat == null || taxaReversa == null) {
      avisos.push(`${parceiro} — ${mes}: preenchimento incompleto na planilha, mês não incluído.`);
      return;
    }

    linhas.push({
      Codigo: gerarCodigo(parceiro),
      Parceiro: parceiro,
      Ciclo: cicloDoMesChave(mes),
      Mes: mes,
      Faturamento_Reversa: faturamentoReversa,
      Taxa_Reversa_pct: taxaReversa,
      Faturamento_Devolucao: faturamentoDevolucao,
      Taxa_Devolucao_pct: taxaDevolucao,
      SLA_pct: sla,
      Agendamento_pct: agendamento,
      CSAT_pct: csat,
      Elegivel: String(row.Elegivel || 'SIM').trim().toUpperCase() === 'SIM' ? 'SIM' : 'NAO',
    });
  });

  return { linhas, avisos };
}
