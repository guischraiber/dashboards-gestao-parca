import { useState, useEffect, useMemo, useCallback } from "react";
import Papa from "papaparse";

const C = {
  laranja:"#F97316", verde:"#16A34A", vermelho:"#DC2626", amarelo:"#CA8A04",
  azul:"#2563EB", cinzaFundo:"#F8F7F4", cinzaCard:"#FFFFFF", cinzaBorda:"#E5E3DF",
  cinzaTexto:"#6B7280", texto:"#1C1917",
};

// Campos reais do localStorage do SlaApp:
// weekly: [{s, total, sla, agend, ader, sla15, aging, ...}]
// pd:     {Parceiro: {semana: {sla, agend, ader, sla15, aging, total}}}
// CSAT:   {"YYYY_WN": {label, semana, mes, share, taxa, respostas, disparos}}

const INDICADORES = [
  {key:"sla",  label:"SLA Reversa", meta:86, inv:false, unit:"%"},
  {key:"agend",label:"Agendamento",  meta:95, inv:false, unit:"%"},
  {key:"ader", label:"Aderência",    meta:95, inv:false, unit:"%"},
  {key:"sla15",label:"SLA 15 dias",  meta:90, inv:false, unit:"%"},
  {key:"aging",label:"Aging Médio",  meta:7,  inv:true,  unit:"d"},
];
const MESES_NOME = {1:"Jan",2:"Fev",3:"Mar",4:"Abr",5:"Mai",6:"Jun",7:"Jul",8:"Ago",9:"Set",10:"Out",11:"Nov",12:"Dez"};
const TRIM_MESES = {1:[1,2,3],2:[4,5,6],3:[7,8,9],4:[10,11,12]};

// ── Helpers ───────────────────────────────────────────────────────────────────
function lerLS(key, fallback) {
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : fallback; } catch { return fallback; }
}
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

// ── Agrega indicadores de uma lista de semanas ─────────────────────────────
function calcPeriodo(semanas) {
  // semanas = [{s, total, sla, agend, ader, sla15, aging}]
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

function calcParceiros(semanas, pd) {
  const parcs = Object.keys(pd);
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

// ── Componente ────────────────────────────────────────────────────────────────
export default function WeeklyApp() {
  const [weekly,    setWeekly]    = useState([]);  // [{s, mes, total, sla, agend,...}]
  const [pd,        setPd]        = useState({});
  const [rawRows,   setRawRows]   = useState([]);
  const [csatSlots, setCsatSlots] = useState({}); // {"YYYY_WN":{share,taxa,semana,mes}}
  const [abrangAtual, setAbrangAtual] = useState(null);
  const [crData,    setCrData]    = useState(null);
  const [loading,   setLoading]   = useState(true);

  const [granular,  setGranular]  = useState("semana");
  const [selA,      setSelA]      = useState(null);
  const [selAnt,    setSelAnt]    = useState(null);
  const [threshold, setThreshold] = useState(3);
  const [racionais, setRacionais] = useState({abrangencia:"",indicadores:"",coletaReceb:"",csat:"",emAberto:""});
  const setR = (k,v) => setRacionais(p=>({...p,[k]:v}));

  useEffect(()=>{
    (async()=>{
      // ── SLA weekly & pd ──────────────────────────────────────────────────
      const wRaw = lerLS("slaParca_weekly",[]);
      const pdRaw= lerLS("slaParca_pd",{});

      // Extrai mapa semana→mês do CSV bruto (campo "Mês_Efetivada" ou "semana_Efetivada")
      const csvSalvo = await lerIDB("slaParcaDB","csvBruto","atual");
      let rows = [];
      if(csvSalvo?.rows) rows = csvSalvo.rows;
      else if(typeof csvSalvo==="string") rows = Papa.parse(csvSalvo,{header:true,skipEmptyLines:true}).data;
      setRawRows(rows);

      // Constrói mapa semana → mês a partir do CSV bruto
      const semMes = {};
      rows.forEach(r=>{
        const s = parseInt(r["semana_Efetivada"]||r["Semana_Efetivada"]||0);
        const m = parseInt(r["Mês_Efetivada"]||r["Mes_Efetivada"]||r["mes_Efetivada"]||0);
        if(s&&m&&!semMes[s]) semMes[s]=m;
      });

      // Enriquece weekly com campo mes
      const wEnriq = wRaw.map(w=>({...w, mes: semMes[w.s]||null}));
      setWeekly(wEnriq.sort((a,b)=>a.s-b.s));
      setPd(pdRaw);

      // Auto-seleciona último período como atual, penúltimo como anterior
      if(wEnriq.length){
        setSelA(wEnriq[wEnriq.length-1].s);
        if(wEnriq.length>1) setSelAnt(wEnriq[wEnriq.length-2].s);
      }

      // ── CSAT ─────────────────────────────────────────────────────────────
      // Tenta primeiro o IDB, depois o localStorage
      let csatSlim = null;
      const csatIDB = await lerIDB("csatParcaDB","dados","parsed");
      if(csatIDB?.porSemana){
        const obj = {};
        csatIDB.porSemana.forEach(p=>{ if(p.semana) obj[`${csatIDB.anoAtual||new Date().getFullYear()}_W${p.semana}`]=p.slim||p; });
        csatSlim = obj;
      }
      if(!csatSlim){
        csatSlim = lerLS("csat_semanas_travadas",{});
        // Às vezes é array, às vezes objeto
        if(Array.isArray(csatSlim)){
          const obj = {};
          csatSlim.forEach(p=>{ if(p.semana) obj[`${new Date().getFullYear()}_W${p.semana}`]=p; });
          csatSlim = obj;
        }
      }
      setCsatSlots(csatSlim||{});

      // ── Abrangência ───────────────────────────────────────────────────────
      const abr = await lerIDB("abrangenciaParcaDB2","dados","atual");
      setAbrangAtual(abr||null);

      // ── Coleta x Recebimento ──────────────────────────────────────────────
      const cr = await lerIDB("slaParcaDB","csvBruto","coletaRecebimento");
      setCrData(cr||null);

      setLoading(false);
    })();
  },[]);

  // ── Períodos disponíveis ──────────────────────────────────────────────────
  const allSemanas = weekly.map(w=>w.s);
  const allMeses   = useMemo(()=>[...new Set(weekly.filter(w=>w.mes).map(w=>w.mes))].sort((a,b)=>a-b),[weekly]);
  const periodos   = granular==="semana" ? allSemanas : granular==="mes" ? allMeses : [1,2,3,4];
  const lbl = useCallback(p=> granular==="semana"?`S${p}`:granular==="mes"?MESES_NOME[p]:`T${p}`,[granular]);

  const semsDoPeríodo = useCallback(sel=>{
    if(sel==null) return [];
    if(granular==="semana") return weekly.filter(w=>w.s===sel);
    if(granular==="mes")    return weekly.filter(w=>w.mes===sel);
    if(granular==="trim")   return weekly.filter(w=>(TRIM_MESES[sel]||[]).includes(w.mes));
    return [];
  },[granular,weekly]);

  const semsA   = useMemo(()=>semsDoPeríodo(selA),   [selA,   semsDoPeríodo]);
  const semsAnt = useMemo(()=>semsDoPeríodo(selAnt), [selAnt, semsDoPeríodo]);
  const indA    = useMemo(()=>calcPeriodo(semsA),   [semsA]);
  const indAnt  = useMemo(()=>calcPeriodo(semsAnt), [semsAnt]);
  const parcsA  = useMemo(()=>calcParceiros(semsA, pd),[semsA,pd]);
  const parcsAnt= useMemo(()=>calcParceiros(semsAnt,pd),[semsAnt,pd]);

  // Movimentos por parceiro acima do threshold
  const movimentos = useMemo(()=> INDICADORES.flatMap(ind=>
    parcsA.map(pA=>{
      const pAnt=parcsAnt.find(p=>p.nome===pA.nome);
      if(!pAnt||pA[ind.key]==null||pAnt[ind.key]==null) return null;
      const d=Math.round((pA[ind.key]-pAnt[ind.key])*100)/100;
      if(Math.abs(d)<threshold) return null;
      return {parceiro:pA.nome,ind:ind.label,atual:pA[ind.key],ant:pAnt[ind.key],d,inv:ind.inv,unit:ind.unit};
    }).filter(Boolean)
  ),[parcsA,parcsAnt,threshold]);

  // ── CSAT — por período selecionado + anterior ─────────────────────────────
  const csatDoPeríodo = useCallback((sel)=>{
    if(sel==null) return null;
    const vals = Object.values(csatSlots).filter(v=>v&&v.semana);
    if(!vals.length) return null;
    if(granular==="semana"){
      return vals.find(v=>v.semana===sel)||null;
    }
    if(granular==="mes"){
      const vs=vals.filter(v=>v.mes===sel);
      if(!vs.length) return null;
      const tot=vs.reduce((s,v)=>s+(v.respostas||0),0);
      const n45=vs.reduce((s,v)=>s+(v.notas45!=null?v.notas45:Math.round((v.share||0)*(v.respostas||0))),0);
      return {share:tot?n45/tot:null,respostas:tot,label:MESES_NOME[sel]};
    }
    if(granular==="trim"){
      const ms=TRIM_MESES[sel]||[];
      const vs=vals.filter(v=>ms.includes(v.mes));
      if(!vs.length) return null;
      const tot=vs.reduce((s,v)=>s+(v.respostas||0),0);
      const n45=vs.reduce((s,v)=>s+(v.notas45!=null?v.notas45:Math.round((v.share||0)*(v.respostas||0))),0);
      return {share:tot?n45/tot:null,respostas:tot,label:`T${sel}`};
    }
    return vals.sort((a,b)=>(b.semana||0)-(a.semana||0))[0];
  },[csatSlots,granular]);

  const csatA   = useMemo(()=>csatDoPeríodo(selA),   [selA,   csatDoPeríodo]);
  const csatAnt = useMemo(()=>csatDoPeríodo(selAnt), [selAnt, csatDoPeríodo]);

  // ── Abrangência filtrada por período ─────────────────────────────────────
  // A base de abrangência tem dataColeta e semana — filtramos pelas semanas do período
  const semanasDoA   = useMemo(()=>semsDoPeríodo(selA).map(w=>w.s),   [selA,   semsDoPeríodo]);
  const semanasDoAnt = useMemo(()=>semsDoPeríodo(selAnt).map(w=>w.s), [selAnt, semsDoPeríodo]);

  const calcCobParca = useCallback((semanas)=>{
    if(!abrangAtual?.rows) return null;
    const rows = semanas.length
      ? abrangAtual.rows.filter(r=>semanas.includes(r.semana))
      : abrangAtual.rows; // sem filtro de período → usa tudo
    if(!rows.length) return null;
    const total = rows.reduce((s,r)=>s+r.abrangencia,0);
    const parca = rows.filter(r=>r.validacao==="PARÇA").reduce((s,r)=>s+r.abrangencia,0);
    // Top estados por volume sem Parça (oportunidades)
    const porUF={};
    rows.forEach(r=>{ if(!porUF[r.estado]) porUF[r.estado]={total:0,parca:0}; porUF[r.estado].total+=r.abrangencia; if(r.validacao==="PARÇA") porUF[r.estado].parca+=r.abrangencia; });
    const ufList = Object.entries(porUF).map(([uf,d])=>({uf,total:d.total,parca:d.parca,pct:d.total?d.parca/d.total*100:0})).sort((a,b)=>b.total-a.total);
    return {pct:total?parca/total*100:0,total,parca,ufList};
  },[abrangAtual]);

  const cobParca    = useMemo(()=>calcCobParca(semanasDoA),   [semanasDoA,   calcCobParca]);
  const cobParcaAnt = useMemo(()=>calcCobParca(semanasDoAnt), [semanasDoAnt, calcCobParca]);

  // ── Coletas em aberto +25 dias — filtradas pelo período ──────────────────
  const emAberto25 = useMemo(()=>{
    if(!rawRows.length) return {total:0,parceiros:[]};
    const semanasAtivas = semanasDoA.length ? new Set(semanasDoA) : null;
    const abertas = rawRows.filter(r=>{
      const situacao = r["Flag Situacao Coleta"]||r["Situacao"]||"";
      if(situacao==="Coletado") return false;
      const aging = parseFloat(r["Aging coleta efetivada"]||r["aging_days"]||r["Aging"]||0);
      if(aging<25) return false;
      if(semanasAtivas){
        const s = parseInt(r["semana_Efetivada"]||r["Semana_Efetivada"]||0);
        if(s && !semanasAtivas.has(s)) return false;
      }
      return true;
    });
    const pp={};
    abertas.forEach(r=>{ const p=r["Transportadora"]||r["Parceiro"]||"—"; pp[p]=(pp[p]||0)+1; });
    return {total:abertas.length,parceiros:Object.entries(pp).sort((a,b)=>b[1]-a[1]).map(([n,c])=>({nome:n,count:c}))};
  },[rawRows,semanasDoA]);

  // ── Geração do HTML para exportação ──────────────────────────────────────
  const gerarHTML = useCallback(()=>{
    const titulo = `Weekly Gestão Parça — ${selA!=null?lbl(selA):"Período não selecionado"}`;
    const dataHoje = new Date().toLocaleDateString("pt-BR");
    const fmtV = (v,ind) => v==null?"—":`${ind.inv?Math.round(v):v.toFixed(1)}${ind.unit}`;
    const fmtD = (d,inv) => {
      if(d==null) return `<span style="color:#6B7280">—</span>`;
      const sinal=d>0?"▲":d<0?"▼":"=";
      const cor=d===0?"#6B7280":(inv?d<=0:d>=0)?"#16A34A":"#DC2626";
      return `<span style="color:${cor};font-weight:600">${sinal} ${Math.abs(d).toFixed(1)}</span>`;
    };
    const box=(cor,label,val,sub="")=>`<div style="background:#F8F7F4;border-radius:8px;padding:16px;display:inline-block;min-width:160px;margin-right:12px;margin-bottom:8px"><div style="font-size:12px;color:#6B7280">${label}</div><div style="font-size:26px;font-weight:700;color:${cor}">${val}</div>${sub?`<div style="font-size:11px;color:#6B7280;margin-top:2px">${sub}</div>`:""}</div>`;
    const rBlock=(txt,cor)=>txt?`<div style="background:${cor}18;border-left:4px solid ${cor};padding:12px 16px;border-radius:0 8px 8px 0;white-space:pre-wrap;margin-top:12px;font-size:13px">${txt}</div>`:"";
    const sec=(t,cor,corpo,rac)=>`<h2 style="border-left:4px solid ${cor};padding-left:12px;margin-top:32px;margin-bottom:12px;font-size:18px">${t}</h2>${corpo}${rBlock(rac,cor)}`;

    const tblInd=()=>{
      if(!indA) return `<p style="color:#6B7280">Sem dados de SLA para o período selecionado.</p>`;
      let html=`<table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px"><thead><tr style="background:#F8F7F4">
        <th style="padding:8px 10px;text-align:left;font-size:11px;color:#6B7280;text-transform:uppercase">Indicador</th>
        <th style="padding:8px 10px;text-align:center;font-size:11px;color:#2563EB;text-transform:uppercase">Atual${selA!=null?` (${lbl(selA)})`:""}</th>
        ${indAnt?`<th style="padding:8px 10px;text-align:center;font-size:11px;color:#6B7280;text-transform:uppercase">Anterior${selAnt!=null?` (${lbl(selAnt)})`:""}</th><th style="padding:8px 10px;text-align:center;font-size:11px;color:#6B7280;text-transform:uppercase">Δ</th>`:""}
        <th style="padding:8px 10px;text-align:center;font-size:11px;color:#6B7280;text-transform:uppercase">Meta</th>
      </tr></thead><tbody>`;
      INDICADORES.forEach((ind,i)=>{
        const vA=indA[ind.key],vAnt=indAnt?.[ind.key];
        const d=vA!=null&&vAnt!=null?Math.round((vA-vAnt)*100)/100:null;
        const cor=corInd(vA,ind);
        html+=`<tr style="border-top:1px solid #E5E3DF;background:${i%2?"#F8F7F4":"white"}"><td style="padding:8px 10px;font-weight:600">${ind.label}</td><td style="padding:8px 10px;text-align:center;font-weight:700;color:${cor}">${fmtV(vA,ind)}</td>${indAnt?`<td style="padding:8px 10px;text-align:center;color:#6B7280">${fmtV(vAnt,ind)}</td><td style="padding:8px 10px;text-align:center">${fmtD(d,ind.inv)}</td>`:""}<td style="padding:8px 10px;text-align:center;color:#6B7280">${ind.inv?`≤${ind.meta}${ind.unit}`:`${ind.meta}${ind.unit}`}</td></tr>`;
      });
      html+="</tbody></table>";
      if(movimentos.length){
        html+=`<p style="font-weight:700;font-size:13px;margin-bottom:6px">⚡ Movimentos ≥ ${threshold} p.p./dias</p><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#F8F7F4">${["Parceiro","Indicador","Antes","Depois","Δ"].map(h=>`<th style="padding:6px 8px;text-align:${h==="Antes"||h==="Depois"||h==="Δ"?"center":"left"};font-size:11px;color:#6B7280;text-transform:uppercase">${h}</th>`).join("")}</tr></thead><tbody>`;
        movimentos.forEach((m,i)=>{ html+=`<tr style="border-top:1px solid #E5E3DF;background:${i%2?"#F8F7F4":"white"}"><td style="padding:6px 8px;font-weight:600">${m.parceiro}</td><td style="padding:6px 8px">${m.ind}</td><td style="padding:6px 8px;text-align:center;color:#6B7280">${fmtV(m.ant,{inv:m.inv,unit:m.unit})}</td><td style="padding:6px 8px;text-align:center;font-weight:700">${fmtV(m.atual,{inv:m.inv,unit:m.unit})}</td><td style="padding:6px 8px;text-align:center">${fmtD(m.d,m.inv)}</td></tr>`; });
        html+="</tbody></table>";
      }
      return html;
    };

    const abrangHtml=()=>{
      if(!cobParca) return `<p style="color:#6B7280">Sem dados de abrangência.</p>`;
      const dPct=cobParcaAnt?Math.round((cobParca.pct-cobParcaAnt.pct)*100)/100:null;
      let h=box(cobParca.pct>=50?"#16A34A":"#DC2626",`Cobertura Parça${selA!=null?` (${lbl(selA)})`:""}}`,`${cobParca.pct.toFixed(1)}%`,`${cobParca.parca.toLocaleString("pt-BR")} de ${cobParca.total.toLocaleString("pt-BR")} coletas`);
      if(cobParcaAnt) h+=box("#6B7280",`Anterior${selAnt!=null?` (${lbl(selAnt)})`:""}}`,`${cobParcaAnt.pct.toFixed(1)}%`,`${cobParcaAnt.parca.toLocaleString("pt-BR")} de ${cobParcaAnt.total.toLocaleString("pt-BR")} coletas`);
      if(dPct!=null) h+=box(dPct>=0?"#16A34A":"#DC2626","Variação",`${dPct>=0?"+":""}${dPct.toFixed(2)} p.p.`,"vs período anterior");
      if(cobParca.ufList?.length){
        h+=`<table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:16px"><thead><tr style="background:#F8F7F4"><th style="padding:6px 10px;text-align:left;font-size:11px;color:#6B7280;text-transform:uppercase">Estado</th><th style="padding:6px 10px;text-align:right;font-size:11px;color:#6B7280;text-transform:uppercase">Coletas</th><th style="padding:6px 10px;text-align:right;font-size:11px;color:#16A34A;text-transform:uppercase">Parça</th><th style="padding:6px 10px;text-align:right;font-size:11px;color:#6B7280;text-transform:uppercase">% Cobertura</th></tr></thead><tbody>`;
        cobParca.ufList.slice(0,15).forEach((u,i)=>{ const c=u.pct>=75?"#16A34A":u.pct>=40?"#CA8A04":"#DC2626"; h+=`<tr style="border-top:1px solid #E5E3DF;background:${i%2?"#F8F7F4":"white"}"><td style="padding:6px 10px;font-weight:600">${u.uf}</td><td style="padding:6px 10px;text-align:right">${u.total.toLocaleString("pt-BR")}</td><td style="padding:6px 10px;text-align:right">${u.parca.toLocaleString("pt-BR")}</td><td style="padding:6px 10px;text-align:right;font-weight:700;color:${c}">${u.pct.toFixed(1)}%</td></tr>`; });
        h+="</tbody></table>";
      }
      return h;
    };

    const csatHtml=()=>{
      if(!csatA) return `<p style="color:#6B7280">Sem dados de CSAT.</p>`;
      const dCsat=csatAnt&&csatA?.share!=null&&csatAnt?.share!=null?Math.round((csatA.share-csatAnt.share)*1000)/10:null;
      let h=box("#7C3AED",`Share notas 4-5${selA!=null?` (${lbl(selA)})`:""}}`,csatA.share!=null?`${(csatA.share*100).toFixed(1)}%`:"—",`${csatA.respostas||0} respostas${csatA.label?` · ${csatA.label}`:""}`);
      if(csatAnt) h+=box("#6B7280",`Anterior${selAnt!=null?` (${lbl(selAnt)})`:""}}`,csatAnt.share!=null?`${(csatAnt.share*100).toFixed(1)}%`:"—",`${csatAnt.respostas||0} respostas${csatAnt.label?` · ${csatAnt.label}`:""}`);
      if(dCsat!=null) h+=box(dCsat>=0?"#16A34A":"#DC2626","Variação",`${dCsat>=0?"+":""}${dCsat.toFixed(1)} p.p.`,"vs período anterior");
      return h;
    };

    const abertoHtml=()=>{
      let h=box(emAberto25.total>0?"#DC2626":"#16A34A",`Total ≥ 25 dias em aberto${selA!=null?` (${lbl(selA)})`:""}}`,emAberto25.total);
      if(emAberto25.parceiros.length){
        h+=`<table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:12px"><thead><tr style="background:#F8F7F4"><th style="padding:6px 10px;text-align:left;font-size:11px;color:#6B7280">Parceiro</th><th style="padding:6px 10px;text-align:right;font-size:11px;color:#6B7280">Coletas</th></tr></thead><tbody>`;
        emAberto25.parceiros.forEach((p,i)=>{ h+=`<tr style="border-top:1px solid #E5E3DF;background:${i%2?"#F8F7F4":"white"}"><td style="padding:6px 10px">${p.nome}</td><td style="padding:6px 10px;text-align:right;font-weight:700;color:#DC2626">${p.count}</td></tr>`; });
        h+="</tbody></table>";
      }
      return h;
    };

    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${titulo}</title>
<style>@media print{body{margin:0;padding:20px}button{display:none!important}}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;color:#1C1917;padding:40px;max-width:960px;margin:0 auto}h1{font-size:22px;margin:0 0 4px}.sub{color:#6B7280;font-size:13px;margin-bottom:32px}</style>
</head><body>
<h1>📋 ${titulo}</h1>
<div class="sub">Gerado em ${dataHoje} · Período: ${selA!=null?lbl(selA):"—"}${selAnt!=null?" vs "+lbl(selAnt):""}</div>
${sec("🗺️ Abrangência Parça","#F97316",abrangHtml(),racionais.abrangencia)}
${sec("📊 Indicadores SLA / Agendamento / Aderência","#2563EB",tblInd(),racionais.indicadores)}
${sec("📦 Coleta x Recebimento","#16A34A",crData?.rows?`<p style="color:#6B7280;font-size:13px">Base: <strong>${crData.nome||"—"}</strong> · ${crData.rows.length.toLocaleString("pt-BR")} linhas</p>`:"<p style='color:#6B7280'>Sem dados.</p>",racionais.coletaReceb)}
${sec("⭐ CSAT","#7C3AED",csatHtml(),racionais.csat)}
${sec("⏰ Coletas em Aberto (+25 dias)","#DC2626",abertoHtml(),racionais.emAberto)}
<p style="margin-top:48px;font-size:11px;color:#9CA3AF;border-top:1px solid #E5E3DF;padding-top:12px">Gerado pelo Dashboard Gestão Parça</p>
</body></html>`;
  },[selA,selAnt,lbl,indA,indAnt,movimentos,threshold,racionais,cobParca,cobParcaAnt,csatA,csatAnt,emAberto25,crData]);
  const exportarHTML = ()=>{ const html=gerarHTML(); const b=new Blob([html],{type:"text/html"}); const u=URL.createObjectURL(b); const a=document.createElement("a"); a.href=u;a.download=`weekly-${selA!=null?lbl(selA):"periodo"}.html`;a.click();URL.revokeObjectURL(u); };
  const exportarPDF  = ()=>{ const w=window.open("","_blank"); w.document.write(gerarHTML()); w.document.close(); setTimeout(()=>w.print(),600); };

  const pill = on=>({padding:"5px 14px",borderRadius:999,fontSize:13,fontWeight:600,cursor:"pointer",border:`1.5px solid ${on?C.laranja:C.cinzaBorda}`,background:on?`${C.laranja}18`:"transparent",color:on?C.laranja:C.cinzaTexto});
  const sel_style = ativo=>({padding:"6px 10px",borderRadius:6,border:`1.5px solid ${ativo?C.laranja:C.cinzaBorda}`,fontSize:13,fontWeight:600,color:ativo?C.laranja:C.cinzaTexto,background:C.cinzaCard});

  if(loading) return <div style={{padding:40,color:C.cinzaTexto,fontSize:13}}>⏳ Carregando dados...</div>;

  const nomeRel = "Weekly";

  const secoes = [
    {key:"abrangencia", titulo:"🗺️ Abrangência Parça", cor:C.laranja,
     conteudo: cobParca ? <>
       {/* KPIs: atual + anterior + delta */}
       <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:16}}>
         <Kpi label={`Cobertura Parça${selA!=null?` (${lbl(selA)})`:""}`} valor={`${cobParca.pct.toFixed(1)}%`} cor={cobParca.pct>=50?C.verde:C.vermelho} sub={`${cobParca.parca.toLocaleString("pt-BR")} de ${cobParca.total.toLocaleString("pt-BR")} coletas`}/>
         {cobParcaAnt&&<Kpi label={`Anterior${selAnt!=null?` (${lbl(selAnt)})`:""}`} valor={`${cobParcaAnt.pct.toFixed(1)}%`} cor={C.cinzaTexto} sub={`${cobParcaAnt.parca.toLocaleString("pt-BR")} de ${cobParcaAnt.total.toLocaleString("pt-BR")} coletas`}/>}
         {cobParcaAnt&&(()=>{const d=Math.round((cobParca.pct-cobParcaAnt.pct)*100)/100;return <Kpi label="Variação" valor={`${d>=0?"+":""}${d.toFixed(2)} p.p.`} cor={d>=0?C.verde:C.vermelho} sub="vs período anterior"/>;})()} 
       </div>
       {/* Tabela por estado */}
       {cobParca.ufList?.length>0&&<>
         <div style={{fontSize:12,fontWeight:700,color:C.cinzaTexto,marginBottom:6,textTransform:"uppercase"}}>Cobertura por estado</div>
         <div style={{overflowX:"auto"}}>
           <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
             <thead><tr style={{background:C.cinzaFundo}}>
               {["Estado","Coletas","Parça","% Cobertura"].map((h,i)=><th key={h} style={{padding:"5px 8px",textAlign:i===0?"left":"right",fontSize:10,fontWeight:700,color:C.cinzaTexto,textTransform:"uppercase"}}>{h}</th>)}
             </tr></thead>
             <tbody>{cobParca.ufList.slice(0,15).map((u,i)=>{
               const cor=u.pct>=75?C.verde:u.pct>=40?C.amarelo:C.vermelho;
               const barW=Math.round(u.pct);
               return <tr key={u.uf} style={{borderTop:`1px solid ${C.cinzaBorda}`,background:i%2===0?"transparent":C.cinzaFundo}}>
                 <td style={{padding:"5px 8px",fontWeight:600}}>{u.uf}</td>
                 <td style={{padding:"5px 8px",textAlign:"right"}}>{u.total.toLocaleString("pt-BR")}</td>
                 <td style={{padding:"5px 8px",textAlign:"right"}}>{u.parca.toLocaleString("pt-BR")}</td>
                 <td style={{padding:"5px 8px",textAlign:"right"}}>
                   <div style={{display:"flex",alignItems:"center",gap:8,justifyContent:"flex-end"}}>
                     <div style={{width:80,height:8,background:"#E5E3DF",borderRadius:4,overflow:"hidden"}}>
                       <div style={{width:`${barW}%`,height:"100%",background:cor,borderRadius:4}}/>
                     </div>
                     <span style={{fontWeight:700,color:cor,minWidth:42,textAlign:"right"}}>{u.pct.toFixed(1)}%</span>
                   </div>
                 </td>
               </tr>;
             })}</tbody>
           </table>
         </div>
       </>}
     </> : <p style={{color:C.cinzaTexto,fontSize:13,margin:0}}>Sem dados. Importe a base na aba <strong>Abrangência Parça</strong>.</p>},

    {key:"indicadores", titulo:"📊 Indicadores SLA / Agendamento / Aderência", cor:C.azul,
     conteudo: indA ? <>
       <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,marginBottom:16}}>
         <thead><tr style={{background:C.cinzaFundo}}>
           <th style={{padding:"6px 10px",textAlign:"left",fontSize:11,color:C.cinzaTexto,textTransform:"uppercase"}}>Indicador</th>
           <th style={{padding:"6px 10px",textAlign:"center",fontSize:11,color:C.azul,textTransform:"uppercase"}}>Atual{selA!=null?` (${lbl(selA)})`:""}</th>
           {indAnt&&<th style={{padding:"6px 10px",textAlign:"center",fontSize:11,color:C.cinzaTexto,textTransform:"uppercase"}}>Anterior{selAnt!=null?` (${lbl(selAnt)})`:""}</th>}
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
             {indAnt&&<td style={{padding:"6px 10px",textAlign:"center",color:C.cinzaTexto}}>{fmtInd(vAnt,ind)}</td>}
             {indAnt&&<td style={{padding:"6px 10px",textAlign:"center",fontWeight:700,color:dc}}>{dt}</td>}
             <td style={{padding:"6px 10px",textAlign:"center",color:C.cinzaTexto}}>{ind.inv?`≤${ind.meta}${ind.unit}`:`${ind.meta}${ind.unit}`}</td>
           </tr>;
         })}</tbody>
       </table>
       {movimentos.length>0&&<>
         <div style={{fontSize:13,fontWeight:700,marginBottom:8}}>⚡ Movimentos ≥ {threshold} p.p./dias</div>
         <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
           <thead><tr style={{background:C.cinzaFundo}}>
             {["Parceiro","Indicador","Antes","Depois","Δ"].map(h=><th key={h} style={{padding:"5px 8px",textAlign:h==="Antes"||h==="Depois"||h==="Δ"?"center":"left",fontSize:10,color:C.cinzaTexto,textTransform:"uppercase"}}>{h}</th>)}
           </tr></thead>
           <tbody>{movimentos.map((m,i)=>{
             const {texto:dt,cor:dc}=fmtDelta(m.d,m.inv);
             return <tr key={i} style={{borderTop:`1px solid ${C.cinzaBorda}`,background:i%2?"transparent":C.cinzaFundo}}>
               <td style={{padding:"5px 8px",fontWeight:600}}>{m.parceiro}</td>
               <td style={{padding:"5px 8px"}}>{m.ind}</td>
               <td style={{padding:"5px 8px",textAlign:"center",color:C.cinzaTexto}}>{fmtInd(m.ant,{inv:m.inv,unit:m.unit})}</td>
               <td style={{padding:"5px 8px",textAlign:"center",fontWeight:700}}>{fmtInd(m.atual,{inv:m.inv,unit:m.unit})}</td>
               <td style={{padding:"5px 8px",textAlign:"center",fontWeight:700,color:dc}}>{dt}</td>
             </tr>;
           })}</tbody>
         </table>
       </>}
     </>
     : <p style={{color:C.cinzaTexto,fontSize:13,margin:0}}>Sem dados de SLA. Carregue o CSV na aba <strong>Performance Coleta</strong>.</p>},

    {key:"coletaReceb", titulo:"📦 Coleta x Recebimento", cor:C.verde,
     conteudo: crData?.rows
       ? <p style={{fontSize:13,color:C.cinzaTexto,margin:0}}>Base: <strong>{crData.nome||"—"}</strong> · {crData.rows.length.toLocaleString("pt-BR")} linhas importadas.</p>
       : <p style={{color:C.cinzaTexto,fontSize:13,margin:0}}>Sem dados. Importe na aba <strong>Performance Coleta → Coleta x Recebimento</strong>.</p>},

    {key:"csat", titulo:"⭐ CSAT", cor:"#7C3AED",
     conteudo: csatA ? <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
       <Kpi label={`Share notas 4-5${selA!=null?` (${lbl(selA)})`:""}`} valor={csatA.share!=null?`${(csatA.share*100).toFixed(1)}%`:"—"} cor="#7C3AED" sub={`${csatA.respostas||0} respostas${csatA.label?` · ${csatA.label}`:""}`}/>
       {csatAnt&&<Kpi label={`Anterior${selAnt!=null?` (${lbl(selAnt)})`:""}`} valor={csatAnt.share!=null?`${(csatAnt.share*100).toFixed(1)}%`:"—"} cor={C.cinzaTexto} sub={`${csatAnt.respostas||0} respostas${csatAnt.label?` · ${csatAnt.label}`:""}`}/>}
       {csatAnt&&csatA?.share!=null&&csatAnt?.share!=null&&(()=>{const d=Math.round((csatA.share-csatAnt.share)*1000)/10;return <Kpi label="Variação" valor={`${d>=0?"+":""}${d.toFixed(1)} p.p.`} cor={d>=0?C.verde:C.vermelho} sub="vs período anterior"/>;})()} 
     </div>
     : <p style={{color:C.cinzaTexto,fontSize:13,margin:0}}>Sem dados de CSAT. Importe na aba <strong>CSAT</strong>.</p>},

    {key:"emAberto", titulo:`⏰ Coletas em Aberto (+25 dias)${selA!=null?` — ${lbl(selA)}`: ""}`, cor:C.vermelho,
     conteudo: <div style={{display:"flex",gap:12,flexWrap:"wrap"}}><Kpi label={`Total ≥ 25 dias${selA!=null?` (${lbl(selA)})`:""}`} valor={emAberto25.total.toString()} cor={emAberto25.total>0?C.vermelho:C.verde}/>
       {emAberto25.parceiros.slice(0,6).map(p=><Kpi key={p.nome} label={p.nome} valor={p.count.toString()} cor={C.vermelho}/>)}</div>},
  ];

  return (
    <div style={{maxWidth:1100,margin:"0 auto",padding:"20px 24px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
        <div>
          <div style={{fontSize:20,fontWeight:700}}>📋 Gerador de Weekly</div>
          <div style={{fontSize:12,color:C.cinzaTexto}}>Selecione o período, preencha os racionais e exporte.</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={exportarHTML} style={{padding:"9px 16px",borderRadius:8,border:`1.5px solid ${C.azul}`,background:"transparent",color:C.azul,fontSize:13,fontWeight:700,cursor:"pointer"}}>⬇ Exportar HTML</button>
          <button onClick={exportarPDF}  style={{padding:"9px 16px",borderRadius:8,background:C.laranja,color:"#fff",border:"none",fontSize:13,fontWeight:700,cursor:"pointer"}}>🖨️ Exportar PDF</button>
        </div>
      </div>

      {/* Configurar período */}
      <div style={{background:C.cinzaCard,border:`1px solid ${C.cinzaBorda}`,borderRadius:12,padding:20,marginBottom:20}}>
        <div style={{fontWeight:700,marginBottom:14}}>Configurar período</div>
        <div style={{display:"flex",gap:24,flexWrap:"wrap",alignItems:"flex-start"}}>
          <div>
            <div style={{fontSize:11,fontWeight:700,color:C.cinzaTexto,marginBottom:8,textTransform:"uppercase"}}>Granularidade</div>
            <div style={{display:"flex",gap:6}}>
              {[["semana","Semana"],["mes","Mês"],["trim","Trimestre"]].map(([k,l])=>(
                <button key={k} onClick={()=>{setGranular(k);setSelA(null);setSelAnt(null);}} style={pill(granular===k)}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <div style={{fontSize:11,fontWeight:700,color:C.cinzaTexto,marginBottom:8,textTransform:"uppercase"}}>Período atual</div>
            <select value={selA??""} onChange={e=>setSelA(e.target.value?Number(e.target.value):null)} style={sel_style(selA!=null)}>
              <option value="">Selecionar</option>
              {periodos.map(p=><option key={p} value={p}>{lbl(p)}</option>)}
            </select>
            {periodos.length===0&&<div style={{fontSize:11,color:C.vermelho,marginTop:4}}>Sem dados disponíveis — carregue o CSV na aba Performance Coleta.</div>}
          </div>
          <div>
            <div style={{fontSize:11,fontWeight:700,color:C.cinzaTexto,marginBottom:8,textTransform:"uppercase"}}>Período anterior (para Δ)</div>
            <select value={selAnt??""} onChange={e=>setSelAnt(e.target.value?Number(e.target.value):null)} style={sel_style(false)}>
              <option value="">Nenhum</option>
              {periodos.filter(p=>p!==selA).map(p=><option key={p} value={p}>{lbl(p)}</option>)}
            </select>
          </div>
          <div>
            <div style={{fontSize:11,fontWeight:700,color:C.cinzaTexto,marginBottom:8,textTransform:"uppercase"}}>Destacar variação ≥</div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <input type="number" value={threshold} onChange={e=>setThreshold(Number(e.target.value)||1)} min={1} max={50}
                style={{width:60,padding:"6px 8px",borderRadius:6,border:`1px solid ${C.cinzaBorda}`,fontSize:13,textAlign:"center"}}/>
              <span style={{fontSize:13,color:C.cinzaTexto}}>p.p. / dias</span>
            </div>
          </div>
        </div>
        {granular==="mes"&&allMeses.length===0&&<div style={{marginTop:12,fontSize:12,color:C.amarelo,background:"#FEF3C7",padding:"8px 12px",borderRadius:6}}>
          ⚠️ Nenhum mês detectado — os dados são carregados do CSV da aba Performance Coleta. Os meses são extraídos da coluna "Mês_Efetivada" do CSV. Verifique se o CSV está importado com essa coluna preenchida.
        </div>}
      </div>

      {/* Seções */}
      {secoes.map(({key,titulo,cor,conteudo})=>(
        <div key={key} style={{background:C.cinzaCard,border:`1px solid ${C.cinzaBorda}`,borderRadius:12,padding:20,marginBottom:16}}>
          <div style={{fontWeight:700,fontSize:15,borderLeft:`4px solid ${cor}`,paddingLeft:12,marginBottom:14}}>{titulo}</div>
          {conteudo}
          <div style={{marginTop:14}}>
            <div style={{fontSize:11,fontWeight:700,color:C.cinzaTexto,marginBottom:6,textTransform:"uppercase"}}>Racional / Observações</div>
            <textarea value={racionais[key]} onChange={e=>setR(key,e.target.value)}
              placeholder={`Escreva o racional desta seção para o ${nomeRel}...`}
              rows={4}
              style={{width:"100%",padding:"10px 12px",borderRadius:8,border:`1px solid ${C.cinzaBorda}`,fontSize:13,fontFamily:"inherit",resize:"vertical",boxSizing:"border-box",background:C.cinzaFundo,outline:"none"}}/>
          </div>
        </div>
      ))}
    </div>
  );
}

function Kpi({label,valor,cor,sub}) {
  return (
    <div style={{background:C.cinzaFundo,border:`1px solid ${C.cinzaBorda}`,borderRadius:10,padding:"12px 16px",minWidth:140}}>
      <div style={{fontSize:11,color:C.cinzaTexto,marginBottom:4}}>{label}</div>
      <div style={{fontSize:24,fontWeight:700,color:cor||C.texto}}>{valor}</div>
      {sub&&<div style={{fontSize:11,color:C.cinzaTexto,marginTop:2}}>{sub}</div>}
    </div>
  );
}
