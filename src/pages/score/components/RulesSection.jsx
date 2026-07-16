import React from 'react';

function TabelaFaixas({ linhas }) {
  return (
    <table style={{ maxWidth: 320 }}>
      <thead>
        <tr><th>Nota</th><th>De</th><th>Até</th></tr>
      </thead>
      <tbody>
        {[...linhas].sort((a, b) => a.nota - b.nota).map((f) => (
          <tr key={f.nota}>
            <td>{f.nota}</td>
            <td>{f.min.toFixed(2)}%</td>
            <td>{f.max.toFixed(2)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function RulesSection({ config }) {
  const { pesos, faixasIndicador, faixasFinais } = config;

  return (
    <div className="card">
      <h2>Regras do Score Parça Reversa</h2>

      <div>
        <h3 style={{ fontSize: 14 }}>1. Como o score é calculado</h3>
        <p style={{ fontSize: 14, lineHeight: 1.6 }}>
          O score é composto por três pilares, cada um com um peso diferente:
        </p>
        <ul className="tips-list">
          <li><strong>SLA de Coleta — peso {(pesos.sla * 100).toFixed(0)}%:</strong> % de coletas realizadas dentro do prazo acordado (comparação entre data agendada e data efetivada no Eagle). Coletas sem data de agendamento entram automaticamente como fora do SLA.</li>
          <li><strong>Agendamento — peso {(pesos.agendamento * 100).toFixed(0)}%:</strong> % de coletas com data de agendamento corretamente registrada no Eagle após o aceite e alinhamento com o cliente.</li>
          <li><strong>CSAT — peso {(pesos.csat * 100).toFixed(0)}%:</strong> % de respostas "4" ou "5" na pergunta de Experiência Geral da pesquisa de satisfação enviada ao cliente.</li>
        </ul>
        <p style={{ fontSize: 14, lineHeight: 1.6 }}>
          Cada pilar recebe uma nota de 1 a 5 conforme a faixa de percentual atingida (tabelas abaixo).
          O score final é a soma de cada nota multiplicada pelo peso do pilar:
        </p>
        <p style={{ fontSize: 13, background: '#F8F7F4', padding: 10, borderRadius: 8, fontFamily: 'monospace' }}>
          Score = (Nota SLA × {(pesos.sla * 100).toFixed(0)}%) + (Nota Agendamento × {(pesos.agendamento * 100).toFixed(0)}%) + (Nota CSAT × {(pesos.csat * 100).toFixed(0)}%)
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.6 }}>
          Quando o ciclo trimestral combina 3 meses, o score de <strong>cada mês é calculado normalmente</strong>{' '}
          (nota de cada pilar × peso). O score do trimestre é a <strong>média dos 3 scores mensais, ponderada
          pelo faturamento de cada mês</strong> — meses com mais faturamento têm mais peso no resultado final:
        </p>
        <p style={{ fontSize: 13, background: '#F8F7F4', padding: 10, borderRadius: 8, fontFamily: 'monospace' }}>
          Score do Trimestre = Σ(Score do mês × Faturamento do mês) / Σ(Faturamento do mês)
        </p>

        <h3 style={{ fontSize: 14, marginTop: 20 }}>2. Faixas de nota por pilar</h3>
        <div className="pillars-grid">
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>SLA de Coleta</div>
            <TabelaFaixas linhas={faixasIndicador.sla} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Agendamento</div>
            <TabelaFaixas linhas={faixasIndicador.agendamento} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>CSAT</div>
            <TabelaFaixas linhas={faixasIndicador.csat} />
          </div>
        </div>

        <h3 style={{ fontSize: 14, marginTop: 20 }}>3. Faixas do score final e consequência na taxa</h3>
        <table>
          <thead>
            <tr><th>Faixa</th><th>Resultado</th><th>Ação aplicada</th></tr>
          </thead>
          <tbody>
            {[...faixasFinais].sort((a, b) => a.min - b.min).map((f) => (
              <tr key={f.label}>
                <td>{f.min.toFixed(2)} – {f.max.toFixed(2)}</td>
                <td>{f.label}</td>
                <td>
                  {f.ajustePP === 0 ? 'Sem alteração na taxa' : `${f.ajustePP > 0 ? '+' : ''}${f.ajustePP.toFixed(2)}% na taxa`}
                  {f.descricao ? ` — ${f.descricao}` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 13, color: '#6B7280' }}>
          O score é recalculado a cada 3 meses, e o resultado vale para a taxa cobrada sobre coleta reversa,
          devolução Bulky e terceiras nos 3 meses seguintes.
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.6 }}>
          O ajuste é somado, em pontos percentuais, direto sobre a taxa contratada do parceiro:
        </p>
        <p style={{ fontSize: 13, background: '#F8F7F4', padding: 10, borderRadius: 8, fontFamily: 'monospace' }}>
          Nova taxa = Taxa contratada + Ajuste da faixa
        </p>

        <h3 style={{ fontSize: 14, marginTop: 20 }}>4. Quem participa do score</h3>
        <p style={{ fontSize: 14, lineHeight: 1.6 }}>
          Desde a primeira coleta, todo parceiro já recebe um score — para acompanhar a própria evolução desde o início.
          Porém, as <strong>consequências na taxa</strong> (desconto ou acréscimo) só se aplicam a parceiros que atendam,
          simultaneamente, aos dois critérios abaixo:
        </p>
        <ul className="tips-list">
          <li>3 ou mais meses de operação</li>
          <li>Mais de 10 coletas realizadas no período avaliado</li>
        </ul>
        <p style={{ fontSize: 13, color: '#6B7280' }}>
          Parceiros que ainda não atingiram esses critérios veem o score normalmente, com um aviso de que
          ele é apenas informativo neste ciclo.
        </p>
      </div>
    </div>
  );
}
