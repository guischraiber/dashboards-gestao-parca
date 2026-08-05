// api/sync.js
// ─────────────────────────────────────────────────────────────────────────────
// Backend compartilhado — Gestão Parça (MadeiraMadeira)
// Usa o Vercel KV (banco chave-valor integrado ao próprio Vercel) — não depende
// de Google Cloud, conta de serviço, nem de nenhuma permissão de TI/admin.
// Você mesmo habilita isso na sua conta Vercel (ver instruções abaixo).
//
// COMO HABILITAR (uma única vez, direto no painel do Vercel — sem TI):
// 1. No seu projeto no Vercel → aba "Storage" → "Create Database" → escolha "KV".
// 2. Dê um nome (ex: "gestao-parca-kv") e crie.
// 3. Na tela seguinte, "Connect Project" → selecione este projeto. Isso injeta
//    automaticamente as variáveis de ambiente necessárias (KV_REST_API_URL,
//    KV_REST_API_TOKEN etc.) — não precisa copiar nada manualmente.
// 4. Adicione a dependência no package.json:  "@vercel/kv": "^2.0.0"
// 5. Comite este arquivo em api/sync.js e faça o deploy.
// ─────────────────────────────────────────────────────────────────────────────

function nomeChave(store, key) {
  const seguro = (s) => String(s || "").replace(/[^a-zA-Z0-9_.-]/g, "_");
  return `parca-sync:${seguro(store)}:${seguro(key)}`;
}

module.exports = async function handler(req, res) {
  try {
    const { kv } = await import("@vercel/kv"); // import dinâmico: funciona independente do formato de módulo do projeto

    if (req.method === "GET") {
      const { store, key } = req.query || {};
      if (!store || !key) return res.status(400).json({ erro: "store e key são obrigatórios" });
      const dados = await kv.get(nomeChave(store, key));
      return res.status(200).json({ dados: dados ?? null });
    }

    if (req.method === "POST") {
      const { store, key, dados } = req.body || {};
      if (!store || !key) return res.status(400).json({ erro: "store e key são obrigatórios" });
      await kv.set(nomeChave(store, key), dados);
      return res.status(200).json({ ok: true, atualizadoEm: new Date().toISOString() });
    }

    return res.status(405).json({ erro: "método não suportado" });
  } catch (e) {
    console.error("Erro em /api/sync:", e);
    return res.status(500).json({ erro: String(e?.message || e) });
  }
};
