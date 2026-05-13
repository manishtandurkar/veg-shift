import React from "react";

interface TrendStripProps {
  slope: number;
  trend: string;
}

const CONFIG = {
  deteriorating: { icon: "↘", label: "Deteriorating", desc: "Viability declining over time" },
  improving:     { icon: "↗", label: "Improving",     desc: "Viability recovering" },
  stable:        { icon: "→", label: "Stable",         desc: "No significant trend detected" },
} as const;

const TrendStrip: React.FC<TrendStripProps> = ({ slope, trend }) => {
  const cfg = CONFIG[trend as keyof typeof CONFIG] ?? CONFIG.stable;

  return (
    <div className={`trend-strip ${trend}`}>
      <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: "1.35rem", lineHeight: 1 }}>{cfg.icon}</span>
        <span>
          <strong>{cfg.label}</strong>
          <span style={{ fontWeight: 400, opacity: 0.75, marginLeft: 6, fontSize: "0.82rem" }}>
            — {cfg.desc}
          </span>
        </span>
      </span>
      <span style={{ fontVariantNumeric: "tabular-nums", fontSize: "0.875rem", fontWeight: 700 }}>
        {slope >= 0 ? "+" : ""}{slope.toFixed(4)}<span style={{ fontWeight: 400, opacity: 0.7, fontSize: "0.78rem", marginLeft: 3 }}>/yr</span>
      </span>
    </div>
  );
};

export default TrendStrip;
