import React from "react";
import type { RiskLevel } from "../api/types";

const RISK_LABELS: Record<RiskLevel, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const RiskMeter: React.FC<{ level: RiskLevel }> = ({ level }) => {
  return (
    <div className={`risk-meter risk-${level}`}>
      <div className="risk-bar" />
      <div className="risk-text">
        <span>Risk Level</span>
        <strong>{RISK_LABELS[level]}</strong>
      </div>
    </div>
  );
};

export default RiskMeter;
