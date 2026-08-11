// ─────────────────────────────────────────────────────────────────────────────
// SINCRONIZAÇÃO REMOTA — Gestão Parça (MadeiraMadeira)
// ─────────────────────────────────────────────────────────────────────────────
// Problema que este arquivo resolve: hoje os dados importados (SLA, CSAT,
// Abrangência) ficam só no navegador de quem importou (localStorage/IndexedDB).
// Cada pessoa que abre o dashboard precisa importar de novo.
//
// Solução: uma função serverless no próprio Vercel (api/sync.js) guarda os
// dados em arquivos JSON numa pasta do Google Drive, usando uma conta de
// serviço. Como a função roda no mesmo domínio do dashboard, não existe
// problema de CORS nem de login do Workspace (o motivo pelo qual a primeira
// tentativa com Google Apps Script não funcionou).
//
// Quem importa, importa normalmente e os dados são publicados nessa função.
// Quem só visualiza, ao abrir qualquer aba, busca da função automaticamente
// e guarda uma cópia local (cache) — sem precisar importar nada.
// ─────────────────────────────────────────────────────────────────────────────

export const SYNC_URL = "/api/sync"; // caminho relativo — mesmo domínio do dashboard, sem CORS

function syncConfigurado() {
  return true; // a função /api/sync sempre existe no mesmo deploy; se faltar env var, ela retorna erro 500 (ver console)
}

// ── Compressão (mesma técnica já usada no botão "Compartilhar link") ───────
// Bases grandes (ex: CSAT com comentários em texto livre) excediam o limite de
// tamanho de requisição sem isso. CompressionStream é nativo do navegador.
async function comprimir(objeto) {
  const bytes = new TextEncoder().encode(JSON.stringify(objeto));
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
  return await new Response(stream).arrayBuffer();
}

// ── Chamadas genéricas ao backend ───────────────────────────────────────────
export async function lerRemoto(store, key) {
  if (!syncConfigurado()) return null;
  try {
    const r = await fetch(`${SYNC_URL}?store=${encodeURIComponent(store)}&key=${encodeURIComponent(key)}`);
    if (!r.ok) return null;
    const j = await r.json();
    return j?.dados ?? null;
  } catch {
    return null; // sem internet ou backend fora do ar — quem chamou usa o que tiver local
  }
}

export async function salvarRemoto(store, key, dados) {
  if (!syncConfigurado()) return false;
  try {
    const comprimido = await comprimir(dados);
    const r = await fetch(`${SYNC_URL}?store=${encodeURIComponent(store)}&key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: comprimido,
    });
    return r.ok;
  } catch {
    return false;
  }
}

// ── IndexedDB genérico (mesmo padrão usado em cada dashboard) ───────────────
function abrirDB(dbName, storeName) {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) { reject(new Error("IndexedDB indisponível")); return; }
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(storeName)) req.result.createObjectStore(storeName);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGet(dbName, storeName, chave) {
  try {
    const db = await abrirDB(dbName, storeName);
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const req = tx.objectStore(storeName).get(chave);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch { return null; }
}
async function idbPut(dbName, storeName, chave, valor) {
  try {
    const db = await abrirDB(dbName, storeName);
    await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).put(valor, chave);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    return true;
  } catch { return false; }
}

// ── Pontos de sincronização conhecidos ──────────────────────────────────────
// Mapeia cada "gaveta" local (localStorage ou IndexedDB) já usada pelos
// dashboards para um nome de store/key no backend compartilhado.
export const PONTOS_SYNC = {
  slaCsvAtual:     { tipo:"idb", dbName:"slaParcaDB",          storeName:"csvBruto", chaveLocal:"atual",                     store:"sla",         key:"csvBruto_atual" },
  slaCr:           { tipo:"idb", dbName:"slaParcaDB",          storeName:"csvBruto", chaveLocal:"coletaRecebimento",         store:"sla",         key:"csvBruto_coletaRecebimento" },
  slaCrAnterior:   { tipo:"idb", dbName:"slaParcaDB",          storeName:"csvBruto", chaveLocal:"coletaRecebimentoAnterior", store:"sla",         key:"csvBruto_coletaRecebimentoAnterior" },
  slaWeekly:       { tipo:"ls",  chaveLocal:"slaParca_weekly", store:"sla", key:"weekly" },
  slaPd:           { tipo:"ls",  chaveLocal:"slaParca_pd",     store:"sla", key:"pd" },
  csatParsed:      { tipo:"idb", dbName:"csatParcaDB",         storeName:"dados",    chaveLocal:"parsed",                    store:"csat",        key:"dados_parsed" },
  csatDadosImportados: { tipo:"idb", dbName:"csatParcaDB",     storeName:"dadosImportados", chaveLocal:"atual",              store:"csat",        key:"dadosImportados_atual" },
  csatSemanasTrav: { tipo:"ls",  chaveLocal:"csat_semanas_travadas", store:"csat", key:"semanas_travadas" },
  abrangAtual:     { tipo:"idb", dbName:"abrangenciaParcaDB2", storeName:"dados",    chaveLocal:"atual",                     store:"abrangencia", key:"dados_atual" },
  abrangAnterior:  { tipo:"idb", dbName:"abrangenciaParcaDB2", storeName:"dados",    chaveLocal:"anterior",                  store:"abrangencia", key:"dados_anterior" },
  weeklyRacionais: { tipo:"ls",  chaveLocal:"weeklyParca_racionais",       store:"weekly", key:"racionais" },
  weeklyAssuntos:  { tipo:"ls",  chaveLocal:"weeklyParca_assuntosGerais",  store:"weekly", key:"assuntosGerais" },
  weeklyProblemas: { tipo:"ls",  chaveLocal:"weeklyParca_problemasColeta", store:"weekly", key:"problemasColeta" },
};

async function lerLocal(ponto) {
  if (ponto.tipo === "ls") {
    try { const s = localStorage.getItem(ponto.chaveLocal); return s ? JSON.parse(s) : null; } catch { return null; }
  }
  return await idbGet(ponto.dbName, ponto.storeName, ponto.chaveLocal);
}
async function salvarLocalPonto(ponto, dados) {
  if (ponto.tipo === "ls") {
    try { localStorage.setItem(ponto.chaveLocal, JSON.stringify(dados)); return true; } catch { return false; }
  }
  return await idbPut(ponto.dbName, ponto.storeName, ponto.chaveLocal, dados);
}

/**
 * Chame no início de cada dashboard, ANTES de ler o localStorage/IndexedDB local,
 * passando os nomes dos pontos que aquele dashboard usa (ver PONTOS_SYNC).
 * Se o backend tiver algo, sobrescreve a cópia local — assim quem só visualiza
 * (nunca importou nada) já vê os dados de quem importou.
 */
export async function sincronizarAntesDeLer(nomesPontos) {
  if (!syncConfigurado()) return;
  await Promise.all(nomesPontos.map(async (nome) => {
    const ponto = PONTOS_SYNC[nome];
    if (!ponto) return;
    const remoto = await lerRemoto(ponto.store, ponto.key);
    if (remoto != null) await salvarLocalPonto(ponto, remoto);
  }));
}

/**
 * Chame depois de importar/salvar localmente, para publicar os dados no backend
 * compartilhado — assim outras pessoas passam a ver essa importação também.
 */
export async function publicarApósImportar(nomePonto, dados) {
  const ponto = PONTOS_SYNC[nomePonto];
  if (!ponto) return false;
  return await salvarRemoto(ponto.store, ponto.key, dados);
}

// ── Zerar tudo (local + remoto) ─────────────────────────────────────────────
// Botão de manutenção: limpa, de uma vez, tudo que este arquivo sincroniza —
// localStorage, os bancos IndexedDB usados pelos dashboards e as chaves
// correspondentes no Vercel KV (api/sync.mjs). Não toca nos dados do GitHub
// usados por SlaApp/CsatApp/AbrangenciaApp/Score (api/sla.js, api/csat.js,
// api/abrangencia.js, api/coletaRecebimento.js, api/score.js) — isso é
// zerado apagando os arquivos em data/ direto no repositório.
export async function limparTudoLocalERemoto() {
  // 1) localStorage — todas as chaves conhecidas em PONTOS_SYNC
  const chavesLS = new Set();
  Object.values(PONTOS_SYNC).forEach((p) => { if (p.tipo === "ls") chavesLS.add(p.chaveLocal); });
  chavesLS.forEach((chave) => { try { localStorage.removeItem(chave); } catch {} });

  // 2) IndexedDB — os bancos inteiros usados pelos dashboards
  const bancos = new Set();
  Object.values(PONTOS_SYNC).forEach((p) => { if (p.tipo === "idb") bancos.add(p.dbName); });
  await Promise.all([...bancos].map((dbName) => new Promise((resolve) => {
    try {
      const req = indexedDB.deleteDatabase(dbName);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    } catch { resolve(); }
  })));

  // 3) Remoto — todas as chaves parca-sync:* no Vercel KV
  let remotoOk = false;
  try {
    const r = await fetch(`${SYNC_URL}?limparTudo=1`, { method: "DELETE" });
    remotoOk = r.ok;
  } catch {
    remotoOk = false;
  }

  return { remotoOk };
}
