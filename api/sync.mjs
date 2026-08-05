// api/sync.mjs
// ─────────────────────────────────────────────────────────────────────────────
// Backend compartilhado — Gestão Parça (MadeiraMadeira)
// Usa o Vercel KV. Os dados chegam JÁ COMPRIMIDOS (gzip) do navegador — necessário
// porque bases grandes (ex: CSAT com comentários em texto livre) excediam o
// limite de tamanho de requisição (erro 413) quando enviadas sem compressão.
//
// Compatível com dados antigos não comprimidos (ver bloco try/catch no GET) —
// não é necessário reimportar tudo de novo por causa dessa mudança, EXCETO os
// pontos que já estavam falhando com 413 (esses precisam ser reimportados uma vez).
// ─────────────────────────────────────────────────────────────────────────────

import { kv } from "@vercel/kv";
import zlib from "zlib";

function nomeChave(store, key) {
  const seguro = (s) => String(s || "").replace(/[^a-zA-Z0-9_.-]/g, "_");
  return `parca-sync:${seguro(store)}:${seguro(key)}`;
}

async function lerCorpoBruto(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const { store, key } = req.query || {};
      if (!store || !key) return res.status(400).json({ erro: "store e key são obrigatórios" });
      const armazenado = await kv.get(nomeChave(store, key));
      if (armazenado == null) return res.status(200).json({ dados: null });

      let dados;
      try {
        if (typeof armazenado === "string") {
          const buf = Buffer.from(armazenado, "base64");
          const json = zlib.gunzipSync(buf).toString("utf-8");
          dados = JSON.parse(json);
        } else {
          dados = armazenado; // formato antigo (objeto já deserializado pelo KV, não comprimido)
        }
      } catch {
        dados = armazenado; // não estava comprimido — usa como está
      }
      return res.status(200).json({ dados });
    }

    if (req.method === "POST") {
      const { store, key } = req.query || {};
      if (!store || !key) return res.status(400).json({ erro: "store e key são obrigatórios" });
      // O corpo já chega comprimido (gzip) do navegador — só repassamos pro KV
      // codificado em base64 (formato de texto, seguro pra qualquer backend de KV).
      const bruto = Buffer.isBuffer(req.body) ? req.body : await lerCorpoBruto(req);
      const comprimidoBase64 = bruto.toString("base64");
      await kv.set(nomeChave(store, key), comprimidoBase64);
      return res.status(200).json({ ok: true, atualizadoEm: new Date().toISOString() });
    }

    return res.status(405).json({ erro: "método não suportado" });
  } catch (e) {
    console.error("Erro em /api/sync:", e);
    return res.status(500).json({ erro: String(e?.message || e) });
  }
}
