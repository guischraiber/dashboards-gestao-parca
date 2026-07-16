// Converte as 3 planilhas "cruas" (Indicadores, Faturamento, Taxas) do Weekly Parça
// no formato mensal por parceiro que o motor de score (scoring.js) espera.
//
// Por que isso existe: as planilhas de origem já existem com outro propósito
// (o dashboard Weekly Parça) e têm formato largo/semanal. Em vez de pedir pro
// Guilherme manter uma 4ª planilha limpa à mão, o dashboard faz esse trabalho
// sozinho, direto das fontes que já existem.

import Papa from 'papaparse';

const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
export const ANO_CONSIDERADO = '2026'; // regra do Guilherme: considerar só os meses de 2026
export const MES_INICIO_PROGRAMA = '2026-01'; // o Score Parça Reversa passa a valer a partir daqui

function norm(s) {
  return String(s || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

// Remove sufixo entre parênteses para casar nomes que aparecem com/sem ele
// entre as diferentes planilhas (ex.: "E S L KOSLYK CO (Ebenezer)" vs "E S L KOSLYK CO")
function normCore(s) {
  return norm(String(s || '').replace(/\(.*?\)/g, ''));
}

// Gera um código estável a partir do nome do parceiro (mesma lógica usada tanto
// na importação avançada quanto no modelo simples, pra manter os links consistentes).
export function gerarCodigo(nome) {
  return normCore(nome).replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function paraNumeroPct(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (s === '' || s === '-' || s === '-%') return null;
  const n = parseFloat(s.replace('%', '').replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function paraBRL(v) {
  if (v == null) return 0;
  const s = String(v).replace('R$', '').trim().replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function paraPctSimples(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (s === '') return null;
  const n = parseFloat(s.replace('%', '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function parseCsv(text) {
  return Papa.parse(text, { header: false, skipEmptyLines: false }).data;
}

// --- Planilha 1: Indicadores (formato largo, semanal + mensal + trimestral) ---
// Extrai, por parceiro/mês, os % de SLA, Agendamento e CSAT usando o bloco
// mensal (JAN..DEZ) de 2026 já calculado na própria planilha — não recalcula
// a partir das semanas, e ignora outros anos (só 2026 entra no score).
export function parseIndicadores(csvText) {
  const rows = parseCsv(csvText);
  const h0 = rows[0] || [];
  const h1 = rows[1] || [];

  // Localiza o bloco "JAN..DEZ" de 2026
  let start = -1;
  for (let i = 0; i < h1.length; i++) {
    if (h1[i] === 'JAN' && h0[i] === ANO_CONSIDERADO) {
      start = i;
      break;
    }
  }

  // resultado[mesIndex 1-12][coreName] = { nome, sla, agendamento, csat }
  const resultado = {};
  for (let m = 1; m <= 12; m++) resultado[m] = {};
  if (start === -1) return resultado; // planilha não tem bloco de 2026

  function setValor(secao, nomeParceiro, valorPorColuna) {
    const core = normCore(nomeParceiro);
    for (let k = 0; k < 12; k++) {
      const val = paraNumeroPct(valorPorColuna[start + k]);
      if (val !== null) {
        const mesIdx = k + 1;
        if (!resultado[mesIdx][core]) resultado[mesIdx][core] = { nome: nomeParceiro.trim() };
        resultado[mesIdx][core][secao] = val;
      }
    }
  }

  // Linhas que não são parceiros de verdade, mesmo contendo "SLA"/"CSAT" no nome
  const NAO_PARCEIRO = /parça|cliente|meta|atingimento|realizado acumulado/i;

  let i = 0;
  while (i < rows.length) {
    const row = rows[i] || [];
    const ind = (row[1] || '').trim();

    // Regra do Guilherme: o indicador de SLA tem "SLA" em algum lugar do nome
    // (não necessariamente no início) — o restante da lógica não muda.
    if (/\bSLA\b/i.test(ind) && !ind.includes('Notas') && !NAO_PARCEIRO.test(ind)) {
      const partner = ind.replace(/\bSLA\b/i, '').trim();
      setValor('sla', partner, row);
    } else if (ind === '% coletas com agendamento sistêmico') {
      let j = i + 1;
      while (j < rows.length) {
        const r2 = rows[j] || [];
        const ind2 = (r2[1] || '').trim();
        if (!ind2 || ind2 === 'Aderência a data agendada') break;
        setValor('agendamento', ind2, r2);
        j++;
      }
      i = j - 1;
    } else if (ind.startsWith('CSAT ') && ind !== 'CSAT Parça (Share de Notas 4 - 5)') {
      setValor('csat', ind.slice(5), row);
    }
    i++;
  }

  return resultado; // { 1: {CORE: {nome, sla, agendamento, csat}}, ..., 12: {...} }
}

// --- Planilhas 2 e 3: Faturamento e Taxas (formato largo: parceiro x mês) ---
// headerRowLabel: 'Faturamento' ou 'Taxa'
export function parseTabelaLarga(csvText, headerRowLabel, valueParser) {
  const rows = parseCsv(csvText);
  let headerIdx = rows.findIndex((r) => (r[0] || '').trim() === headerRowLabel);
  if (headerIdx === -1) return {};
  const meses = rows[headerIdx].slice(1).map((m) => (m || '').trim().toUpperCase());

  const resultado = {}; // { CORE: { nome, valores: { JAN: x, FEV: y, ... } } }
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const nome = (row[0] || '').trim();
    if (!nome) continue;
    const core = normCore(nome);
    const valores = {};
    meses.forEach((mes, idx) => {
      if (mes) valores[mes] = valueParser(row[idx + 1]);
    });
    resultado[core] = { nome, valores };
  }
  return resultado;
}

export function parseFaturamento(csvText) {
  return parseTabelaLarga(csvText, 'Faturamento', paraBRL);
}

export function parseTaxas(csvText) {
  return parseTabelaLarga(csvText, 'Taxa', paraPctSimples);
}

// Dado um mês-alvo (ex. 'JUN') e a tabela de taxas de um parceiro, usa a taxa
// daquele mês se existir; senão, usa a coluna mais recente disponível (carry-forward),
// já que a taxa contratada normalmente não muda todo mês.
function taxaParaMes(valoresTaxa, mesAbrev, todosMesesEmOrdem) {
  if (valoresTaxa[mesAbrev] != null) return valoresTaxa[mesAbrev];
  const idxAlvo = todosMesesEmOrdem.indexOf(mesAbrev);
  for (let i = idxAlvo - 1; i >= 0; i--) {
    const m = todosMesesEmOrdem[i];
    if (valoresTaxa[m] != null) return valoresTaxa[m];
  }
  // fallback: qualquer valor disponível, mesmo que "futuro" em relação ao mês alvo
  const disponiveis = todosMesesEmOrdem.filter((m) => valoresTaxa[m] != null);
  return disponiveis.length ? valoresTaxa[disponiveis[0]] : null;
}

function mesParaCiclo(mesIdx) {
  const trimestre = Math.floor((mesIdx - 1) / 3) + 1;
  return `${ANO_CONSIDERADO}-T${trimestre}`;
}

// Igual a mesParaCiclo, mas a partir de uma chave "AAAA-MM" completa (usado pelo
// modelo único de importação, onde o ano vem preenchido pelo usuário).
export function cicloDoMesChave(mesChave) {
  const ano = mesChave.slice(0, 4);
  const mesIdx = parseInt(mesChave.slice(5, 7), 10);
  const trimestre = Math.floor((mesIdx - 1) / 3) + 1;
  return `${ano}-T${trimestre}`;
}

// Junta as 3 fontes e produz as linhas mensais no formato que scoring.js espera:
// { Codigo, Parceiro, Ciclo, Mes, Faturamento_mes, SLA_pct, Agendamento_pct, CSAT_pct, Elegivel, Taxa_Base_pct }
//
// Regras:
// - Só considera meses (ignora semanas/trimestres da planilha de origem).
// - Só considera 2026. Faturamento/Taxas não têm coluna de ano, então os meses
//   deles são sempre tratados como 2026.
// - O programa só vale a partir de MES_INICIO_PROGRAMA (jan/2026) — qualquer
//   mês anterior é ignorado, mesmo que exista dado para ele.
// - Só gera uma linha para parceiro+mês quando SLA, Agendamento, CSAT e a taxa
//   base estiverem TODOS presentes. Meses com dado faltando são pulados
//   (não fabricamos dado) e reportados em `avisos`.
export function combinarFontes({ indicadoresCsv, faturamentoCsv, taxasCsv }) {
  const indicadores = parseIndicadores(indicadoresCsv); // { 1: {CORE: {...}}, ..., 12: {...} }
  const faturamento = parseFaturamento(faturamentoCsv);
  const taxas = parseTaxas(taxasCsv);

  const mesesOrdem = MESES; // ordem fixa para o carry-forward de taxa
  const linhas = [];
  const avisos = [];

  // Parceiro "oficial" = quem aparece na planilha de Faturamento (é quem é cobrado)
  Object.entries(faturamento).forEach(([core, dadosFat]) => {
    const nomeParceiro = dadosFat.nome;
    const codigo = gerarCodigo(nomeParceiro);

    Object.entries(dadosFat.valores).forEach(([mesAbrev, faturamentoMes]) => {
      const mesIdx = mesesOrdem.indexOf(mesAbrev) + 1;
      if (mesIdx === 0) return;

      const mesChave = `${ANO_CONSIDERADO}-${String(mesIdx).padStart(2, '0')}`;
      if (mesChave < MES_INICIO_PROGRAMA) {
        return; // antes do início do programa (jan/2026) — nem entra como aviso, é esperado
      }

      const dadosIndicador = indicadores[mesIdx]?.[core];
      if (!dadosIndicador || dadosIndicador.sla == null || dadosIndicador.agendamento == null || dadosIndicador.csat == null) {
        avisos.push(`${nomeParceiro} — ${mesAbrev}/${ANO_CONSIDERADO}: indicador incompleto (SLA/Agendamento/CSAT), mês não incluído.`);
        return;
      }

      const taxaBase = taxaParaMes(taxas[core]?.valores || {}, mesAbrev, mesesOrdem);
      if (taxaBase == null) {
        avisos.push(`${nomeParceiro} — ${mesAbrev}/${ANO_CONSIDERADO}: sem taxa base cadastrada, mês não incluído.`);
        return;
      }

      linhas.push({
        Codigo: codigo,
        Parceiro: nomeParceiro,
        Ciclo: mesParaCiclo(mesIdx),
        Mes: mesChave,
        Faturamento_mes: faturamentoMes,
        SLA_pct: dadosIndicador.sla,
        Agendamento_pct: dadosIndicador.agendamento,
        CSAT_pct: dadosIndicador.csat,
        Elegivel: 'SIM', // sem fonte de "meses de operação"/"qtd coletas" ainda — ver README
        Taxa_Base_pct: taxaBase,
      });
    });
  });

  return { linhas, avisos };
}
