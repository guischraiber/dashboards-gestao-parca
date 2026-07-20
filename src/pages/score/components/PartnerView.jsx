import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { agruparEProcessar, DICAS_MELHORIA } from '../scoring.js';
import RulesSection from './RulesSection.jsx';

const CORES = {
  verde: '#16A34A',
  amarelo: '#CA8A04',
  vermelho: '#DC2626',
  azul: '#2563EB',
};

function Circulo({ score, cor }) {
  return (
    <div className="score-circle" style={{ borderColor: CORES[cor] }}>
      <div className="valor" style={{ color: CORES[cor] }}>{score.toFixed(2)}</div>
      <div className="max">/ 5.0</div>
    </div>
  );
}

function BarraPilar({ label, pct, peso, nota }) {
  const cor = nota >= 4 ? 'verde' : nota >= 3 ? 'amarelo' : 'vermelho';
  return (
    <div className="pillar-card">
      <div className="label">{label} <span className="peso">({peso})</span></div>
      <div className="pct" style={{ color: CORES[cor] }}>{pct.toFixed(2)}%</div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${Math.min(pct, 100)}%`, background: CORES[cor] }} />
      </div>
      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 6 }}>Nota média do trimestre: {nota.toFixed(1)}/5</div>
    </div>
  );
}

export default function PartnerView({ codigo }) {
  const [estado, setEstado] = useState('carregando'); // carregando | erro | ok
  const [erroMsg, setErroMsg] = useState('');
  const [linhas, setLinhas] = useState([]);
  const [config, setConfig] = useState(null);
  const [aba, setAba] = useState('resultado');

  useEffect(() => {
    Promise.all([
      fetch(`/api/score?codigo=${encodeURIComponent(codigo)}`).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Erro desconhecido');
        return data;
      }),
      fetch('/api/config').then((r) => r.json()),
    ])
      .then(([dataScore, dataConfig]) => {
        setConfig(dataConfig.config);
        setLinhas(agruparEProcessar(dataScore.rows, dataConfig.config));
        setEstado('ok');
      })
      .catch((e) => {
        setErroMsg(e.message);
        setEstado('erro');
      });
  }, [codigo]);

  if (estado === 'carregando') {
    return <div className="page"><div className="state-msg">Carregando seu score...</div></div>;
  }

  if (estado === 'erro') {
    return (
      <div className="page">
        <div className="state-msg">
          Não foi possível carregar seus dados.<br />
          <span style={{ fontSize: 12 }}>{erroMsg}</span><br /><br />
          Entre em contato com seu ponto focal na Madeira Madeira.
        </div>
      </div>
    );
  }

  // Ordena por ciclo (assume formato tipo "2025-T4" que ordena bem como string)
  const historico = [...linhas].sort((a, b) => (a.ciclo > b.ciclo ? 1 : -1));
  const atual = historico[historico.length - 1];
  const dicas = DICAS_MELHORIA[atual.pilarMaisFraco] || [];

  return (
    <div className="page">
      <div className="header">
        <div className="logo-dot" />
        <div>
          <h1>Score Parça — {atual.parceiro}</h1>
          <div className="subtitle">Ciclo {atual.ciclo} · Programa Score Parça Reversa</div>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab-btn ${aba === 'resultado' ? 'active' : ''}`} onClick={() => setAba('resultado')}>
          Meu Resultado
        </button>
        <button className={`tab-btn ${aba === 'acoes' ? 'active' : ''}`} onClick={() => setAba('acoes')}>
          Como Melhorar
        </button>
        <button className={`tab-btn ${aba === 'regras' ? 'active' : ''}`} onClick={() => setAba('regras')}>
          Regras do Score
        </button>
      </div>

      {aba === 'resultado' && (
        <>
          <div className="card">
            <h2>Seu resultado neste ciclo</h2>
            <div className="score-hero">
              <Circulo score={atual.score} cor={atual.faixa.cor} />
              <div>
                <span className={`badge ${atual.faixa.cor}`}>{atual.faixa.label}</span>
                <p style={{ margin: '10px 0 4px', fontSize: 14 }}>
                  <strong>Consequência na taxa:</strong> {atual.faixa.consequencia}
                </p>
                <p style={{ margin: 0, fontSize: 13, color: '#6B7280', maxWidth: 480 }}>
                  {atual.faixa.descricao}
                </p>
                {!atual.elegivel && (
                  <p style={{ margin: '8px 0 0', fontSize: 12, color: '#CA8A04' }}>
                    ⚠ Este ciclo é informativo — parceiro ainda não atingiu os critérios de elegibilidade
                    (3+ meses de operação e 10+ coletas no período), portanto sem aplicação de consequência.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="card">
            <h2>Impacto na sua taxa</h2>
            {atual.impactoTaxa.porProcesso.length === 0 ? (
              <p style={{ fontSize: 13, color: '#6B7280' }}>
                Sem dados de faturamento/taxa cadastrados neste ciclo — fale com o time de Gestão Parça.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {atual.impactoTaxa.porProcesso.map((p) => (
                  <div key={p.chave} style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 110, fontSize: 13, fontWeight: 700, color: '#374151' }}>{p.label}</div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: '#6B7280' }}>Taxa atual</div>
                      <div style={{ fontSize: 22, fontWeight: 700 }}>{p.taxaBase.toFixed(2)}%</div>
                    </div>
                    <div style={{ fontSize: 20, color: '#9CA3AF' }}>→</div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: '#6B7280' }}>Nova taxa (próximos 3 meses)</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: CORES[atual.faixa.cor] }}>
                        {p.taxaNova.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                ))}
                <div>
                  <span className={`badge ${atual.faixa.cor}`}>
                    {atual.impactoTaxa.ajustePP > 0 ? '+' : ''}{atual.impactoTaxa.ajustePP.toFixed(2)} p.p. em todos os tipos acima
                  </span>
                </div>
              </div>
            )}
            <p style={{ fontSize: 13, color: '#6B7280', marginTop: 12, marginBottom: 0 }}>
              Essa taxa passa a valer nos tipos de processo em que você atua (coleta reversa, devolução e/ou
              terceiras) nos próximos 3 meses, conforme o resultado do seu score neste trimestre.
              {!atual.elegivel && ' Como este ciclo ainda é informativo para você, essa mudança não será aplicada de fato.'}
            </p>
          </div>

          <div className="card">
            <h2>Como cada pilar contribuiu</h2>
            <p style={{ fontSize: 12, color: '#6B7280', marginTop: -8, marginBottom: 12 }}>
              Valores de referência: média dos 3 meses do trimestre, ponderada pelo faturamento de cada mês.
            </p>
            <div className="pillars-grid">
              <BarraPilar label="SLA de Coleta" pct={atual.sla} peso={`peso ${(config.pesos.sla * 100).toFixed(0)}%`} nota={atual.nSla} />
              <BarraPilar label="Agendamento" pct={atual.agendamento} peso={`peso ${(config.pesos.agendamento * 100).toFixed(0)}%`} nota={atual.nAgendamento} />
              <BarraPilar label="CSAT" pct={atual.csat} peso={`peso ${(config.pesos.csat * 100).toFixed(0)}%`} nota={atual.nCsat} />
            </div>
          </div>

          {historico.length > 1 && (
            <div className="card">
              <h2>Evolução do score</h2>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={historico} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E3DF" />
                  <XAxis dataKey="ciclo" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 5]} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => v.toFixed(2)} />
                  <ReferenceLine y={4} stroke="#16A34A" strokeDasharray="4 4" label={{ value: 'Meta 4.0', fontSize: 10, fill: '#16A34A' }} />
                  <ReferenceLine y={3} stroke="#CA8A04" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="score" stroke="#F97316" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {atual.detalheMensal && (
            <div className="card">
              <h2>Como os 3 meses foram combinados neste trimestre</h2>
              <p style={{ fontSize: 13, color: '#6B7280', marginTop: -6 }}>
                O score de cada mês é calculado normalmente (nota de cada pilar × peso). O score do trimestre
                é a média dos 3 scores mensais, <strong>ponderada pelo faturamento</strong> de cada mês —
                meses com mais faturamento pesam mais no resultado final.
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Mês</th>
                    <th>Faturamento Reversa</th>
                    <th>SLA</th>
                    <th>Agendamento</th>
                    <th>CSAT</th>
                    <th>Score do mês</th>
                  </tr>
                </thead>
                <tbody>
                  {atual.detalheMensal.map((m) => (
                    <tr key={m.mes}>
                      <td>{m.mes}</td>
                      <td>{m.faturamento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                      <td>{m.sla.toFixed(2)}% (nota {m.nSla})</td>
                      <td>{m.agendamento.toFixed(2)}% (nota {m.nAgendamento})</td>
                      <td>{m.csat.toFixed(2)}% (nota {m.nCsat})</td>
                      <td><strong>{m.score.toFixed(2)}</strong></td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={5}><strong>Score do trimestre (ponderado pelo faturamento)</strong></td>
                    <td><strong>{atual.score.toFixed(2)}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {aba === 'acoes' && (
        <div className="card">
          <h2>Como melhorar seu score</h2>
          <p style={{ fontSize: 13, color: '#6B7280', marginTop: -6 }}>
            Seu pilar com maior oportunidade de melhoria agora é <strong>{
              atual.pilarMaisFraco === 'sla' ? 'SLA de Coleta' : atual.pilarMaisFraco === 'agendamento' ? 'Agendamento' : 'CSAT'
            }</strong>. Recomendações:
          </p>
          <ul className="tips-list">
            {dicas.map((dica, i) => <li key={i}>{dica}</li>)}
          </ul>
        </div>
      )}

      {aba === 'regras' && <RulesSection config={config} />}

      <div className="footer-note">
        Dúvidas sobre este score? Fale com seu ponto focal de Gestão de Parceiros na Madeira Madeira.
      </div>
    </div>
  );
}
