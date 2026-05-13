import React from "react";
import { useCityContext } from "../state/CityContext";
import { useCityDetail } from "../hooks/useCityDetail";
import ActionSteps from "../components/ActionSteps";

const RSI_INFO: Record<string, { color: string; desc: string }> = {
  low:    { color: "var(--risk-low)",    desc: "Aquifer recharges faster than depletion" },
  medium: { color: "var(--risk-medium)", desc: "Moderate stress — monitor seasonal variation" },
  high:   { color: "var(--risk-high)",   desc: "Depletion exceeds recharge — critical zone" },
};

const RsiGauge: React.FC<{ level: string }> = ({ level }) => {
  const key = level?.toLowerCase() as keyof typeof RSI_INFO;
  const info = RSI_INFO[key] ?? { color: "var(--muted)", desc: level };
  const pct = key === "low" ? 0.25 : key === "medium" ? 0.6 : 0.92;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 700, color: info.color, textTransform: "capitalize", fontSize: "1.2rem" }}>
          {level}
        </span>
        <span className={`tag risk-${key}`}>RSI Level</span>
      </div>
      <div style={{ height: 10, borderRadius: 999, background: "rgba(30,42,36,0.08)", overflow: "hidden" }}>
        <div style={{
          width: `${pct * 100}%`,
          height: "100%",
          background: info.color,
          borderRadius: 999,
          transition: "width 0.8s ease",
        }} />
      </div>
      <p style={{ margin: 0, fontSize: "0.83rem" }}>{info.desc}</p>
    </div>
  );
};

const WaterIrrigation: React.FC = () => {
  const { selectedCity } = useCityContext();
  const { detail, loading, error } = useCityDetail(selectedCity);

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>Water & Irrigation</h1>
          <p>Recharge stress index, groundwater depth, and evidence-backed irrigation guidance.</p>
        </div>
        {selectedCity && <span className="tag">{selectedCity}</span>}
      </div>

      {loading && <p>Loading irrigation strategy…</p>}
      {error && <p className="error">{error}</p>}
      {!selectedCity && <p className="muted">Select a city from the header to view water data.</p>}

      {detail && (
        <>
          {/* GW metrics */}
          <div className="card-grid">
            <div className="card">
              <div className="card-header">
                <h3>Recharge Stress Index</h3>
              </div>
              <RsiGauge level={detail.irrigation.rsi_level} />
            </div>

            <div className="card metric-card">
              <div className="metric-label">Groundwater depth</div>
              <div className="metric-value">
                {detail.irrigation.gw_depth_mbgl}
                <span style={{ fontSize: "0.9rem", fontWeight: 400, color: "var(--muted)", marginLeft: 4 }}>mbgl</span>
              </div>
              <p style={{ margin: 0, fontSize: "0.83rem" }}>Metres below ground level</p>
            </div>

            <div className="card metric-card">
              <div className="metric-label">Depletion rate</div>
              <div className="metric-value metric-delta negative" style={{ fontSize: "1.4rem" }}>
                {detail.irrigation.depletion_rate}
              </div>
              <p style={{ margin: 0, fontSize: "0.83rem" }}>Annual aquifer decline</p>
            </div>

            <div className="card metric-card">
              <div className="metric-label">Recharge efficiency</div>
              <div className="metric-value metric-delta positive" style={{ fontSize: "1.4rem" }}>
                {detail.irrigation.recharge_efficiency}
              </div>
              <p style={{ margin: 0, fontSize: "0.83rem" }}>Monsoon recharge ratio</p>
            </div>
          </div>

          {/* Irrigation guidance */}
          <div className="card-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
            <ActionSteps
              irrigationMethod={detail.irrigation.irrigation_method}
              sowingWindow={detail.irrigation.optimal_sow_window}
              avoidCrops={detail.irrigation.avoid_crops}
              recommendedCrops={detail.irrigation.recommended_crops}
            />
            <div className="card">
              <h3>Sowing guidance</h3>
              <div style={{ display: "grid", gap: 14 }}>
                <div>
                  <div style={{ fontSize: "0.78rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                    Optimal sowing window
                  </div>
                  <span className="tag" style={{ fontSize: "0.85rem" }}>
                    📅 {detail.irrigation.optimal_sow_window}
                  </span>
                </div>
                {detail.irrigation.recommended_crops?.length > 0 && (
                  <div>
                    <div style={{ fontSize: "0.78rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                      Climate-compatible crops
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {detail.irrigation.recommended_crops.map((c: string) => (
                        <span key={c} className="tag risk-low" style={{ fontSize: "0.8rem" }}>✓ {c}</span>
                      ))}
                    </div>
                  </div>
                )}
                {detail.irrigation.avoid_crops?.length > 0 && (
                  <div>
                    <div style={{ fontSize: "0.78rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                      High-risk crops to avoid
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {detail.irrigation.avoid_crops.map((c: string) => (
                        <span key={c} className="tag risk-high" style={{ fontSize: "0.8rem" }}>✗ {c}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Water conservation note */}
          <div className="card" style={{ background: "rgba(13, 117, 182, 0.06)", borderColor: "rgba(13, 117, 182, 0.2)" }}>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <span style={{ fontSize: "2rem" }}>💧</span>
              <div>
                <h4 style={{ margin: "0 0 6px" }}>Water conservation matters</h4>
                <p style={{ margin: 0, fontSize: "0.875rem" }}>
                  Aquifer depletion rates across the 10 studied cities average 0.15 m/yr. Switching
                  from flood irrigation to drip or sprinkler systems can reduce crop water consumption
                  by up to 40% while maintaining equivalent yields — critical when RSI is high.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
};

export default WaterIrrigation;
