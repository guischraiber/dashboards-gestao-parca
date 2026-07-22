import React, { useState, useEffect, useMemo, useCallback } from "react";
import Papa from "papaparse";

const C = {
  laranja: "#F97316", verde: "#16A34A", vermelho: "#DC2626", amarelo: "#CA8A04",
  azul: "#2563EB", cinzaFundo: "#F8F7F4", cinzaCard: "#FFFFFF", cinzaBorda: "#E5E3DF",
  cinzaTexto: "#6B7280", texto: "#1C1917",
};

// ── Persistência (IndexedDB) — banco próprio desta página ──────────────────
const DB_NAME = "abrangenciaParcaDB";
const STORE = "dados";

function abrirDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function salvarChave(chave, valor) {
  try {
    const db = await abrirDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(valor, chave);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    return true;
  } catch { return false; }
}
async function carregarChave(chave) {
  try {
    const db = await abrirDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(chave);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch { return null; }
}

// ── Layout esquemático do Brasil em blocos (não é geografia exata — é uma
// grade que aproxima a posição relativa de cada UF, pra dar uma leitura
// visual rápida sem precisar de coordenadas de cidade por cidade) ──────────
const GRADE_UF = [
  { uf: "RR", col: 3, row: 0 },
  { uf: "AM", col: 1, row: 1 }, { uf: "PA", col: 3, row: 1 }, { uf: "AP", col: 4, row: 1 }, { uf: "MA", col: 6, row: 1 },
  { uf: "AC", col: 0, row: 2 }, { uf: "RO", col: 1, row: 2 }, { uf: "TO", col: 4, row: 2 }, { uf: "PI", col: 6, row: 2 }, { uf: "CE", col: 7, row: 2 },
  { uf: "MT", col: 2, row: 3 }, { uf: "GO", col: 4, row: 3 }, { uf: "BA", col: 6, row: 3 }, { uf: "RN", col: 8, row: 3 },
  { uf: "MS", col: 2, row: 4 }, { uf: "DF", col: 4, row: 4 }, { uf: "PE", col: 7, row: 4 }, { uf: "PB", col: 8, row: 4 },
  { uf: "MG", col: 4, row: 5 }, { uf: "SE", col: 6, row: 4 }, { uf: "AL", col: 7, row: 5 },
  { uf: "SP", col: 3, row: 6 }, { uf: "RJ", col: 5, row: 6 }, { uf: "ES", col: 6, row: 5 },
  { uf: "PR", col: 3, row: 7 },
  { uf: "SC", col: 3, row: 8 },
  { uf: "RS", col: 3, row: 9 },
];

function normalizarCidade(s) {
  return String(s || "").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function parseCSVAbrangencia(texto) {
  const { data } = Papa.parse(texto, { header: true, skipEmptyLines: true });
  return data
    .filter(r => r["Logistica Reversa Estado"] && r["Logistica Reversa Cidade"])
    .map(r => ({
      validacao: String(r["VALIDAÇÃO"] || "").trim().toUpperCase(),
      transportadora: String(r["Logistica Reversa Transportadora"] || "").trim(),
      estado: String(r["Logistica Reversa Estado"] || "").trim().toUpperCase(),
      cidade: String(r["Logistica Reversa Cidade"] || "").trim(),
      abrangencia: parseFloat(String(r["Abrangencia"] || "").replace(",", ".")) || 0,
    }));
}

function chaveLinha(r) {
  return `${r.estado}|${normalizarCidade(r.cidade)}|${r.transportadora}`;
}

function compararDatasets(anterior, atual) {
  const mapaAnterior = new Map(anterior.map(r => [chaveLinha(r), r]));
  const mapaAtual = new Map(atual.map(r => [chaveLinha(r), r]));
  const novas = [];
  const mudancas = [];
  for (const [chave, r] of mapaAtual) {
    const rAnt = mapaAnterior.get(chave);
    if (!rAnt) novas.push(r);
    else if (rAnt.validacao !== r.validacao || rAnt.abrangencia !== r.abrangencia) {
      mudancas.push({ antes: rAnt, depois: r });
    }
  }
  const removidas = [];
  for (const [chave, r] of mapaAnterior) {
    if (!mapaAtual.has(chave)) removidas.push(r);
  }
  return { novas, removidas, mudancas };
}

function resumoPorUF(linhas) {
  const mapa = {};
  linhas.forEach(r => {
    if (!mapa[r.estado]) mapa[r.estado] = { total: 0, parca: 0, naoParca: 0, cidades: new Set() };
    mapa[r.estado].total++;
    mapa[r.estado].cidades.add(normalizarCidade(r.cidade));
    if (r.validacao === "PARÇA") mapa[r.estado].parca++;
    else mapa[r.estado].naoParca++;
  });
  return mapa;
}

function corDoBloco(dadosUF) {
  if (!dadosUF || dadosUF.total === 0) return "#E5E3DF";
  const pct = dadosUF.parca / dadosUF.total;
  if (pct >= 0.75) return "#16A34A";
  if (pct >= 0.4) return "#84CC16";
  if (pct > 0) return "#F59E0B";
  return "#DC2626";
}

export default function AbrangenciaApp() {
  const [aba, setAba] = useState("geral");
  const [atual, setAtual] = useState(null);       // { rows, nome, data }
  const [anterior, setAnterior] = useState(null); // idem
  const [loading, setLoading] = useState("");
  const [erro, setErro] = useState("");
  const [ufSelecionada, setUfSelecionada] = useState(null);
  const [avisoPersistencia, setAvisoPersistencia] = useState(false);

  useEffect(() => {
    (async () => {
      const a = await carregarChave("atual");
      const b = await carregarChave("anterior");
      if (a) setAtual(a);
      if (b) setAnterior(b);
    })();
  }, []);

  const handleUpload = useCallback((file) => {
    setLoading(file.name);
    setErro("");
    Papa.parse(file, {
      complete: async () => {}, // usamos o parse manual abaixo, isso é só placeholder
    });
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const rows = parseCSVAbrangencia(ev.target.result);
        if (rows.length === 0) throw new Error("Não encontrei linhas válidas — confira se o arquivo tem as colunas certas (VALIDAÇÃO, Logistica Reversa Transportadora, Logistica Reversa Estado, Logistica Reversa Cidade, Abrangencia).");

        const novoAtual = { rows, nome: file.name, data: new Date().toISOString() };
        // O que era "atual" vira "anterior" (só se já existia algo antes)
        if (atual) {
          await salvarChave("anterior", atual);
          setAnterior(atual);
        }
        await salvarChave("atual", novoAtual);
        setAtual(novoAtual);
        const ok = true;
        setAvisoPersistencia(!ok);
      } catch (e) {
        setErro(e.message || String(e));
      } finally {
        setLoading("");
      }
    };
    reader.onerror = () => { setErro("Não consegui ler este arquivo."); setLoading(""); };
    reader.readAsText(file);
  }, [atual]);

  const resumoUF = useMemo(() => atual ? resumoPorUF(atual.rows) : {}, [atual]);

  const totais = useMemo(() => {
    if (!atual) return null;
    const cidades = new Set(atual.rows.map(r => `${r.estado}|${normalizarCidade(r.cidade)}`));
    const parca = atual.rows.filter(r => r.validacao === "PARÇA").length;
    return {
      linhas: atual.rows.length,
      cidades: cidades.size,
      transportadoras: new Set(atual.rows.map(r => r.transportadora)).size,
      pctParca: atual.rows.length ? (parca / atual.rows.length) * 100 : 0,
    };
  }, [atual]);

  const comparacao = useMemo(() => {
    if (!atual || !anterior) return null;
    return compararDatasets(anterior.rows, atual.rows);
  }, [atual, anterior]);

  const linhasDaUF = useMemo(() => {
    if (!atual || !ufSelecionada) return [];
    return atual.rows.filter(r => r.estado === ufSelecionada).sort((a, b) => a.cidade.localeCompare(b.cidade));
  }, [atual, ufSelecionada]);

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "20px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>🗺️ Abrangência Parça</div>
          <div style={{ fontSize: 12, color: C.cinzaTexto }}>
            Cobertura de transportadoras parceiras por cidade — base de logística reversa
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a href="/modelo-abrangencia-parca.csv" download
            style={{ padding: "8px 14px", borderRadius: 8, border: `1.5px solid ${C.cinzaBorda}`, fontSize: 13, fontWeight: 600, textDecoration: "none", color: C.texto }}>
            ⬇ Baixar modelo (.csv)
          </a>
          <label style={{ padding: "8px 14px", borderRadius: 8, background: C.laranja, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            <input type="file" accept=".csv" style={{ display: "none" }} onChange={e => { if (e.target.files[0]) handleUpload(e.target.files[0]); e.target.value = ""; }} />
            📂 Importar planilha
          </label>
        </div>
      </div>

      <div style={{ fontSize: 11, color: C.cinzaTexto, marginTop: -10, marginBottom: 16 }}>
        O modelo pra download é a própria base de logística reversa (mesmo formato de sempre) — baixe, atualize
        os dados com a abrangência do ano inteiro, e reenvie pelo botão "Importar planilha".
      </div>

      {loading && <div style={{ fontSize: 13, color: C.laranja, marginBottom: 12 }}>⏳ Processando {loading}...</div>}
      {erro && <div style={{ padding: 12, background: "#FEE2E2", border: "1px solid #DC2626", borderRadius: 8, color: "#991B1B", fontSize: 13, marginBottom: 12 }}>⚠️ {erro}</div>}
      {avisoPersistencia && <div style={{ padding: 10, background: "#FEF3C7", border: "1px solid #FBBF24", borderRadius: 8, color: "#92400E", fontSize: 12, marginBottom: 12 }}>⚠️ Não consegui salvar neste navegador — ao recarregar a página, será preciso reimportar.</div>}

      {!atual ? (
        <div style={{ background: C.cinzaCard, border: `1px solid ${C.cinzaBorda}`, borderRadius: 12, padding: 40, textAlign: "center", color: C.cinzaTexto }}>
          Nenhuma planilha importada ainda. Baixe o modelo, preencha com a abrangência do ano inteiro,
          e importe usando o botão acima.
        </div>
      ) : (
        <>
          <div style={{ fontSize: 12, color: C.cinzaTexto, marginBottom: 14 }}>
            Base atual: <strong>{atual.nome}</strong> · importada em {new Date(atual.data).toLocaleString("pt-BR")}
            {anterior && <> · anterior: <strong>{anterior.nome}</strong> ({new Date(anterior.data).toLocaleString("pt-BR")})</>}
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {[["geral", "🏠 Visão Geral"], ["mapa", "🗺️ Mapa"], ["comparacao", "🔄 Comparação"]].map(([k, l]) => (
              <button key={k} onClick={() => setAba(k)} style={{
                padding: "8px 16px", borderRadius: 8, border: `1.5px solid ${aba === k ? C.laranja : C.cinzaBorda}`,
                background: aba === k ? `${C.laranja}18` : "transparent", color: aba === k ? C.laranja : C.cinzaTexto,
                fontWeight: 600, fontSize: 13, cursor: "pointer",
              }}>{l}</button>
            ))}
          </div>

          {aba === "geral" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
              <Kpi label="Linhas na base" valor={totais.linhas.toLocaleString("pt-BR")} />
              <Kpi label="Cidades atendidas" valor={totais.cidades.toLocaleString("pt-BR")} />
              <Kpi label="Transportadoras" valor={totais.transportadoras.toLocaleString("pt-BR")} />
              <Kpi label="% cobertura Parça" valor={`${totais.pctParca.toFixed(1)}%`} cor={totais.pctParca >= 50 ? C.verde : C.vermelho} />
            </div>
          )}

          {aba === "mapa" && (
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              <div style={{ background: C.cinzaCard, border: `1px solid ${C.cinzaBorda}`, borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 12, color: C.cinzaTexto, marginBottom: 10 }}>
                  Cada bloco é um estado (posição esquemática, não é mapa geográfico exato). Cor = % de cidades cobertas por transportadora Parça. Clique num estado pra ver o detalhe.
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(9, 48px)", gridAutoRows: "48px", gap: 4 }}>
                  {GRADE_UF.map(({ uf, col, row }) => {
                    const dados = resumoUF[uf];
                    const cor = corDoBloco(dados);
                    const ativo = ufSelecionada === uf;
                    return (
                      <div key={uf}
                        onClick={() => dados && setUfSelecionada(ativo ? null : uf)}
                        title={dados ? `${uf}: ${dados.parca} Parça / ${dados.total} total` : `${uf}: sem dado`}
                        style={{
                          gridColumn: col + 1, gridRow: row + 1, background: cor,
                          borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 11, fontWeight: 700, color: dados ? "#fff" : "#9CA3AF",
                          cursor: dados ? "pointer" : "default",
                          border: ativo ? `3px solid ${C.texto}` : "2px solid transparent",
                          opacity: dados ? 1 : 0.6,
                        }}>
                        {uf}
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 14, marginTop: 14, fontSize: 11, color: C.cinzaTexto, flexWrap: "wrap" }}>
                  <Legenda cor="#16A34A" texto="≥75% Parça" />
                  <Legenda cor="#84CC16" texto="40–75% Parça" />
                  <Legenda cor="#F59E0B" texto="<40% Parça" />
                  <Legenda cor="#DC2626" texto="0% Parça (só não-parça)" />
                  <Legenda cor="#E5E3DF" texto="Sem dado" />
                </div>
              </div>

              {ufSelecionada && (
                <div style={{ flex: 1, minWidth: 320, background: C.cinzaCard, border: `1px solid ${C.cinzaBorda}`, borderRadius: 12, padding: 20, maxHeight: 480, overflowY: "auto" }}>
                  <div style={{ fontWeight: 700, marginBottom: 10 }}>{ufSelecionada} — {linhasDaUF.length} atendimento(s)</div>
                  <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ textAlign: "left", color: C.cinzaTexto }}>
                        <th style={{ padding: "4px 6px" }}>Cidade</th>
                        <th style={{ padding: "4px 6px" }}>Transportadora</th>
                        <th style={{ padding: "4px 6px" }}>Validação</th>
                        <th style={{ padding: "4px 6px", textAlign: "right" }}>Abrangência</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linhasDaUF.map((r, i) => (
                        <tr key={i} style={{ borderTop: `1px solid ${C.cinzaBorda}` }}>
                          <td style={{ padding: "4px 6px" }}>{r.cidade}</td>
                          <td style={{ padding: "4px 6px" }}>{r.transportadora}</td>
                          <td style={{ padding: "4px 6px", color: r.validacao === "PARÇA" ? C.verde : C.vermelho, fontWeight: 600 }}>{r.validacao}</td>
                          <td style={{ padding: "4px 6px", textAlign: "right" }}>{r.abrangencia}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {aba === "comparacao" && (
            <div style={{ background: C.cinzaCard, border: `1px solid ${C.cinzaBorda}`, borderRadius: 12, padding: 20 }}>
              {!anterior ? (
                <div style={{ color: C.cinzaTexto, fontSize: 13 }}>
                  Ainda não há uma planilha anterior pra comparar — isso aparece automaticamente a partir da
                  segunda importação.
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 13, color: C.cinzaTexto, marginBottom: 14 }}>
                    Comparando <strong>{anterior.nome}</strong> (anterior) com <strong>{atual.nome}</strong> (atual).
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
                    <Kpi label="Atendimentos novos" valor={comparacao.novas.length} cor={C.verde} />
                    <Kpi label="Atendimentos removidos" valor={comparacao.removidas.length} cor={C.vermelho} />
                    <Kpi label="Atendimentos alterados" valor={comparacao.mudancas.length} cor={C.amarelo} />
                  </div>

                  {comparacao.novas.length > 0 && <TabelaSimples titulo="✅ Novos atendimentos" linhas={comparacao.novas} />}
                  {comparacao.removidas.length > 0 && <TabelaSimples titulo="❌ Atendimentos removidos" linhas={comparacao.removidas} />}
                  {comparacao.mudancas.length > 0 && (
                    <div style={{ marginTop: 20 }}>
                      <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>🔁 Atendimentos que mudaram</div>
                      <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ textAlign: "left", color: C.cinzaTexto }}>
                            <th style={{ padding: "4px 6px" }}>Cidade</th>
                            <th style={{ padding: "4px 6px" }}>Transportadora</th>
                            <th style={{ padding: "4px 6px" }}>Validação (antes → depois)</th>
                            <th style={{ padding: "4px 6px", textAlign: "right" }}>Abrangência (antes → depois)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {comparacao.mudancas.map((m, i) => (
                            <tr key={i} style={{ borderTop: `1px solid ${C.cinzaBorda}` }}>
                              <td style={{ padding: "4px 6px" }}>{m.depois.estado} — {m.depois.cidade}</td>
                              <td style={{ padding: "4px 6px" }}>{m.depois.transportadora}</td>
                              <td style={{ padding: "4px 6px" }}>{m.antes.validacao} → {m.depois.validacao}</td>
                              <td style={{ padding: "4px 6px", textAlign: "right" }}>{m.antes.abrangencia} → {m.depois.abrangencia}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {comparacao.novas.length === 0 && comparacao.removidas.length === 0 && comparacao.mudancas.length === 0 && (
                    <div style={{ color: C.cinzaTexto, fontSize: 13 }}>Nenhuma diferença encontrada entre as duas planilhas.</div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Kpi({ label, valor, cor }) {
  return (
    <div style={{ background: C.cinzaCard, border: `1px solid ${C.cinzaBorda}`, borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 12, color: C.cinzaTexto, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: cor || C.texto }}>{valor}</div>
    </div>
  );
}
function Legenda({ cor, texto }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <div style={{ width: 12, height: 12, borderRadius: 3, background: cor }} />
      {texto}
    </div>
  );
}
function TabelaSimples({ titulo, linhas }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>{titulo} ({linhas.length})</div>
      <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", color: C.cinzaTexto }}>
            <th style={{ padding: "4px 6px" }}>Estado</th>
            <th style={{ padding: "4px 6px" }}>Cidade</th>
            <th style={{ padding: "4px 6px" }}>Transportadora</th>
            <th style={{ padding: "4px 6px" }}>Validação</th>
            <th style={{ padding: "4px 6px", textAlign: "right" }}>Abrangência</th>
          </tr>
        </thead>
        <tbody>
          {linhas.slice(0, 200).map((r, i) => (
            <tr key={i} style={{ borderTop: `1px solid ${C.cinzaBorda}` }}>
              <td style={{ padding: "4px 6px" }}>{r.estado}</td>
              <td style={{ padding: "4px 6px" }}>{r.cidade}</td>
              <td style={{ padding: "4px 6px" }}>{r.transportadora}</td>
              <td style={{ padding: "4px 6px", color: r.validacao === "PARÇA" ? C.verde : C.vermelho, fontWeight: 600 }}>{r.validacao}</td>
              <td style={{ padding: "4px 6px", textAlign: "right" }}>{r.abrangencia}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {linhas.length > 200 && <div style={{ fontSize: 11, color: C.cinzaTexto, marginTop: 6 }}>Mostrando as 200 primeiras de {linhas.length}.</div>}
    </div>
  );
}
