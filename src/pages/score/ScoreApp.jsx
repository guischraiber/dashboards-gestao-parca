import React, { useMemo } from 'react';
import PartnerView from './components/PartnerView.jsx';
import AdminView from './components/AdminView.jsx';

export default function ScoreApp() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const codigoParceiro = params.get('parceiro');

  // Com o código do parceiro na URL, mostra só a visão dele.
  // Sem o código (acesso pela navegação interna do dashboard), mostra a visão
  // completa da equipe direto — sem exigência de token/senha.
  if (codigoParceiro) {
    return <PartnerView codigo={codigoParceiro} />;
  }

  return <AdminView />;
}
