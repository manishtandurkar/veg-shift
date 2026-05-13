import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCityContext } from "../state/CityContext";
import RiskMeter from "../components/RiskMeter";

const STATS = [
  { number: "10", label: "Indian Cities" },
  { number: "25", label: "Years of Data" },
  { number: "14", label: "Crop Types" },
  { number: "3", label: "Data Sources" },
  { number: "17", label: "Pipeline Steps" },
];

const PIPELINE_STEPS = [
  {
    icon: "🛰️",
    color: "blue",
    step: "Step 1 — Data Fusion",
    title: "Three-Dataset Integration",
    desc: "Daily climate (91k rows), CGWB groundwater levels (2000–2024), and FAO GAEZ crop suitability rasters fused into a single master dataset.",
  },
  {
    icon: "🧠",
    color: "purple",
    step: "Step 2 — ML Engine",
    title: "Temporal Fusion Transformer",
    desc: "TFT with 5-year lookback detects Crop Viability Loss Events via dual-deficit triggers. SHAP explainability identifies key drivers per city.",
  },
  {
    icon: "💧",
    color: "amber",
    step: "Step 3 — Climate Zones",
    title: "Köppen-Geiger Classification",
    desc: "Annual climate zone classification with 3-year persistence filter to detect genuine zone transitions vs. single-year anomalies.",
  },
  {
    icon: "🌾",
    color: "green",
    step: "Step 4 — Advisory Engine",
    title: "Personalized Crop Guidance",
    desc: "14 crops ranked by suitability score + trajectory penalty + zone alignment. Irrigation strategy and MSP economic protection alerts.",
  },
  {
    icon: "📊",
    color: "red",
    step: "Step 5 — Dashboard",
    title: "Farmer Decision Interface",
    desc: "Decision-first UI with risk meter, SHAP explainability, groundwater recharge grids, and government scheme discovery.",
  },
];

const Landing: React.FC = () => {
  const { cities } = useCityContext();
  const navigate = useNavigate();

  return (
    <section className="page">
      {/* ── Hero ── */}
      <div className="hero">
        <div className="hero-eyebrow">
          🌿 SDG 13: Climate Action &nbsp;·&nbsp; AI-Powered Agriculture
        </div>
        <h1>
          Which crops are safe <em>after</em> the<br />climate shifts?
        </h1>
        <p>
          VegShift fuses 25 years of climate, groundwater, and crop-suitability data to detect
          when traditional crops become unviable — and recommends what to grow next. Built for
          Indian farmers and agricultural advisors.
        </p>
        <div className="hero-actions">
          <Link className="primary" to="/intake">→ Start farmer intake</Link>
          <Link className="secondary" to="/city">Explore city data</Link>
          <Link className="secondary" to="/explain">View model explainability</Link>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="stats-row">
        {STATS.map((s, i) => (
          <div
            key={s.label}
            className="stat-card"
            style={{ "--delay": `${i * 0.06}s` } as React.CSSProperties}
          >
            <span className="stat-number">{s.number}</span>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── City grid ── */}
      <div className="section">
        <div className="section-head">
          <h2>Cities covered</h2>
          <span className="tag">2000 – 2024</span>
        </div>
        <div className="city-grid">
          {cities.map((city, i) => (
            <div
              key={city.city}
              className="card city-preview"
              style={{ "--delay": `${i * 0.04}s` } as React.CSSProperties}
              onClick={() => navigate("/city")}
              title={`View ${city.city} detail`}
            >
              <div className="card-header">
                <h3 style={{ margin: 0, fontSize: "1rem" }}>{city.city}</h3>
                <span className={`tag risk-${city.risk_level}`}>
                  {city.risk_level.toUpperCase()}
                </span>
              </div>
              <RiskMeter level={city.risk_level} />
              <p style={{ fontSize: "0.78rem", marginTop: 8, marginBottom: 0 }}>
                {city.current_zone ?? "Zone"} · {city.recent_cvle_count} CVLEs (5 yr)
              </p>
              <p style={{ fontSize: "0.78rem", marginBottom: 0 }}>
                Top: {city.top_crops.slice(0, 2).map((c) => c.crop).join(", ")}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── How it works ── */}
      <div className="pipeline-section">
        <div className="section-head">
          <h2>How VegShift works</h2>
          <span className="tag">17-step ML pipeline</span>
        </div>
        <div className="pipeline-steps">
          {PIPELINE_STEPS.map((step, i) => (
            <div
              key={step.step}
              className="pipeline-step"
              style={{ "--delay": `${i * 0.07}s` } as React.CSSProperties}
            >
              <div className={`step-icon ${step.color}`}>{step.icon}</div>
              <div className="step-number">{step.step}</div>
              <h4>{step.title}</h4>
              <p>{step.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Technology stack ── */}
      <div className="card tech-stack">
        <h3>Technology stack</h3>
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
        <h2>Why this matters</h2>
        <p>
          Climate zone shifts are shrinking sowing windows, depleting aquifers, and making
          traditional crops unreliable across India. VegShift detects <strong>Crop Viability Loss
          Events (CVLEs)</strong> — the moment when dual atmospheric and groundwater deficits make a
          crop economically unviable — and gives farmers a data-backed alternative before losses
          compound.
        </p>
        <p style={{ marginBottom: 0 }}>
          This project directly targets three UN Sustainable Development Goals:
        </p>
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
