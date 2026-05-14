import React, { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import GlossaryModal from "./GlossaryModal";
import Chatbot from "./Chatbot";
import { useCityContext } from "../state/CityContext";

const Layout: React.FC = () => {
  const { loading, error } = useCityContext();
  const [glossaryOpen, setGlossaryOpen] = useState(false);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <NavLink to="/" style={{ textDecoration: "none" }}>
            <span className="brand-mark">
              VegShift<sup>AI</sup>
            </span>
          </NavLink>
          <span className="brand-tag">Climate-adaptive crop guidance for Indian farmers</span>
        </div>

        <nav className="nav">
          <NavLink to="/">Home</NavLink>
          <NavLink to="/intake">Intake</NavLink>
          <NavLink to="/dashboard">Dashboard</NavLink>

          <NavLink to="/crops">Crops</NavLink>
          <NavLink to="/water">Water</NavLink>
          <NavLink to="/economic">Protection</NavLink>
          <NavLink to="/explain">Explainability</NavLink>
          <NavLink to="/reports">Reports</NavLink>
        </nav>

        <div className="header-actions">
          <button type="button" className="ghost" onClick={() => setGlossaryOpen(true)}>
            Glossary
          </button>
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>

      <footer className="app-footer">
        <div className="footer-sdg">
          <span className="sdg-badge">SDG 13</span>
          <span>Climate Action · Zero Hunger · Clean Water</span>
        </div>
        <div className="footer-tech">
          <span>TFT · SHAP</span>
          <span>FastAPI</span>
          <span>React 18</span>
          <span>Köppen-Geiger</span>
          <span>FAO GAEZ · CGWB</span>
        </div>
      </footer>

      <GlossaryModal open={glossaryOpen} onClose={() => setGlossaryOpen(false)} />
      <Chatbot />
    </div>
  );
};

export default Layout;
