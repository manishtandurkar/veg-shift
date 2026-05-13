import React from "react";
import { useCityContext } from "../state/CityContext";
import { useCityDetail } from "../hooks/useCityDetail";

const EconomicProtection: React.FC = () => {
  const { selectedCity } = useCityContext();
  const { detail, loading, error } = useCityDetail(selectedCity);

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>Economic Protection</h1>
          <p>MSP price floors, exploitation risk index, and government scheme discovery.</p>
        </div>
        {selectedCity && <span className="tag">{selectedCity}</span>}
      </div>

      {loading && <p>Loading economic data…</p>}
      {error && <p className="error">{error}</p>}
      {!selectedCity && <p className="muted">Select a city from the header to view protection data.</p>}

      {detail && (
        <>
          {/* Alert banner */}
          {detail.eri.alert && (
            <div className="card" style={{
              background: "rgba(178, 58, 36, 0.07)",
              borderColor: "rgba(178, 58, 36, 0.3)",
              display: "flex", gap: 14, alignItems: "center",
            }}>
              <span style={{ fontSize: "2rem" }}>⚠️</span>
              <div>
                <h4 style={{ margin: "0 0 4px", color: "var(--risk-high)" }}>High exploitation risk detected</h4>
                <p style={{ margin: 0, fontSize: "0.875rem" }}>
                  The ERI score for {selectedCity} exceeds the alert threshold. Farmers in this region
                  may be vulnerable to below-MSP price exploitation during distress seasons.
                </p>
              </div>
            </div>
          )}

          {/* Key numbers */}
          <div className="card-grid">
            <div className="card metric-card">
              <div className="metric-label">Exploitation Risk Index</div>
              <div className={`metric-value ${detail.eri.alert ? "metric-delta negative" : "metric-delta positive"}`}>
                {(detail.eri.eri * 100).toFixed(1)}%
              </div>
              <p style={{ fontSize: "0.8rem", margin: 0 }}>
                {detail.eri.alert ? "Alert: above threshold" : "Within safe range"}
              </p>
            </div>
            <div className="card metric-card">
              <div className="metric-label">Primary crop</div>
              <div className="metric-value" style={{ fontSize: "1.3rem", textTransform: "capitalize" }}>
                {detail.eri.primary_crop ?? "—"}
              </div>
              <p style={{ fontSize: "0.8rem", margin: 0 }}>Based on advisory ranking</p>
            </div>
            <div className="card metric-card">
              <div className="metric-label">MSP (per quintal)</div>
              <div className="metric-value" style={{ fontSize: "1.4rem" }}>
                {detail.eri.msp_inr_per_quintal ? `₹${detail.eri.msp_inr_per_quintal}` : "N/A"}
              </div>
              <p style={{ fontSize: "0.8rem", margin: 0 }}>Government minimum support price</p>
            </div>
            <div className="card metric-card">
              <div className="metric-label">Distress floor</div>
              <div className="metric-value metric-delta negative" style={{ fontSize: "1.4rem" }}>
                {detail.eri.distress_price_threshold ? `₹${detail.eri.distress_price_threshold}` : "N/A"}
              </div>
              <p style={{ fontSize: "0.8rem", margin: 0 }}>Threshold below which to alert</p>
            </div>
          </div>

          {/* Schemes + crops */}
          <div className="card-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
            <div className="card">
              <h3>Government schemes</h3>
              <div style={{ display: "grid", gap: 12 }}>
                {detail.eri.procurement_center && (
                  <div style={{ padding: "12px 16px", background: "rgba(30,42,36,0.05)", borderRadius: 12, border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                      Procurement center
                    </div>
                    <div style={{ fontWeight: 600 }}>{detail.eri.procurement_center}</div>
                  </div>
                )}
                {detail.eri.crop_insurance_scheme && (
                  <div style={{ padding: "12px 16px", background: "rgba(30,42,36,0.05)", borderRadius: 12, border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                      Insurance scheme
                    </div>
                    <div style={{ fontWeight: 600 }}>{detail.eri.crop_insurance_scheme}</div>
                  </div>
                )}
              </div>
            </div>

            {detail.eri.alternative_crops?.length > 0 && (
              <div className="card">
                <h3>Lower-risk alternatives</h3>
                <p style={{ fontSize: "0.83rem", marginBottom: 14 }}>
                  Crops with lower exploitation risk scores and better zone alignment:
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {detail.eri.alternative_crops.map((crop: string) => (
                    <span key={crop} className="tag risk-low" style={{ fontSize: "0.83rem" }}>
                      ✓ {crop}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Info card */}
          <div className="card" style={{ background: "rgba(245, 158, 11, 0.06)", borderColor: "rgba(245, 158, 11, 0.2)" }}>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <span style={{ fontSize: "2rem" }}>📜</span>
              <div>
                <h4 style={{ margin: "0 0 6px" }}>About the Exploitation Risk Index (ERI)</h4>
                <p style={{ margin: 0, fontSize: "0.875rem" }}>
                  ERI combines three signals: (1) how far the market price has fallen below MSP,
                  (2) the severity of the dual-deficit water stress, and (3) the trajectory of CVLE
                  events in the last 5 years. A score above 0.65 triggers an alert — farmers should
                  contact the nearest procurement center before selling.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
};

export default EconomicProtection;
