import { useEffect } from "react";
import { BrowserRouter, useLocation, useNavigate, NavLink } from "react-router-dom";
import SlaApp from "./pages/SlaApp.jsx";
import CsatApp from "./pages/CsatApp.jsx";
import ScoreApp from "./pages/score/ScoreApp.jsx";
import "./pages/score/style.css";

const C = {
  laranja: "#F97316",
  azul: "#2563EB",
  verde: "#16A34A",
  cinzaFundo: "#F8F7F4",
  cinzaCard: "#FFFFFF",
  cinzaBorda: "#E5E3DF",
  cinzaTexto: "#6B7280",
  texto: "#1C1917",
};

function NavBar() {
  const linkStyle = ({ isActive }) => ({
    padding: "10px 18px",
    borderRadius: 8,
    fontWeight: 600,
    fontSize: 14,
    textDecoration: "none",
    color: isActive ? "#FFFFFF" : C.texto,
    background: isActive ? C.laranja : "transparent",
    transition: "background 0.15s ease",
  });

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        padding: "12px 24px",
        background: C.cinzaCard,
        borderBottom: `1px solid ${C.cinzaBorda}`,
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      <span style={{ fontWeight: 700, fontSize: 15, color: C.texto, marginRight: 16 }}>
        Gestão Parça
      </span>
      <NavLink to="/sla" style={linkStyle}>
        Performance Coleta
      </NavLink>
      <NavLink to="/csat" style={linkStyle}>
        CSAT
      </NavLink>
      <NavLink to="/score" style={linkStyle}>
        Score
      </NavLink>
    </div>
  );
}

function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();

  // Link enviado a um parceiro externo (ex: /score?parceiro=ABC123).
  // Nesse caso não mostramos a navbar nem montamos os dashboards internos —
  // o parceiro só deve ver a própria tela de score, isolada.
  const params = new URLSearchParams(location.search);
  const isPartnerLink = params.has("parceiro");

  // Redireciona a raiz (ou rota desconhecida) para /sla, sem desmontar nada.
  useEffect(() => {
    if (isPartnerLink) return;
    if (!["/sla", "/csat", "/score"].includes(location.pathname)) {
      navigate("/sla", { replace: true });
    }
  }, [location.pathname, isPartnerLink, navigate]);

  if (isPartnerLink) {
    return <ScoreApp />;
  }

  const showSla = location.pathname === "/sla" || location.pathname === "/";
  const showCsat = location.pathname === "/csat";
  const showScore = location.pathname === "/score";

  return (
    <div style={{ minHeight: "100vh", background: C.cinzaFundo }}>
      <NavBar />
      {/* Os três dashboards ficam sempre montados assim que visitados uma vez.
          Trocar de aba só esconde visualmente os outros, então o estado de
          importação de arquivos (ex.: CSVs do CSAT) não se perde ao navegar
          entre eles. */}
      <div style={{ display: showSla ? "block" : "none" }}>
        <SlaApp />
      </div>
      <div style={{ display: showCsat ? "block" : "none" }}>
        <CsatApp />
      </div>
      <div style={{ display: showScore ? "block" : "none" }}>
        <ScoreApp />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
