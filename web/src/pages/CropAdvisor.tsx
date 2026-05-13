import React, { useState } from "react";
import { useCityContext } from "../state/CityContext";
import { useCityDetail } from "../hooks/useCityDetail";
import AdvisoryCard from "../components/AdvisoryCard";

const CropAdvisor: React.FC = () => {
  const { selectedCity } = useCityContext();
  const { detail, loading, error } = useCityDetail(selectedCity);
  const [filter, setFilter] = useState<"all" | "kharif" | "rabi" | "annual">("all");

  const crops = detail?.advisory.ranked_crops ?? [];
  const filtered = filter === "all" ? crops : crops.filter((c) => c.season === filter);

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>Crop Advisor</h1>
          <p>14 crops ranked by climate suitability, trajectory penalty, and zone alignment.</p>
        </div>
        {selectedCity && <span className="tag">{selectedCity} · {detail?.advisory.current_zone}</span>}
      </div>

      {/* Scoring methodology */}
      <div className="card">
        <div className="card-header">
          <h3>Ranking methodology</h3>
          <span className="tag">Step 15 pipeline output</span>
        </div>
        <div className="card-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <div>
            <div style={{ fontSize: "0.78rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>FAO GAEZ suitability</div>
            <p style={{ fontSize: "0.83rem", margin: 0 }}>Crop-specific climate and soil fit from GeoTIFF raster data.</p>
          </div>
          <div>
            <div style={{ fontSize: "0.78rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Trajectory penalty</div>
            <p style={{ fontSize: "0.83rem", margin: 0 }}>Penalises crops with worsening viability slope over the last 5 years.</p>
          </div>
          <div>
            <div style={{ fontSize: "0.78rem", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Zone alignment</div>
            <p style={{ fontSize: "0.83rem", margin: 0 }}>Bonus for crops whose ideal Köppen zone matches the city's current zone.</p>
          </div>
        </div>
      </div>

      {/* Season filter */}
      {detail && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(["all", "kharif", "rabi", "annual"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              style={{
                background: filter === s ? "var(--accent)" : "rgba(30,42,36,0.07)",
                color: filter === s ? "white" : "var(--muted)",
                border: "1px solid",
                borderColor: filter === s ? "var(--accent)" : "var(--border)",
                borderRadius: 999,
                padding: "6px 16px",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "0.85rem",
                textTransform: "capitalize",
              }}
            >
              {s === "all" ? `All (${crops.length})` : `${s.charAt(0).toUpperCase() + s.slice(1)} (${crops.filter(c => c.season === s).length})`}
            </button>
          ))}
        </div>
      )}

      {loading && <p>Loading crop advisory…</p>}
      {error && <p className="error">{error}</p>}
      {!selectedCity && <p className="muted">Select a city from the header to view crop recommendations.</p>}

      {detail && (
        <div className="card-grid">
          {filtered.map((crop, idx) => (
            <AdvisoryCard key={`${crop.crop}-${idx}`} crop={crop} rank={idx + 1} />
          ))}
        </div>
      )}

      {detail && filtered.length === 0 && (
        <div className="card muted">No {filter} crops in the ranking for this city.</div>
      )}
    </section>
  );
};

export default CropAdvisor;
