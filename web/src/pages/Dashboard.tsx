import React from "react";
import { useCityContext } from "../state/CityContext";
import { useCityDetail } from "../hooks/useCityDetail";
import { useFarmerProfile } from "../state/FarmerProfileContext";
import RiskMeter from "../components/RiskMeter";
import AdvisoryCard from "../components/AdvisoryCard";
import ActionSteps from "../components/ActionSteps";
import EvidenceCard from "../components/EvidenceCard";
import TrendStrip from "../components/TrendStrip";
import { useLanguage } from "../state/LanguageContext";
import { t } from "../i18n";

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
  const { lang } = useLanguage();

  if (!hasSubmitted) {
    return (
      <section className="page">
        <div className="card" style={{ textAlign: "center", padding: 48 }}>
          <div style={{ fontSize: "3rem", marginBottom: 16 }}>🌾</div>
          <h3>{t(lang, 'dashboard.intake_required_title')}</h3>
          <p>{t(lang, 'dashboard.intake_required_desc')}</p>
          <a className="primary" href="/intake" style={{ marginTop: 16, display: "inline-block" }}>
            → {t(lang, 'dashboard.intake_required_cta')}
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>{t(lang, 'dashboard.title')}</h1>
          <p>{t(lang, 'dashboard.desc', { city: selectedCity })}</p>
        </div>
        {summary && <RiskMeter level={summary.risk_level} />}
      </div>

      {/* Farm profile summary */}
      <div className="card">
        <div className="card-header">
          <h3>{t(lang, 'dashboard.profile')}</h3>
          <span className="tag">{selectedCity}</span>
        </div>
        <div className="input-summary">
          {[
            { label: t(lang, "nav.city"), value: selectedCity },
            { label: t(lang, "dashboard.desired_crop"), value: profile.desiredCrop || "—" },
            { label: t(lang, "dashboard.budget"), value: profile.budgetINR ? `₹${profile.budgetINR}` : "—" },
            { label: t(lang, "dashboard.land_size"), value: profile.landSizeHa ? `${profile.landSizeHa} ha` : "—" },
            { label: t(lang, "dashboard.water_access"), value: profile.waterAccess || "—" },
            { label: t(lang, "dashboard.irrigation"), value: profile.irrigationType || "—" },
            { label: t(lang, "dashboard.season"), value: profile.season || "—" },
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
          <p style={{ marginBottom: 0 }}>{t(lang, "dashboard.running", { city: selectedCity })}</p>
        </div>
      )}
      {error && <p className="error">{error}</p>}

      {detail && (
        <>
          {/* Key metrics row */}
          <div className="card-grid">
            <div className="card metric-card">
              <div className="metric-label">{t(lang, "dashboard.climate_zone")}</div>
              <div className="metric-value" style={{ fontSize: "1.3rem" }}>{detail.advisory.current_zone}</div>
              <p style={{ fontSize: "0.8rem", margin: 0 }}>{t(lang, "dashboard.koppen")}</p>
            </div>
            <div className="card metric-card">
              <div className="metric-label">{t(lang, "dashboard.cvle_5yr")}</div>
              <div className={`metric-value ${(summary?.recent_cvle_count ?? 0) >= 2 ? "metric-delta negative" : "metric-delta positive"}`}>
                {summary?.recent_cvle_count ?? "—"}
              </div>
              <p style={{ fontSize: "0.8rem", margin: 0 }}>{t(lang, "dashboard.cvle_desc")}</p>
            </div>
            <div className="card metric-card">
              <div className="metric-label">{t(lang, "dashboard.trend_slope")}</div>
              <div className={`metric-value ${detail.trend.trend === "deteriorating" ? "metric-delta negative" : detail.trend.trend === "improving" ? "metric-delta positive" : ""}`}>
                {detail.trend.slope.toFixed(4)}
              </div>
              <p style={{ fontSize: "0.8rem", margin: 0 }}>{t(lang, "dashboard.per_year_r2", { r2: detail.trend.r_squared.toFixed(3) })}</p>
            </div>
            <div className="card metric-card">
              <div className="metric-label">{t(lang, "dashboard.transitions")}</div>
              <div className="metric-value">{detail.transitions.length}</div>
              <p style={{ fontSize: "0.8rem", margin: 0 }}>
                {detail.transitions[0]
                  ? `${t(lang, "dashboard.latest")}: ${detail.transitions[0].from_zone} → ${detail.transitions[0].to_zone}`
                  : t(lang, "dashboard.no_transitions")}
              </p>
            </div>
          </div>

          {/* Trend */}
          <TrendStrip slope={detail.trend.slope} trend={detail.trend.trend} />

          {/* Crop recommendations */}
          <div className="section">
            <div className="section-head">
              <h2>{t(lang, "dashboard.top_recommendations")}</h2>
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
                <h3>{t(lang, "dashboard.economic_protection")}</h3>
                <span className={`tag ${detail.eri.alert ? "risk-high" : "risk-low"}`}>
                  {detail.eri.alert ? t(lang, 'eri.alert') : t(lang, 'eri.ok')}
                </span>
              </div>
              <div className="eri-row">
                <EriGauge value={detail.eri.eri} alert={detail.eri.alert} />
                <div>
                  <div className="metric-label">{t(lang, "dashboard.eri")}</div>
                  <div style={{ fontWeight: 700, fontSize: "1.1rem", marginTop: 4 }}>
                    {(detail.eri.eri * 100).toFixed(1)}%
                  </div>
                  {detail.eri.alert && (
                    <p style={{ fontSize: "0.8rem", color: "var(--risk-high)", marginTop: 8 }}>
                      {t(lang, "dashboard.high_eri")}
                    </p>
                  )}
                </div>
              </div>
              <div className="divider" style={{ margin: "14px 0" }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <div className="metric-label" style={{ marginBottom: 4 }}>{t(lang, "dashboard.msp")}</div>
                  <div style={{ fontWeight: 600 }}>
                    {detail.eri.msp_inr_per_quintal ? `₹${detail.eri.msp_inr_per_quintal}/qtl` : "N/A"}
                  </div>
                </div>
                <div>
                  <div className="metric-label" style={{ marginBottom: 4 }}>{t(lang, "dashboard.distress_floor")}</div>
                  <div style={{ fontWeight: 600 }}>
                    {detail.eri.distress_price_threshold ? `₹${detail.eri.distress_price_threshold}` : "N/A"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Evidence */}
          <div className="section">
            <h2>{t(lang, "dashboard.local_evidence")}</h2>
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
