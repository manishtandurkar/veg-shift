import React, { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import GlossaryModal from "./GlossaryModal";
import Chatbot from "./Chatbot";
import { useCityContext } from "../state/CityContext";
import { useLanguage } from "../state/LanguageContext";
import { t } from "../i18n";

const Layout: React.FC = () => {
  const { loading, error } = useCityContext();
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const { lang, setLang } = useLanguage();

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <NavLink to="/" style={{ textDecoration: "none" }}>
            <span className="brand-mark">
              VegShift<sup>AI</sup>
            </span>
          </NavLink>
          <span className="brand-tag">{t(lang, 'landing.desc')}</span>
        </div>

        <nav className="nav">
          <NavLink to="/">{t(lang, 'nav.home')}</NavLink>
          <NavLink to="/intake">{t(lang, 'nav.intake')}</NavLink>
          <NavLink to="/dashboard">{t(lang, 'nav.dashboard')}</NavLink>
          <NavLink to="/crops">{t(lang, 'nav.crops')}</NavLink>
          <NavLink to="/water">{t(lang, 'nav.water')}</NavLink>
          <NavLink to="/economic">{t(lang, 'nav.economic')}</NavLink>
          <NavLink to="/explain">{t(lang, 'nav.explain')}</NavLink>
          <NavLink to="/compare">{t(lang, 'nav.compare')}</NavLink>
          <NavLink to="/reports">{t(lang, 'nav.reports')}</NavLink>
          <NavLink to="/research">🔬 Research</NavLink>
        </nav>

        <div className="header-actions">
          <select
            aria-label={t(lang, "language.label")}
            value={lang}
            onChange={(e) => setLang(e.target.value as any)}
            style={{ marginRight: 12 }}
          >
            <option value="en">{t(lang, "language.english")}</option>
            <option value="hi">{t(lang, "language.hindi")}</option>
            <option value="kn">{t(lang, "language.kannada")}</option>
          </select>

          <button type="button" className="ghost" onClick={() => setGlossaryOpen(true)}>
            {t(lang, 'glossary.title')}
          </button>
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>

      <footer className="app-footer">
        <div className="footer-sdg">
          <span className="sdg-badge">SDG 13</span>
          <span>Climate Action - Zero Hunger - Clean Water</span>
        </div>
        <div className="footer-tech">
          <span>TFT · TCN · Transformer</span>
          <span>XGBoost · LightGBM · RF</span>
          <span>SHAP · MC Dropout</span>
          <span>FastAPI · React 18</span>
          <span>Köppen-Geiger · FAO GAEZ · CGWB</span>
        </div>
      </footer>

      <GlossaryModal open={glossaryOpen} onClose={() => setGlossaryOpen(false)} />
      <Chatbot />
    </div>
  );
};

export default Layout;
