import React, { useState } from "react";
import { useCityContext } from "../state/CityContext";
import { useCityDetail } from "../hooks/useCityDetail";
import { useLanguage } from "../state/LanguageContext";
import { t } from "../i18n";
import { capitalizeWords } from "../utils/text";

const Reports: React.FC = () => {
  const { selectedCity, cities } = useCityContext();
  const { detail, loading, error } = useCityDetail(selectedCity);
  const [downloaded, setDownloaded] = useState(false);
  const { lang } = useLanguage();

  const handleDownload = () => {
    if (!detail) return;
    const report = {
      generated: new Date().toISOString(),
      city: selectedCity,
      pipeline_version: "VegShift v1.0",
      advisory: detail.advisory,
      irrigation: detail.irrigation,
      eri: detail.eri,
      transitions: detail.transitions,
      trend: detail.trend,
      shap_drivers: detail.shap,
      evidence: detail.evidence,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `vegshift-${selectedCity.toLowerCase().replace(/\s+/g, "-")}-report.json`;
    link.click();
    URL.revokeObjectURL(url);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 3000);
  };

  const handleDownloadSummary = () => {
    const rows = cities.map((c) => ({
      city: c.city,
      risk_level: c.risk_level,
      zone: c.current_zone,
      cvle_5yr: c.recent_cvle_count,
      top_crop: c.top_crops[0]?.crop ? capitalizeWords(c.top_crops[0]?.crop) : "—",
    }));
    const header = "City,Risk Level,Köppen Zone,CVLE (5yr),Top Crop\n";
    const csv = header + rows.map((r) => Object.values(r).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "vegshift-all-cities-summary.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>{t(lang, 'nav.reports')}</h1>
          <p>{t(lang, "reports.desc")}</p>
        </div>
      </div>

      {/* Export options */}
      <div className="card-grid">
        {/* All-cities CSV */}
        <div className="card">
          <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>📊</div>
          <h3>{t(lang, "reports.all_summary")}</h3>
          <p style={{ fontSize: "0.875rem" }}>
            {t(lang, "reports.all_summary_desc")}
          </p>
          <button
            type="button"
            className="primary"
            onClick={handleDownloadSummary}
            style={{ marginTop: 12 }}
          >
            {t(lang, 'download.csv')}
          </button>
        </div>

        {/* City JSON */}
        <div className="card">
          <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🌆</div>
          <h3>{selectedCity ? t(lang, "reports.city_full", { city: selectedCity }) : t(lang, "reports.city_detail")}</h3>
          <p style={{ fontSize: "0.875rem" }}>
            {t(lang, "reports.city_desc")}
          </p>
          {!selectedCity && (
            <p style={{ fontSize: "0.8rem", color: "var(--risk-medium)", marginTop: 8 }}>
              {t(lang, 'select.city.header_hint')}
            </p>
          )}
          {loading && <p style={{ fontSize: "0.875rem" }}>{t(lang, "reports.preparing")}</p>}
          {error && <p className="error">{error}</p>}
          <button
            type="button"
            className="primary"
            onClick={handleDownload}
            disabled={!detail || loading}
            style={{ marginTop: 12 }}
          >
            {downloaded ? t(lang, 'downloaded') : t(lang, 'download.json')}
          </button>
        </div>

        {/* Pipeline info */}
        <div className="card">
          <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🧬</div>
          <h3>{t(lang, "reports.pipeline_docs")}</h3>
          <p style={{ fontSize: "0.875rem" }}>
            {t(lang, "reports.pipeline_desc")}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <span className="tag">17 steps</span>
            <span className="tag">250 rows master dataset</span>
            <span className="tag">3 raw datasets</span>
          </div>
        </div>
      </div>

      {/* Report preview */}
      {detail && selectedCity && (
        <div className="card">
          <div className="card-header">
            <h3>{t(lang, "reports.preview", { city: selectedCity })}</h3>
            <span className="tag">{t(lang, "reports.json")}</span>
          </div>
          <div style={{
            background: "rgba(30, 42, 36, 0.04)",
            borderRadius: 12,
            padding: "16px 20px",
            fontFamily: "monospace",
            fontSize: "0.8rem",
            color: "var(--muted)",
            lineHeight: 1.6,
            border: "1px solid var(--border)",
          }}>
            <div><span style={{ color: "var(--accent-dark)" }}>city:</span> "{selectedCity}"</div>
            <div><span style={{ color: "var(--accent-dark)" }}>zone:</span> "{detail.advisory.current_zone}"</div>
            <div><span style={{ color: "var(--accent-dark)" }}>trend:</span> "{detail.trend.trend}" (slope: {detail.trend.slope.toFixed(4)})</div>
            <div><span style={{ color: "var(--accent-dark)" }}>eri:</span> {(detail.eri.eri * 100).toFixed(1)}% {detail.eri.alert ? "⚠ ALERT" : "✓"}</div>
            <div><span style={{ color: "var(--accent-dark)" }}>transitions:</span> {detail.transitions.length} detected</div>
            <div><span style={{ color: "var(--accent-dark)" }}>top_crops:</span> [{detail.advisory.ranked_crops.slice(0, 3).map(c => `"${c.crop}"`).join(", ")}]</div>
            <div><span style={{ color: "var(--accent-dark)" }}>shap_drivers:</span> {detail.shap.city_top.length} features ranked</div>
            <div><span style={{ color: "var(--accent-dark)" }}>evidence:</span> {detail.evidence.length} citations</div>
          </div>
        </div>
      )}

    </section>
  );
};

export default Reports;
