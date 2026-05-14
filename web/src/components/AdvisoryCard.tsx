import React from "react";
import type { CropScore } from "../api/types";

const RANK_CLASSES = ["gold", "silver", "bronze"];

const CROP_ICONS: Record<string, string> = {
  Wheat: "🌾", Rice: "🌾", Maize: "🌽", Corn: "🌽",
  Cotton: "🪴", Sugarcane: "🌿", Soybean: "🫘", Groundnut: "🥜",
  Tomato: "🍅", Onion: "🧅", Potato: "🥔", Sorghum: "🌾",
  Millet: "🌾", Bajra: "🌾", Jowar: "🌾",
};

function cropIcon(name: string): string {
  const key = name.toLowerCase();
  for (const [k, v] of Object.entries(CROP_ICONS)) {
    if (key.includes(k.toLowerCase())) return v;
  }
  return "🌱";
}

const AdvisoryCard: React.FC<{ crop: CropScore; rank: number }> = ({ crop, rank }) => {
  const rankClass = rank <= 3 ? RANK_CLASSES[rank - 1] : "";
  const scorePct = Math.min(1, Math.max(0, crop.score / 100));
  const scoreColor = scorePct >= 0.65 ? "var(--risk-low)" : scorePct >= 0.4 ? "var(--risk-medium)" : "var(--risk-high)";

  return (
    <div className={`card advisory-card ${crop.zone_match ? "zone-match" : "zone-mismatch"}`}>
      <div className="advisory-head">
        <div className={`rank-badge ${rankClass}`}>#{rank}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: "1.1rem" }}>{cropIcon(crop.crop)}</span>
            <h4 style={{ margin: 0, fontSize: "0.98rem", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {crop.crop}
            </h4>
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 4 }}>
            <span className="tag" style={{ fontSize: "0.68rem", padding: "2px 7px", textTransform: "capitalize" }}>{crop.season}</span>
            <span className={`tag ${crop.zone_match ? "risk-low" : "risk-high"}`} style={{ fontSize: "0.68rem", padding: "2px 7px" }}>
              {crop.zone_match ? "✓ Zone match" : "⚠ Mismatch"}
            </span>
          </div>
        </div>
      </div>

      <div className="score-bar-row">
        <div className="score-bar-label">
          <span>Viability score</span>
          <strong style={{ color: scoreColor }}>{(scorePct * 100).toFixed(0)}%</strong>
        </div>
        <div className="score-bar-track">
          <div
            className="score-bar-fill"
            style={{
              "--bar-scale": scorePct,
              "--delay": `${rank * 0.08}s`,
            } as React.CSSProperties}
          />
        </div>
      </div>
    </div>
  );
};

export default AdvisoryCard;
