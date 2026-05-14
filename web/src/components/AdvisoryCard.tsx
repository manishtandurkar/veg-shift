import React, { useState } from "react";
import type { CropScore, ClimateContext } from "../api/types";
import { useLanguage } from "../state/LanguageContext";
import { t } from "../i18n";

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

interface BreakdownRowProps {
  label: string;
  deduction: number;
  explanation: string;
}

function BreakdownRow({ label, deduction, explanation }: BreakdownRowProps) {
  const isOk = deduction === 0;
  const color = isOk ? "var(--risk-low)" : deduction > -10 ? "var(--risk-medium)" : "var(--risk-high)";
  return (
    <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: 8, marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
        <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
        <span style={{ fontSize: "0.85rem", fontWeight: 700, color }}>
          {isOk ? "✓ 0" : `${deduction.toFixed(1)}`}
        </span>
      </div>
      <p style={{ fontSize: "0.78rem", margin: 0, color: "var(--fg)", lineHeight: 1.4 }}>{explanation}</p>
    </div>
  );
}

interface AdvisoryCardProps {
  crop: CropScore;
  rank: number;
  climateContext?: ClimateContext;
  currentZone?: string;
}

const AdvisoryCard: React.FC<AdvisoryCardProps> = ({ crop, rank, climateContext, currentZone }) => {
  const [expanded, setExpanded] = useState(false);
  const rankClass = rank <= 3 ? RANK_CLASSES[rank - 1] : "";
  const scorePct = Math.min(1, Math.max(0, crop.score / 100));
  const scoreColor = scorePct >= 0.65 ? "var(--risk-low)" : scorePct >= 0.4 ? "var(--risk-medium)" : "var(--risk-high)";
  const { lang } = useLanguage();

  const bd = crop.breakdown;
  const spec = crop.crop_spec;
  const ctx = climateContext;

  function zoneExplain() {
    if (!bd || !spec) return "";
    const zone = currentZone ?? "?";
    if (bd.zone === 0) return t(lang, "advisory.breakdown.zone_ok", { zone });
    return t(lang, "advisory.breakdown.zone_bad", { zone, zones: spec.zones.join(", ") });
  }

  function tempExplain() {
    if (!bd || !spec || !ctx) return "";
    if (bd.temp === 0) return t(lang, "advisory.breakdown.temp_ok", { tmax: String(ctx.t_max), cropmax: String(spec.max_temp) });
    return t(lang, "advisory.breakdown.temp_bad", { tmax: String(ctx.t_max), cropmax: String(spec.max_temp) });
  }

  function waterExplain() {
    if (!bd || !spec || !ctx) return "";
    if (bd.water === 0) return t(lang, "advisory.breakdown.water_ok", { rain: String(ctx.rainfall_mm), req: String(spec.water_req) });
    return t(lang, "advisory.breakdown.water_bad", { rain: String(ctx.rainfall_mm), req: String(spec.water_req) });
  }

  function gwExplain() {
    if (!bd || !ctx) return "";
    if (bd.gw === 0) return t(lang, "advisory.breakdown.gw_ok");
    return t(lang, "advisory.breakdown.gw_bad", { depth: String(ctx.gw_depth_mbgl) });
  }

  function trajExplain() {
    if (!bd) return "";
    if (bd.trajectory === 0) return t(lang, "advisory.breakdown.traj_ok");
    return t(lang, "advisory.breakdown.traj_bad");
  }

  const hasBreakdown = !!bd;

  return (
    <div
      className={`card advisory-card ${crop.zone_match ? "zone-match" : "zone-mismatch"}`}
      style={{ cursor: hasBreakdown ? "pointer" : "default" }}
      onClick={() => hasBreakdown && setExpanded((e) => !e)}
      role={hasBreakdown ? "button" : undefined}
      tabIndex={hasBreakdown ? 0 : undefined}
      onKeyDown={(e) => { if (hasBreakdown && (e.key === "Enter" || e.key === " ")) setExpanded((v) => !v); }}
    >
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
              {crop.zone_match ? t(lang, "advisory.zone_match") : t(lang, "advisory.zone_mismatch")}
            </span>
          </div>
        </div>
        {hasBreakdown && (
          <div style={{ fontSize: "0.7rem", color: "var(--accent)", fontWeight: 600, marginLeft: 4, flexShrink: 0 }}>
            {expanded ? "▲" : "▼"}
          </div>
        )}
      </div>

      <div className="score-bar-row">
        <div className="score-bar-label">
          <span>{t(lang, "advisory.viability")}</span>
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

      {hasBreakdown && (
        <div style={{ fontSize: "0.72rem", color: "var(--accent)", marginTop: 4, fontWeight: 500 }}>
          {t(lang, "advisory.why")}
        </div>
      )}

      {expanded && bd && (
        <div
          style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 12 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ fontSize: "0.8rem", fontWeight: 700, marginBottom: 10, color: "var(--fg)" }}>
            {t(lang, "advisory.breakdown.title")}
          </div>

          {ctx && (
            <div style={{ background: "rgba(30,42,36,0.06)", borderRadius: 6, padding: "6px 10px", marginBottom: 10, fontSize: "0.74rem", color: "var(--muted)", display: "flex", gap: 12, flexWrap: "wrap" }}>
              <span>🌡 {ctx.t_max}°C max</span>
              <span>🌧 {ctx.rainfall_mm}mm/yr</span>
              <span>💧 {ctx.gw_depth_mbgl}m depth</span>
            </div>
          )}

          <BreakdownRow
            label={t(lang, "advisory.breakdown.zone")}
            deduction={bd.zone}
            explanation={zoneExplain()}
          />
          <BreakdownRow
            label={t(lang, "advisory.breakdown.temp")}
            deduction={bd.temp}
            explanation={tempExplain()}
          />
          <BreakdownRow
            label={t(lang, "advisory.breakdown.water")}
            deduction={bd.water}
            explanation={waterExplain()}
          />
          <BreakdownRow
            label={t(lang, "advisory.breakdown.gw")}
            deduction={bd.gw}
            explanation={gwExplain()}
          />
          <BreakdownRow
            label={t(lang, "advisory.breakdown.trajectory")}
            deduction={bd.trajectory}
            explanation={trajExplain()}
          />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4, paddingTop: 6, borderTop: "1px solid var(--border)" }}>
            <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Total deductions</span>
            <strong style={{ fontSize: "0.9rem", color: scoreColor }}>
              {(bd.zone + bd.temp + bd.water + bd.gw + bd.trajectory).toFixed(1)} → {crop.score.toFixed(0)}
            </strong>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvisoryCard;
