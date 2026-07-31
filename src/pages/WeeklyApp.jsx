import { useState, useEffect, useMemo, useCallback } from "react";
import Papa from "papaparse";

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
  {key:"aging",label:"Aging Médio",  meta:7,  inv:true,  unit:"d"},
];
const MESES = {1:"Jan",2:"Fev",3:"Mar",4:"Abr",5:"Mai",6:"Jun",7:"Jul",8:"Ago",9:"Set",10:"Out",11:"Nov",12:"Dez"};
const TRIM_MESES = {1:[1,2,3],2:[4,5,6],3:[7,8,9],4:[10,11,12]};

// ── Helpers de leitura de dados ──────────────────────────────────────────────
function lerLocalStorage(key, fallback) {
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : fallback; } catch { return fallback; }
}

async function lerIDB(dbName, storeName, key) {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(dbName, 1);
      req.onerror = () => resolve(null);
      req.onsuccess = () => {
        try {
          const tx = req.result.transaction(storeName, "readonly");
          const r = tx.objectStore(storeName).get(key);
          r.onsuccess = () => resolve(r.result || null);
          r.onerror = () => resolve(null);
        } catch { resolve(null); }
      };
      req.onupgradeneeded = () => resolve(null);
    } catch { resolve(null); }
  });
}

// ── Cálculo de indicadores de uma lista de semanas (do weeklyExtra) ──────────
function calcPeriodo(semanas, pdMerged, granular) {
  // semanas = lista de objetos {s, total, sla_pct, agendamento_pct, ...}
  // Retorna {total, sla, agend, ader, sla15, aging} ponderado
  if (!semanas.length) return null;
  const tot = semanas.reduce((a,r) => a + (r.total||0), 0);
  if (!tot) return null;
  const pw = (key) => {
    let s=0, t=0;
    semanas.forEach(r => { if(r[key]!=null){ s+=r[key]*(r.total||0); t+=r.total||0; } });
    return t ? Math.round(s/t*100)/100 : null;
  };
  return {
    total: tot,
    sla:   pw("sla_pct"),
    agend: pw("agendamento_pct"),
    ader:  pw("aderencia_pct"),
    sla15: pw("sla15_pct"),
    aging: pw("aging_medio"),
  };
}

function calcPorParceiro(semanas, pdMerged) {
  // Para cada parceiro em pdMerged, agrega os valores das semanas selecionadas
  const parceiros = Object.keys(pdMerged);
  return parceiros.map(p => {
    const rows = semanas.map(w => pdMerged[p]?.[w.s]).filter(Boolean);
    if (!rows.length) return null;
    const tot = rows.reduce((a,r) => a + (r.total||0), 0);
    if (!tot) return null;
    const pw = (key) => {
      let s=0, t=0;
      rows.forEach(r => { if(r[key]!=null){ s+=r[key]*(r.total||0); t+=r.total||0; } });
      return t ? Math.round(s/t*100)/100 : null;
    };
    return { nome:p, total:tot, sla:pw("sla_pct"), agend:pw("agendamento_pct"),
             ader:pw("ader_pct"), sla15:pw("sla15_pct"), aging:pw("aging_medio") };
  }).filter(Boolean).sort((a,b) => b.total - a.total);
}

// ── Helpers de formatação ─────────────────────────────────────────────────────
const fmtInd = (v, ind) => v == null ? "—" : `${ind.inv ? Math.round(v) : v.toFixed(1)}${ind.unit}`;
const corInd = (v, ind) => {
  if(v==null) return C.cinzaTexto;
  if(!ind.inv) return v>=ind.meta ? C.verde : v>=ind.meta*0.95 ? C.amarelo : C.vermelho;
  return v<=ind.meta ? C.verde : v<=ind.meta*1.15 ? C.amarelo : C.vermelho;
};
const delta = (a, b, inv) => {
  if(a==null||b==null) return null;
  const d = Math.round((b-a)*100)/100;
  return d;
};
const fmtDelta = (d, inv) => {
  if(d==null) return "—";
  const sinal = d>0?"▲":d<0?"▼":"=";
  const cor = d===0 ? C.cinzaTexto : (inv ? d<=0 : d>=0) ? C.verde : C.vermelho;
  return { texto:`${sinal} ${Math.abs(d).toFixed(1)}`, cor };
};

// ── Componente principal ──────────────────────────────────────────────────────
export default function WeeklyApp() {
  // ── Estado dos dados carregados ────────────────────────────────────────────
  const [slaData, setSlaData] = useState({ weekly:[], pd:{}, rawRows:[] });
  const [csatData, setCsatData] = useState(null);
  const [abrangData, setAbrangData] = useState(null);
  const [coletaRecebData, setColetaRecebData] = useState(null);
  const [carregando, setCarregando] = useState(true);

  // ── Configuração do período ────────────────────────────────────────────────
  const [granular, setGranular] = useState("semana"); // semana | mes | trim
  const [selA, setSelA] = useState(null);  // período atual
  const [selAnt, setSelAnt] = useState(null); // período anterior (para Δ)
  const [thresholdDelta, setThresholdDelta] = useState(3); // % mín pra destacar variação

  // ── Racionais por seção ────────────────────────────────────────────────────
  const [racionais, setRacionais] = useState({
    abrangencia:"", indicadores:"", coletaReceb:"", csat:"", emAberto:""
  });
  const setRacional = (key, val) => setRacionais(prev => ({...prev, [key]:val}));

  // ── Carrega todos os dados ao montar ───────────────────────────────────────
  useEffect(() => {
    (async () => {
      // SLA
      const weekly = lerLocalStorage("slaParca_weekly", []).sort((a,b)=>a.s-b.s);
      const pd = lerLocalStorage("slaParca_pd", {});
      const csvSalvo = await lerIDB("slaParcaDB","csvBruto","atual");
      let rawRows = [];
      if(csvSalvo?.rows) rawRows = csvSalvo.rows;
      else if(csvSalvo && typeof csvSalvo === "string") {
        rawRows = Papa.parse(csvSalvo, {header:true,skipEmptyLines:true}).data;
      }
      setSlaData({weekly, pd, rawRows});

      // Abrangência
      const abr = await lerIDB("abrangenciaParcaDB2","dados","atual");
      setAbrangData(abr || null);

      // Abrangência anterior (para Δ cobertura)
      const abrAnt = await lerIDB("abrangenciaParcaDB2","dados","anterior");

      // Coleta x Recebimento
      const cr = await lerIDB("slaParcaDB","csvBruto","coletaRecebimento");
      setColetaRecebData(cr || null);

      // CSAT (semanas travadas)
      const csatTrav = lerLocalStorage("csat_semanas_travadas", []);
      setCsatData(csatTrav.length ? csatTrav : null);

      setCarregando(false);

      // Pré-seleciona último período como "atual" e penúltimo como "anterior"
      if(weekly.length) {
        setSelA(weekly[weekly.length-1].s);
        if(weekly.length>1) setSelAnt(weekly[weekly.length-2].s);
      }
    })();
  }, []);

  // ── Listas de períodos disponíveis ─────────────────────────────────────────
  const allSemanas = slaData.weekly.map(w=>w.s);
  const allMeses = useMemo(()=>[...new Set(slaData.weekly.map(w=>w.mes).filter(Boolean))].sort((a,b)=>a-b),[slaData.weekly]);
  const periodos = granular==="semana" ? allSemanas : granular==="mes" ? allMeses : [1,2,3,4];
  const lbl = (p) => granular==="semana"?`S${p}`:granular==="mes"?MESES[p]:`T${p}`;

  // ── Semanas do período selecionado ─────────────────────────────────────────
  const semanasDoPeríodo = useCallback((sel) => {
    if(sel==null) return [];
    if(granular==="semana") return slaData.weekly.filter(w=>w.s===sel);
    if(granular==="mes") return slaData.weekly.filter(w=>w.mes===sel);
    if(granular==="trim") return slaData.weekly.filter(w=>(TRIM_MESES[sel]||[]).includes(w.mes));
    return [];
  },[granular, slaData.weekly]);

  const semsA   = useMemo(()=>semanasDoPeríodo(selA),   [selA,   semanasDoPeríodo]);
  const semsAnt = useMemo(()=>semanasDoPeríodo(selAnt), [selAnt, semanasDoPeríodo]);

  const indA   = useMemo(()=>calcPeriodo(semsA,   slaData.pd), [semsA,   slaData.pd]);
  const indAnt = useMemo(()=>calcPeriodo(semsAnt, slaData.pd), [semsAnt, slaData.pd]);

  const parceirosA   = useMemo(()=>calcPorParceiro(semsA,   slaData.pd),[semsA,   slaData.pd]);
  const parceirosAnt = useMemo(()=>calcPorParceiro(semsAnt, slaData.pd),[semsAnt, slaData.pd]);

  // Destaque por parceiro: só quem mudou acima do threshold
  const movimentos = useMemo(()=>{
    return INDICADORES.flatMap(ind => {
      return parceirosA.map(pA => {
        const pAnt = parceirosAnt.find(p=>p.nome===pA.nome);
        if(!pAnt || pA[ind.key]==null || pAnt[ind.key]==null) return null;
        const d = Math.round((pA[ind.key]-pAnt[ind.key])*100)/100;
        const abs = Math.abs(d);
        if(abs < thresholdDelta) return null;
        return { parceiro:pA.nome, ind:ind.label, atual:pA[ind.key], ant:pAnt[ind.key], d, inv:ind.inv, unit:ind.unit };
      }).filter(Boolean);
    });
  },[parceirosA, parceirosAnt, thresholdDelta]);

  // ── Coletas em aberto (+25 dias) ───────────────────────────────────────────
  const emAberto25 = useMemo(()=>{
    const rows = slaData.rawRows;
    if(!rows.length) return {total:0, parceiros:[]};
    const abertas = rows.filter(r=>r["Flag Situacao Coleta"]!=="Coletado" && parseInt(r["aging_days"]||r["Aging"]||0)>=25);
    const porParceiro = {};
    abertas.forEach(r=>{
      const p = r["Transportadora"]||r["Parceiro"]||"—";
      porParceiro[p]=(porParceiro[p]||0)+1;
    });
    return {
      total: abertas.length,
      parceiros: Object.entries(porParceiro).sort((a,b)=>b[1]-a[1]).map(([n,c])=>({nome:n,count:c}))
    };
  },[slaData.rawRows]);

  // ── Abrangência atual e anterior ───────────────────────────────────────────
  const coberturaParcaAtual = useMemo(()=>{
    if(!abrangData?.rows) return null;
    const rows = abrangData.rows;
    const total = rows.reduce((s,r)=>s+r.abrangencia,0);
    const parca = rows.filter(r=>r.validacao==="PARÇA").reduce((s,r)=>s+r.abrangencia,0);
    return {pct: total?parca/total*100:0, total, parca};
  },[abrangData]);

  // ── CSAT — última semana disponível ───────────────────────────────────────
  const csatSemanas = useMemo(()=>{
    if(!csatData||!csatData.length) return null;
    const sorted = [...csatData].sort((a,b)=>(b.semana||0)-(a.semana||0));
    const ultima = sorted[0];
    const penultima = sorted[1]||null;
    return {ultima, penultima};
  },[csatData]);

  // ── Geração do HTML exportável ─────────────────────────────────────────────
  const gerarHTML = useCallback(()=>{
    const titulo = `Weekly Gestão Parça — ${selA!=null?lbl(selA):"Período não selecionado"}`;
    const dataHoje = new Date().toLocaleDateString("pt-BR");
    const fmtPct = (v) => v==null?"—":`${v.toFixed(1)}%`;
    const fmtDeltaHTML = (d, inv) => {
      if(d==null) return `<span style="color:#6B7280">—</span>`;
      const sinal = d>0?"▲":d<0?"▼":"=";
      const cor = d===0?"#6B7280":(inv?d<=0:d>=0)?"#16A34A":"#DC2626";
      return `<span style="color:${cor};font-weight:600">${sinal} ${Math.abs(d).toFixed(1)}</span>`;
    };

    const secAbr = coberturaParcaAtual ? `
      <h2 style="border-left:4px solid #F97316;padding-left:12px;margin-top:32px">🗺️ Abrangência Parça</h2>
      <div style="display:flex;gap:24px;margin-bottom:16px">
        <div style="background:#F8F7F4;border-radius:8px;padding:16px;flex:1">
          <div style="font-size:12px;color:#6B7280">Cobertura Parça (ponderada)</div>
          <div style="font-size:28px;font-weight:700;color:${coberturaParcaAtual.pct>=50?"#16A34A":"#DC2626"}">${fmtPct(coberturaParcaAtual.pct)}</div>
          <div style="font-size:12px;color:#6B7280">${coberturaParcaAtual.parca.toLocaleString("pt-BR")} de ${coberturaParcaAtual.total.toLocaleString("pt-BR")} coletas</div>
        </div>
      </div>
      ${racionais.abrangencia?`<div style="background:#FFF7ED;border-left:4px solid #F97316;padding:12px 16px;border-radius:0 8px 8px 0;white-space:pre-wrap">${racionais.abrangencia}</div>`:""}
    ` : `<h2 style="border-left:4px solid #F97316;padding-left:12px;margin-top:32px">🗺️ Abrangência Parça</h2><p style="color:#6B7280">Sem dados de abrangência importados.</p>`;

    const secInd = indA ? `
      <h2 style="border-left:4px solid #2563EB;padding-left:12px;margin-top:32px">📊 Indicadores — ${selA!=null?lbl(selA):""}</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px">
        <thead><tr style="background:#F8F7F4">
          <th style="padding:8px 12px;text-align:left;color:#6B7280;font-size:11px;text-transform:uppercase">Indicador</th>
          <th style="padding:8px 12px;text-align:center;color:#2563EB;font-size:11px;text-transform:uppercase">Atual${selA!=null?" ("+lbl(selA)+")":""}</th>
          <th style="padding:8px 12px;text-align:center;color:#6B7280;font-size:11px;text-transform:uppercase">Anterior${selAnt!=null?" ("+lbl(selAnt)+")":""}</th>
          <th style="padding:8px 12px;text-align:center;color:#6B7280;font-size:11px;text-transform:uppercase">Variação</th>
          <th style="padding:8px 12px;text-align:center;color:#6B7280;font-size:11px;text-transform:uppercase">Meta</th>
        </tr></thead>
        <tbody>${INDICADORES.map((ind,i)=>{
          const vA = indA?.[ind.key];
          const vAnt = indAnt?.[ind.key];
          const d = delta(vAnt,vA,ind.inv);
          const cor = corInd(vA,ind);
          return `<tr style="border-top:1px solid #E5E3DF;background:${i%2===0?"white":"#F8F7F4"}">
            <td style="padding:8px 12px;font-weight:600">${ind.label}</td>
            <td style="padding:8px 12px;text-align:center;font-weight:700;color:${cor}">${fmtInd(vA,ind)}</td>
            <td style="padding:8px 12px;text-align:center;color:#6B7280">${fmtInd(vAnt,ind)}</td>
            <td style="padding:8px 12px;text-align:center">${fmtDeltaHTML(d,ind.inv)}</td>
            <td style="padding:8px 12px;text-align:center;color:#6B7280">${ind.inv?`≤${ind.meta}${ind.unit}`:`${ind.meta}${ind.unit}`}</td>
          </tr>`;
        }).join("")}</tbody>
      </table>
      ${movimentos.length?`
        <div style="font-weight:700;margin-bottom:8px;font-size:13px">⚡ Movimentos acima de ${thresholdDelta} p.p. / dias</div>
        <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px">
          <thead><tr style="background:#F8F7F4">
            <th style="padding:6px 10px;text-align:left;color:#6B7280;font-size:11px">Parceiro</th>
            <th style="padding:6px 10px;text-align:left;color:#6B7280;font-size:11px">Indicador</th>
            <th style="padding:6px 10px;text-align:center;color:#6B7280;font-size:11px">Antes</th>
            <th style="padding:6px 10px;text-align:center;color:#6B7280;font-size:11px">Depois</th>
            <th style="padding:6px 10px;text-align:center;color:#6B7280;font-size:11px">Δ</th>
          </tr></thead>
          <tbody>${movimentos.map((m,i)=>`
            <tr style="border-top:1px solid #E5E3DF;background:${i%2===0?"white":"#F8F7F4"}">
              <td style="padding:6px 10px;font-weight:600">${m.parceiro}</td>
              <td style="padding:6px 10px">${m.ind}</td>
              <td style="padding:6px 10px;text-align:center;color:#6B7280">${fmtInd(m.ant,{inv:m.inv,unit:m.unit})}</td>
              <td style="padding:6px 10px;text-align:center;font-weight:700">${fmtInd(m.atual,{inv:m.inv,unit:m.unit})}</td>
              <td style="padding:6px 10px;text-align:center">${fmtDeltaHTML(m.d,m.inv)}</td>
            </tr>`).join("")}</tbody>
        </table>
      `:""}
      ${racionais.indicadores?`<div style="background:#EFF6FF;border-left:4px solid #2563EB;padding:12px 16px;border-radius:0 8px 8px 0;white-space:pre-wrap">${racionais.indicadores}</div>`:""}
    ` : `<h2 style="border-left:4px solid #2563EB;padding-left:12px;margin-top:32px">📊 Indicadores</h2><p style="color:#6B7280">Sem dados de SLA para o período selecionado.</p>`;

    const secCR = coletaRecebData?.rows ? `
      <h2 style="border-left:4px solid #16A34A;padding-left:12px;margin-top:32px">📦 Coleta x Recebimento</h2>
      <p style="color:#6B7280;font-size:13px">Base: ${coletaRecebData.nome||"—"} · ${coletaRecebData.rows.length.toLocaleString("pt-BR")} linhas</p>
      ${racionais.coletaReceb?`<div style="background:#F0FDF4;border-left:4px solid #16A34A;padding:12px 16px;border-radius:0 8px 8px 0;white-space:pre-wrap">${racionais.coletaReceb}</div>`:""}
    ` : `<h2 style="border-left:4px solid #16A34A;padding-left:12px;margin-top:32px">📦 Coleta x Recebimento</h2><p style="color:#6B7280">Sem dados de Coleta x Recebimento importados.</p>`;

    const secCSAT = csatSemanas ? `
      <h2 style="border-left:4px solid #7C3AED;padding-left:12px;margin-top:32px">⭐ CSAT</h2>
      <div style="display:flex;gap:16px;margin-bottom:16px">
        ${csatSemanas.ultima?`<div style="background:#F8F7F4;border-radius:8px;padding:16px;flex:1">
          <div style="font-size:12px;color:#6B7280">Última semana disponível</div>
          <div style="font-size:24px;font-weight:700;color:#7C3AED">${csatSemanas.ultima.csat_pct!=null?`${csatSemanas.ultima.csat_pct.toFixed(1)}%`:"—"}</div>
        </div>`:""}
      </div>
      ${racionais.csat?`<div style="background:#F5F3FF;border-left:4px solid #7C3AED;padding:12px 16px;border-radius:0 8px 8px 0;white-space:pre-wrap">${racionais.csat}</div>`:""}
    ` : `<h2 style="border-left:4px solid #7C3AED;padding-left:12px;margin-top:32px">⭐ CSAT</h2><p style="color:#6B7280">Sem dados de CSAT importados.</p>`;

    const secAberto = `
      <h2 style="border-left:4px solid #DC2626;padding-left:12px;margin-top:32px">⏰ Coletas em Aberto (+25 dias)</h2>
      <div style="background:#FEE2E2;border-radius:8px;padding:16px;margin-bottom:16px;display:inline-block;min-width:200px">
        <div style="font-size:12px;color:#6B7280">Total em aberto ≥ 25 dias</div>
        <div style="font-size:32px;font-weight:700;color:#DC2626">${emAberto25.total}</div>
      </div>
      ${emAberto25.parceiros.length?`
        <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px">
          <thead><tr style="background:#F8F7F4">
            <th style="padding:6px 10px;text-align:left;color:#6B7280;font-size:11px">Parceiro</th>
            <th style="padding:6px 10px;text-align:right;color:#6B7280;font-size:11px">Coletas</th>
          </tr></thead>
          <tbody>${emAberto25.parceiros.map((p,i)=>`
            <tr style="border-top:1px solid #E5E3DF;background:${i%2===0?"white":"#F8F7F4"}">
              <td style="padding:6px 10px">${p.nome}</td>
              <td style="padding:6px 10px;text-align:right;font-weight:700;color:#DC2626">${p.count}</td>
            </tr>`).join("")}</tbody>
        </table>`:""}
      ${racionais.emAberto?`<div style="background:#FEF2F2;border-left:4px solid #DC2626;padding:12px 16px;border-radius:0 8px 8px 0;white-space:pre-wrap">${racionais.emAberto}</div>`:""}
    `;

    return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titulo}</title>
<style>
  @media print { body{margin:0;padding:20px} button{display:none!important} h2{page-break-before:auto} }
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;color:#1C1917;margin:0;padding:40px;max-width:960px;margin:0 auto}
  h1{font-size:24px;margin:0 0 4px} .sub{color:#6B7280;font-size:13px;margin-bottom:32px}
</style>
</head><body>
  <h1>📋 ${titulo}</h1>
  <div class="sub">Gerado em ${dataHoje} · Período: ${selA!=null?lbl(selA):"—"}${selAnt!=null?" vs "+lbl(selAnt):""}</div>
  ${secAbr}${secInd}${secCR}${secCSAT}${secAberto}
  <p style="margin-top:48px;font-size:11px;color:#9CA3AF;border-top:1px solid #E5E3DF;padding-top:12px">Gerado pelo Dashboard Gestão Parça</p>
</body></html>`;
  },[selA, selAnt, lbl, indA, indAnt, movimentos, thresholdDelta, racionais,
     coberturaParcaAtual, csatSemanas, emAberto25, coletaRecebData]);

  const exportarHTML = () => {
    const html = gerarHTML();
    const blob = new Blob([html], {type:"text/html"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href=url; a.download=`weekly-${selA!=null?lbl(selA):"periodo"}.html`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportarPDF = () => {
    const html = gerarHTML();
    const win = window.open("","_blank");
    win.document.write(html);
    win.document.close();
    setTimeout(()=>win.print(), 600);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if(carregando) return <div style={{padding:40,color:C.cinzaTexto}}>Carregando dados...</div>;

  const pill = (on) => ({
    padding:"5px 14px", borderRadius:999, fontSize:13, fontWeight:600, cursor:"pointer",
    border:`1.5px solid ${on?C.laranja:C.cinzaBorda}`,
    background:on?`${C.laranja}18`:"transparent",
    color:on?C.laranja:C.cinzaTexto,
  });

  return (
    <div style={{maxWidth:1100, margin:"0 auto", padding:"20px 24px"}}>
      {/* ── Cabeçalho ── */}
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20}}>
        <div>
          <div style={{fontSize:20, fontWeight:700}}>📋 Gerador de Weekly / MBR / QBR</div>
          <div style={{fontSize:12, color:C.cinzaTexto}}>Selecione o período, preencha os racionais e exporte.</div>
        </div>
        <div style={{display:"flex", gap:8}}>
          <button onClick={exportarHTML} style={{padding:"9px 16px", borderRadius:8, border:`1.5px solid ${C.azul}`, background:"transparent", color:C.azul, fontSize:13, fontWeight:700, cursor:"pointer"}}>⬇ Exportar HTML</button>
          <button onClick={exportarPDF}  style={{padding:"9px 16px", borderRadius:8, background:C.laranja, color:"#fff", border:"none", fontSize:13, fontWeight:700, cursor:"pointer"}}>🖨️ Exportar PDF</button>
        </div>
      </div>

      {/* ── Configuração do período ── */}
      <div style={{background:C.cinzaCard, border:`1px solid ${C.cinzaBorda}`, borderRadius:12, padding:20, marginBottom:20}}>
        <div style={{fontWeight:700, marginBottom:12}}>Configurar período</div>
        <div style={{display:"flex", gap:24, flexWrap:"wrap", alignItems:"flex-start"}}>
          <div>
            <div style={{fontSize:11, fontWeight:700, color:C.cinzaTexto, marginBottom:8, textTransform:"uppercase"}}>Granularidade</div>
            <div style={{display:"flex", gap:6}}>
              {[["semana","Semana"],["mes","Mês"],["trim","Trimestre"]].map(([k,l])=>(
                <button key={k} onClick={()=>{setGranular(k);setSelA(null);setSelAnt(null);}} style={pill(granular===k)}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <div style={{fontSize:11, fontWeight:700, color:C.cinzaTexto, marginBottom:8, textTransform:"uppercase"}}>Período atual</div>
            <select value={selA??""} onChange={e=>setSelA(e.target.value?Number(e.target.value):null)}
              style={{padding:"6px 10px", borderRadius:6, border:`1.5px solid ${selA!=null?C.laranja:C.cinzaBorda}`, fontSize:13, fontWeight:600, color:selA!=null?C.laranja:C.cinzaTexto}}>
              <option value="">Selecionar</option>
              {periodos.map(p=><option key={p} value={p}>{lbl(p)}</option>)}
            </select>
          </div>
          <div>
            <div style={{fontSize:11, fontWeight:700, color:C.cinzaTexto, marginBottom:8, textTransform:"uppercase"}}>Período anterior (para Δ)</div>
            <select value={selAnt??""} onChange={e=>setSelAnt(e.target.value?Number(e.target.value):null)}
              style={{padding:"6px 10px", borderRadius:6, border:`1px solid ${C.cinzaBorda}`, fontSize:13, color:C.cinzaTexto}}>
              <option value="">Nenhum</option>
              {periodos.filter(p=>p!==selA).map(p=><option key={p} value={p}>{lbl(p)}</option>)}
            </select>
          </div>
          <div>
            <div style={{fontSize:11, fontWeight:700, color:C.cinzaTexto, marginBottom:8, textTransform:"uppercase"}}>Destacar variação acima de</div>
            <div style={{display:"flex", alignItems:"center", gap:8}}>
              <input type="number" value={thresholdDelta} onChange={e=>setThresholdDelta(Number(e.target.value)||1)} min={1} max={50}
                style={{width:60, padding:"6px 8px", borderRadius:6, border:`1px solid ${C.cinzaBorda}`, fontSize:13, textAlign:"center"}}/>
              <span style={{fontSize:13, color:C.cinzaTexto}}>p.p. / dias</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Seções ── */}
      {[
        {key:"abrangencia", titulo:"🗺️ Abrangência Parça", cor:C.laranja, conteudo: coberturaParcaAtual ? (
          <div style={{display:"flex", gap:14, marginBottom:12}}>
            <Kpi label="Cobertura Parça" valor={`${coberturaParcaAtual.pct.toFixed(1)}%`} cor={coberturaParcaAtual.pct>=50?C.verde:C.vermelho}
              sub={`${coberturaParcaAtual.parca.toLocaleString("pt-BR")} de ${coberturaParcaAtual.total.toLocaleString("pt-BR")} coletas`}/>
          </div>
        ) : <p style={{color:C.cinzaTexto, fontSize:13}}>Sem dados de abrangência. Importe na aba Abrangência Parça.</p>},

        {key:"indicadores", titulo:"📊 Indicadores SLA / Agendamento / Aderência", cor:C.azul, conteudo: indA ? (
          <>
            <table style={{width:"100%", borderCollapse:"collapse", fontSize:13, marginBottom:16}}>
              <thead><tr style={{background:C.cinzaFundo}}>
                <th style={{padding:"6px 10px", textAlign:"left", fontSize:11, color:C.cinzaTexto, textTransform:"uppercase"}}>Indicador</th>
                <th style={{padding:"6px 10px", textAlign:"center", fontSize:11, color:C.azul, textTransform:"uppercase"}}>Atual{selA!=null?` (${lbl(selA)})`:""}</th>
                {indAnt&&<th style={{padding:"6px 10px", textAlign:"center", fontSize:11, color:C.cinzaTexto, textTransform:"uppercase"}}>Anterior{selAnt!=null?` (${lbl(selAnt)})`:""}</th>}
                {indAnt&&<th style={{padding:"6px 10px", textAlign:"center", fontSize:11, color:C.cinzaTexto, textTransform:"uppercase"}}>Δ</th>}
                <th style={{padding:"6px 10px", textAlign:"center", fontSize:11, color:C.cinzaTexto, textTransform:"uppercase"}}>Meta</th>
              </tr></thead>
              <tbody>{INDICADORES.map((ind,i)=>{
                const vA=indA[ind.key], vAnt=indAnt?.[ind.key];
                const d=delta(vAnt,vA,ind.inv);
                const {texto:dt, cor:dc} = fmtDelta(d,ind.inv);
                return <tr key={ind.key} style={{borderTop:`1px solid ${C.cinzaBorda}`, background:i%2===0?"transparent":C.cinzaFundo}}>
                  <td style={{padding:"6px 10px", fontWeight:600}}>{ind.label}</td>
                  <td style={{padding:"6px 10px", textAlign:"center", fontWeight:700, color:corInd(vA,ind)}}>{fmtInd(vA,ind)}</td>
                  {indAnt&&<td style={{padding:"6px 10px", textAlign:"center", color:C.cinzaTexto}}>{fmtInd(vAnt,ind)}</td>}
                  {indAnt&&<td style={{padding:"6px 10px", textAlign:"center", fontWeight:700, color:dc||C.cinzaTexto}}>{dt}</td>}
                  <td style={{padding:"6px 10px", textAlign:"center", color:C.cinzaTexto}}>{ind.inv?`≤${ind.meta}${ind.unit}`:`${ind.meta}${ind.unit}`}</td>
                </tr>;
              })}</tbody>
            </table>
            {movimentos.length>0&&<>
              <div style={{fontSize:13, fontWeight:700, marginBottom:8}}>⚡ Movimentos acima de {thresholdDelta} p.p. / dias</div>
              <table style={{width:"100%", borderCollapse:"collapse", fontSize:12}}>
                <thead><tr style={{background:C.cinzaFundo}}>
                  {["Parceiro","Indicador","Antes","Depois","Δ"].map(h=><th key={h} style={{padding:"5px 8px", textAlign:h==="Parceiro"||h==="Indicador"?"left":"center", fontSize:10, color:C.cinzaTexto, textTransform:"uppercase"}}>{h}</th>)}
                </tr></thead>
                <tbody>{movimentos.map((m,i)=>{
                  const {texto:dt,cor:dc}=fmtDelta(m.d,m.inv);
                  return <tr key={i} style={{borderTop:`1px solid ${C.cinzaBorda}`, background:i%2===0?"transparent":C.cinzaFundo}}>
                    <td style={{padding:"5px 8px", fontWeight:600}}>{m.parceiro}</td>
                    <td style={{padding:"5px 8px"}}>{m.ind}</td>
                    <td style={{padding:"5px 8px", textAlign:"center", color:C.cinzaTexto}}>{fmtInd(m.ant,{inv:m.inv,unit:m.unit})}</td>
                    <td style={{padding:"5px 8px", textAlign:"center", fontWeight:700}}>{fmtInd(m.atual,{inv:m.inv,unit:m.unit})}</td>
                    <td style={{padding:"5px 8px", textAlign:"center", fontWeight:700, color:dc}}>{dt}</td>
                  </tr>;
                })}</tbody>
              </table>
            </>}
          </>
        ) : <p style={{color:C.cinzaTexto, fontSize:13}}>Sem dados de SLA para o período selecionado. Carregue o CSV na aba Performance Coleta.</p>},

        {key:"coletaReceb", titulo:"📦 Coleta x Recebimento", cor:C.verde, conteudo: coletaRecebData?.rows
          ? <p style={{fontSize:13, color:C.cinzaTexto}}>Base: <strong>{coletaRecebData.nome}</strong> · {coletaRecebData.rows.length.toLocaleString("pt-BR")} linhas importadas. Adicione o racional abaixo.</p>
          : <p style={{color:C.cinzaTexto, fontSize:13}}>Sem dados. Importe na aba Coleta x Recebimento.</p>},

        {key:"csat", titulo:"⭐ CSAT", cor:"#7C3AED", conteudo: csatSemanas
          ? <div style={{display:"flex", gap:14}}><Kpi label="Última semana disponível" valor={csatSemanas.ultima?.csat_pct!=null?`${csatSemanas.ultima.csat_pct.toFixed(1)}%`:"—"} cor="#7C3AED"/></div>
          : <p style={{color:C.cinzaTexto, fontSize:13}}>Sem dados de CSAT. Importe na aba CSAT.</p>},

        {key:"emAberto", titulo:"⏰ Coletas em Aberto (+25 dias)", cor:C.vermelho, conteudo: (
          <div style={{display:"flex", gap:14, flexWrap:"wrap"}}>
            <Kpi label="Total ≥ 25 dias em aberto" valor={emAberto25.total.toString()} cor={emAberto25.total>0?C.vermelho:C.verde}/>
            {emAberto25.parceiros.slice(0,5).map(p=><Kpi key={p.nome} label={p.nome} valor={p.count.toString()} cor={C.vermelho}/>)}
          </div>
        )},
      ].map(({key,titulo,cor,conteudo})=>(
        <div key={key} style={{background:C.cinzaCard, border:`1px solid ${C.cinzaBorda}`, borderRadius:12, padding:20, marginBottom:16}}>
          <div style={{fontWeight:700, fontSize:15, borderLeft:`4px solid ${cor}`, paddingLeft:12, marginBottom:16}}>{titulo}</div>
          {conteudo}
          <div style={{marginTop:16}}>
            <div style={{fontSize:11, fontWeight:700, color:C.cinzaTexto, marginBottom:6, textTransform:"uppercase"}}>Racional / Observações</div>
            <textarea value={racionais[key]} onChange={e=>setRacional(key,e.target.value)}
              placeholder={`Escreva o racional desta seção para o ${granular==="semana"?"Weekly":granular==="mes"?"MBR":"QBR"}...`}
              rows={4}
              style={{width:"100%", padding:"10px 12px", borderRadius:8, border:`1px solid ${C.cinzaBorda}`, fontSize:13, fontFamily:"inherit", resize:"vertical", boxSizing:"border-box", background:C.cinzaFundo}}/>
          </div>
        </div>
      ))}
    </div>
  );
}

function Kpi({label, valor, cor, sub}) {
  return (
    <div style={{background:"#F8F7F4", border:`1px solid #E5E3DF`, borderRadius:10, padding:"12px 16px", minWidth:140}}>
      <div style={{fontSize:11, color:"#6B7280", marginBottom:4}}>{label}</div>
      <div style={{fontSize:24, fontWeight:700, color:cor||"#1C1917"}}>{valor}</div>
      {sub&&<div style={{fontSize:11, color:"#6B7280", marginTop:2}}>{sub}</div>}
    </div>
  );
}
