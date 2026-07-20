import React, { useMemo } from 'react';
import PartnerView from './components/PartnerView.jsx';
import AdminView from './components/AdminView.jsx';

export default function ScoreApp() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const codigoParceiro = params.get('parceiro');
  const adminToken = params.get('admin');

  if (codigoParceiro) {
    return <PartnerView codigo={codigoParceiro} />;
  }

  if (adminToken) {
    return <AdminView token={adminToken} />;
  }

  return (
    <div className="page">
      <div className="header">
        <div className="logo-dot" />
        <div>
          <h1>Score Parça Reversa</h1>
          <div className="subtitle">Acesso não identificado</div>
        </div>
      </div>
      <div className="card">
        <p>
          Este link precisa de um parâmetro na URL:
        </p>
        <ul>
          <li><code>?parceiro=SEU_CODIGO</code> — para o parceiro ver o próprio score</li>
          <li><code>?admin=TOKEN</code> — para a visão interna da equipe</li>
        </ul>
      </div>
    </div>
  );
}
