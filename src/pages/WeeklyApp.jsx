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
const MESES_NOME = {1:"Jan",2:"Fev",3:"Mar",4:"Abr",5:"Mai",6:"Jun",7:"Jul",8:"Ago",9:"Set",10:"Out",11:"Nov",12:"Dez"};
const TRIM_MESES = {1:[1,2,3],2:[4,5,6],3:[7,8,9],4:[10,11,12]};

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

function calcPeriodo(semanas, filtroParcs) {
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

function calcParceiros(semanas, pd, filtroParcs) {
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

// Helper pra calcular a análise CR do tipo {n, mesma, um, dois, tres, porParceiro}
function calcCR(rows, filtroParcs) {
  const validas = rows
    .filter(r => {
      if(!r["Data Coleta"]||!r["Data de Recebimento da Coleta"]) return false;
      if(filtroParcs&&filtroParcs.length&&!filtroParcs.includes(r["Parceiro Nome"])) return false;
      return true;
    })
    .map(r => {
      const parseDate = s => { const [d,m,y]=String(s||"").split("/"); return (d&&m&&y)?`${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`:null; };
      const dc=parseDate(r["Data Coleta"]), dr=parseDate(r["Data de Recebimento da Coleta"]);
      if(!dc||!dr) return null;
      const dias = Math.round((new Date(dr)-new Date(dc))/(1000*60*60*24));
      return dias>=0?{...r,dias}:null;
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
  const [abrangAtual, setAbrangAtual] = useState(null);
  const [crRows,      setCrRows]      = useState([]);
  const [crRowsAnt,   setCrRowsAnt]   = useState([]);
  const [loading,     setLoading]     = useState(true);

  const [granular,    setGranular]    = useState("semana");
  const [selA,        setSelA]        = useState(null);
  const [selAnt,      setSelAnt]      = useState(null);
  const [filtroParcs, setFiltroParcs] = useState([]); // filtro multi-parceiro global
  const [racionais,   setRacionais]   = useState({abrangencia:"",indicadores:"",coletaReceb:"",csat:""});
  const setR = (k,v) => setRacionais(p=>({...p,[k]:v}));

  // Estado minimizável para subseções da abrangência
  const [abrangMostrarEstados, setAbrangMostrarEstados] = useState(true);
  const [abrangMostrarShare, setAbrangMostrarShare] = useState(true);
  // Filtro multi-parça dentro da seção de abrangência
  const [abrangFiltroParcs, setAbrangFiltroParcs] = useState([]);

  useEffect(()=>{
    (async()=>{
      const wRaw = lerLS("slaParca_weekly",[]);
      const pdRaw= lerLS("slaParca_pd",{});
      const csvSalvo = await lerIDB("slaParcaDB","csvBruto","atual");
      let rows = [];
      if(csvSalvo?.rows) rows = csvSalvo.rows;
      else if(typeof csvSalvo==="string") rows = Papa.parse(csvSalvo,{header:true,skipEmptyLines:true}).data;
      setRawRows(rows);

      const semMes = {};
      rows.forEach(r=>{
        const s = parseInt(r["semana_Efetivada"]||r["Semana_Efetivada"]||0);
        const m = parseInt(r["Mês_Efetivada"]||r["Mes_Efetivada"]||r["mes_Efetivada"]||0);
        if(s&&m&&!semMes[s]) semMes[s]=m;
      });
      const wEnriq = wRaw.map(w=>({...w, mes: semMes[w.s]||null}));
      setWeekly(wEnriq.sort((a,b)=>a.s-b.s));
      setPd(pdRaw);

      if(wEnriq.length){
        setSelA(wEnriq[wEnriq.length-1].s);
        if(wEnriq.length>1) setSelAnt(wEnriq[wEnriq.length-2].s);
      }

      // CSAT
      let csatSlim = null;
      const csatIDB = await lerIDB("csatParcaDB","dados","parsed");
      if(csatIDB?.porSemana){
        const obj = {};
        csatIDB.porSemana.forEach(p=>{ if(p.semana) obj[`${csatIDB.anoAtual||new Date().getFullYear()}_W${p.semana}`]=p.slim||p; });
        csatSlim = obj;
        // Por parceiro: parceiros dentro de cada semana
        const pp={};
        csatIDB.porSemana.forEach(semObj=>{
          (semObj.parceiros||[]).forEach(pc=>{
            if(!pp[pc.nome]) pp[pc.nome]={semanas:[]};
            pp[pc.nome].semanas.push({semana:semObj.semana,mes:semObj.mes,share:pc.share,respostas:pc.respostas||pc.total||0});
          });
        });
        setCsatPorParceiro(pp);
      }
      if(!csatSlim){
        csatSlim = lerLS("csat_semanas_travadas",{});
        if(Array.isArray(csatSlim)){
          const obj = {};
          csatSlim.forEach(p=>{ if(p.semana) obj[`${new Date().getFullYear()}_W${p.semana}`]=p; });
          csatSlim = obj;
        }
      }
      setCsatSlots(csatSlim||{});

      // Abrangência
      const abr = await lerIDB("abrangenciaParcaDB2","dados","atual");
      setAbrangAtual(abr||null);

      // Coleta x Recebimento (atual e anterior)
      const cr = await lerIDB("slaParcaDB","csvBruto","coletaRecebimento");
      const crAnt = await lerIDB("slaParcaDB","csvBruto","coletaRecebimentoAnterior");
      setCrRows(cr?.rows||[]);
      setCrRowsAnt(crAnt?.rows||[]);

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

  // Ponderação dos indicadores globais (respeitando filtro de parceiro)
  const indA = useMemo(()=>{
    if(!filtroParcs.length) return calcPeriodo(semsA);
    // Agrega apenas pelos parceiros filtrados
    const rows = semsA.flatMap(w=>filtroParcs.map(p=>pd[p]?.[w.s]).filter(Boolean));
    if(!rows.length) return null;
    const tot=rows.reduce((a,r)=>a+(r.total||0),0); if(!tot) return null;
    const pw=key=>{let s=0,t=0;rows.forEach(r=>{if(r[key]!=null){s+=r[key]*(r.total||0);t+=r.total||0;}});return t?Math.round(s/t*100)/100:null;};
    return {total:tot,sla:pw("sla"),agend:pw("agend"),ader:pw("ader"),sla15:pw("sla15"),aging:pw("aging")};
  },[semsA,pd,filtroParcs]);
  const indAnt = useMemo(()=>{
    if(!filtroParcs.length) return calcPeriodo(semsAnt);
    const rows = semsAnt.flatMap(w=>filtroParcs.map(p=>pd[p]?.[w.s]).filter(Boolean));
    if(!rows.length) return null;
    const tot=rows.reduce((a,r)=>a+(r.total||0),0); if(!tot) return null;
    const pw=key=>{let s=0,t=0;rows.forEach(r=>{if(r[key]!=null){s+=r[key]*(r.total||0);t+=r.total||0;}});return t?Math.round(s/t*100)/100:null;};
    return {total:tot,sla:pw("sla"),agend:pw("agend"),ader:pw("ader"),sla15:pw("sla15"),aging:pw("aging")};
  },[semsAnt,pd,filtroParcs]);

  const parcsA   = useMemo(()=>calcParceiros(semsA, pd, filtroParcs.length?filtroParcs:null), [semsA,pd,filtroParcs]);
  const parcsAnt = useMemo(()=>calcParceiros(semsAnt,pd,filtroParcs.length?filtroParcs:null), [semsAnt,pd,filtroParcs]);

  // Movimentos: todos os parceiros, sem threshold — agrupados por parceiro e por indicador
  const movimentos = useMemo(()=>{
    const porParceiro = {};
    const porIndicador = {};
    INDICADORES.forEach(ind=>{
      parcsA.forEach(pA=>{
        const pAnt=parcsAnt.find(p=>p.nome===pA.nome);
        if(!pAnt||pA[ind.key]==null||pAnt[ind.key]==null) return;
        const d=Math.round((pA[ind.key]-pAnt[ind.key])*100)/100;
        if(d===0) return;
        const item={parceiro:pA.nome,ind:ind.label,key:ind.key,atual:pA[ind.key],ant:pAnt[ind.key],d,inv:ind.inv,unit:ind.unit};
        if(!porParceiro[pA.nome]) porParceiro[pA.nome]=[];
        porParceiro[pA.nome].push(item);
        if(!porIndicador[ind.label]) porIndicador[ind.label]=[];
        porIndicador[ind.label].push(item);
      });
    });
    return {porParceiro, porIndicador};
  },[parcsA,parcsAnt]);

  // ── CSAT por período ──────────────────────────────────────────────────────
  const csatDoPeríodo = useCallback((sel)=>{
    if(sel==null) return null;
    const vals = Object.values(csatSlots).filter(v=>v&&v.semana);
    if(!vals.length) return null;
    if(granular==="semana") return vals.find(v=>v.semana===sel)||null;
    if(granular==="mes"){ const vs=vals.filter(v=>v.mes===sel); if(!vs.length) return null; const tot=vs.reduce((s,v)=>s+(v.respostas||0),0); const n45=vs.reduce((s,v)=>s+(v.notas45!=null?v.notas45:Math.round((v.share||0)*(v.respostas||0))),0); return {share:tot?n45/tot:null,respostas:tot,label:MESES_NOME[sel]}; }
    if(granular==="trim"){ const ms=TRIM_MESES[sel]||[]; const vs=vals.filter(v=>ms.includes(v.mes)); if(!vs.length) return null; const tot=vs.reduce((s,v)=>s+(v.respostas||0),0); const n45=vs.reduce((s,v)=>s+(v.notas45!=null?v.notas45:Math.round((v.share||0)*(v.respostas||0))),0); return {share:tot?n45/tot:null,respostas:tot,label:`T${sel}`}; }
    return vals.sort((a,b)=>(b.semana||0)-(a.semana||0))[0];
  },[csatSlots,granular]);

  const csatA   = useMemo(()=>csatDoPeríodo(selA),   [selA,   csatDoPeríodo]);
  const csatAnt = useMemo(()=>csatDoPeríodo(selAnt), [selAnt, csatDoPeríodo]);

  // ── Abrangência filtrada por período e por parça ──────────────────────────
  const semanasDoA   = useMemo(()=>semsDoPeríodo(selA).map(w=>w.s),   [selA,semsDoPeríodo]);
  const semanasDoAnt = useMemo(()=>semsDoPeríodo(selAnt).map(w=>w.s), [selAnt,semsDoPeríodo]);

  const calcCobParca = useCallback((semanas, filtroA=[])=>{
    if(!abrangAtual?.rows) return null;
    let rows = semanas.length ? abrangAtual.rows.filter(r=>semanas.includes(r.semana)) : abrangAtual.rows;
    if(filtroA.length) rows = rows.filter(r=>filtroA.includes(r.transportadora));
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
    if(!abrangAtual?.rows) return [];
    return [...new Set(abrangAtual.rows.filter(r=>r.validacao==="PARÇA").map(r=>r.transportadora))].sort();
  },[abrangAtual]);

  const cobParca    = useMemo(()=>calcCobParca(semanasDoA, abrangFiltroParcs),   [semanasDoA,calcCobParca,abrangFiltroParcs]);
  const cobParcaAnt = useMemo(()=>calcCobParca(semanasDoAnt, abrangFiltroParcs), [semanasDoAnt,calcCobParca,abrangFiltroParcs]);

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
                <button key={k} onClick={()=>{setGranular(k);setSelA(null);setSelAnt(null);}} style={pill(granular===k)}>{l}</button>
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
          <div style={{fontSize:12,fontWeight:700,color:C.cinzaTexto,marginBottom:10,textTransform:"uppercase"}}>
            Filtrar por parceiro (todos os indicadores)
            {filtroParcs.length>0&&<button onClick={()=>setFiltroParcs([])} style={{marginLeft:10,fontSize:11,fontWeight:600,color:C.cinzaTexto,background:"transparent",border:`1px solid ${C.cinzaBorda}`,borderRadius:6,padding:"2px 8px",cursor:"pointer"}}>Limpar</button>}
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {todosParceiros.map(p=>(
              <button key={p} onClick={()=>toggleParc(p)} style={pill(filtroParcs.includes(p))}>{p}</button>
            ))}
          </div>
          {filtroParcs.length>0&&<div style={{fontSize:11,color:C.laranja,marginTop:8}}>Mostrando dados de: {filtroParcs.join(", ")}</div>}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ── 1. ABRANGÊNCIA ── */}
      <div style={{background:C.cinzaCard,border:`1px solid ${C.cinzaBorda}`,borderRadius:12,padding:20,marginBottom:14}}>
        <div style={{fontWeight:700,fontSize:15,borderLeft:`4px solid ${C.laranja}`,paddingLeft:12,marginBottom:14}}>🗺️ Abrangência Parça</div>

        {/* Filtro de parça dentro da abrangência */}
        {transpParçaDisponiveis.length>0&&(
          <div style={{marginBottom:12}}>
            <span style={{fontSize:11,fontWeight:700,color:C.cinzaTexto,marginRight:8}}>Filtrar transportadora Parça:</span>
            {transpParçaDisponiveis.slice(0,12).map(t=>(
              <button key={t} onClick={()=>toggleAbrangParc(t)} style={{...pill(abrangFiltroParcs.includes(t)),marginRight:4,marginBottom:4}}>{t}</button>
            ))}
            {abrangFiltroParcs.length>0&&<button onClick={()=>setAbrangFiltroParcs([])} style={{fontSize:11,color:C.cinzaTexto,background:"transparent",border:`1px solid ${C.cinzaBorda}`,borderRadius:6,padding:"3px 8px",cursor:"pointer",marginLeft:4}}>Limpar</button>}
          </div>
        )}

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
                {cobParcaAnt&&<th style={{padding:"5px 8px",textAlign:"right",fontSize:10,fontWeight:700,color:C.cinzaTexto,textTransform:"uppercase"}}>Share ant.{selAnt!=null?` (${lbl(selAnt)})`:""}  </th>}
                {cobParcaAnt&&<th style={{padding:"5px 8px",textAlign:"right",fontSize:10,fontWeight:700,color:C.cinzaTexto,textTransform:"uppercase"}}>Δ</th>}
              </tr></thead>
              <tbody>
                {cobParca.transpList.map((t,i)=>{
                  const tAnt = cobParcaAnt?.transpList.find(x=>x.nome===t.nome);
                  const d = tAnt!=null ? Math.round((t.share-tAnt.share)*100)/100 : null;
                  return <tr key={t.nome} style={{borderTop:`1px solid ${C.cinzaBorda}`,background:i%2===0?"transparent":C.cinzaFundo}}>
                    <td style={{padding:"5px 8px",fontWeight:600}}>{t.nome}</td>
                    <td style={{padding:"5px 8px",textAlign:"right"}}>{t.coletas.toLocaleString("pt-BR")}</td>
                    <td style={{padding:"5px 8px",textAlign:"right",fontWeight:700,color:C.verde}}>{t.share.toFixed(1)}%</td>
                    {cobParcaAnt&&<td style={{padding:"5px 8px",textAlign:"right",color:C.cinzaTexto}}>{tAnt?`${tAnt.share.toFixed(1)}%`:"—"}</td>}
                    {cobParcaAnt&&<td style={{padding:"5px 8px",textAlign:"right"}}><DeltaChip d={d} inv={false} unit=" p.p."/></td>}
                  </tr>;
                })}
                <tr style={{borderTop:`2px solid ${C.cinzaBorda}`,fontWeight:700}}>
                  <td style={{padding:"5px 8px"}}>Total Parça</td>
                  <td style={{padding:"5px 8px",textAlign:"right"}}>{cobParca.parca.toLocaleString("pt-BR")}</td>
                  <td style={{padding:"5px 8px",textAlign:"right",color:C.verde}}>{cobParca.pct.toFixed(1)}%</td>
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
                        <span style={{fontWeight:700,color:cor,minWidth:40,textAlign:"right"}}>{u.pct.toFixed(1)}%</span>
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
            <div style={{marginBottom:12}}>
              <div style={{fontSize:13,fontWeight:700,marginBottom:10}}>⚡ Movimentos por parceiro</div>
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
                        <div style={{fontSize:13,fontWeight:700,color:cor}}>{m.d>=0?"+":""}{m.d.toFixed(1)}{m.unit}</div>
                        <div style={{fontSize:11,color:C.cinzaTexto}}>{fmtInd(m.ant,{inv:m.inv,unit:m.unit})} → {fmtInd(m.atual,{inv:m.inv,unit:m.unit})}</div>
                      </div>;
                    })}
                  </div>
                </div>
              ))}
            </div>
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
            <div style={{marginTop:16}}>
              <div style={{fontSize:12,fontWeight:700,color:C.cinzaTexto,marginBottom:8,textTransform:"uppercase"}}>Por parceiro</div>
              <CRTabelaParceiro crA={crA} crAnt={crRowsAnt.length>0?crAnt:null}/>
            </div>
          )}
        </> : <p style={{color:C.cinzaTexto,fontSize:13,margin:0}}>Sem dados. Importe na aba <strong>Performance Coleta → Coleta x Recebimento</strong>.</p>}

        <RacionalBox valor={racionais.coletaReceb} onChange={v=>setR("coletaReceb",v)} label="Weekly"/>
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ── 4. CSAT ── */}
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
            <div style={{marginTop:8}}>
              <div style={{fontSize:12,fontWeight:700,color:C.cinzaTexto,marginBottom:8,textTransform:"uppercase"}}>Por parceiro</div>
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
                      const semA = selA!=null&&granular==="semana" ? dados.semanas.filter(s=>s.semana===selA) : dados.semanas;
                      const semAntObj = selAnt!=null&&granular==="semana" ? dados.semanas.filter(s=>s.semana===selAnt) : [];
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
            </div>
          )}
        </> : <p style={{color:C.cinzaTexto,fontSize:13,margin:0}}>Sem dados de CSAT. Importe na aba <strong>CSAT</strong>.</p>}

        <RacionalBox valor={racionais.csat} onChange={v=>setR("csat",v)} label="Weekly"/>
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

function RacionalBox({valor,onChange,label}) {
  return (
    <div style={{marginTop:14}}>
      <div style={{fontSize:11,fontWeight:700,color:"#6B7280",marginBottom:6,textTransform:"uppercase"}}>Racional / Observações</div>
      <textarea value={valor} onChange={e=>onChange(e.target.value)}
        placeholder={`Escreva o racional desta seção para o ${label}...`} rows={3}
        style={{width:"100%",padding:"10px 12px",borderRadius:8,border:"1px solid #E5E3DF",fontSize:13,fontFamily:"inherit",resize:"vertical",boxSizing:"border-box",background:"#F8F7F4",outline:"none"}}/>
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
