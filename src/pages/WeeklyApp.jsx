import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Papa from "papaparse";
import { sincronizarAntesDeLer, publicarApósImportar, limparTudoLocalERemoto } from "../syncRemoto";
import { parseCSV, parseCsvColetaRecebimento } from "./SlaApp.jsx";
import { parseCSVAbrangencia } from "./AbrangenciaApp.jsx";

const C = {
  laranja:"#F97316", verde:"#16A34A", vermelho:"#DC2626", amarelo:"#CA8A04",
  azul:"#2563EB", cinzaFundo:"#F8F7F4", cinzaCard:"#FFFFFF", cinzaBorda:"#E5E3DF",
  cinzaTexto:"#6B7280", texto:"#1C1917",
};

const INDICADORES = [
  {key:"sla",  label:"SLA Reversa", meta:86, inv:false, unit:"%"},
  {key:"agend",label:"Agendamento",  meta:95, inv:false, unit:"%"},
  {key:"ader", label:"Aderência",    meta:95, inv:false, unit:"%"},
  {key:"sla15",label:"SLA 15 dias",  meta:90, inv:false, unit:"%"},
];
const MESES_NOME = {1:"Jan",2:"Fev",3:"Mar",4:"Abr",5:"Mai",6:"Jun",7:"Jul",8:"Ago",9:"Set",10:"Out",11:"Nov",12:"Dez"};
const TRIM_MESES = {1:[1,2,3],2:[4,5,6],3:[7,8,9],4:[10,11,12]};

// ── Normalização de nomes de parceiro ──────────────────────────────────────────
// SLA, Coleta x Recebimento e CSAT grafam o mesmo parceiro de formas diferentes
// (maiúsculas/minúsculas, sufixo de transportadora, razão social completa, etc),
// então o mesmo parceiro aparecia várias vezes no filtro. Resolvido em 2 passos:
//   1) Limpeza automática — remove acento, padroniza maiúsculas e espaços.
//      Resolve duplicidade que é só diferença de grafia (ex: "Safari" vs "SAFARI").
//   2) Tabela de apelidos (PARCEIRO_ALIASES) — casos em que o nome é realmente
//      diferente entre as bases (razão social, sufixo de filial/serviço etc).
//      Sempre que aparecer uma nova duplicidade no filtro, adicione uma linha aqui.
function limparNomeParceiro(nome) {
  return String(nome || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove acentuação
    .trim().replace(/\s+/g, " ")
    .toUpperCase();
}

// Sufixos genéricos (tag de canal/serviço/razão social) que não identificam o parceiro
// — removidos do final do nome, com quantas repetições forem necessárias.
const SUFIXOS_GENERICOS_PARCEIRO = [
  "OUTLET","OUTL","TRANSPORTES","TRANSPORTE","TRANSP","MONTAGEM",
  "LTDA","EIRELI","EPP","CIA","S A","SA","ME",
];
function removerSufixosGenericos(nomeLimpo) {
  let n = nomeLimpo, mudou = true;
  while (mudou) {
    mudou = false;
    for (const suf of SUFIXOS_GENERICOS_PARCEIRO) {
      const re = new RegExp(`\\s${suf}$`);
      if (re.test(n)) { n = n.replace(re, "").trim(); mudou = true; }
    }
  }
  return n;
}

// Apelidos conhecidos: chave = nome já limpo (sem acento, maiúsculo) como aparece na base,
// valor = nome canônico a exibir/agrupar no filtro. Edite/complete conforme surgirem novos casos.
const PARCEIRO_ALIASES = {
  "AGMX OPORTUNIDA": "AGMX",
  "E S L KOSLYK CO": "E S L KOSLYK",
  "KMAN MOVEIS": "KMAN",
  "LOGME - TRANSPO": "LOGME",
  "LOGME CWB": "LOGME",
  "ORC MOVEIS E EL": "ORC",
  "MOVEL SERVICE COMERCIO DE MOVEIS LTDA": "MOVEL SERVICE",
  "MOV CAMILO": "MOVEIS CAMILO",
  "MOVEIS CAMILO L": "MOVEIS CAMILO",
  "CAMILO": "MOVEIS CAMILO",
  "PONTASSO - TRINDADE & CUBA": "TRINDADE & CUBA",
  "TRINDADE": "TRINDADE & CUBA",
  "SALDAO CAMPINAS": "SALDAO",
  "REAL MOWEIS COM": "REAL MOWEIS",
  "TOPA TUDO MOVEI": "TOPA TUDO",
  "TOPA TUDO MOVEIS": "TOPA TUDO",
};

// Ponto único de normalização — sempre usar essa função ao ler/agrupar nome de parceiro
function normalizarParceiro(nomeOriginal) {
  const limpo = limparNomeParceiro(nomeOriginal);
  if (!limpo) return "";
  if (PARCEIRO_ALIASES[limpo]) return PARCEIRO_ALIASES[limpo];
  const semSufixo = removerSufixosGenericos(limpo);
  if (semSufixo !== limpo && PARCEIRO_ALIASES[semSufixo]) return PARCEIRO_ALIASES[semSufixo];
  return semSufixo || limpo;
}

// Mescla dois registros semanais (usado quando dois nomes diferentes de parceiro
// caem no mesmo nome canônico e ambos têm dados na mesma semana) — pondera pelo total
function mesclarRegistroSemana(a, b) {
  if (!a) return b;
  if (!b) return a;
  const totA = a.total||0, totB = b.total||0, tot = totA+totB;
  const pw = k => {
    const va=a[k], vb=b[k];
    if (va==null && vb==null) return null;
    if (va==null) return vb;
    if (vb==null) return va;
    return tot ? Math.round((va*totA+vb*totB)/tot*100)/100 : null;
  };
  return { total: tot, sla:pw("sla"), agend:pw("agend"), ader:pw("ader"), sla15:pw("sla15"), aging:pw("aging") };
}

// Calcula semana ISO (igual ao AbrangenciaApp)
function semanaISO(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d)) return null;
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  return Math.ceil(((tmp - yearStart) / 86400000 + 1) / 7);
}

// Parser idêntico ao AbrangenciaApp — garante os mesmos resultados
function parseCSVAbrangenciaW(texto) {
  const { data } = Papa.parse(texto, { header:true, skipEmptyLines:true });
  return data
    .filter(r => r["Logistica Reversa Estado"] && r["Logistica Reversa Cidade"])
    .map(r => {
      const dataColeta = String(
        r["Logistica Reversa Data Coleta Efetivada Date"] ||
        r["Logistica Reversa Data Coleta Efetivada"] || ""
      ).trim();
      const mesRaw = String(r["Logistica Reversa Data Coleta Efetivada Month"] || "").trim();
      const mes = mesRaw.includes("-")
        ? parseInt(mesRaw.split("-")[1]) || null
        : parseInt(mesRaw) || null;
      const semana = semanaISO(dataColeta);
      return {
        validacao:      String(r["VALIDAÇÃO"] || r["Validação"] || r["Validacao"] || "").trim().toUpperCase(),
        transportadora: String(r["Logistica Reversa Transportadora"] || "").trim(),
        estado:         String(r["Logistica Reversa Estado"] || "").trim().toUpperCase(),
        cidade:         String(r["Logistica Reversa Cidade"] || "").trim(),
        abrangencia:    parseFloat(String(r["Abrangencia"] || "").replace(",", ".")) || 0,
        dataColeta, semana, mes,
      };
    });
}

function lerLS(key, fallback) {
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : fallback; } catch { return fallback; }
}
function salvarLS(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* storage indisponível/cheio — ignora */ }
}
// Chaves de persistência do Weekly (racionais e assuntos gerais), por semana selecionada
const WEEKLY_RACIONAIS_KEY = "weeklyParca_racionais";
const WEEKLY_ASSUNTOS_KEY  = "weeklyParca_assuntosGerais";
const WEEKLY_PROBLEMAS_KEY = "weeklyParca_problemasColeta";
async function lerIDB(dbName, storeName, key) {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(dbName, 1);
      req.onerror = () => resolve(null);
      req.onupgradeneeded = () => resolve(null);
      req.onsuccess = () => {
        try {
          const tx = req.result.transaction(storeName, "readonly");
          const r = tx.objectStore(storeName).get(key);
          r.onsuccess = () => resolve(r.result || null);
          r.onerror = () => resolve(null);
        } catch { resolve(null); }
      };
    } catch { resolve(null); }
  });
}
const fmtInd = (v, ind) => v == null ? "—" : `${ind.inv ? Math.round(v) : v.toFixed(1)}${ind.unit}`;
const corInd = (v, ind) => {
  if(v==null) return C.cinzaTexto;
  if(!ind.inv) return v>=ind.meta?C.verde:v>=ind.meta*0.95?C.amarelo:C.vermelho;
  return v<=ind.meta?C.verde:v<=ind.meta*1.15?C.amarelo:C.vermelho;
};
const fmtDelta = (d, inv) => {
  if(d==null) return {texto:"—", cor:C.cinzaTexto};
  const sinal = d>0?"▲":d<0?"▼":"=";
  const cor = d===0?C.cinzaTexto:(inv?d<=0:d>=0)?C.verde:C.vermelho;
  return {texto:`${sinal} ${Math.abs(d).toFixed(1)}`, cor};
};

// Calcula indicadores direto das linhas brutas do CSV (igual ao SlaApp)
// Isso garante exatamente os mesmos números que aparecem na aba Performance Coleta
function calcFromRawRows(rows) {
  const norm = v => String(v||"").trim().toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g,"");
  const pct = (n,d) => d>0?Math.round(n/d*10000)/100:null;
  const avg = arr => arr.length?Math.round(arr.reduce((a,b)=>a+b,0)/arr.length*100)/100:null;
  const base = rows.filter(r=>r["Flag Situacao Coleta"]==="Coletado");
  if(base.length<1) return null;
  const sp   = base.filter(r=>r["Problema_de_coleta"]!=="1"&&r["Problema_de_coleta"]!==1&&r["Problema_de_coleta"]!==true);
  const isNao   = r=>norm(r["Vencido"])==="nao";
  const isNao15 = r=>norm(r["Vencido (SLA Cliente)"])==="nao";
  const isAg    = r=>r["Agendamento"]==="1"||r["Agendamento"]===1;
  const isAder  = r=>{const v=r["Aderencia agendamento "]??r["Aderencia agendamento"];return v==="1"||v===1;};
  const agOk    = base.filter(isAg);
  const agingList = base.map(r=>{const v=parseFloat(r["Aging coleta efetivada"]);return !isNaN(v)&&v>=0?v:null;}).filter(v=>v!==null);
  return {
    total: base.length,
    sla:   pct(base.filter(isNao).length,   base.length),
    agend: pct(base.filter(isAg).length,    base.length),
    ader:  pct(agOk.filter(isAder).length,  agOk.length),
    sla15: pct(base.filter(isNao15).length, base.length),
    aging: avg(agingList),
  };
}

function calcPeriodoFromSemanas(semanas) {
  // Agrega semanas ponderadas pelo total de coletas
  if(!semanas.length) return null;
  const tot = semanas.reduce((a,r)=>a+(r.total||0),0);
  if(!tot) return null;
  const pw = key => {
    let s=0,t=0;
    semanas.forEach(r=>{ if(r[key]!=null){s+=r[key]*(r.total||0);t+=r.total||0;} });
    return t ? Math.round(s/t*100)/100 : null;
  };
  return { total:tot, sla:pw("sla"), agend:pw("agend"), ader:pw("ader"), sla15:pw("sla15"), aging:pw("aging") };
}

function calcParceirosFromSemanas(semanas, pd, filtroParcs) {
  const parcs = filtroParcs && filtroParcs.length ? filtroParcs : Object.keys(pd);
  return parcs.map(p=>{
    const rows = semanas.map(w=>pd[p]?.[w.s]).filter(Boolean);
    if(!rows.length) return null;
    const tot = rows.reduce((a,r)=>a+(r.total||0),0);
    if(!tot) return null;
    const pw = key => {
      let s=0,t=0;
      rows.forEach(r=>{ if(r[key]!=null){s+=r[key]*(r.total||0);t+=r.total||0;} });
      return t ? Math.round(s/t*100)/100 : null;
    };
    return {nome:p,total:tot,sla:pw("sla"),agend:pw("agend"),ader:pw("ader"),sla15:pw("sla15"),aging:pw("aging")};
  }).filter(Boolean).sort((a,b)=>b.total-a.total);
}

// Feriados nacionais BR 2026 (igual ao SlaApp)
const FERIADOS_CR = new Set([
  "2026-01-01","2026-02-16","2026-02-17","2026-02-18",
  "2026-04-03","2026-04-05","2026-04-21","2026-05-01","2026-06-04",
  "2026-09-07","2026-10-12","2026-11-02","2026-11-15","2026-11-20","2026-12-25",
]);

// Calcula dias úteis entre duas datas (formato DD/MM/YYYY) — igual ao SlaApp
function busdaysCR(d1Str, d2Str) {
  if(!d1Str||!d2Str) return null;
  try {
    const [d1d,d1m,d1y]=d1Str.split("/"); const dt1=new Date(d1y,d1m-1,d1d);
    const [d2d,d2m,d2y]=d2Str.split("/"); const dt2=new Date(d2y,d2m-1,d2d);
    if(isNaN(dt1)||isNaN(dt2)||dt2<dt1) return null;
    let dias=0, cur=new Date(dt1);
    while(cur<dt2){
      const dow=cur.getDay();
      const iso=cur.toISOString().slice(0,10);
      if(dow!==0&&dow!==6&&!FERIADOS_CR.has(iso)) dias++;
      cur.setDate(cur.getDate()+1);
    }
    return dias;
  } catch{ return null; }
}

// Helper pra calcular a análise CR do tipo {n, mesma, um, dois, tres, porParceiro}
function calcCR(rows, filtroParcs) {
  const validas = rows
    .filter(r => {
      if(!r["Data Coleta"]||!r["Data de Recebimento da Coleta"]) return false;
      if(filtroParcs&&filtroParcs.length&&!filtroParcs.includes(r["Parceiro Nome"])) return false;
      return true;
    })
    .map(r => {
      // Usa dias úteis igual à aba Performance Coleta (padrão da aba é diasCorridos=false)
      const dias = busdaysCR(r["Data Coleta"], r["Data de Recebimento da Coleta"]);
      return dias!=null?{...r,dias}:null;
    }).filter(Boolean);
  const n=validas.length;
  const mesma=validas.filter(r=>r.dias===0).length;
  const um=validas.filter(r=>r.dias===1).length;
  const dois=validas.filter(r=>r.dias===2).length;
  const tres=validas.filter(r=>r.dias>=3).length;
  const pp={};
  validas.forEach(r=>{const p=r["Parceiro Nome"]||"—";if(!pp[p])pp[p]={total:0,mesma:0,um:0,dois:0,tres:0};pp[p].total++;if(r.dias===0)pp[p].mesma++;else if(r.dias===1)pp[p].um++;else if(r.dias===2)pp[p].dois++;else pp[p].tres++;});
  return {n,mesma,um,dois,tres,porParceiro:pp};
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function WeeklyApp() {
  const [weekly,      setWeekly]      = useState([]);
  const [pd,          setPd]          = useState({});
  const [rawRows,     setRawRows]     = useState([]);
  const [csatSlots,   setCsatSlots]   = useState({});
  const [csatPorParceiro, setCsatPorParceiro] = useState({});
  const [abrangAtual, setAbrangAtual] = useState(null);   // mantido para compatibilidade
  const [abrangRawRows, setAbrangRawRows] = useState([]); // linhas parseadas do csvRaw
  const [crRows,      setCrRows]      = useState([]);
  const [crRowsAnt,   setCrRowsAnt]   = useState([]);
  const [loading,     setLoading]     = useState(true);

  const [granular,    setGranular]    = useState("semana");
  const [selA,        setSelA]        = useState(null);
  const [selAnt,      setSelAnt]      = useState(null);
  const [filtroParcs, setFiltroParcs] = useState([]); // filtro multi-parceiro global
  const [mostrarFiltroParceiro, setMostrarFiltroParceiro] = useState(true);
  const RACIONAIS_VAZIO = {abrangencia:"",indicadores:"",coletaReceb:"",problemas:"",csat:""};
  const [racionais,   setRacionais]   = useState(RACIONAIS_VAZIO);
  const setR = (k,v) => setRacionais(p=>({...p,[k]:v}));
  const racionaisCarregados = useRef(false); // evita salvar antes de carregar o localStorage da semana

  // Carrega os racionais salvos sempre que a semana/mês/trimestre selecionado mudar
  useEffect(() => {
    (async () => {
      await sincronizarAntesDeLer(["weeklyRacionais"]); // busca o que outras pessoas escreveram antes de ler local
      const chave = `${granular}_${selA ?? "geral"}`;
      const todos = lerLS(WEEKLY_RACIONAIS_KEY, {});
      racionaisCarregados.current = false;
      setRacionais({ ...RACIONAIS_VAZIO, ...(todos[chave] || {}) });
      racionaisCarregados.current = true;
    })();
  }, [selA, granular]);

  // Salva automaticamente sempre que uma observação/racional for editada, e publica
  // pro backend compartilhado para que outras pessoas vejam o mesmo texto
  useEffect(() => {
    if (!racionaisCarregados.current) return; // não sobrescreve enquanto ainda está carregando
    const chave = `${granular}_${selA ?? "geral"}`;
    const todos = lerLS(WEEKLY_RACIONAIS_KEY, {});
    todos[chave] = racionais;
    salvarLS(WEEKLY_RACIONAIS_KEY, todos);
    publicarApósImportar("weeklyRacionais", todos);
  }, [racionais, selA, granular]);

  // Estado minimizável para subseções da abrangência
  const [abrangMostrarEstados, setAbrangMostrarEstados] = useState(true);
  const [abrangMostrarShare, setAbrangMostrarShare] = useState(true);
  // Filtro multi-parça dentro da seção de abrangência
  const [abrangFiltroParcs, setAbrangFiltroParcs] = useState([]);

  useEffect(()=>{
    (async()=>{
      // Busca a versão mais recente do backend compartilhado (se configurado) e
      // atualiza a cópia local antes de ler. slaCsvAtual/slaCr/slaCrAnterior/
      // abrangAtual/abrangAnterior saíram desta lista porque esses dados agora
      // vêm direto do backend (fetch abaixo) — o SLA e a Abrangência migraram
      // para lá e pararam de escrever nesses pontos de sincronização, então
      // mantê-los aqui só custava uma chamada extra sem efeito nenhum.
      await sincronizarAntesDeLer([
        "slaWeekly","slaPd","csatParsed","csatDadosImportados","csatSemanasTrav",
      ]);

      const pdRaw= lerLS("slaParca_pd",{});
      // SLA — busca direto do backend (data/slaBruto.csv no GitHub, via
      // api/sla.js), a mesma fonte que a aba Performance Coleta usa. Isso
      // substitui a leitura antiga de IndexedDB (slaParcaDB), que ficou sem
      // ninguém escrevendo nela depois que o SLA migrou para o backend
      // compartilhado — por isso o Weekly ficava sem dado pra quem não
      // importou manualmente na própria aba SLA daquele navegador.
      let rows = [];
      try {
        const rSla = await fetch("/api/sla");
        if (rSla.ok) {
          const dataSla = await rSla.json();
          if (dataSla?.csv) rows = parseCSV(dataSla.csv);
        }
      } catch (e) {
        console.warn("Weekly: não consegui buscar o SLA do servidor:", e);
      }
      // Normaliza o nome do parceiro (Transportadora) para evitar duplicidade no filtro
      rows = rows.map(r => r["Transportadora"] ? {...r, "Transportadora": normalizarParceiro(r["Transportadora"])} : r);
      setRawRows(rows);

      // semMes: mapa semana → Set de meses (uma semana pode cobrir 2 meses)
      const semMesSet = {};
      rows.forEach(r=>{
        const s = parseInt(r["semana_Efetivada"]||r["Semana_Efetivada"]||0);
        const m = parseInt(r["Mês_Efetivada"]||r["Mes_Efetivada"]||r["mes_Efetivada"]||0);
        if(s&&m){ if(!semMesSet[s]) semMesSet[s]=new Set(); semMesSet[s].add(m); }
      });
      // semMes: mês principal de cada semana (o mais frequente) para lookup simples
      const semMes = {};
      Object.entries(semMesSet).forEach(([s,ms])=>{ semMes[s]=[...ms][0]; });
      // Catálogo de semanas — construído direto das linhas do servidor (semMesSet),
      // não mais do cache local "slaParca_weekly" (que só existia em quem já tinha
      // importado manualmente naquele navegador e por isso ficava vazio pra todo
      // mundo mais). Os indicadores de cada semana são calculados ao vivo por
      // calcFromRawRows/rawDoPeríodo a partir de rawRows, então aqui só precisamos
      // de {s, mes, meses} pra montar o catálogo de períodos.
      const wEnriq = Object.keys(semMesSet).map(sStr=>{
        const s = parseInt(sStr);
        return { s, mes: semMes[s]||null, meses: [...semMesSet[s]] };
      });
      setWeekly(wEnriq.sort((a,b)=>a.s-b.s));
      // Canonicaliza as chaves de pd (nome do parceiro), mesclando semanas quando dois nomes
      // diferentes na base caírem no mesmo nome canônico
      const pdCanon = {};
      Object.entries(pdRaw).forEach(([nomeOriginal, semanasObj]) => {
        const canon = normalizarParceiro(nomeOriginal);
        if (!canon) return;
        if (!pdCanon[canon]) pdCanon[canon] = {};
        Object.entries(semanasObj||{}).forEach(([semana, rec]) => {
          pdCanon[canon][semana] = mesclarRegistroSemana(pdCanon[canon][semana], rec);
        });
      });
      setPd(pdCanon);

      if(wEnriq.length){
        setSelA(wEnriq[wEnriq.length-1].s);
        if(wEnriq.length>1) setSelAnt(wEnriq[wEnriq.length-2].s);
      }

      // CSAT
      let csatSlim = null;
      let csatPP = {};

      // Tenta IDB primeiro
      const csatIDB = await lerIDB("csatParcaDB","dados","parsed");
      if(csatIDB?.porSemana){
        const obj = {};
        csatIDB.porSemana.forEach(p=>{ if(p.semana) obj[`${csatIDB.anoAtual||new Date().getFullYear()}_W${p.semana}`]=p.slim||p; });
        csatSlim = obj;
        // Tenta extrair por parceiro do IDB
        csatIDB.porSemana.forEach(semObj=>{
          (semObj.parceiros||semObj.porParceiro||[]).forEach(pc=>{
            const nome = pc.nome||pc.parceiro||pc.name;
            if(!nome) return;
            if(!csatPP[nome]) csatPP[nome]={semanas:[]};
            csatPP[nome].semanas.push({
              semana: semObj.semana, mes: semObj.mes,
              share: pc.share!=null ? pc.share : (pc.notas45&&pc.total ? pc.notas45/pc.total : null),
              respostas: pc.respostas||pc.total||0
            });
          });
        });
      }

      // Fallback: localStorage csat_semanas_travadas
      const csatLS = lerLS("csat_semanas_travadas", {});
      const csatArr = Array.isArray(csatLS) ? csatLS : Object.values(csatLS);

      if(!csatSlim){
        // Monta o objeto de semanas gerais
        const obj = {};
        csatArr.forEach(p=>{ if(p.semana) obj[`${new Date().getFullYear()}_W${p.semana}`]=p; });
        csatSlim = obj;
      }

      // Tenta extrair por parceiro do localStorage se IDB não trouxe
      if(Object.keys(csatPP).length===0){
        csatArr.forEach(semObj=>{
          // Verifica campos comuns de "por parceiro" no objeto de semana
          const parcsData = semObj.parceiros||semObj.porParceiro||semObj.byPartner||[];
          if(Array.isArray(parcsData)){
            parcsData.forEach(pc=>{
              const nome = pc.nome||pc.parceiro||pc.name||pc.label;
              if(!nome) return;
              if(!csatPP[nome]) csatPP[nome]={semanas:[]};
              csatPP[nome].semanas.push({
                semana: semObj.semana, mes: semObj.mes,
                share: pc.share!=null ? pc.share : (pc.notas45&&pc.total ? pc.notas45/pc.total : null),
                respostas: pc.respostas||pc.total||0
              });
            });
          }
        });
      }

      // Se ainda vazio, tenta ler do IDB com a chave "semanas" (outra estrutura possível)
      if(Object.keys(csatPP).length===0){
        const csatIDB2 = await lerIDB("csatParcaDB","dados","semanas");
        if(csatIDB2 && typeof csatIDB2 === 'object'){
          const arr2 = Array.isArray(csatIDB2) ? csatIDB2 : Object.values(csatIDB2);
          arr2.forEach(semObj=>{
            const parcsData = semObj.parceiros||semObj.porParceiro||[];
            parcsData.forEach(pc=>{
              const nome = pc.nome||pc.parceiro||pc.name;
              if(!nome) return;
              if(!csatPP[nome]) csatPP[nome]={semanas:[]};
              csatPP[nome].semanas.push({semana:semObj.semana,mes:semObj.mes,share:pc.share,respostas:pc.respostas||0});
            });
          });
        }
      }

      // Enriquece cada slot de CSAT com o campo `mes` normalizado para número
      // O campo mes pode vir como "2026-07" (string) ou 7 (número) — normaliza para número
      const normalizarMesCsat = (mes, semana) => {
        if(typeof mes === 'number' && mes >= 1 && mes <= 12) return mes;
        if(typeof mes === 'string'){
          // Formato "2026-07" → 7
          if(mes.includes('-')) return parseInt(mes.split('-')[1]) || null;
          const n = parseInt(mes);
          if(n >= 1 && n <= 12) return n;
        }
        // Fallback: deriva da semana usando o mapa semana→mês
        return semMes[semana] || null;
      };
      const csatSlimEnriq = {};
      Object.entries(csatSlim||{}).forEach(([k,v])=>{
        const semNum = v.semana || parseInt((k.split('_W')[1]||'0'));
        const mesCalc = normalizarMesCsat(v.mes, semNum);
        csatSlimEnriq[k] = {...v, semana: semNum, mes: mesCalc};
      });
      // Enriquece também csatPorParceiro com o campo mes em cada semana
      Object.values(csatPP).forEach(pp=>{
        pp.semanas = pp.semanas.map(s=>({...s, mes: s.mes || semMes[s.semana] || null}));
      });
      // Canonicaliza o nome do parceiro (evita duplicidade no filtro), mesclando as semanas
      // de nomes diferentes que caem no mesmo canônico
      const csatPPCanon = {};
      Object.entries(csatPP).forEach(([nomeOriginal, dados]) => {
        const canon = normalizarParceiro(nomeOriginal);
        if (!canon) return;
        if (!csatPPCanon[canon]) csatPPCanon[canon] = {semanas: []};
        csatPPCanon[canon].semanas.push(...(dados.semanas||[]));
      });
      setCsatSlots(csatSlimEnriq);
      setCsatPorParceiro(csatPPCanon);

      // Abrangência — busca direto do backend (data/abrangenciaAtual.csv no
      // GitHub, via api/abrangencia.js), a mesma fonte que a aba Abrangência
      // Parça usa, com o mesmo parser (parseCSVAbrangencia) — mesmo motivo do
      // SLA acima: a aba Abrangência não escreve mais em abrangenciaParcaDB2
      // desde que migrou para o backend compartilhado.
      let abr = null;
      try {
        const rAbr = await fetch("/api/abrangencia");
        if (rAbr.ok) {
          const dataAbr = await rAbr.json();
          if (dataAbr?.atualCSV) {
            abr = { rows: parseCSVAbrangencia(dataAbr.atualCSV), nome: dataAbr.atualNome, data: dataAbr.atualData };
          }
        }
      } catch (e) {
        console.warn("Weekly: não consegui buscar a Abrangência do servidor:", e);
      }
      setAbrangAtual(abr||null);

      if(abr?.rows?.length){
        setAbrangRawRows(abr.rows);
        const jul = abr.rows.filter(r=>r.mes===7);
        const julParca = jul.filter(r=>r.validacao==="PARÇA");
        const tot = jul.reduce((s,r)=>s+(r.abrangencia||0),0);
        const parca = julParca.reduce((s,r)=>s+(r.abrangencia||0),0);
      }

      // Coleta x Recebimento — busca direto do backend (data/coletaRecebimento.csv
      // no GitHub, via api/coletaRecebimento.js), mesma fonte que a aba SLA usa.
      // Esse endpoint só guarda a versão atual (sem "anterior" — diferente de
      // Abrangência), então crRowsAnt fica vazio mesmo; as telas já tratam
      // esse caso mostrando só o período atual, sem comparação.
      let crRowsFetch = [];
      try {
        const rCr = await fetch("/api/coletaRecebimento");
        if (rCr.ok) {
          const dataCr = await rCr.json();
          if (dataCr?.csv) crRowsFetch = parseCsvColetaRecebimento(dataCr.csv);
        }
      } catch (e) {
        console.warn("Weekly: não consegui buscar Coleta x Recebimento do servidor:", e);
      }
      const normalizarLinhasCR = (linhas) => (linhas||[]).map(r =>
        r["Parceiro Nome"] ? {...r, "Parceiro Nome": normalizarParceiro(r["Parceiro Nome"])} : r
      );
      setCrRows(normalizarLinhasCR(crRowsFetch));
      setCrRowsAnt([]);

      setLoading(false);
    })();
  },[]);

  // ── Todos os parceiros disponíveis (SLA + CR + CSAT) ────────────────────
  const todosParceiros = useMemo(()=>{
    const set = new Set([
      ...Object.keys(pd),
      ...crRows.map(r=>r["Parceiro Nome"]||"").filter(Boolean),
      ...Object.keys(csatPorParceiro),
    ]);
    return [...set].sort();
  },[pd, crRows, csatPorParceiro]);

  // ── Períodos ──────────────────────────────────────────────────────────────
  const allSemanas = weekly.map(w=>w.s);
  const allMeses   = useMemo(()=>{
    const ms = new Set();
    weekly.forEach(w=>{ (w.meses||[]).forEach(m=>ms.add(m)); if(w.mes) ms.add(w.mes); });
    return [...ms].sort((a,b)=>a-b);
  },[weekly]);
  const periodos   = granular==="semana" ? allSemanas : granular==="mes" ? allMeses : [1,2,3,4];
  const lbl = useCallback(p=> granular==="semana"?`S${p}`:granular==="mes"?MESES_NOME[p]:`T${p}`,[granular]);

  const semsDoPeríodo = useCallback(sel=>{
    if(sel==null) return [];
    if(granular==="semana") return weekly.filter(w=>w.s===sel);
    // Para mês/trim: inclui semanas que TOCAM aquele mês (semanas de transição inclusive)
    if(granular==="mes")    return weekly.filter(w=>w.meses?.includes(sel)||w.mes===sel);
    if(granular==="trim")   return weekly.filter(w=>(TRIM_MESES[sel]||[]).some(m=>w.meses?.includes(m)||w.mes===m));
    return [];
  },[granular,weekly]);

  const semsA   = useMemo(()=>semsDoPeríodo(selA),   [selA,   semsDoPeríodo]);
  const semsAnt = useMemo(()=>semsDoPeríodo(selAnt), [selAnt, semsDoPeríodo]);

  // Helper: filtra rawRows pelo período e parceiros selecionados
  const rawDoPeríodo = useCallback((sel)=>{
    if(!rawRows.length||sel==null) return [];
    if(granular==="semana"){
      const s=String(sel);
      return rawRows.filter(r=>{
        const rs=String(parseInt(r["semana_Efetivada"]||r["Semana_Efetivada"]||0));
        return rs===s && (filtroParcs.length===0||filtroParcs.includes(r["Transportadora"]));
      });
    }
    if(granular==="mes"){
      return rawRows.filter(r=>{
        const m=parseInt(r["Mês_Efetivada"]||r["Mes_Efetivada"]||0);
        return m===sel && (filtroParcs.length===0||filtroParcs.includes(r["Transportadora"]));
      });
    }
    if(granular==="trim"){
      const meses=TRIM_MESES[sel]||[];
      return rawRows.filter(r=>{
        const m=parseInt(r["Mês_Efetivada"]||r["Mes_Efetivada"]||0);
        return meses.includes(m) && (filtroParcs.length===0||filtroParcs.includes(r["Transportadora"]));
      });
    }
    return [];
  },[rawRows,granular,filtroParcs]);

  // Indicadores globais: usa rawRows quando disponível (exatos = igual Performance Coleta)
  // Fallback para semas agregadas quando não há CSV bruto carregado
  const indA = useMemo(()=>{
    const linhas = rawDoPeríodo(selA);
    if(linhas.length>=1) return calcFromRawRows(linhas);
    return calcPeriodoFromSemanas(semsA);
  },[selA, rawDoPeríodo, semsA]);

  const indAnt = useMemo(()=>{
    const linhas = rawDoPeríodo(selAnt);
    if(linhas.length>=1) return calcFromRawRows(linhas);
    return calcPeriodoFromSemanas(semsAnt);
  },[selAnt, rawDoPeríodo, semsAnt]);

  const parcsA = useMemo(()=>{
    // Se temos CSV bruto, calcula por parceiro diretamente
    const linhas = rawDoPeríodo(selA);
    if(linhas.length>=1){
      const byParc={};
      linhas.forEach(r=>{const p=r["Transportadora"]||"—";if(!byParc[p])byParc[p]=[];byParc[p].push(r);});
      return Object.entries(byParc).map(([nome,rows])=>{const d=calcFromRawRows(rows);return d?{nome,...d}:null;}).filter(Boolean).sort((a,b)=>b.total-a.total);
    }
    return calcParceirosFromSemanas(semsA, pd, filtroParcs.length?filtroParcs:null);
  },[selA, rawDoPeríodo, semsA, pd, filtroParcs]);

  const parcsAnt = useMemo(()=>{
    const linhas = rawDoPeríodo(selAnt);
    if(linhas.length>=1){
      const byParc={};
      linhas.forEach(r=>{const p=r["Transportadora"]||"—";if(!byParc[p])byParc[p]=[];byParc[p].push(r);});
      return Object.entries(byParc).map(([nome,rows])=>{const d=calcFromRawRows(rows);return d?{nome,...d}:null;}).filter(Boolean).sort((a,b)=>b.total-a.total);
    }
    return calcParceirosFromSemanas(semsAnt, pd, filtroParcs.length?filtroParcs:null);
  },[selAnt, rawDoPeríodo, semsAnt, pd, filtroParcs]);

  // Movimentos: todos os indicadores de todos os parceiros com dados (com ou sem variação)
  const movimentos = useMemo(()=>{
    const porParceiro = {};
    parcsA.forEach(pA=>{
      const pAnt = parcsAnt.find(p=>p.nome===pA.nome);
      INDICADORES.forEach(ind=>{
        // Mostra o indicador se tiver dado no período atual (com ou sem período anterior)
        if(pA[ind.key]==null) return;
        const d = pAnt&&pAnt[ind.key]!=null ? Math.round((pA[ind.key]-pAnt[ind.key])*100)/100 : null;
        const item={parceiro:pA.nome,ind:ind.label,key:ind.key,atual:pA[ind.key],ant:pAnt?.[ind.key]??null,d,inv:ind.inv,unit:ind.unit};
        if(!porParceiro[pA.nome]) porParceiro[pA.nome]=[];
        porParceiro[pA.nome].push(item);
      });
    });
    return {porParceiro};
  },[parcsA,parcsAnt]);

  // ── CSAT por período ──────────────────────────────────────────────────────
  const csatDoPeríodo = useCallback((sel)=>{
    if(sel==null) return null;
    const vals = Object.values(csatSlots).filter(v=>v&&v.semana);
    if(!vals.length) return null;
    if(granular==="semana") return vals.find(v=>v.semana===sel)||null;
    if(granular==="mes"){ const vs=vals.filter(v=>parseInt(v.mes)===sel); if(!vs.length) return null; const tot=vs.reduce((s,v)=>s+(v.respostas||0),0); const n45=vs.reduce((s,v)=>s+(v.notas45!=null?v.notas45:Math.round((v.share||0)*(v.respostas||0))),0); return {share:tot?n45/tot:null,respostas:tot,label:MESES_NOME[sel]}; }
    if(granular==="trim"){ const ms=TRIM_MESES[sel]||[]; const vs=vals.filter(v=>ms.includes(v.mes)); if(!vs.length) return null; const tot=vs.reduce((s,v)=>s+(v.respostas||0),0); const n45=vs.reduce((s,v)=>s+(v.notas45!=null?v.notas45:Math.round((v.share||0)*(v.respostas||0))),0); return {share:tot?n45/tot:null,respostas:tot,label:`T${sel}`}; }
    return vals.sort((a,b)=>(b.semana||0)-(a.semana||0))[0];
  },[csatSlots,granular]);

  const csatA   = useMemo(()=>csatDoPeríodo(selA),   [selA,   csatDoPeríodo]);
  const csatAnt = useMemo(()=>csatDoPeríodo(selAnt), [selAnt, csatDoPeríodo]);

  // ── Abrangência filtrada por período e por parça ──────────────────────────
  const semanasDoA   = useMemo(()=>semsDoPeríodo(selA).map(w=>w.s),   [selA,semsDoPeríodo]);
  const semanasDoAnt = useMemo(()=>semsDoPeríodo(selAnt).map(w=>w.s), [selAnt,semsDoPeríodo]);

  const calcCobParca = useCallback((sel, filtroA=[], gran)=>{
    // gran passado como parâmetro — evita closure stale no granular
    if(!abrangRawRows.length) return null;
    let rows = abrangRawRows;
    if(sel!=null){
      if(gran==="semana") rows = rows.filter(r=>r.semana===sel);
      else if(gran==="mes")  rows = rows.filter(r=>r.mes===sel);
      else if(gran==="trim") rows = rows.filter(r=>(TRIM_MESES[sel]||[]).includes(r.mes));
    }
    if(filtroA.length) rows = rows.filter(r=>filtroA.includes(r.transportadora));
    if(rows.length>0){
      const tot=rows.reduce((s,r)=>s+r.abrangencia,0);
      const parca=rows.filter(r=>r.validacao==="PARÇA").reduce((s,r)=>s+r.abrangencia,0);
    }
    if(!rows.length) return null;
    const total = rows.reduce((s,r)=>s+r.abrangencia,0);
    const parca = rows.filter(r=>r.validacao==="PARÇA").reduce((s,r)=>s+r.abrangencia,0);
    const porUF={};
    rows.forEach(r=>{ if(!porUF[r.estado]) porUF[r.estado]={total:0,parca:0}; porUF[r.estado].total+=r.abrangencia; if(r.validacao==="PARÇA") porUF[r.estado].parca+=r.abrangencia; });
    const ufList=Object.entries(porUF).map(([uf,d])=>({uf,total:d.total,parca:d.parca,pct:d.total?d.parca/d.total*100:0})).sort((a,b)=>b.total-a.total);
    // Share por transportadora parça
    const porTransp={};
    rows.filter(r=>r.validacao==="PARÇA").forEach(r=>{ if(!porTransp[r.transportadora]) porTransp[r.transportadora]=0; porTransp[r.transportadora]+=r.abrangencia; });
    const transpList=Object.entries(porTransp).map(([t,v])=>({nome:t,coletas:v,share:total?v/total*100:0})).sort((a,b)=>b.coletas-a.coletas);
    return {pct:total?parca/total*100:0,total,parca,ufList,transpList,naoParça:total-parca};
  },[abrangAtual]);

  // Transportadoras parça disponíveis (para filtro na seção)
  const transpParçaDisponiveis = useMemo(()=>{
    if(!abrangRawRows.length) return [];
    return [...new Set(abrangRawRows.filter(r=>r.validacao==="PARÇA").map(r=>r.transportadora))].sort();
  },[abrangRawRows, granular]);

  const cobParca    = useMemo(()=>calcCobParca(selA,   abrangFiltroParcs, granular), [selA,   granular, calcCobParca, abrangFiltroParcs]);
  const cobParcaAnt = useMemo(()=>calcCobParca(selAnt, abrangFiltroParcs, granular), [selAnt, granular, calcCobParca, abrangFiltroParcs]);

  // ── CR por período e parceiro ─────────────────────────────────────────────
  const crA   = useMemo(()=>calcCR(crRows, filtroParcs.length?filtroParcs:null),   [crRows,   filtroParcs]);
  const crAnt = useMemo(()=>calcCR(crRowsAnt, filtroParcs.length?filtroParcs:null),[crRowsAnt,filtroParcs]);

  // ── helpers UI ─────────────────────────────────────────────────────────────
  const pill = on=>({padding:"4px 12px",borderRadius:999,fontSize:12,fontWeight:600,cursor:"pointer",border:`1.5px solid ${on?C.laranja:C.cinzaBorda}`,background:on?`${C.laranja}18`:"transparent",color:on?C.laranja:C.cinzaTexto});
  const selSty = a=>({padding:"6px 10px",borderRadius:6,border:`1.5px solid ${a?C.laranja:C.cinzaBorda}`,fontSize:13,fontWeight:600,color:a?C.laranja:C.cinzaTexto,background:C.cinzaCard});
  const pct = (v,n) => n>0 ? `${(v/n*100).toFixed(1)}%` : "—";

  const toggleParc = (p) => setFiltroParcs(prev => prev.includes(p) ? prev.filter(x=>x!==p) : [...prev,p]);
  const toggleAbrangParc = (p) => setAbrangFiltroParcs(prev => prev.includes(p) ? prev.filter(x=>x!==p) : [...prev,p]);

  if(loading) return <div style={{padding:40,color:C.cinzaTexto,fontSize:13}}>⏳ Carregando dados...</div>;

  // ── Subcomponentes internos ───────────────────────────────────────────────
  const SecaoColapsavel = ({titulo,cor,children,visivel,setVisivel,badge}) => (
    <div style={{marginTop:12,border:`1px solid ${C.cinzaBorda}`,borderRadius:10,overflow:"hidden"}}>
      <div onClick={()=>setVisivel(!visivel)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:C.cinzaFundo,cursor:"pointer",borderLeft:`3px solid ${cor}`}}>
        <span style={{fontSize:13,fontWeight:700,color:cor}}>{titulo}{badge&&<span style={{marginLeft:8,fontSize:11,fontWeight:400,color:C.cinzaTexto}}>{badge}</span>}</span>
        <span style={{fontSize:14,color:C.cinzaTexto}}>{visivel?"▾":"▸"}</span>
      </div>
      {visivel&&<div style={{padding:14}}>{children}</div>}
    </div>
  );

  const DeltaChip = ({d,inv,unit=""}) => {
    if(d==null) return <span style={{color:C.cinzaTexto}}>—</span>;
    const cor = d===0?C.cinzaTexto:(inv?d<=0:d>=0)?C.verde:C.vermelho;
    const sinal = d>0?"▲":d<0?"▼":"=";
    return <span style={{fontWeight:700,color:cor}}>{sinal} {Math.abs(d).toFixed(1)}{unit}</span>;
  };

  return (
    <div style={{maxWidth:1100,margin:"0 auto",padding:"20px 24px"}}>
      {/* ── Cabeçalho ── */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
        <div>
          <div style={{fontSize:20,fontWeight:700}}>📋 Gerador de Weekly</div>
          <div style={{fontSize:12,color:C.cinzaTexto}}>Selecione o período, preencha os racionais e exporte.</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>{
            const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Weekly</title>
            <style>body{font-family:Arial,sans-serif;color:#1C1917;padding:40px;max-width:960px;margin:0 auto}h2{border-left:4px solid #F97316;padding-left:12px;margin-top:28px}@media print{button{display:none}}</style></head><body>
            <h1>Weekly Gestão Parça — ${selA!=null?lbl(selA):"—"}</h1>
            <p style="color:#6B7280">Gerado em ${new Date().toLocaleDateString("pt-BR")}${selAnt!=null?" · comparado com "+lbl(selAnt):""}</p>
            </body></html>`;
            const b=new Blob([html],{type:"text/html"}); const u=URL.createObjectURL(b); const a=document.createElement("a"); a.href=u;a.download=`weekly-${selA!=null?lbl(selA):"periodo"}.html`;a.click();URL.revokeObjectURL(u);
          }} style={{padding:"9px 16px",borderRadius:8,border:`1.5px solid ${C.azul}`,background:"transparent",color:C.azul,fontSize:13,fontWeight:700,cursor:"pointer"}}>⬇ Exportar HTML</button>
          <button onClick={()=>{const w=window.open("","_blank"); if(w){w.document.write(`<html><body style="font-family:Arial;padding:40px;max-width:960px;margin:0 auto"><h1>Weekly — ${selA!=null?lbl(selA):"—"}</h1></body></html>`);w.document.close();setTimeout(()=>w.print(),600);}}} style={{padding:"9px 16px",borderRadius:8,background:C.laranja,color:"#fff",border:"none",fontSize:13,fontWeight:700,cursor:"pointer"}}>🖨️ Exportar PDF</button>
          <button onClick={async()=>{
            if(!window.confirm("Isso apaga TODOS os dados salvos localmente neste navegador (SLA, CSAT, Abrangência e os racionais/assuntos/problemas do Weekly) e também a cópia compartilhada no servidor (Vercel KV). Não afeta os dados do GitHub usados pelas abas SLA/CSAT/Abrangência/Score — isso é zerado direto no repositório. Quer continuar?")) return;
            if(!window.confirm("Tem certeza mesmo? Essa ação não pode ser desfeita, e os outros colaboradores também vão perder a cópia compartilhada.")) return;
            const {remotoOk} = await limparTudoLocalERemoto();
            alert(remotoOk ? "Tudo zerado (local e servidor). A página vai recarregar." : "Local zerado, mas não consegui limpar o servidor (Vercel KV) — confira a configuração. A página vai recarregar mesmo assim.");
            window.location.reload();
          }} style={{padding:"9px 16px",borderRadius:8,border:`1.5px solid ${C.vermelho}`,background:"transparent",color:C.vermelho,fontSize:13,fontWeight:700,cursor:"pointer"}}>🧹 Zerar tudo (local + servidor)</button>
        </div>
      </div>

      {/* ── Configuração do período ── */}
      <div style={{background:C.cinzaCard,border:`1px solid ${C.cinzaBorda}`,borderRadius:12,padding:20,marginBottom:16}}>
        <div style={{fontWeight:700,marginBottom:14}}>Configurar período</div>
        <div style={{display:"flex",gap:20,flexWrap:"wrap",alignItems:"flex-start"}}>
          <div>
            <div style={{fontSize:11,fontWeight:700,color:C.cinzaTexto,marginBottom:8,textTransform:"uppercase"}}>Granularidade</div>
            <div style={{display:"flex",gap:6}}>
              {[["semana","Semana"],["mes","Mês"],["trim","Trimestre"]].map(([k,l])=>(
                <button key={k} onClick={()=>{
                  setGranular(k);
                  // Seleciona automaticamente o mais recente e o penúltimo ao trocar granularidade
                  if(k==="semana"){
                    const ss=weekly.map(w=>w.s).sort((a,b)=>a-b);
                    setSelA(ss.length?ss[ss.length-1]:null);
                    setSelAnt(ss.length>1?ss[ss.length-2]:null);
                  } else if(k==="mes"){
                    const ms=[...new Set(weekly.filter(w=>w.mes).map(w=>w.mes))].sort((a,b)=>a-b);
                    setSelA(ms.length?ms[ms.length-1]:null);
                    setSelAnt(ms.length>1?ms[ms.length-2]:null);
                  } else if(k==="trim"){
                    // Trimestre: calcula baseado nos meses disponíveis
                    const ms=[...new Set(weekly.filter(w=>w.mes).map(w=>w.mes))];
                    const trims=[...new Set(ms.map(m=>m<=3?1:m<=6?2:m<=9?3:4))].sort((a,b)=>a-b);
                    setSelA(trims.length?trims[trims.length-1]:null);
                    setSelAnt(trims.length>1?trims[trims.length-2]:null);
                  }
                }} style={pill(granular===k)}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <div style={{fontSize:11,fontWeight:700,color:C.cinzaTexto,marginBottom:8,textTransform:"uppercase"}}>Período atual</div>
            <select value={selA??""} onChange={e=>setSelA(e.target.value?Number(e.target.value):null)} style={selSty(selA!=null)}>
              <option value="">Selecionar</option>
              {periodos.map(p=><option key={p} value={p}>{lbl(p)}</option>)}
            </select>
          </div>
          <div>
            <div style={{fontSize:11,fontWeight:700,color:C.cinzaTexto,marginBottom:8,textTransform:"uppercase"}}>Período anterior (para Δ)</div>
            <select value={selAnt??""} onChange={e=>setSelAnt(e.target.value?Number(e.target.value):null)} style={selSty(false)}>
              <option value="">Nenhum</option>
              {periodos.filter(p=>p!==selA).map(p=><option key={p} value={p}>{lbl(p)}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ── Filtro global por parceiro ── */}
      {todosParceiros.length>0&&(
        <div style={{background:C.cinzaCard,border:`1px solid ${C.cinzaBorda}`,borderRadius:12,padding:16,marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:mostrarFiltroParceiro?10:0}}>
            <div style={{fontSize:12,fontWeight:700,color:C.cinzaTexto,textTransform:"uppercase",display:"flex",alignItems:"center",gap:8}}>
              Filtrar por parceiro
              {filtroParcs.length>0&&<span style={{background:C.laranja,color:"#fff",borderRadius:99,padding:"1px 7px",fontSize:11}}>{filtroParcs.length}</span>}
            </div>
            <div style={{display:"flex",gap:6}}>
              {filtroParcs.length>0&&<button onClick={()=>setFiltroParcs([])} style={{fontSize:11,fontWeight:600,color:C.cinzaTexto,background:"transparent",border:`1px solid ${C.cinzaBorda}`,borderRadius:6,padding:"3px 8px",cursor:"pointer"}}>Limpar</button>}
              <button onClick={()=>setMostrarFiltroParceiro(v=>!v)} style={{fontSize:11,fontWeight:600,color:C.cinzaTexto,background:"transparent",border:`1px solid ${C.cinzaBorda}`,borderRadius:6,padding:"3px 8px",cursor:"pointer"}}>
                {mostrarFiltroParceiro?"▾ Ocultar":"▸ Mostrar"}
              </button>
            </div>
          </div>
          {mostrarFiltroParceiro&&<>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {todosParceiros.map(p=>(
                <button key={p} onClick={()=>toggleParc(p)} style={pill(filtroParcs.includes(p))}>{p}</button>
              ))}
            </div>
            {filtroParcs.length>0&&<div style={{fontSize:11,color:C.laranja,marginTop:8}}>Mostrando dados de: {filtroParcs.join(", ")}</div>}
          </>}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ── 1. ABRANGÊNCIA ── */}
      <div style={{background:C.cinzaCard,border:`1px solid ${C.cinzaBorda}`,borderRadius:12,padding:20,marginBottom:14}}>
        <div style={{fontWeight:700,fontSize:15,borderLeft:`4px solid ${C.laranja}`,paddingLeft:12,marginBottom:14}}>🗺️ Abrangência Parça</div>

        {cobParca ? <>
          {/* KPIs principais */}
          <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:12}}>
            <Kpi label={`Cobertura Parça${selA!=null?` (${lbl(selA)})`:""}`} valor={`${cobParca.pct.toFixed(1)}%`} cor={cobParca.pct>=50?C.verde:C.vermelho} sub={`${cobParca.parca.toLocaleString("pt-BR")} de ${cobParca.total.toLocaleString("pt-BR")} coletas`}/>
            {cobParcaAnt&&<Kpi label={`Anterior${selAnt!=null?` (${lbl(selAnt)})`:""}`} valor={`${cobParcaAnt.pct.toFixed(1)}%`} cor={C.cinzaTexto} sub={`${cobParcaAnt.parca.toLocaleString("pt-BR")} de ${cobParcaAnt.total.toLocaleString("pt-BR")} coletas`}/>}
            {cobParcaAnt&&(()=>{const d=Math.round((cobParca.pct-cobParcaAnt.pct)*100)/100;return <Kpi label="Variação cobertura" valor={`${d>=0?"+":""}${d.toFixed(2)} p.p.`} cor={d>=0?C.verde:C.vermelho} sub="vs período anterior"/>;})()} 
          </div>

          {/* Share por transportadora parça — colapsável */}
          <SecaoColapsavel titulo="📊 Share de coletas por transportadora Parça" cor={C.laranja} visivel={abrangMostrarShare} setVisivel={setAbrangMostrarShare}
            badge={`${cobParca.transpList.length} transportadoras`}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,marginBottom:8}}>
              <thead><tr style={{background:C.cinzaFundo}}>
                <th style={{padding:"5px 8px",textAlign:"left",fontSize:10,fontWeight:700,color:C.cinzaTexto,textTransform:"uppercase"}}>Transportadora</th>
                <th style={{padding:"5px 8px",textAlign:"right",fontSize:10,fontWeight:700,color:C.azul,textTransform:"uppercase"}}>Coletas{selA!=null?` (${lbl(selA)})`:""}  </th>
                <th style={{padding:"5px 8px",textAlign:"right",fontSize:10,fontWeight:700,color:C.azul,textTransform:"uppercase"}}>Share{selA!=null?` (${lbl(selA)})`:""}  </th>
                {cobParcaAnt&&<th style={{padding:"5px 8px",textAlign:"right",fontSize:10,fontWeight:700,color:C.cinzaTexto,textTransform:"uppercase"}}>Coletas ant.{selAnt!=null?` (${lbl(selAnt)})`:""}  </th>}
                {cobParcaAnt&&<th style={{padding:"5px 8px",textAlign:"right",fontSize:10,fontWeight:700,color:C.cinzaTexto,textTransform:"uppercase"}}>Share ant.</th>}
                {cobParcaAnt&&<th style={{padding:"5px 8px",textAlign:"right",fontSize:10,fontWeight:700,color:C.cinzaTexto,textTransform:"uppercase"}}>Δ</th>}
              </tr></thead>
              <tbody>
                {cobParca.transpList.map((t,i)=>{
                  const tAnt = cobParcaAnt?.transpList.find(x=>x.nome===t.nome);
                  const d = tAnt!=null ? Math.round((t.share-tAnt.share)*100)/100 : null;
                  return <tr key={t.nome} style={{borderTop:`1px solid ${C.cinzaBorda}`,background:i%2===0?"transparent":C.cinzaFundo}}>
                    <td style={{padding:"5px 8px",fontWeight:600}}>{t.nome}</td>
                    <td style={{padding:"5px 8px",textAlign:"right"}}>{t.coletas.toLocaleString("pt-BR")}</td>
                    <td style={{padding:"5px 8px",textAlign:"right",fontWeight:700,color:C.verde}}>{t.share!=null?t.share.toFixed(1)+"%" :"—"}</td>
                    {cobParcaAnt&&<td style={{padding:"5px 8px",textAlign:"right",color:C.cinzaTexto}}>{tAnt?tAnt.coletas.toLocaleString("pt-BR"):"—"}</td>}
                    {cobParcaAnt&&<td style={{padding:"5px 8px",textAlign:"right",color:C.cinzaTexto}}>{tAnt?`${tAnt.share.toFixed(1)}%`:"—"}</td>}
                    {cobParcaAnt&&<td style={{padding:"5px 8px",textAlign:"right"}}><DeltaChip d={d} inv={false} unit=" p.p."/></td>}
                  </tr>;
                })}
                <tr style={{borderTop:`2px solid ${C.cinzaBorda}`,fontWeight:700}}>
                  <td style={{padding:"5px 8px"}}>Total Parça</td>
                  <td style={{padding:"5px 8px",textAlign:"right"}}>{cobParca.parca.toLocaleString("pt-BR")}</td>
                  <td style={{padding:"5px 8px",textAlign:"right",color:C.verde}}>{cobParca.pct.toFixed(1)}%</td>
                  {cobParcaAnt&&<td style={{padding:"5px 8px",textAlign:"right",color:C.cinzaTexto}}>{cobParcaAnt.parca.toLocaleString("pt-BR")}</td>}
                  {cobParcaAnt&&<td style={{padding:"5px 8px",textAlign:"right",color:C.cinzaTexto}}>{cobParcaAnt.pct.toFixed(1)}%</td>}
                  {cobParcaAnt&&<td style={{padding:"5px 8px",textAlign:"right"}}><DeltaChip d={Math.round((cobParca.pct-cobParcaAnt.pct)*100)/100} inv={false} unit=" p.p."/></td>}
                </tr>
              </tbody>
            </table>
          </SecaoColapsavel>

          {/* Cobertura por estado — colapsável */}
          <SecaoColapsavel titulo="🗺️ Cobertura por estado" cor="#7C3AED" visivel={abrangMostrarEstados} setVisivel={setAbrangMostrarEstados}
            badge={`${cobParca.ufList.length} estados`}>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead><tr style={{background:C.cinzaFundo}}>
                  {["Estado","Coletas","Parça","% Cobertura"].map((h,i)=><th key={h} style={{padding:"5px 8px",textAlign:i===0?"left":"right",fontSize:10,fontWeight:700,color:C.cinzaTexto,textTransform:"uppercase"}}>{h}</th>)}
                </tr></thead>
                <tbody>{cobParca.ufList.slice(0,15).map((u,i)=>{
                  const cor=u.pct>=75?C.verde:u.pct>=40?C.amarelo:C.vermelho;
                  return <tr key={u.uf} style={{borderTop:`1px solid ${C.cinzaBorda}`,background:i%2===0?"transparent":C.cinzaFundo}}>
                    <td style={{padding:"5px 8px",fontWeight:600}}>{u.uf}</td>
                    <td style={{padding:"5px 8px",textAlign:"right"}}>{u.total.toLocaleString("pt-BR")}</td>
                    <td style={{padding:"5px 8px",textAlign:"right"}}>{u.parca.toLocaleString("pt-BR")}</td>
                    <td style={{padding:"5px 8px",textAlign:"right"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,justifyContent:"flex-end"}}>
                        <div style={{width:70,height:7,background:"#E5E3DF",borderRadius:4,overflow:"hidden"}}>
                          <div style={{width:`${Math.round(u.pct)}%`,height:"100%",background:cor,borderRadius:4}}/>
                        </div>
                        <span style={{fontWeight:700,color:cor,minWidth:40,textAlign:"right"}}>{u.pct!=null?u.pct.toFixed(1)+"%":"—"}</span>
                      </div>
                    </td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          </SecaoColapsavel>
        </> : <p style={{color:C.cinzaTexto,fontSize:13,margin:0}}>Sem dados. Importe na aba <strong>Abrangência Parça</strong>.</p>}

        <RacionalBox valor={racionais.abrangencia} onChange={v=>setR("abrangencia",v)} label="Weekly"/>
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ── 2. INDICADORES ── */}
      <div style={{background:C.cinzaCard,border:`1px solid ${C.cinzaBorda}`,borderRadius:12,padding:20,marginBottom:14}}>
        <div style={{fontWeight:700,fontSize:15,borderLeft:`4px solid ${C.azul}`,paddingLeft:12,marginBottom:14}}>📊 Indicadores SLA / Agendamento / Aderência</div>

        {indA ? <>
          {/* Tabela geral */}
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,marginBottom:16}}>
            <thead><tr style={{background:C.cinzaFundo}}>
              <th style={{padding:"6px 10px",textAlign:"left",fontSize:11,color:C.cinzaTexto,textTransform:"uppercase"}}>Indicador</th>
              <th style={{padding:"6px 10px",textAlign:"center",fontSize:11,color:C.azul,textTransform:"uppercase"}}>Atual{selA!=null?` (${lbl(selA)})`:""}  </th>
              <th style={{padding:"6px 10px",textAlign:"center",fontSize:11,color:C.azul,textTransform:"uppercase"}}>Coletas{selA!=null?` (${lbl(selA)})`:""}  </th>
              {indAnt&&<th style={{padding:"6px 10px",textAlign:"center",fontSize:11,color:C.cinzaTexto,textTransform:"uppercase"}}>Anterior{selAnt!=null?` (${lbl(selAnt)})`:""}  </th>}
              {indAnt&&<th style={{padding:"6px 10px",textAlign:"center",fontSize:11,color:C.cinzaTexto,textTransform:"uppercase"}}>Coletas ant.{selAnt!=null?` (${lbl(selAnt)})`:""}  </th>}
              {indAnt&&<th style={{padding:"6px 10px",textAlign:"center",fontSize:11,color:C.cinzaTexto,textTransform:"uppercase"}}>Δ</th>}
              <th style={{padding:"6px 10px",textAlign:"center",fontSize:11,color:C.cinzaTexto,textTransform:"uppercase"}}>Meta</th>
            </tr></thead>
            <tbody>{INDICADORES.map((ind,i)=>{
              const vA=indA[ind.key],vAnt=indAnt?.[ind.key];
              const d=vA!=null&&vAnt!=null?Math.round((vA-vAnt)*100)/100:null;
              const {texto:dt,cor:dc}=fmtDelta(d,ind.inv);
              return <tr key={ind.key} style={{borderTop:`1px solid ${C.cinzaBorda}`,background:i%2?"transparent":C.cinzaFundo}}>
                <td style={{padding:"6px 10px",fontWeight:600}}>{ind.label}</td>
                <td style={{padding:"6px 10px",textAlign:"center",fontWeight:700,color:corInd(vA,ind)}}>{fmtInd(vA,ind)}</td>
                <td style={{padding:"6px 10px",textAlign:"center",color:C.cinzaTexto}}>{indA.total!=null?indA.total.toLocaleString("pt-BR"):"—"}</td>
                {indAnt&&<td style={{padding:"6px 10px",textAlign:"center",color:C.cinzaTexto}}>{fmtInd(vAnt,ind)}</td>}
                {indAnt&&<td style={{padding:"6px 10px",textAlign:"center",color:C.cinzaTexto}}>{indAnt.total!=null?indAnt.total.toLocaleString("pt-BR"):"—"}</td>}
                {indAnt&&<td style={{padding:"6px 10px",textAlign:"center",fontWeight:700,color:dc}}>{dt}</td>}
                <td style={{padding:"6px 10px",textAlign:"center",color:C.cinzaTexto}}>{ind.inv?`≤${ind.meta}${ind.unit}`:`${ind.meta}${ind.unit}`}</td>
              </tr>;
            })}</tbody>
          </table>

          {/* Movimentos — por parceiro */}
          {Object.keys(movimentos.porParceiro).length>0&&(
            <SecaoColapsavelSimples titulo="⚡ Movimentos por parceiro" cor={C.azul}>
              {Object.entries(movimentos.porParceiro)
                .sort((a,b)=>{const ma=Math.max(...a[1].map(x=>Math.abs(x.d)));const mb=Math.max(...b[1].map(x=>Math.abs(x.d)));return mb-ma;})
                .map(([parc,items])=>(
                <div key={parc} style={{marginBottom:10,padding:12,background:C.cinzaFundo,borderRadius:8,borderLeft:`3px solid ${C.azul}`}}>
                  <div style={{fontWeight:700,marginBottom:8,fontSize:13}}>{parc}</div>
                  <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                    {items.map((m,i)=>{
                      const cor = m.d===0?C.cinzaTexto:(m.inv?m.d<=0:m.d>=0)?C.verde:C.vermelho;
                      return <div key={i} style={{background:C.cinzaCard,border:`1px solid ${C.cinzaBorda}`,borderRadius:8,padding:"8px 12px",minWidth:110}}>
                        <div style={{fontSize:11,color:C.cinzaTexto,marginBottom:2}}>{m.ind}</div>
                        <div style={{fontSize:13,fontWeight:700,color:cor}}>{m.d!=null?(m.d>=0?"+":"")+m.d.toFixed(1)+m.unit:"atual"}</div>
                        <div style={{fontSize:11,color:C.cinzaTexto}}>{m.ant!=null?fmtInd(m.ant,{inv:m.inv,unit:m.unit})+"  →  ":""}{fmtInd(m.atual,{inv:m.inv,unit:m.unit})}</div>
                      </div>;
                    })}
                  </div>
                </div>
              ))}
            </SecaoColapsavelSimples>
          )}

        </> : <p style={{color:C.cinzaTexto,fontSize:13,margin:0}}>Sem dados de SLA. Carregue o CSV na aba <strong>Performance Coleta</strong>.</p>}

        <RacionalBox valor={racionais.indicadores} onChange={v=>setR("indicadores",v)} label="Weekly"/>
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ── 3. COLETA X RECEBIMENTO ── */}
      <div style={{background:C.cinzaCard,border:`1px solid ${C.cinzaBorda}`,borderRadius:12,padding:20,marginBottom:14}}>
        <div style={{fontWeight:700,fontSize:15,borderLeft:`4px solid ${C.verde}`,paddingLeft:12,marginBottom:14}}>📦 Coleta x Recebimento</div>

        {crA && crA.n>0 ? <>
          {/* Geral */}
          <div style={{fontSize:12,fontWeight:700,color:C.cinzaTexto,marginBottom:8,textTransform:"uppercase"}}>Visão Geral</div>
          <CRTabela crA={crA} crAnt={crRowsAnt.length>0?crAnt:null}/>

          {/* Por parceiro */}
          {Object.keys(crA.porParceiro).length>1&&(
            <SecaoColapsavelSimples titulo="Por parceiro" cor={C.verde}>
              <CRTabelaParceiro crA={crA} crAnt={crRowsAnt.length>0?crAnt:null}/>
            </SecaoColapsavelSimples>
          )}
        </> : <p style={{color:C.cinzaTexto,fontSize:13,margin:0}}>Sem dados. Importe na aba <strong>Performance Coleta → Coleta x Recebimento</strong>.</p>}

        <RacionalBox valor={racionais.coletaReceb} onChange={v=>setR("coletaReceb",v)} label="Weekly"/>
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ── 4. PROBLEMAS DE COLETA EM ABERTO ── */}
      <div style={{background:C.cinzaCard,border:`1px solid ${C.cinzaBorda}`,borderRadius:12,padding:20,marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
          <div style={{fontWeight:700,fontSize:15,borderLeft:`4px solid ${C.vermelho}`,paddingLeft:12}}>⚠️ Problemas de Coleta em Aberto</div>
          <span style={{fontSize:10,color:"#9CA3AF"}}>💾 salvo automaticamente</span>
        </div>
        <ProblemasColeta semana={selA} granular={granular}/>
        <RacionalBox valor={racionais.problemas||""} onChange={v=>setR("problemas",v)} label="Weekly"/>
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ── 5. CSAT ── */}
      <div style={{background:C.cinzaCard,border:`1px solid ${C.cinzaBorda}`,borderRadius:12,padding:20,marginBottom:14}}>
        <div style={{fontWeight:700,fontSize:15,borderLeft:`4px solid #7C3AED`,paddingLeft:12,marginBottom:14}}>⭐ CSAT</div>

        {csatA ? <>
          {/* Geral */}
          <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:12}}>
            <Kpi label={`Share notas 4-5${selA!=null?` (${lbl(selA)})`:""}  `} valor={csatA.share!=null?`${(csatA.share*100).toFixed(1)}%`:"—"} cor="#7C3AED" sub={`${csatA.respostas||0} respostas${csatA.label?` · ${csatA.label}`:""}`}/>
            {csatAnt&&<Kpi label={`Anterior${selAnt!=null?` (${lbl(selAnt)})`:""}  `} valor={csatAnt.share!=null?`${(csatAnt.share*100).toFixed(1)}%`:"—"} cor={C.cinzaTexto} sub={`${csatAnt.respostas||0} respostas`}/>}
            {csatAnt&&csatA?.share!=null&&csatAnt?.share!=null&&(()=>{const d=Math.round((csatA.share-csatAnt.share)*1000)/10;return <Kpi label="Variação" valor={`${d>=0?"+":""}${d.toFixed(1)} p.p.`} cor={d>=0?C.verde:C.vermelho} sub="vs período anterior"/>;})()} 
          </div>

          {/* Por parceiro */}
          {Object.keys(csatPorParceiro).length>0&&(
            <SecaoColapsavelSimples titulo="Por parceiro" cor="#7C3AED">
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead><tr style={{background:C.cinzaFundo}}>
                  <th style={{padding:"5px 8px",textAlign:"left",fontSize:10,color:C.cinzaTexto,textTransform:"uppercase"}}>Parceiro</th>
                  <th style={{padding:"5px 8px",textAlign:"center",fontSize:10,color:"#7C3AED",textTransform:"uppercase"}}>Share{selA!=null?` (${lbl(selA)})`:""}  </th>
                  <th style={{padding:"5px 8px",textAlign:"center",fontSize:10,color:C.cinzaTexto,textTransform:"uppercase"}}>Respostas</th>
                  {selAnt!=null&&<th style={{padding:"5px 8px",textAlign:"center",fontSize:10,color:C.cinzaTexto,textTransform:"uppercase"}}>Anterior</th>}
                  {selAnt!=null&&<th style={{padding:"5px 8px",textAlign:"center",fontSize:10,color:C.cinzaTexto,textTransform:"uppercase"}}>Δ</th>}
                </tr></thead>
                <tbody>
                  {Object.entries(csatPorParceiro)
                    .filter(([p])=>!filtroParcs.length||filtroParcs.includes(p))
                    .map(([p,dados],i)=>{
                      // Filtra as semanas do parceiro pelo período selecionado (semana, mês ou trimestre)
                      const semA = (() => {
                        if(selA==null) return dados.semanas;
                        if(granular==="semana") return dados.semanas.filter(s=>s.semana===selA);
                        if(granular==="mes")    return dados.semanas.filter(s=>parseInt(s.mes)===selA);
                        if(granular==="trim")   return dados.semanas.filter(s=>(TRIM_MESES[selA]||[]).includes(s.mes));
                        return dados.semanas;
                      })();
                      const semAntObj = (() => {
                        if(selAnt==null) return [];
                        if(granular==="semana") return dados.semanas.filter(s=>s.semana===selAnt);
                        if(granular==="mes")    return dados.semanas.filter(s=>parseInt(s.mes)===selAnt);
                        if(granular==="trim")   return dados.semanas.filter(s=>(TRIM_MESES[selAnt]||[]).includes(s.mes));
                        return [];
                      })();
                      const aggShare = (ss) => { const tot=ss.reduce((a,s)=>a+(s.respostas||0),0); const n45=ss.reduce((a,s)=>a+Math.round((s.share||0)*(s.respostas||0)),0); return tot?n45/tot:null; };
                      const shareAt = aggShare(semA);
                      const shareAnt = semAntObj.length?aggShare(semAntObj):null;
                      const d = shareAt!=null&&shareAnt!=null?Math.round((shareAt-shareAnt)*1000)/10:null;
                      return <tr key={p} style={{borderTop:`1px solid ${C.cinzaBorda}`,background:i%2===0?"transparent":C.cinzaFundo}}>
                        <td style={{padding:"5px 8px",fontWeight:600}}>{p}</td>
                        <td style={{padding:"5px 8px",textAlign:"center",fontWeight:700,color:"#7C3AED"}}>{shareAt!=null?`${(shareAt*100).toFixed(1)}%`:"—"}</td>
                        <td style={{padding:"5px 8px",textAlign:"center",color:C.cinzaTexto}}>{semA.reduce((a,s)=>a+(s.respostas||0),0)||"—"}</td>
                        {selAnt!=null&&<td style={{padding:"5px 8px",textAlign:"center",color:C.cinzaTexto}}>{shareAnt!=null?`${(shareAnt*100).toFixed(1)}%`:"—"}</td>}
                        {selAnt!=null&&<td style={{padding:"5px 8px",textAlign:"center"}}><DeltaChip d={d} inv={false} unit=" p.p."/></td>}
                      </tr>;
                    })
                  }
                </tbody>
              </table>
            </SecaoColapsavelSimples>
          )}
        </> : <p style={{color:C.cinzaTexto,fontSize:13,margin:0}}>Sem dados de CSAT. Importe na aba <strong>CSAT</strong>.</p>}

        <RacionalBox valor={racionais.csat} onChange={v=>setR("csat",v)} label="Weekly"/>
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ── 5. ASSUNTOS GERAIS ── */}
      <div style={{background:C.cinzaCard,border:`1px solid ${C.cinzaBorda}`,borderRadius:12,padding:20,marginBottom:14}}>
        <div style={{fontWeight:700,fontSize:15,borderLeft:`4px solid ${C.cinzaTexto}`,paddingLeft:12,marginBottom:14}}>📋 Assuntos Gerais</div>
        <AssuntosGerais semana={selA} granular={granular}/>
      </div>

    </div>
  );
}

// ── Sub-componentes estáticos ─────────────────────────────────────────────────
function Kpi({label,valor,cor,sub}) {
  return (
    <div style={{background:"#F8F7F4",border:`1px solid #E5E3DF`,borderRadius:10,padding:"12px 16px",minWidth:140}}>
      <div style={{fontSize:11,color:"#6B7280",marginBottom:4}}>{label}</div>
      <div style={{fontSize:22,fontWeight:700,color:cor||"#1C1917"}}>{valor}</div>
      {sub&&<div style={{fontSize:11,color:"#6B7280",marginTop:2}}>{sub}</div>}
    </div>
  );
}

function SecaoColapsavelSimples({titulo,cor,children}) {
  const [visivel, setVisivel] = useState(true);
  return (
    <div style={{marginTop:12,border:`1px solid #E5E3DF`,borderRadius:10,overflow:"hidden"}}>
      <div onClick={()=>setVisivel(!visivel)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:"#F8F7F4",cursor:"pointer",borderLeft:`3px solid ${cor}`}}>
        <span style={{fontSize:13,fontWeight:700,color:cor}}>{titulo}</span>
        <span style={{fontSize:14,color:"#6B7280"}}>{visivel?"▾":"▸"}</span>
      </div>
      {visivel&&<div style={{padding:14}}>{children}</div>}
    </div>
  );
}

function RacionalBox({valor,onChange,label}) {
  return (
    <div style={{marginTop:14}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
        <div style={{fontSize:11,fontWeight:700,color:"#6B7280",textTransform:"uppercase"}}>Racional / Observações</div>
        <span style={{fontSize:10,color:"#9CA3AF"}}>💾 salvo automaticamente</span>
      </div>
      <textarea value={valor} onChange={e=>onChange(e.target.value)}
        placeholder={`Escreva o racional desta seção para o ${label}...`} rows={3}
        style={{width:"100%",padding:"10px 12px",borderRadius:8,border:"1px solid #E5E3DF",fontSize:13,fontFamily:"inherit",resize:"vertical",boxSizing:"border-box",background:"#F8F7F4",outline:"none"}}/>
    </div>
  );
}

const ASSUNTO_VAZIO = [{id:1, texto:"", tipo:"info"}];

function AssuntosGerais({ semana, granular }) {
  const [itens, setItens] = useState(ASSUNTO_VAZIO);
  const itensCarregados = useRef(false); // evita salvar antes de carregar o localStorage do período

  // Carrega os assuntos salvos sempre que o período selecionado (semana/mês/trimestre) mudar
  useEffect(() => {
    (async () => {
      await sincronizarAntesDeLer(["weeklyAssuntos"]); // busca o que outras pessoas escreveram antes de ler local
      const chave = `${granular ?? "semana"}_${semana ?? "geral"}`;
      const todos = lerLS(WEEKLY_ASSUNTOS_KEY, {});
      const salvos = todos[chave];
      itensCarregados.current = false;
      setItens(salvos && salvos.length ? salvos : ASSUNTO_VAZIO);
      itensCarregados.current = true;
    })();
  }, [semana, granular]);

  // Salva automaticamente sempre que um assunto for adicionado, editado ou removido, e
  // publica pro backend compartilhado para que outras pessoas vejam os mesmos assuntos
  useEffect(() => {
    if (!itensCarregados.current) return; // não sobrescreve enquanto ainda está carregando
    const chave = `${granular ?? "semana"}_${semana ?? "geral"}`;
    const todos = lerLS(WEEKLY_ASSUNTOS_KEY, {});
    todos[chave] = itens;
    salvarLS(WEEKLY_ASSUNTOS_KEY, todos);
    publicarApósImportar("weeklyAssuntos", todos);
  }, [itens, semana, granular]);

  const addItem = () => setItens(prev=>[...prev, {id:Date.now(), texto:"", tipo:"info"}]);
  const removeItem = (id) => setItens(prev=>prev.filter(x=>x.id!==id));
  const updateItem = (id, campo, val) => setItens(prev=>prev.map(x=>x.id===id?{...x,[campo]:val}:x));

  const TIPOS = [
    {key:"info",    label:"ℹ️ Info",    cor:"#2563EB"},
    {key:"acao",    label:"✅ Ação",    cor:"#16A34A"},
    {key:"alerta",  label:"⚠️ Alerta", cor:"#CA8A04"},
    {key:"critico", label:"🔴 Crítico", cor:"#DC2626"},
  ];

  return (
    <div>
      <div style={{fontSize:12,color:"#6B7280",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap"}}>
        <span>Registre assuntos, ações e pontos de atenção que serão discutidos na reunião.</span>
        <span style={{fontSize:10,color:"#9CA3AF",whiteSpace:"nowrap"}}>💾 salvo automaticamente</span>
      </div>
      {itens.map((item,i)=>(
        <div key={item.id} style={{display:"flex",gap:8,alignItems:"flex-start",marginBottom:8}}>
          <select value={item.tipo} onChange={e=>updateItem(item.id,"tipo",e.target.value)}
            style={{padding:"7px 8px",borderRadius:6,border:"1px solid #E5E3DF",fontSize:12,fontWeight:600,
              color:TIPOS.find(t=>t.key===item.tipo)?.cor||"#6B7280",flexShrink:0,background:"#F8F7F4"}}>
            {TIPOS.map(t=><option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          <textarea
            value={item.texto}
            onChange={e=>updateItem(item.id,"texto",e.target.value)}
            placeholder={`Assunto ${i+1}...`}
            rows={2}
            style={{flex:1,padding:"7px 10px",borderRadius:6,border:"1px solid #E5E3DF",fontSize:13,
              fontFamily:"inherit",resize:"vertical",outline:"none",background:"#F8F7F4"}}/>
          <button onClick={()=>removeItem(item.id)}
            style={{padding:"7px 8px",background:"none",border:"1px solid #E5E3DF",borderRadius:6,
              cursor:"pointer",color:"#6B7280",fontSize:14,flexShrink:0}}>✕</button>
        </div>
      ))}
      <button onClick={addItem}
        style={{marginTop:4,padding:"7px 14px",borderRadius:6,border:"1.5px dashed #E5E3DF",
          background:"transparent",color:"#6B7280",fontSize:13,cursor:"pointer",fontWeight:600}}>
        + Adicionar assunto
      </button>
    </div>
  );
}

function ProblemasColeta({ semana, granular }) {
  const LOJAS = ["Madeira Madeira", "Marketplace"];
  const FAIXAS = ["0 a 2 dias", "2 a 5 dias", "5 a 10 dias", "10 a 30 dias"];

  const dadosVazio = () => {
    const d = {};
    LOJAS.forEach(l => {
      d[l] = {};
      FAIXAS.forEach(f => { d[l][f] = {qtde:""}; });
    });
    return d;
  };

  // Estado: {loja: {faixa: {aging: "", qtde: ""}}}
  const [dados, setDados] = useState(dadosVazio);
  const dadosCarregados = useRef(false); // evita salvar antes de carregar o localStorage do período

  // Carrega os dados salvos sempre que o período selecionado (semana/mês/trimestre) mudar
  useEffect(() => {
    (async () => {
      await sincronizarAntesDeLer(["weeklyProblemas"]); // busca o que outras pessoas preencheram antes de ler local
      const chave = `${granular ?? "semana"}_${semana ?? "geral"}`;
      const todos = lerLS(WEEKLY_PROBLEMAS_KEY, {});
      dadosCarregados.current = false;
      setDados(todos[chave] || dadosVazio());
      dadosCarregados.current = true;
    })();
  }, [semana, granular]);

  // Salva automaticamente sempre que uma quantidade for preenchida/alterada, e publica
  // pro backend compartilhado para que outras pessoas vejam os mesmos números
  useEffect(() => {
    if (!dadosCarregados.current) return; // não sobrescreve enquanto ainda está carregando
    const chave = `${granular ?? "semana"}_${semana ?? "geral"}`;
    const todos = lerLS(WEEKLY_PROBLEMAS_KEY, {});
    todos[chave] = dados;
    salvarLS(WEEKLY_PROBLEMAS_KEY, todos);
    publicarApósImportar("weeklyProblemas", todos);
  }, [dados, semana, granular]);

  const upd = (loja, faixa, campo, val) =>
    setDados(prev => ({...prev, [loja]: {...prev[loja], [faixa]: {...prev[loja][faixa], [campo]: val}}}));

  const totalLoja = (loja, campo) =>
    FAIXAS.reduce((s,f) => s + (parseFloat(dados[loja][f][campo])||0), 0);

  const totalGeral = (campo) =>
    LOJAS.reduce((s,l) => s + totalLoja(l,campo), 0);

  const inp = (loja, faixa, campo) => (
    <input
      type="number" min="0"
      value={dados[loja][faixa][campo]}
      onChange={e => upd(loja, faixa, campo, e.target.value)}
      placeholder="—"
      style={{width:"100%", padding:"4px 6px", border:"1px solid #E5E3DF",
        borderRadius:4, fontSize:12, textAlign:"right", background:"#F8F7F4",
        outline:"none", boxSizing:"border-box"}}
    />
  );

  const th = (txt, right) => (
    <th style={{padding:"7px 10px", fontSize:11, fontWeight:700, color:"#6B7280",
      textTransform:"uppercase", textAlign:right?"right":"left",
      background:"#F8F7F4", whiteSpace:"nowrap"}}>{txt}</th>
  );

  const tdVal = (val, bold, cor) => (
    <td style={{padding:"6px 10px", textAlign:"right", fontWeight:bold?700:400,
      color:cor||"#1C1917", fontSize:12}}>{val||"—"}</td>
  );

  return (
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%", borderCollapse:"collapse", fontSize:12}}>
        <thead>
          <tr>
            {th("Loja")}
            {th("Aging")}
            {th("Qtde Pedidos", true)}
          </tr>
        </thead>
        <tbody>
          {LOJAS.map((loja, li) => (
            <>
              {FAIXAS.map((faixa, fi) => (
                <tr key={`${loja}-${faixa}`} style={{borderTop:"1px solid #E5E3DF",
                  background:li%2===0?"transparent":"#F8F7F4"}}>
                  {fi===0 && (
                    <td rowSpan={FAIXAS.length} style={{padding:"6px 10px",
                      fontWeight:700, verticalAlign:"top", borderRight:"1px solid #E5E3DF",
                      color:"#1C1917", whiteSpace:"nowrap"}}>
                      {loja}
                    </td>
                  )}
                  <td style={{padding:"6px 10px", color:"#6B7280", whiteSpace:"nowrap"}}>{faixa}</td>
                  <td style={{padding:"4px 6px", width:120}}>{inp(loja, faixa, "qtde")}</td>
                </tr>
              ))}
              {/* Total da loja */}
              <tr style={{borderTop:"2px solid #E5E3DF", background:li%2===0?"#EFF6FF":"#F0FDF4"}}>
                <td colSpan={2} style={{padding:"6px 10px", fontWeight:700,
                  fontSize:12, color:"#1C1917"}}>
                  {loja} Total
                </td>
                {tdVal(totalLoja(loja,"qtde")||"—", true)}
              </tr>
            </>
          ))}
          {/* Total geral */}
          <tr style={{borderTop:"2px solid #1C1917", background:"#1C1917"}}>
            <td colSpan={2} style={{padding:"7px 10px", fontWeight:700,
              fontSize:12, color:"#FFFFFF"}}>
              Total Geral
            </td>
            <td style={{padding:"7px 10px", textAlign:"right", fontWeight:700,
              color:"#FFFFFF", fontSize:12}}>{totalGeral("qtde")||"—"}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function CRTabela({crA, crAnt}) {
  const C2 = {verde:"#16A34A",vermelho:"#DC2626",cinzaTexto:"#6B7280",cinzaBorda:"#E5E3DF",cinzaFundo:"#F8F7F4"};
  const pct = (v,n) => n>0 ? `${(v/n*100).toFixed(1)}%` : "—";
  const faixas = [
    {label:"Mesma data",     vA:crA.mesma, vAnt:crAnt?.mesma},
    {label:"1 dia útil",    vA:crA.um,    vAnt:crAnt?.um},
    {label:"2 dias úteis",  vA:crA.dois,  vAnt:crAnt?.dois},
    {label:"3+ dias úteis", vA:crA.tres,  vAnt:crAnt?.tres},
  ];
  return (
    <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
      <thead><tr style={{background:C2.cinzaFundo}}>
        <th style={{padding:"6px 10px",textAlign:"left",fontSize:11,color:C2.cinzaTexto,textTransform:"uppercase"}}>Faixa</th>
        <th style={{padding:"6px 10px",textAlign:"right",fontSize:11,color:"#2563EB",textTransform:"uppercase"}}>Coletas</th>
        <th style={{padding:"6px 10px",textAlign:"right",fontSize:11,color:"#2563EB",textTransform:"uppercase"}}>%</th>
        {crAnt&&<th style={{padding:"6px 10px",textAlign:"right",fontSize:11,color:C2.cinzaTexto,textTransform:"uppercase"}}>% Ant.</th>}
        {crAnt&&<th style={{padding:"6px 10px",textAlign:"right",fontSize:11,color:C2.cinzaTexto,textTransform:"uppercase"}}>Δ</th>}
      </tr></thead>
      <tbody>
        {faixas.map(({label,vA,vAnt},i)=>{
          const pA=crA.n>0?vA/crA.n*100:null;
          const pAnt=crAnt&&crAnt.n>0?vAnt/crAnt.n*100:null;
          const d=pA!=null&&pAnt!=null?Math.round((pA-pAnt)*100)/100:null;
          const cor=d==null?null:d>=0?C2.verde:C2.vermelho;
          return <tr key={label} style={{borderTop:`1px solid ${C2.cinzaBorda}`,background:i%2===0?"transparent":C2.cinzaFundo}}>
            <td style={{padding:"6px 10px"}}>{label}</td>
            <td style={{padding:"6px 10px",textAlign:"right"}}>{vA}</td>
            <td style={{padding:"6px 10px",textAlign:"right",fontWeight:600}}>{pct(vA,crA.n)}</td>
            {crAnt&&<td style={{padding:"6px 10px",textAlign:"right",color:C2.cinzaTexto}}>{pct(vAnt,crAnt.n)}</td>}
            {crAnt&&<td style={{padding:"6px 10px",textAlign:"right",fontWeight:700,color:cor}}>{d==null?"—":`${d>=0?"+":""}${d.toFixed(2)} p.p.`}</td>}
          </tr>;
        })}
        <tr style={{borderTop:`2px solid ${C2.cinzaBorda}`,fontWeight:700}}>
          <td style={{padding:"6px 10px"}}>Total</td>
          <td style={{padding:"6px 10px",textAlign:"right"}}>{crA.n}</td>
          <td style={{padding:"6px 10px",textAlign:"right"}}>100%</td>
          {crAnt&&<td style={{padding:"6px 10px",textAlign:"right",color:C2.cinzaTexto}}>100%</td>}
          {crAnt&&<td/>}
        </tr>
      </tbody>
    </table>
  );
}

function CRTabelaParceiro({crA, crAnt}) {
  const C2 = {verde:"#16A34A",vermelho:"#DC2626",cinzaTexto:"#6B7280",cinzaBorda:"#E5E3DF",cinzaFundo:"#F8F7F4"};
  const pct = (v,n) => n>0 ? `${(v/n*100).toFixed(1)}%` : "—";
  return (
    <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
      <thead><tr style={{background:C2.cinzaFundo}}>
        {["Parceiro","Total","Mesma data",crAnt&&"Δ","1d útil",crAnt&&"Δ","2d úteis",crAnt&&"Δ","3+d",crAnt&&"Δ"].filter(Boolean).map(h=>(
          <th key={h} style={{padding:"5px 8px",textAlign:h==="Parceiro"?"left":"center",fontSize:10,color:C2.cinzaTexto,textTransform:"uppercase"}}>{h}</th>
        ))}
      </tr></thead>
      <tbody>
        {Object.entries(crA.porParceiro).sort((a,b)=>b[1].total-a[1].total).map(([p,d],i)=>{
          const dAnt = crAnt?.porParceiro?.[p];
          const dd=(vA,nA,vAnt,nAnt)=>{if(!dAnt)return null;const pA=nA>0?vA/nA*100:null;const pAnt=nAnt>0?vAnt/nAnt*100:null;if(pA==null||pAnt==null)return null;return Math.round((pA-pAnt)*100)/100;};
          const fmtD=(delta)=>{if(delta==null)return <td style={{padding:"5px 8px",textAlign:"center",color:C2.cinzaTexto}}>—</td>;const cor=delta>=0?C2.verde:C2.vermelho;return <td style={{padding:"5px 8px",textAlign:"center",fontWeight:700,color:cor,fontSize:11}}>{delta>=0?"+":""}{delta.toFixed(1)}</td>;};
          return <tr key={p} style={{borderTop:`1px solid ${C2.cinzaBorda}`,background:i%2===0?"transparent":C2.cinzaFundo}}>
            <td style={{padding:"5px 8px",fontWeight:600}}>{p}</td>
            <td style={{padding:"5px 8px",textAlign:"center"}}>{d.total}</td>
            <td style={{padding:"5px 8px",textAlign:"center"}}>{pct(d.mesma,d.total)}</td>
            {crAnt&&fmtD(dd(d.mesma,d.total,dAnt?.mesma||0,dAnt?.total||0))}
            <td style={{padding:"5px 8px",textAlign:"center"}}>{pct(d.um,d.total)}</td>
            {crAnt&&fmtD(dd(d.um,d.total,dAnt?.um||0,dAnt?.total||0))}
            <td style={{padding:"5px 8px",textAlign:"center"}}>{pct(d.dois,d.total)}</td>
            {crAnt&&fmtD(dd(d.dois,d.total,dAnt?.dois||0,dAnt?.total||0))}
            <td style={{padding:"5px 8px",textAlign:"center"}}>{pct(d.tres,d.total)}</td>
            {crAnt&&fmtD(dd(d.tres,d.total,dAnt?.tres||0,dAnt?.total||0))}
          </tr>;
        })}
      </tbody>
    </table>
  );
}
