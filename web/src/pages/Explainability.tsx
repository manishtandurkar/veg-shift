import React from "react";
import { useCityContext } from "../state/CityContext";
import { useCityDetail } from "../hooks/useCityDetail";

interface ShapItem { feature: string; score: number; }

const FEATURE_LABELS: Record<string, string> = {
  gdd_annual: "Growing Degree Days",
  monsoon_fraction: "Monsoon Fraction",
  water_deficit: "Water Deficit",
  groundwater_depletion: "GW Depletion Rate",
  recharge_efficiency: "Recharge Efficiency",
  crop_water_deficit: "Crop Water Deficit",
  late_monsoon_fraction: "Late Monsoon",
  koppen_zone: "Köppen Zone",
  cvle_count: "CVLE Count",
  temp_max_annual: "Max Temperature",
  temp_min_annual: "Min Temperature",
  precip_annual: "Annual Precipitation",
};

function prettyFeature(raw: string): string {
  return FEATURE_LABELS[raw] ?? raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const ShapBar: React.FC<{ items: ShapItem[]; delay?: number }> = ({ items, delay = 0 }) => {
  const maxScore = Math.max(...items.map((i) => Math.abs(i.score)));

  return (
    <div className="shap-list">
      {items.map((item, idx) => {
        const pct = maxScore > 0 ? Math.abs(item.score) / maxScore : 0;
        const isPositive = item.score >= 0;
        return (
          <div
            key={item.feature}
            className="shap-row"
            style={{ animationDelay: `${delay + idx * 0.05}s` }}
          >
            <div className="shap-header">
              <span className="shap-feature">{prettyFeature(item.feature)}</span>
              <span className="shap-score">
                {isPositive ? "+" : ""}{item.score.toFixed(4)}
              </span>
            </div>
            <div className="shap-bar-track">
              <div
                className={`shap-bar-fill ${isPositive ? "positive" : "negative"}`}
                style={{
                  "--bar-scale": pct,
                  animationDelay: `${delay + idx * 0.05}s`,
                } as React.CSSProperties}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const Explainability: React.FC = () => {
  const { selectedCity } = useCityContext();
  const { detail, loading, error } = useCityDetail(selectedCity);

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>Model Explainability</h1>
          <p>SHAP-based feature importance showing which climate signals drive the risk forecast.</p>
        </div>
        {selectedCity && <span className="tag">{selectedCity}</span>}
      </div>

      {/* Methodology card */}
      <div className="card">
        <div className="card-header">
          <h3>How we explain the model</h3>
          <span className="tag">SHAP TreeExplainer</span>
        </div>
        <div className="card-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <div>
            <div style={{ fontSize: "0.78rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Model</div>
            <div style={{ fontWeight: 600 }}>Temporal Fusion Transformer</div>
            <div style={{ fontSize: "0.82rem", color: "var(--muted)" }}>5-year encoder · quantile output</div>
          </div>
          <div>
            <div style={{ fontSize: "0.78rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Explainer</div>
            <div style={{ fontWeight: 600 }}>SHAP TreeExplainer</div>
            <div style={{ fontSize: "0.82rem", color: "var(--muted)" }}>Random Forest surrogate</div>
          </div>
          <div>
            <div style={{ fontSize: "0.78rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Bar length</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 28, height: 8, borderRadius: 4, background: "linear-gradient(90deg, var(--accent-dark), var(--accent))" }} />
                <span style={{ fontSize: "0.82rem" }}>Mean |SHAP| — larger = stronger driver</span>
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--muted)", lineHeight: 1.4 }}>
                Values are mean absolute SHAP across all years for this city.
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading && <p>Loading explainability data...</p>}
      {error && <p className="error">{error}</p>}
      {!selectedCity && <p className="muted">Select a city from the header or complete the intake form.</p>}

      {detail && (
        <>
          <div className="card-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
            <div className="card">
              <div className="card-header">
                <h3>City-level drivers</h3>
                <span className="tag">{selectedCity}</span>
              </div>
              <p style={{ fontSize: "0.83rem", marginBottom: 16 }}>
                Top features influencing the CVLE risk score specifically for {selectedCity}.
              </p>
              <ShapBar items={detail.shap.city_top} delay={0.1} />
            </div>

            <div className="card">
              <div className="card-header">
                <h3>Global drivers</h3>
                <span className="tag">All 10 cities</span>
              </div>
              <p style={{ fontSize: "0.83rem", marginBottom: 16 }}>
                Features with the highest mean absolute SHAP value across all cities.
              </p>
              <ShapBar items={detail.shap.global_top} delay={0.2} />
            </div>
          </div>

          {/* TFT attention weights if available */}
          <div className="card">
            <div className="card-header">
              <h3>Interpretation guide</h3>
            </div>
            <div className="card-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <div>
                <h4 style={{ fontSize: "0.9rem" }}>What SHAP measures</h4>
                <p style={{ fontSize: "0.83rem" }}>
                  Each bar shows the mean absolute SHAP value — how much a feature drives the
                  prediction on average across all years. Longer bar = stronger overall influence.
                </p>
              </div>
              <div>
                <h4 style={{ fontSize: "0.9rem" }}>Dual-deficit trigger</h4>
                <p style={{ fontSize: "0.83rem" }}>
                  A CVLE fires when atmospheric water deficit {">"} 40% AND groundwater recharge {"<"} 30%
                  persist for 2+ consecutive years. These two features dominate SHAP scores.
                </p>
              </div>
              <div>
                <h4 style={{ fontSize: "0.9rem" }}>City vs. global</h4>
                <p style={{ fontSize: "0.83rem" }}>
                  Global drivers average across all 10 cities. City-level drivers may differ because
                  each city has a unique climate trajectory and groundwater regime.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
};

export default Explainability;
