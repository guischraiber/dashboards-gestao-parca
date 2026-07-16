import React, { useState } from 'react';
import { DEFAULT_CONFIG } from '../scoring.js';

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function InputNumero({ value, onChange, width = 70, step = '0.01' }) {
  return (
    <input
      type="number"
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      style={{ width, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--cinza-borda)', fontSize: 13 }}
    />
  );
}

const PILARES = [
  { chave: 'sla', label: 'SLA de Coleta' },
  { chave: 'agendamento', label: 'Agendamento' },
  { chave: 'csat', label: 'CSAT' },
];

export default function ConfigView({ token, configInicial, onSalvo }) {
  const [config, setConfig] = useState(() => clone(configInicial));
  const [salvando, setSalvando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const somaPesos = config.pesos.sla + config.pesos.agendamento + config.pesos.csat;
  const pesosOk = Math.abs(somaPesos - 1) < 0.005;

  function atualizarPeso(chave, valorPct) {
    setConfig((c) => ({ ...c, pesos: { ...c.pesos, [chave]: (parseFloat(valorPct) || 0) / 100 } }));
  }

  function atualizarFaixaIndicador(pilar, idx, campo, valor) {
    setConfig((c) => {
      const novo = clone(c);
      novo.faixasIndicador[pilar][idx][campo] = valor;
      return novo;
    });
  }

  function atualizarFaixaFinal(idx, campo, valor) {
    setConfig((c) => {
      const novo = clone(c);
      novo.faixasFinais[idx][campo] = valor;
      return novo;
    });
  }

  function restaurarPadrao() {
    setConfig(clone(DEFAULT_CONFIG));
    setResultado(null);
  }

  async function salvar() {
    setSalvando(true);
    setResultado(null);
    try {
      const r = await fetch('/api/salvarConfig', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin: token, config }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.erros ? data.erros.join(' ') : (data.error || 'Erro desconhecido'));
      setResultado({ ok: true, mensagem: data.mensagem });
      onSalvo?.(config);
    } catch (e) {
      setResultado({ ok: false, mensagem: e.message });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <div className="card">
        <h2>Pesos de cada pilar</h2>
        <p style={{ fontSize: 13, color: '#6B7280', marginTop: -6 }}>Precisam somar 100%.</p>
        <div className="pillars-grid">
          {PILARES.map((p) => (
            <div className="pillar-card" key={p.chave}>
              <div className="label">{p.label}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                <InputNumero value={(config.pesos[p.chave] * 100).toFixed(0)} onChange={(v) => atualizarPeso(p.chave, v)} width={60} step="1" />
                <span style={{ fontSize: 13 }}>%</span>
              </div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 13, marginTop: 12, color: pesosOk ? '#16A34A' : '#DC2626', fontWeight: 600 }}>
          Soma atual: {(somaPesos * 100).toFixed(1)}% {pesosOk ? '✓' : '— precisa somar 100%'}
        </p>
      </div>

      <div className="card">
        <h2>Faixas de nota por pilar</h2>
        <p style={{ fontSize: 13, color: '#6B7280', marginTop: -6 }}>
          Percentual mínimo e máximo para cada nota de 1 a 5, em cada pilar.
        </p>
        <div className="pillars-grid">
          {PILARES.map((p) => (
            <div key={p.chave}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{p.label}</div>
              <table>
                <thead>
                  <tr><th>Nota</th><th>Min %</th><th>Max %</th></tr>
                </thead>
                <tbody>
                  {config.faixasIndicador[p.chave]
                    .slice()
                    .sort((a, b) => a.nota - b.nota)
                    .map((f) => {
                      const idxReal = config.faixasIndicador[p.chave].findIndex((x) => x.nota === f.nota);
                      return (
                        <tr key={f.nota}>
                          <td>{f.nota}</td>
                          <td>
                            <InputNumero value={f.min} onChange={(v) => atualizarFaixaIndicador(p.chave, idxReal, 'min', v)} />
                          </td>
                          <td>
                            <InputNumero value={f.max} onChange={(v) => atualizarFaixaIndicador(p.chave, idxReal, 'max', v)} />
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Faixas do score final e penalidades/benefícios</h2>
        <p style={{ fontSize: 13, color: '#6B7280', marginTop: -6 }}>
          Ajuste de taxa em pontos percentuais — positivo é penalidade (parceiro paga mais), negativo é
          benefício (parceiro paga menos), zero é neutro.
        </p>
        <table>
          <thead>
            <tr>
              <th>Nome</th><th>Score min</th><th>Score max</th><th>Ajuste (p.p.)</th><th>Cor</th><th>Descrição</th>
            </tr>
          </thead>
          <tbody>
            {config.faixasFinais
              .slice()
              .sort((a, b) => a.min - b.min)
              .map((f) => {
                const idxReal = config.faixasFinais.findIndex((x) => x.label === f.label);
                return (
                  <tr key={f.label}>
                    <td>
                      <input
                        type="text"
                        value={f.label}
                        onChange={(e) => atualizarFaixaFinal(idxReal, 'label', e.target.value)}
                        style={{ width: 120, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--cinza-borda)', fontSize: 13 }}
                      />
                    </td>
                    <td><InputNumero value={f.min} onChange={(v) => atualizarFaixaFinal(idxReal, 'min', v)} /></td>
                    <td><InputNumero value={f.max} onChange={(v) => atualizarFaixaFinal(idxReal, 'max', v)} /></td>
                    <td><InputNumero value={f.ajustePP} onChange={(v) => atualizarFaixaFinal(idxReal, 'ajustePP', v)} width={60} /></td>
                    <td>
                      <select
                        value={f.cor}
                        onChange={(e) => atualizarFaixaFinal(idxReal, 'cor', e.target.value)}
                        style={{ padding: '4px 6px', borderRadius: 6, border: '1px solid var(--cinza-borda)', fontSize: 13 }}
                      >
                        <option value="verde">verde</option>
                        <option value="amarelo">amarelo</option>
                        <option value="vermelho">vermelho</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="text"
                        value={f.descricao || ''}
                        onChange={(e) => atualizarFaixaFinal(idxReal, 'descricao', e.target.value)}
                        style={{ width: 260, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--cinza-borda)', fontSize: 13 }}
                      />
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar regras'}
          </button>
          <button className="btn btn-ghost" onClick={restaurarPadrao} disabled={salvando}>
            Restaurar padrão oficial
          </button>
        </div>
        <p style={{ fontSize: 12, color: '#6B7280', marginTop: 12 }}>
          Depois de salvar, o dashboard leva ~1 minuto para atualizar (o Vercel faz um novo deploy sozinho).
          A mudança vale para todo cálculo feito depois disso — ciclos já fechados não são recalculados
          retroativamente na hora, mas se você reabrir um ciclo antigo, ele também vai usar a regra mais atual.
        </p>
        {resultado && (
          <p style={{ fontSize: 13, marginTop: 10, color: resultado.ok ? '#16A34A' : '#DC2626' }}>
            {resultado.ok ? '✓ ' : '✗ '}{resultado.mensagem}
          </p>
        )}
      </div>
    </>
  );
}
