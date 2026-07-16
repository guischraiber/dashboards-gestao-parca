import React, { useState } from 'react';
import * as XLSX from 'xlsx';

function lerArquivoComoTexto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file, 'utf-8');
  });
}

// Converte a aba "Dados" de um .xlsx em texto CSV, no navegador, sem precisar
// de nada no servidor além do que já existe para CSV puro.
function lerXlsxComoCsv(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const wb = XLSX.read(reader.result, { type: 'array' });
        const nomeAba = wb.SheetNames.includes('Dados') ? 'Dados' : wb.SheetNames[0];
        const csv = XLSX.utils.sheet_to_csv(wb.Sheets[nomeAba]);
        resolve(csv);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

async function lerArquivoImportacao(file) {
  if (file.name.toLowerCase().endsWith('.xlsx')) return lerXlsxComoCsv(file);
  return lerArquivoComoTexto(file);
}

function CampoArquivo({ label, arquivo, onChange, accept }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <input type="file" accept={accept} onChange={(e) => onChange(e.target.files?.[0] || null)} />
      {arquivo && <div style={{ fontSize: 12, color: '#16A34A', marginTop: 4 }}>✓ {arquivo.name} selecionado</div>}
    </div>
  );
}

export default function ImportView({ token, historico = [], onImportado }) {
  // --- Fluxo principal: modelo único ---
  const [modelo, setModelo] = useState(null);
  const [enviandoModelo, setEnviandoModelo] = useState(false);
  const [resultadoModelo, setResultadoModelo] = useState(null);

  // --- Fluxo avançado: 3 planilhas do Weekly Parça ---
  const [avancadoAberto, setAvancadoAberto] = useState(false);
  const [indicadores, setIndicadores] = useState(null);
  const [faturamento, setFaturamento] = useState(null);
  const [taxas, setTaxas] = useState(null);
  const [enviandoAvancado, setEnviandoAvancado] = useState(false);
  const [resultadoAvancado, setResultadoAvancado] = useState(null);
  const [limpandoHistorico, setLimpandoHistorico] = useState(false);

  async function enviar(body, setEnviando, setResultado, aoTerminar) {
    setEnviando(true);
    setResultado(null);
    try {
      const r = await fetch('/api/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Erro desconhecido');
      setResultado({ ok: true, mensagem: data.mensagem });
      aoTerminar?.();
      onImportado?.();
    } catch (e) {
      setResultado({ ok: false, mensagem: e.message });
    } finally {
      setEnviando(false);
    }
  }

  async function handleEnviarModelo() {
    if (!modelo) return;
    const modeloCsv = await lerArquivoImportacao(modelo);
    enviar({ admin: token, modeloCsv, nomes: { modelo: modelo.name } }, setEnviandoModelo, setResultadoModelo, () => setModelo(null));
  }

  async function handleEnviarAvancado() {
    const body = { admin: token, nomes: {} };
    if (indicadores) { body.indicadoresCsv = await lerArquivoComoTexto(indicadores); body.nomes.indicadores = indicadores.name; }
    if (faturamento) { body.faturamentoCsv = await lerArquivoComoTexto(faturamento); body.nomes.faturamento = faturamento.name; }
    if (taxas) { body.taxasCsv = await lerArquivoComoTexto(taxas); body.nomes.taxas = taxas.name; }
    enviar(body, setEnviandoAvancado, setResultadoAvancado, () => {
      setIndicadores(null);
      setFaturamento(null);
      setTaxas(null);
    });
  }

  async function handleLimparHistorico() {
    if (!window.confirm('Apagar o histórico de importações? Os dados atuais do score não são afetados, só a lista de registros.')) return;
    setLimpandoHistorico(true);
    try {
      const r = await fetch('/api/limparHistoricoImportacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin: token }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Erro desconhecido');
      onImportado?.();
    } catch (e) {
      window.alert(`Não foi possível limpar: ${e.message}`);
    } finally {
      setLimpandoHistorico(false);
    }
  }

  return (
    <>
      <div className="card">
        <h2>Importar Dados do Ciclo</h2>
        <p style={{ fontSize: 13, color: '#6B7280', marginTop: -6 }}>
          Fluxo recomendado: baixe o modelo, peça para o time preencher, e envie de volta. Depois de enviar,
          o dashboard leva cerca de <strong>1 minuto</strong> para atualizar (o Vercel faz um novo deploy
          automaticamente).
        </p>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '16px 0 22px' }}>
          <a href="/modelo-score-parca.xlsx" download className="btn" style={{ textDecoration: 'none', display: 'inline-block' }}>
            ⬇ Baixar modelo (.xlsx)
          </a>
          <span style={{ fontSize: 12, color: '#6B7280' }}>
            já vem com a lista de parceiros — só preencher os números do mês
          </span>
        </div>

        <CampoArquivo
          label="Enviar planilha preenchida (.xlsx ou .csv)"
          arquivo={modelo}
          onChange={setModelo}
          accept=".xlsx,.csv"
        />

        <button className="btn" onClick={handleEnviarModelo} disabled={!modelo || enviandoModelo}>
          {enviandoModelo ? 'Enviando...' : 'Importar'}
        </button>

        {resultadoModelo && (
          <p style={{ fontSize: 13, marginTop: 14, color: resultadoModelo.ok ? '#16A34A' : '#DC2626' }}>
            {resultadoModelo.ok ? '✓ ' : '✗ '}{resultadoModelo.mensagem}
          </p>
        )}
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Avançado: importar direto das planilhas do Weekly Parça</h2>
          <button className="btn btn-ghost" onClick={() => setAvancadoAberto(!avancadoAberto)}>
            {avancadoAberto ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>

        {avancadoAberto && (
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: 13, color: '#6B7280', marginTop: -6 }}>
              Use isso só se preferir importar direto das planilhas de Indicadores, Faturamento e Taxas do
              Weekly Parça (formato semanal/largo), em vez do modelo simples acima. Se você importar por
              aqui, isso passa a valer no lugar do modelo único até você importar um modelo novo.
            </p>
            <CampoArquivo label="1. Indicadores (SLA, Agendamento, CSAT)" arquivo={indicadores} onChange={setIndicadores} accept=".csv" />
            <CampoArquivo label="2. Faturamento" arquivo={faturamento} onChange={setFaturamento} accept=".csv" />
            <CampoArquivo label="3. Taxas" arquivo={taxas} onChange={setTaxas} accept=".csv" />
            <button
              className="btn"
              onClick={handleEnviarAvancado}
              disabled={(!indicadores && !faturamento && !taxas) || enviandoAvancado}
            >
              {enviandoAvancado ? 'Enviando...' : 'Importar (avançado)'}
            </button>
            {resultadoAvancado && (
              <p style={{ fontSize: 13, marginTop: 14, color: resultadoAvancado.ok ? '#16A34A' : '#DC2626' }}>
                {resultadoAvancado.ok ? '✓ ' : '✗ '}{resultadoAvancado.mensagem}
              </p>
            )}
          </div>
        )}
      </div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0 }}>📂 Histórico de Importações</h2>
            <p style={{ fontSize: 12, color: '#6B7280', marginTop: 4, marginBottom: 0 }}>
              Fica salvo no repositório — visível pra qualquer um que acessar a visão interna.
            </p>
          </div>
          {historico.length > 0 && (
            <button className="btn btn-ghost" onClick={handleLimparHistorico} disabled={limpandoHistorico}>
              {limpandoHistorico ? 'Limpando...' : '🗑️ Limpar'}
            </button>
          )}
        </div>
        {historico.length === 0 ? (
          <p style={{ fontSize: 13, color: '#6B7280', marginTop: 14 }}>Nenhuma importação registrada ainda.</p>
        ) : (
          <table style={{ marginTop: 14 }}>
            <thead>
              <tr>
                <th>#</th>
                <th>Data / Hora</th>
                <th>Arquivo(s)</th>
              </tr>
            </thead>
            <tbody>
              {[...historico].reverse().map((h, i) => (
                <tr key={i} style={{ background: i === 0 ? '#F0FDF4' : 'transparent' }}>
                  <td>{historico.length - i}</td>
                  <td>{new Date(h.data).toLocaleString('pt-BR')}</td>
                  <td>{(h.arquivos || []).join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
