import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCityContext } from "../state/CityContext";
import RiskMeter from "../components/RiskMeter";
import { useLanguage } from "../state/LanguageContext";
import { t } from "../i18n";

const STATS = [
  { number: "10", labelKey: "stats.cities" },
  { number: "25", labelKey: "stats.years" },
  { number: "14", labelKey: "stats.crops" },
  { number: "3", labelKey: "stats.sources" },
  { number: "17", labelKey: "stats.steps" },
];

const PIPELINE_STEPS = [
  {
    icon: "🛰️",
    color: "blue",
    stepKey: "pipeline.step1.step",
    titleKey: "pipeline.step1.title",
    descKey: "pipeline.step1.desc",
  },
  {
    icon: "🧠",
    color: "purple",
    stepKey: "pipeline.step2.step",
    titleKey: "pipeline.step2.title",
    descKey: "pipeline.step2.desc",
  },
  {
    icon: "💧",
    color: "amber",
    stepKey: "pipeline.step3.step",
    titleKey: "pipeline.step3.title",
    descKey: "pipeline.step3.desc",
  },
  {
    icon: "🌾",
    color: "green",
    stepKey: "pipeline.step4.step",
    titleKey: "pipeline.step4.title",
    descKey: "pipeline.step4.desc",
  },
  {
    icon: "📊",
    color: "red",
    stepKey: "pipeline.step5.step",
    titleKey: "pipeline.step5.title",
    descKey: "pipeline.step5.desc",
  },
];

const Landing: React.FC = () => {
  const { cities } = useCityContext();
  const { lang } = useLanguage();
  const navigate = useNavigate();

  return (
    <section className="page">
      {/* ── Hero ── */}
      <div className="hero">
        <div className="hero-eyebrow">{t(lang, "landing.eyebrow")}</div>
        <h1>{t(lang, 'landing.title')}</h1>
        <p>{t(lang, 'landing.desc')}</p>
        <div className="hero-actions">
          <Link className="primary" to="/intake">→ {t(lang, 'intake.title')}</Link>
          <Link className="secondary" to="/city">{t(lang, 'nav.city')}</Link>
          <Link className="secondary" to="/explain">{t(lang, 'nav.explain')}</Link>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="stats-row">
        {STATS.map((s, i) => (
          <div
            key={s.labelKey}
            className="stat-card"
            style={{ "--delay": `${i * 0.06}s` } as React.CSSProperties}
          >
            <span className="stat-number">{s.number}</span>
            <div className="stat-label">{t(lang, s.labelKey)}</div>
          </div>
        ))}
      </div>

      {/* ── City grid ── */}
      <div className="section">
        <div className="section-head">
          <h2>{t(lang, "landing.cities_covered")}</h2>
          <span className="tag">2000 – 2024</span>
        </div>
        <div className="city-grid">
          {cities.map((city, i) => (
            <div
              key={city.city}
              className="card city-preview"
              style={{ "--delay": `${i * 0.04}s` } as React.CSSProperties}
              onClick={() => navigate("/city")}
              title={t(lang, "landing.view_city", { city: city.city })}
            >
              <div className="card-header">
                <h3 style={{ margin: 0, fontSize: "1rem" }}>{city.city}</h3>
                <span className={`tag risk-${city.risk_level}`}>
                  {t(lang, `risk.${city.risk_level}`)}
                </span>
              </div>
              <RiskMeter level={city.risk_level} />
              <p style={{ fontSize: "0.78rem", marginTop: 8, marginBottom: 0 }}>
                {city.current_zone ?? "Zone"} · {city.recent_cvle_count} CVLEs (5 yr)
              </p>
              <p style={{ fontSize: "0.78rem", marginBottom: 0 }}>
                {t(lang, "landing.top")}: {city.top_crops.slice(0, 2).map((c) => c.crop).join(", ")}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── How it works ── */}
      <div className="pipeline-section">
        <div className="section-head">
          <h2>{t(lang, "landing.how")}</h2>
          <span className="tag">{t(lang, "landing.pipeline_tag")}</span>
        </div>
        <div className="pipeline-steps">
          {PIPELINE_STEPS.map((step, i) => (
            <div
              key={step.stepKey}
              className="pipeline-step"
              style={{ "--delay": `${i * 0.07}s` } as React.CSSProperties}
            >
              <div className={`step-icon ${step.color}`}>{step.icon}</div>
              <div className="step-number">{t(lang, step.stepKey)}</div>
              <h4>{t(lang, step.titleKey)}</h4>
              <p>{t(lang, step.descKey)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Technology stack ── */}
      <div className="card tech-stack">
        <h3>{t(lang, "landing.tech")}</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>ML & Data</div>
            <div className="tech-chips">
              <span className="tech-chip highlight">Temporal Fusion Transformer</span>
              <span className="tech-chip highlight">SHAP Explainability</span>
              <span className="tech-chip">PyTorch Lightning</span>
              <span className="tech-chip">scikit-learn</span>
              <span className="tech-chip">pandas / numpy</span>
              <span className="tech-chip">rasterio (GeoTIFF)</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Backend & API</div>
            <div className="tech-chips">
              <span className="tech-chip highlight">FastAPI</span>
              <span className="tech-chip">Uvicorn</span>
              <span className="tech-chip">TF-IDF Chatbot</span>
              <span className="tech-chip">Plotly / Dash</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Frontend</div>
            <div className="tech-chips">
              <span className="tech-chip highlight">React 18 + TypeScript</span>
              <span className="tech-chip">Vite</span>
              <span className="tech-chip">React Router v6</span>
              <span className="tech-chip">Context API</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── SDG alignment ── */}
      <div className="mission">
        <h2>{t(lang, "landing.why")}</h2>
        <p>{t(lang, "landing.why_desc")}</p>
        <p style={{ marginBottom: 0 }}>{t(lang, "landing.sdg_target")}</p>
        <div className="sdg-badges">
          <span className="sdg-chip green">SDG 13 · Climate Action</span>
          <span className="sdg-chip blue">SDG 6 · Clean Water</span>
          <span className="sdg-chip yellow">SDG 2 · Zero Hunger</span>
        </div>
      </div>
    </section>
  );
};

export default Landing;
