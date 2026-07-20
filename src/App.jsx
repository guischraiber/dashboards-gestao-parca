import { useEffect, Component } from "react";
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

// Evita a "tela branca": se algum dashboard quebrar durante o render, mostra
// o erro de verdade (mensagem + onde aconteceu) em vez de simplesmente sumir.
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("Erro capturado no dashboard:", this.props.label, error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ maxWidth: 800, margin: "40px auto", padding: 24, background: "#FEE2E2", border: "1px solid #DC2626", borderRadius: 12, fontFamily: "monospace" }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#DC2626", marginBottom: 8 }}>
            ⚠️ Erro ao carregar {this.props.label || "esta tela"}
          </div>
          <div style={{ fontSize: 13, color: "#7F1D1D", whiteSpace: "pre-wrap", marginBottom: 12 }}>
            {String(this.state.error?.message || this.state.error)}
          </div>
          <div style={{ fontSize: 12, color: "#991B1B" }}>
            Tire um print desta tela (o texto acima ajuda a encontrar o problema) e mande pro Claude.
          </div>
          <button onClick={() => this.setState({ error: null })} style={{ marginTop: 12, fontSize: 12, background: "#DC2626", color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontWeight: 600 }}>
            Tentar de novo
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

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
    return (
      <ErrorBoundary label="Score">
        <ScoreApp />
      </ErrorBoundary>
    );
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
        <ErrorBoundary label="Performance Coleta">
          <SlaApp />
        </ErrorBoundary>
      </div>
      <div style={{ display: showCsat ? "block" : "none" }}>
        <ErrorBoundary label="CSAT">
          <CsatApp />
        </ErrorBoundary>
      </div>
      <div style={{ display: showScore ? "block" : "none" }}>
        <ErrorBoundary label="Score">
          <ScoreApp />
        </ErrorBoundary>
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
