// api/config.js
// Retorna a configuração ATIVA do score (pesos, faixas de nota, faixas finais).
// É pública de propósito (sem token) — são as regras do programa, que os
// próprios parceiros devem poder ver na aba "Regras do Score".
// Se data/config.json não existir ainda, devolve os valores padrão oficiais.

import fs from 'fs';
import path from 'path';
import { DEFAULT_CONFIG } from '../src/pages/score/scoring.js';

export default async function handler(req, res) {
  const caminho = path.join(process.cwd(), 'data', 'config.json');
  try {
    if (fs.existsSync(caminho)) {
      const config = JSON.parse(fs.readFileSync(caminho, 'utf8'));
      return res.status(200).json({ config, personalizado: true });
    }
  } catch (e) {
    // se o arquivo estiver corrompido, cai pro padrão em vez de quebrar o dashboard
  }
  return res.status(200).json({ config: DEFAULT_CONFIG, personalizado: false });
}
