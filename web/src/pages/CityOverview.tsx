import React from "react";
import { useCityContext } from "../state/CityContext";
import { useCityDetail } from "../hooks/useCityDetail";
import EvidenceCard from "../components/EvidenceCard";
import RiskMeter from "../components/RiskMeter";
import TrendStrip from "../components/TrendStrip";

const CityOverview: React.FC = () => {
  const { selectedCity, cities } = useCityContext();
  const summary = cities.find((c) => c.city === selectedCity);
  const { detail, loading, error } = useCityDetail(selectedCity);

  if (!selectedCity || !summary) {
    return (
      <section className="page">
        <div className="card" style={{ textAlign: "center", padding: 48 }}>
          <div style={{ fontSize: "3rem", marginBottom: 16 }}>🗺️</div>
          <h3>Select a city</h3>
          <p>Choose a city from the header dropdown to explore its climate data.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>{selectedCity}</h1>
          <p>25-year climate trajectory, zone transitions, crop risk, and local evidence.</p>
        </div>
        <RiskMeter level={summary.risk_level} />
      </div>

      {/* Key metrics */}
      <div className="card-grid">
        <div className="card metric-card">
          <div className="metric-label">Current zone</div>
          <div className="metric-value" style={{ fontSize: "1.4rem" }}>
            {detail?.advisory.current_zone ?? summary.current_zone ?? "—"}
          </div>
          <p style={{ fontSize: "0.8rem", margin: 0 }}>Köppen-Geiger classification</p>
        </div>
        <div className="card metric-card">
          <div className="metric-label">CVLE events (5 yr)</div>
          <div className={`metric-value ${(summary.recent_cvle_count ?? 0) >= 2 ? "metric-delta negative" : "metric-delta positive"}`}>
            {summary.recent_cvle_count}
          </div>
          <p style={{ fontSize: "0.8rem", margin: 0 }}>Crop Viability Loss Events</p>
        </div>
        <div className="card metric-card">
          <div className="metric-label">Risk level</div>
          <div className={`metric-value metric-delta ${summary.risk_level === "high" ? "negative" : summary.risk_level === "low" ? "positive" : ""}`} style={{ fontSize: "1.3rem", textTransform: "capitalize" }}>
            {summary.risk_level}
          </div>
          <p style={{ fontSize: "0.8rem", margin: 0 }}>Based on dual-deficit trigger</p>
        </div>
        {detail && (
          <div className="card metric-card">
            <div className="metric-label">Trend slope</div>
            <div className={`metric-value ${detail.trend.trend === "deteriorating" ? "metric-delta negative" : detail.trend.trend === "improving" ? "metric-delta positive" : ""}`}>
              {detail.trend.slope.toFixed(4)}
            </div>
            <p style={{ fontSize: "0.8rem", margin: 0 }}>Per year · R² = {detail.trend.r_squared.toFixed(3)}</p>
          </div>
        )}
      </div>

      {/* Top crops */}
      {summary.top_crops.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3>Recommended crops</h3>
            <span className="tag">Ranked by suitability</span>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {summary.top_crops.map((c, i) => (
              <div key={c.crop} style={{
                background: i === 0 ? "rgba(63,122,74,0.12)" : "rgba(30,42,36,0.06)",
                border: `1px solid ${i === 0 ? "rgba(63,122,74,0.3)" : "var(--border)"}`,
                borderRadius: 12,
                padding: "8px 16px",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}>
                <span style={{ fontWeight: 700, color: "var(--accent-dark)" }}>#{i + 1}</span>
                <span style={{ fontWeight: 600 }}>{c.crop}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && <p>Loading detailed data…</p>}
      {error && <p className="error">{error}</p>}

      {detail && (
        <>
          {/* Trend */}
          {detail.trend && <TrendStrip slope={detail.trend.slope} trend={detail.trend.trend} />}

          {/* Climate transitions */}
          <div className="section">
            <div className="section-head">
              <h2>Climate zone transitions</h2>
              <span className="tag">{detail.transitions.length} detected</span>
            </div>
            {detail.transitions.length > 0 ? (
              <div className="table">
                {detail.transitions.map((item, idx) => (
                  <div key={`${item.transition_year}-${idx}`} className="table-row">
                    <div className="year-pill">{item.transition_year}</div>
                    <div>
                      <strong>{item.from_zone}</strong>
                      <span style={{ margin: "0 8px", color: "var(--muted)" }}>→</span>
                      <strong>{item.to_zone}</strong>
                    </div>
                    <div style={{ color: "var(--muted)", fontSize: "0.83rem" }}>
                      Confirmed over {item.years_confirmed} year{item.years_confirmed !== 1 ? "s" : ""}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card muted">
                No Köppen-Geiger zone transitions detected for {selectedCity} in the study period.
                This means the city's climate classification has remained stable (2000–2024).
              </div>
            )}
          </div>

          {/* Evidence */}
          <div className="section">
            <h2>Evidence from the ground</h2>
            <div className="card-grid">
              {detail.evidence.map((item, idx) => (
                <EvidenceCard key={`${item.title}-${idx}`} item={item} />
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
};

export default CityOverview;
