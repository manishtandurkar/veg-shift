import React from "react";

interface TrendStripProps {
  slope: number;
  trend: string;
}

const TrendStrip: React.FC<TrendStripProps> = ({ slope, trend }) => {
  const label = trend === "deteriorating" ? "Deteriorating" : trend === "improving" ? "Improving" : "Stable";
  return (
    <div className={`trend-strip ${trend}`}>
      <span>{label}</span>
      <strong>{slope >= 0 ? "+" : ""}{slope.toFixed(4)} / yr</strong>
    </div>
  );
};

export default TrendStrip;
