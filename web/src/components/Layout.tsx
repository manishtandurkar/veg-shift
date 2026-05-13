import React, { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import CitySelector from "./CitySelector";
import GlossaryModal from "./GlossaryModal";
import { useCityContext } from "../state/CityContext";

const Layout: React.FC = () => {
  const { loading, error, meta } = useCityContext();
  const [glossaryOpen, setGlossaryOpen] = useState(false);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">VegShift</span>
          <span className="brand-tag">Climate-ready crop guidance</span>
        </div>
        <nav className="nav">
          <NavLink to="/">Home</NavLink>
          <NavLink to="/intake">Intake</NavLink>
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/city">City</NavLink>
          <NavLink to="/crops">Crops</NavLink>
          <NavLink to="/water">Water</NavLink>
          <NavLink to="/economic">Protection</NavLink>
          <NavLink to="/explain">Explain</NavLink>
          <NavLink to="/reports">Reports</NavLink>
        </nav>
        <div className="header-actions">
          <CitySelector />
          <button type="button" className="ghost" onClick={() => setGlossaryOpen(true)}>
            Glossary
          </button>
        </div>
      </header>

      <section className="status-bar">
        {loading && <span>Loading data...</span>}
        {error && <span className="error">{error}</span>}
        {meta?.last_updated && (
          <span className="muted">Last updated: {new Date(meta.last_updated).toLocaleString()}</span>
        )}
      </section>

      <main className="app-main">
        <Outlet />
      </main>

      <footer className="app-footer">
        <span>SDG 13 | Climate Action • Built on VegShift pipeline outputs</span>
      </footer>

      <GlossaryModal open={glossaryOpen} onClose={() => setGlossaryOpen(false)} />
    </div>
  );
};

export default Layout;
