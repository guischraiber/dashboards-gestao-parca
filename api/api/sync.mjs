// api/sync.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Backend compartilhado — Gestão Parça (MadeiraMadeira)
// Usa o Vercel KV (banco chave-valor integrado ao próprio Vercel) — não depende
// de Google Cloud, conta de serviço, nem de nenhuma permissão de TI/admin.
//
// Extensão .mjs (em vez de .js) de propósito: força o formato ES Module,
// independente de qualquer configuração "type" no package.json — evita o erro
// de "Serverless Function crashed" por mistura de formato de módulo.
// ─────────────────────────────────────────────────────────────────────────────

import { kv } from "@vercel/kv";

function nomeChave(store, key) {
  const seguro = (s) => String(s || "").replace(/[^a-zA-Z0-9_.-]/g, "_");
  return `parca-sync:${seguro(store)}:${seguro(key)}`;
}

export default async function handler(req, res) {
  try {
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
}
