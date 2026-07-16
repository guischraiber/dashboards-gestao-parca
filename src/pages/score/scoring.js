// Motor de cálculo do Score Parça Reversa.
// Pesos, faixas de nota e faixas finais (penalidade/benefício) são CONFIGURÁVEIS
// — vêm de um objeto `config` (ver DEFAULT_CONFIG abaixo), carregado de
// data/config.json quando existe. Este arquivo só define o comportamento padrão
// e a lógica de cálculo; não é mais o lugar onde a régua "mora" fixa.

export const DEFAULT_CONFIG = {
  pesos: { sla: 0.5, agendamento: 0.2, csat: 0.3 },
  faixasIndicador: {
    sla: [
      { nota: 1, min: 0, max: 79.99 },
      { nota: 2, min: 80, max: 84.99 },
      { nota: 3, min: 85, max: 89.99 },
      { nota: 4, min: 90, max: 94.99 },
      { nota: 5, min: 95, max: 100 },
    ],
    agendamento: [
      { nota: 1, min: 0, max: 89.99 },
      { nota: 2, min: 90, max: 92.99 },
      { nota: 3, min: 93, max: 94.99 },
      { nota: 4, min: 95, max: 97.99 },
      { nota: 5, min: 98, max: 100 },
    ],
    csat: [
      { nota: 1, min: 0, max: 79.99 },
      { nota: 2, min: 80, max: 84.99 },
      { nota: 3, min: 85, max: 89.99 },
      { nota: 4, min: 90, max: 94.99 },
      { nota: 5, min: 95, max: 100 },
    ],
  },
  faixasFinais: [
    {
      min: 0, max: 1.49, label: 'Crítico', cor: 'vermelho', ajustePP: 2.0, tipo: 'penalidade',
      descricao: 'Falhas graves de operação. Além do acréscimo na taxa, há risco de perda de direito de coleta em CDs, terceiras e categorias/regiões específicas.',
    },
    {
      min: 1.5, max: 2.99, label: 'Insatisfatório', cor: 'vermelho', ajustePP: 1.5, tipo: 'penalidade',
      descricao: 'Indicadores abaixo do esperado. Acréscimo na taxa de todas as operações, além de reciclagem obrigatória.',
    },
    {
      min: 3.0, max: 3.99, label: 'Ponto de Atenção', cor: 'amarelo', ajustePP: 0, tipo: 'neutro',
      descricao: 'Instabilidade em um ou mais indicadores. Sem penalidade ou benefício, mas reciclagem com o time de gestão é recomendada.',
    },
    {
      min: 4.0, max: 4.49, label: 'Satisfatório', cor: 'verde', ajustePP: -1.5, tipo: 'beneficio',
      descricao: 'Boa performance, com pequenos ajustes para chegar à excelência. Desconto na taxa.',
    },
    {
      min: 4.5, max: 5.0, label: 'Excelência', cor: 'verde', ajustePP: -2.0, tipo: 'beneficio',
      descricao: 'Alta performance consistente. Desconto na taxa em todas as operações no próximo trimestre.',
    },
  ],
};

// Dicas de melhoria por pilar (extraídas da seção 9.1 do documento oficial) —
// texto fixo, não faz sentido virar configurável pela tela.
export const DICAS_MELHORIA = {
  sla: [
    'Monitorar o SLA diariamente: acompanhar pendências, atrasos e pedidos críticos para agir preventivamente.',
    'Organizar rotinas internas de roteirização, priorizando coletas mais antigas para evitar atrasos.',
    'Registrar todas as ocorrências no sistema (Eagle) para evitar divergências na apuração.',
  ],
  agendamento: [
    'Reforçar a aderência aos agendamentos: contato com o cliente dentro do prazo e alinhamento prévio.',
    'Padronizar o atendimento entre motoristas, focais e ajudantes para manter consistência.',
    'Acompanhar os relatórios semanais enviados pela Madeira para agir antes de o indicador cair.',
  ],
  csat: [
    'Aprimorar a comunicação com o cliente sobre horários, ocorrências e eventuais problemas.',
    'Treinar a equipe (novos colaboradores) sobre contato com o cliente e boas práticas.',
    'Garantir que o produto seja retirado dentro do combinado, sem surpresas para o cliente.',
  ],
};

function paraNumero(v) {
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

// Dado um valor e uma lista de faixas {nota, min, max}, acha a nota correspondente.
// Se o valor não cair em nenhuma faixa (ex.: configuração com buraco), usa a
// nota mais baixa disponível como fallback seguro.
function notaPorFaixa(valor, faixas) {
  const faixasOrdenadas = [...faixas].sort((a, b) => b.min - a.min);
  const encontrada = faixasOrdenadas.find((f) => valor >= f.min);
  if (encontrada) return encontrada.nota;
  return Math.min(...faixas.map((f) => f.nota));
}

export function notaSLA(pct, config = DEFAULT_CONFIG) {
  return notaPorFaixa(pct, config.faixasIndicador.sla);
}

export function notaAgendamento(pct, config = DEFAULT_CONFIG) {
  return notaPorFaixa(pct, config.faixasIndicador.agendamento);
}

export function notaCSAT(pct, config = DEFAULT_CONFIG) {
  return notaPorFaixa(pct, config.faixasIndicador.csat);
}

export function scoreFinal(nSla, nAgendamento, nCsat, config = DEFAULT_CONFIG) {
  const { pesos } = config;
  const soma = nSla * pesos.sla + nAgendamento * pesos.agendamento + nCsat * pesos.csat;
  return Math.round(soma * 100) / 100;
}

export function faixaDoScore(score, config = DEFAULT_CONFIG) {
  const faixa = config.faixasFinais.find((f) => score >= f.min && score <= f.max)
    // fallback: se por algum motivo não cair em nenhuma faixa (config mal configurada),
    // usa a mais próxima por segurança em vez de quebrar o cálculo.
    || (score > config.faixasFinais[config.faixasFinais.length - 1].max
      ? config.faixasFinais[config.faixasFinais.length - 1]
      : config.faixasFinais[0]);

  const sinal = faixa.ajustePP > 0 ? '+' : '';
  return {
    ...faixa,
    consequencia: faixa.ajustePP === 0 ? 'Sem alteração na taxa' : `${sinal}${faixa.ajustePP.toFixed(2)}% na taxa`,
  };
}

// Calcula o impacto prático da faixa na taxa cobrada do parceiro e na receita estimada.
export function calcularImpactoTaxa(taxaBasePct, faixa, faturamentoProjetado) {
  const taxaBase = paraNumero(taxaBasePct);
  const taxaNova = Math.max(0, Math.round((taxaBase + faixa.ajustePP) * 100) / 100);
  const receitaAtual = faturamentoProjetado * (taxaBase / 100);
  const receitaNova = faturamentoProjetado * (taxaNova / 100);
  return {
    taxaBase,
    taxaNova,
    ajustePP: faixa.ajustePP,
    faturamentoProjetado,
    receitaAtual,
    receitaNova,
    impactoReceita: receitaNova - receitaAtual,
  };
}

// Processa UM mês: calcula nota de cada pilar e o score do mês.
export function processarMes(row, config = DEFAULT_CONFIG) {
  const sla = paraNumero(row.SLA_pct);
  const agendamento = paraNumero(row.Agendamento_pct);
  const csat = paraNumero(row.CSAT_pct);
  const nSla = notaSLA(sla, config);
  const nAgendamento = notaAgendamento(agendamento, config);
  const nCsat = notaCSAT(csat, config);
  const score = scoreFinal(nSla, nAgendamento, nCsat, config);
  return {
    mes: row.Mes,
    faturamento: paraNumero(row.Faturamento_mes),
    sla, agendamento, csat,
    nSla, nAgendamento, nCsat,
    score,
  };
}

// Agrega as linhas mensais de um mesmo parceiro+ciclo (trimestre):
// 1. Cada mês já tem seu score final calculado normalmente (nota × peso do pilar).
// 2. O score do TRIMESTRE é a média dos 3 scores mensais, ponderada pelo faturamento do mês.
export function agregarCiclo(linhasMensais, config = DEFAULT_CONFIG) {
  const meses = linhasMensais.map((r) => processarMes(r, config)).sort((a, b) => (a.mes > b.mes ? 1 : -1));
  const totalFat = meses.reduce((s, m) => s + m.faturamento, 0);

  function mediaPonderada(campo) {
    if (totalFat <= 0) {
      return meses.reduce((s, m) => s + m[campo], 0) / meses.length;
    }
    return meses.reduce((s, m) => s + m[campo] * m.faturamento, 0) / totalFat;
  }

  const score = Math.round(mediaPonderada('score') * 100) / 100;
  const faixa = faixaDoScore(score, config);

  const taxaBasePct = paraNumero(linhasMensais[0].Taxa_Base_pct);
  const impactoTaxa = calcularImpactoTaxa(taxaBasePct, faixa, totalFat);

  const nSlaRef = mediaPonderada('nSla');
  const nAgendamentoRef = mediaPonderada('nAgendamento');
  const nCsatRef = mediaPonderada('nCsat');

  const pilares = [
    { chave: 'sla', nota: nSlaRef },
    { chave: 'agendamento', nota: nAgendamentoRef },
    { chave: 'csat', nota: nCsatRef },
  ].sort((a, b) => a.nota - b.nota);

  return {
    codigo: linhasMensais[0].Codigo,
    parceiro: linhasMensais[0].Parceiro,
    ciclo: linhasMensais[0].Ciclo,
    elegivel: String(linhasMensais[0].Elegivel || '').trim().toUpperCase() === 'SIM',
    score,
    faixa,
    sla: mediaPonderada('sla'),
    agendamento: mediaPonderada('agendamento'),
    csat: mediaPonderada('csat'),
    nSla: nSlaRef,
    nAgendamento: nAgendamentoRef,
    nCsat: nCsatRef,
    pilarMaisFraco: pilares[0].chave,
    detalheMensal: meses,
    faturamentoTotalCiclo: totalFat,
    impactoTaxa,
  };
}

// Agrupa linhas mensais cruas (vindas do CSV) por Codigo+Ciclo e processa cada trimestre.
export function agruparEProcessar(linhasCruas, config = DEFAULT_CONFIG) {
  const grupos = {};
  linhasCruas.forEach((r) => {
    const chave = `${r.Codigo}__${r.Ciclo}`;
    if (!grupos[chave]) grupos[chave] = [];
    grupos[chave].push(r);
  });
  return Object.values(grupos).map((linhasDoCiclo) => agregarCiclo(linhasDoCiclo, config));
}
