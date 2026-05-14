import React from "react";
import { useCityContext } from "../state/CityContext";
import { useCityDetail } from "../hooks/useCityDetail";
import { useFarmerProfile } from "../state/FarmerProfileContext";
import RiskMeter from "../components/RiskMeter";
import AdvisoryCard from "../components/AdvisoryCard";
import ActionSteps from "../components/ActionSteps";
import EvidenceCard from "../components/EvidenceCard";
import TrendStrip from "../components/TrendStrip";

const EriGauge: React.FC<{ value: number; alert: boolean }> = ({ value, alert }) => {
  const r = 32;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(1, value));
  const color = alert ? "var(--risk-high)" : value > 0.5 ? "var(--risk-medium)" : "var(--risk-low)";
  return (
    <div className="eri-gauge">
      <svg viewBox="0 0 80 80">
        <circle className="track" cx="40" cy="40" r={r} />
        <circle
          className="fill"
          cx="40"
          cy="40"
          r={r}
          stroke={color}
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="eri-center" style={{ color }}>
        {(value * 100).toFixed(0)}%
      </div>
    </div>
  );
};

const Dashboard: React.FC = () => {
  const { selectedCity, cities } = useCityContext();
  const { profile, hasSubmitted } = useFarmerProfile();
  const { detail, loading, error } = useCityDetail(selectedCity);
  const summary = cities.find((c) => c.city === selectedCity);

  if (!hasSubmitted) {
    return (
      <section className="page">
        <div className="card" style={{ textAlign: "center", padding: 48 }}>
          <div style={{ fontSize: "3rem", marginBottom: 16 }}>🌾</div>
          <h3>Complete the intake form first</h3>
          <p>
            The decision dashboard is personalised to your farm profile — city, crop goal, budget,
            water access, and season. Fill in the intake form to unlock your analysis.
          </p>
          <a className="primary" href="/intake" style={{ marginTop: 16, display: "inline-block" }}>
            → Start intake
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>Decision Dashboard</h1>
          <p>Personalised guidance based on your farm profile and current climate risk in {selectedCity}.</p>
        </div>
        {summary && <RiskMeter level={summary.risk_level} />}
      </div>

      {/* Farm profile summary */}
      <div className="card">
        <div className="card-header">
          <h3>Your farm profile</h3>
          <span className="tag">{selectedCity}</span>
        </div>
        <div className="input-summary">
          {[
            { label: "City", value: selectedCity },
            { label: "Desired crop", value: profile.desiredCrop || "—" },
            { label: "Budget", value: profile.budgetINR ? `₹${profile.budgetINR}` : "—" },
            { label: "Land size", value: profile.landSizeHa ? `${profile.landSizeHa} ha` : "—" },
            { label: "Water access", value: profile.waterAccess || "—" },
            { label: "Irrigation", value: profile.irrigationType || "—" },
            { label: "Season", value: profile.season || "—" },
          ].map((item) => (
            <div key={item.label} className="input-summary-item">
              <div className="label">{item.label}</div>
              <div className="value">{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {loading && (
        <div className="card" style={{ textAlign: "center", padding: 32 }}>
          <p style={{ marginBottom: 0 }}>Running climate analysis for {selectedCity}…</p>
        </div>
      )}
      {error && <p className="error">{error}</p>}

      {detail && (
        <>
          {/* Key metrics row */}
          <div className="card-grid">
            <div className="card metric-card">
              <div className="metric-label">Climate Zone</div>
              <div className="metric-value" style={{ fontSize: "1.3rem" }}>{detail.advisory.current_zone}</div>
              <p style={{ fontSize: "0.8rem", margin: 0 }}>Köppen-Geiger classification</p>
            </div>
            <div className="card metric-card">
              <div className="metric-label">CVLE Events (5 yr)</div>
              <div className={`metric-value ${(summary?.recent_cvle_count ?? 0) >= 2 ? "metric-delta negative" : "metric-delta positive"}`}>
                {summary?.recent_cvle_count ?? "—"}
              </div>
              <p style={{ fontSize: "0.8rem", margin: 0 }}>Crop viability loss events</p>
            </div>
            <div className="card metric-card">
              <div className="metric-label">Trend Slope</div>
              <div className={`metric-value ${detail.trend.trend === "deteriorating" ? "metric-delta negative" : detail.trend.trend === "improving" ? "metric-delta positive" : ""}`}>
                {detail.trend.slope.toFixed(4)}
              </div>
              <p style={{ fontSize: "0.8rem", margin: 0 }}>Per year · R² = {detail.trend.r_squared.toFixed(3)}</p>
            </div>
            <div className="card metric-card">
              <div className="metric-label">Transitions detected</div>
              <div className="metric-value">{detail.transitions.length}</div>
              <p style={{ fontSize: "0.8rem", margin: 0 }}>
                {detail.transitions[0]
                  ? `Latest: ${detail.transitions[0].from_zone} → ${detail.transitions[0].to_zone}`
                  : "No zone transitions found"}
              </p>
            </div>
          </div>

          {/* Trend */}
          <TrendStrip slope={detail.trend.slope} trend={detail.trend.trend} />

          {/* Crop recommendations */}
          <div className="section">
            <div className="section-head">
              <h2>Top crop recommendations</h2>
              <span className="tag">{detail.advisory.current_zone}</span>
            </div>
            <div className="card-grid">
              {detail.advisory.ranked_crops.slice(0, 3).map((crop, idx) => (
                <AdvisoryCard key={`${crop.crop}-${idx}`} crop={crop} rank={idx + 1} />
              ))}
            </div>
          </div>

          {/* Irrigation + Economic in 2 cols */}
          <div className="card-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
            <ActionSteps
              irrigationMethod={detail.irrigation.irrigation_method}
              sowingWindow={detail.irrigation.optimal_sow_window}
              avoidCrops={detail.irrigation.avoid_crops}
              recommendedCrops={detail.irrigation.recommended_crops}
            />

            {/* Economic protection card */}
            <div className="card">
              <div className="card-header">
                <h3>Economic protection</h3>
                <span className={`tag ${detail.eri.alert ? "risk-high" : "risk-low"}`}>
                  {detail.eri.alert ? "⚠ Alert" : "✓ Stable"}
                </span>
              </div>
              <div className="eri-row">
                <EriGauge value={detail.eri.eri} alert={detail.eri.alert} />
                <div>
                  <div className="metric-label">Exploitation Risk Index</div>
                  <div style={{ fontWeight: 700, fontSize: "1.1rem", marginTop: 4 }}>
                    {(detail.eri.eri * 100).toFixed(1)}%
                  </div>
                  {detail.eri.alert && (
                    <p style={{ fontSize: "0.8rem", color: "var(--risk-high)", marginTop: 8 }}>
                      High exploitation risk detected
                    </p>
                  )}
                </div>
              </div>
              <div className="divider" style={{ margin: "14px 0" }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <div className="metric-label" style={{ marginBottom: 4 }}>MSP</div>
                  <div style={{ fontWeight: 600 }}>
                    {detail.eri.msp_inr_per_quintal ? `₹${detail.eri.msp_inr_per_quintal}/qtl` : "N/A"}
                  </div>
                </div>
                <div>
                  <div className="metric-label" style={{ marginBottom: 4 }}>Distress floor</div>
                  <div style={{ fontWeight: 600 }}>
                    {detail.eri.distress_price_threshold ? `₹${detail.eri.distress_price_threshold}` : "N/A"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Evidence */}
          <div className="section">
            <h2>Local evidence</h2>
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

export default Dashboard;
