import React, { useEffect, useMemo, useState } from 'react';
import { agruparEProcessar } from '../scoring.js';
import RulesSection from './RulesSection.jsx';
import ImportView from './ImportView.jsx';
import ConfigView from './ConfigView.jsx';

export default function AdminView({ token }) {
  const [estado, setEstado] = useState('carregando');
  const [erroMsg, setErroMsg] = useState('');
  const [linhasCruas, setLinhasCruas] = useState([]);
  const [avisos, setAvisos] = useState([]);
  const [config, setConfig] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [copiadoCodigo, setCopiadoCodigo] = useState(null);
  const [aba, setAba] = useState('geral');
  const [cicloSelecionado, setCicloSelecionado] = useState(null);

  function carregar() {
    setEstado('carregando');
    Promise.all([
      fetch(`/api/score?admin=${encodeURIComponent(token)}`).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Erro desconhecido');
        return data;
      }),
      fetch('/api/config').then((r) => r.json()),
    ])
      .then(([dataScore, dataConfig]) => {
        setLinhasCruas(dataScore.rows);
        setAvisos(dataScore.avisos || []);
        setHistorico(dataScore.historico || []);
        setConfig(dataConfig.config);
        setEstado('ok');
      })
      .catch((e) => {
        setErroMsg(e.message);
        setEstado('erro');
      });
  }

  useEffect(carregar, [token]);

  const linhas = useMemo(() => (config ? agruparEProcessar(linhasCruas, config) : []), [linhasCruas, config]);

  const ciclosDisponiveis = useMemo(() => {
    const unicos = [...new Set(linhas.map((l) => l.ciclo))];
    return unicos.sort();
  }, [linhas]);

  const ultimoCiclo = useMemo(() => {
    if (ciclosDisponiveis.length === 0) return null;
    return ciclosDisponiveis[ciclosDisponiveis.length - 1];
  }, [ciclosDisponiveis]);

  const cicloExibido = cicloSelecionado && ciclosDisponiveis.includes(cicloSelecionado)
    ? cicloSelecionado
    : ultimoCiclo;

  const linhasAtuais = useMemo(
    () => linhas.filter((l) => l.ciclo === cicloExibido).sort((a, b) => b.score - a.score),
    [linhas, cicloExibido]
  );

  function copiarLink(codigo) {
    const url = `${window.location.origin}/?parceiro=${encodeURIComponent(codigo)}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiadoCodigo(codigo);
      setTimeout(() => setCopiadoCodigo(null), 1500);
    });
  }

  if (estado === 'carregando') {
    return <div className="page"><div className="state-msg">Carregando dados...</div></div>;
  }

  // Mesmo se o score ainda não carregou (ex.: primeiro acesso, sem dado importado),
  // a pessoa precisa conseguir chegar na aba de Importar — só bloqueia a aba "geral".
  if (estado === 'erro') {
    return (
      <div className="page">
        <div className="header">
          <div className="logo-dot" />
          <div>
            <h1>Score Parça Reversa — Visão Interna</h1>
            <div className="subtitle">Nenhum dado carregado ainda</div>
          </div>
        </div>

        <div className="tabs">
          <button className={`tab-btn ${aba === 'geral' ? 'active' : ''}`} onClick={() => setAba('geral')}>
            Visão Geral
          </button>
          <button className={`tab-btn ${aba === 'importar' ? 'active' : ''}`} onClick={() => setAba('importar')}>
            Importar Dados
          </button>
          <button className={`tab-btn ${aba === 'regras' ? 'active' : ''}`} onClick={() => setAba('regras')}>
            Regras do Score
          </button>
        </div>

        {aba === 'importar' ? (
          <ImportView token={token} historico={historico} onImportado={carregar} />
        ) : aba === 'regras' && config ? (
          <RulesSection config={config} />
        ) : (
          <div className="card">
            <p style={{ fontSize: 13, color: '#DC2626' }}>{erroMsg}</p>
            <p style={{ fontSize: 13, color: '#6B7280' }}>
              Se você ainda não importou nenhum dado, vá na aba "Importar Dados" acima.
            </p>
          </div>
        )}
      </div>
    );
  }

  const media = linhasAtuais.length
    ? (linhasAtuais.reduce((s, l) => s + l.score, 0) / linhasAtuais.length).toFixed(2)
    : '-';
  const emRisco = linhasAtuais.filter((l) => l.score < 3).length;
  const excelencia = linhasAtuais.filter((l) => l.score >= 4.5).length;
  const impactoTotalReceita = linhasAtuais.reduce((s, l) => s + l.impactoTaxa.impactoReceita, 0);

  // Indicadores consolidados: faturamento total do ciclo e médias ponderadas
  // pelo faturamento de cada parceiro — referência de "como foi a carteira toda".
  const faturamentoTotalCarteira = linhasAtuais.reduce((s, l) => s + (l.faturamentoTotalCiclo || 0), 0);
  function mediaPonderadaCarteira(campo) {
    if (faturamentoTotalCarteira <= 0 || linhasAtuais.length === 0) return null;
    const soma = linhasAtuais.reduce((s, l) => s + l[campo] * (l.faturamentoTotalCiclo || 0), 0);
    return soma / faturamentoTotalCarteira;
  }
  const slaConsolidado = mediaPonderadaCarteira('sla');
  const agendamentoConsolidado = mediaPonderadaCarteira('agendamento');
  const csatConsolidado = mediaPonderadaCarteira('csat');

  function formatarBRL(v) {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  return (
    <div className="page">
      <div className="header">
        <div className="logo-dot" />
        <div>
          <h1>Score Parça Reversa — Visão Interna</h1>
          <div className="subtitle">Ciclo: {cicloExibido} · {linhasAtuais.length} parceiros</div>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab-btn ${aba === 'geral' ? 'active' : ''}`} onClick={() => setAba('geral')}>
          Visão Geral
        </button>
        <button className={`tab-btn ${aba === 'importar' ? 'active' : ''}`} onClick={() => setAba('importar')}>
          Importar Dados
        </button>
        <button className={`tab-btn ${aba === 'qualidade' ? 'active' : ''}`} onClick={() => setAba('qualidade')}>
          Qualidade de Dados {avisos.length > 0 ? `(${avisos.length})` : ''}
        </button>
        <button className={`tab-btn ${aba === 'configuracoes' ? 'active' : ''}`} onClick={() => setAba('configuracoes')}>
          Configurações
        </button>
        <button className={`tab-btn ${aba === 'regras' ? 'active' : ''}`} onClick={() => setAba('regras')}>
          Regras do Score
        </button>
      </div>

      {aba === 'geral' && (
        <>
          {ciclosDisponiveis.length > 1 && (
            <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ fontSize: 13, color: '#6B7280' }}>Ciclo:</label>
              <select
                value={cicloExibido || ''}
                onChange={(e) => setCicloSelecionado(e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--cinza-borda)',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {ciclosDisponiveis.map((c) => (
                  <option key={c} value={c}>{c}{c === ultimoCiclo ? ' (mais recente)' : ''}</option>
                ))}
              </select>
            </div>
          )}

          <div className="card">
            <div className="pillars-grid">
              <div className="pillar-card">
                <div className="label">Score médio da carteira</div>
                <div className="pct">{media}</div>
              </div>
              <div className="pillar-card">
                <div className="label">Parceiros em excelência (≥4,5)</div>
                <div className="pct" style={{ color: '#16A34A' }}>{excelencia}</div>
              </div>
              <div className="pillar-card">
                <div className="label">Parceiros críticos/insatisfatórios (&lt;3,0)</div>
                <div className="pct" style={{ color: '#DC2626' }}>{emRisco}</div>
              </div>
            </div>
            <div style={{ marginTop: 14, borderTop: '1px solid var(--cinza-borda)', paddingTop: 14 }}>
              <div className="label" style={{ fontSize: 12, color: '#6B7280' }}>
                Impacto estimado na receita da carteira (próximos 3 meses, vs. taxas atuais)
              </div>
              <div className="pct" style={{ color: impactoTotalReceita >= 0 ? '#16A34A' : '#DC2626' }}>
                {impactoTotalReceita >= 0 ? '+' : ''}{formatarBRL(impactoTotalReceita)}
              </div>
            </div>
          </div>

          <div className="card">
            <h2>Indicadores Consolidados da Carteira — {cicloExibido}</h2>
            <p style={{ fontSize: 12, color: '#6B7280', marginTop: -8, marginBottom: 12 }}>
              Como foi o conjunto de todos os parceiros juntos neste ciclo — média ponderada pelo faturamento
              de cada um, como referência para comparar o desempenho individual.
            </p>
            <div className="pillars-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              <div className="pillar-card">
                <div className="label">Faturamento total da carteira</div>
                <div className="pct">{formatarBRL(faturamentoTotalCarteira)}</div>
              </div>
              <div className="pillar-card">
                <div className="label">SLA médio (ponderado)</div>
                <div className="pct">{slaConsolidado != null ? `${slaConsolidado.toFixed(2)}%` : '-'}</div>
              </div>
              <div className="pillar-card">
                <div className="label">Agendamento médio (ponderado)</div>
                <div className="pct">{agendamentoConsolidado != null ? `${agendamentoConsolidado.toFixed(2)}%` : '-'}</div>
              </div>
              <div className="pillar-card">
                <div className="label">CSAT médio (ponderado)</div>
                <div className="pct">{csatConsolidado != null ? `${csatConsolidado.toFixed(2)}%` : '-'}</div>
              </div>
            </div>
          </div>

          <div className="card">
            <h2>Ranking do ciclo {cicloExibido}</h2>
            <table>
              <thead>
                <tr>
                  <th>Parceiro</th>
                  <th>SLA</th>
                  <th>Agend.</th>
                  <th>CSAT</th>
                  <th>Score</th>
                  <th>Faixa</th>
                  <th>Link do parceiro</th>
                </tr>
              </thead>
              <tbody>
                {linhasAtuais.map((l) => (
                  <tr key={l.codigo}>
                    <td>{l.parceiro}</td>
                    <td>{l.sla.toFixed(2)}%</td>
                    <td>{l.agendamento.toFixed(2)}%</td>
                    <td>{l.csat.toFixed(2)}%</td>
                    <td><strong>{l.score.toFixed(2)}</strong></td>
                    <td><span className={`badge ${l.faixa.cor}`}>{l.faixa.label}</span></td>
                    <td>
                      <button className="btn btn-ghost" onClick={() => copiarLink(l.codigo)}>
                        {copiadoCodigo === l.codigo ? 'Copiado!' : 'Copiar link'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h2>Impacto na taxa e na receita — ciclo {cicloExibido}</h2>
            <p style={{ fontSize: 12, color: '#6B7280', marginTop: -8 }}>
              Receita projetada usando o faturamento do próprio trimestre avaliado como estimativa de volume
              para os próximos 3 meses.
            </p>
            <table>
              <thead>
                <tr>
                  <th>Parceiro</th>
                  <th>Faturamento (base)</th>
                  <th>Taxa atual</th>
                  <th>Taxa nova</th>
                  <th>Receita atual</th>
                  <th>Receita nova</th>
                  <th>Impacto</th>
                </tr>
              </thead>
              <tbody>
                {linhasAtuais.map((l) => {
                  const imp = l.impactoTaxa;
                  const positivo = imp.impactoReceita >= 0;
                  return (
                    <tr key={l.codigo}>
                      <td>{l.parceiro}</td>
                      <td>{formatarBRL(imp.faturamentoProjetado)}</td>
                      <td>{imp.taxaBase.toFixed(2)}%</td>
                      <td><strong>{imp.taxaNova.toFixed(2)}%</strong></td>
                      <td>{formatarBRL(imp.receitaAtual)}</td>
                      <td>{formatarBRL(imp.receitaNova)}</td>
                      <td style={{ color: positivo ? '#16A34A' : '#DC2626', fontWeight: 600 }}>
                        {positivo ? '+' : ''}{formatarBRL(imp.impactoReceita)}
                      </td>
                    </tr>
                  );
                })}
                <tr>
                  <td colSpan={6}><strong>Impacto total na carteira</strong></td>
                  <td style={{ color: impactoTotalReceita >= 0 ? '#16A34A' : '#DC2626', fontWeight: 700 }}>
                    {impactoTotalReceita >= 0 ? '+' : ''}{formatarBRL(impactoTotalReceita)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {aba === 'importar' && <ImportView token={token} historico={historico} onImportado={carregar} />}

      {aba === 'qualidade' && (
        <div className="card">
          <h2>Meses excluídos do cálculo por dado incompleto</h2>
          <p style={{ fontSize: 13, color: '#6B7280', marginTop: -6 }}>
            Quando SLA, Agendamento, CSAT ou a taxa base de um parceiro não estão disponíveis para um mês,
            esse mês não entra na média do trimestre (nada é estimado ou inventado).
          </p>
          {avisos.length === 0 ? (
            <p style={{ fontSize: 13, color: '#16A34A' }}>Nenhum dado incompleto neste ciclo. ✓</p>
          ) : (
            <ul className="tips-list">
              {avisos.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          )}
        </div>
      )}

      {aba === 'configuracoes' && <ConfigView token={token} configInicial={config} onSalvo={setConfig} />}

      {aba === 'regras' && <RulesSection config={config} />}

      <div className="footer-note">
        Link de cada parceiro: {window.location.origin}/?parceiro=CODIGO — envie individualmente, nunca compartilhe o link admin.
      </div>
    </div>
  );
}
