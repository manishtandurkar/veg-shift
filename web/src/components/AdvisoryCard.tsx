import React from "react";
import type { CropScore } from "../api/types";

const AdvisoryCard: React.FC<{ crop: CropScore; rank: number }> = ({ crop, rank }) => {
  return (
    <div className={`card advisory-card ${crop.zone_match ? "zone-match" : "zone-mismatch"}`}>
      <div className="advisory-head">
        <span className="rank">#{rank}</span>
        <h4>{crop.crop}</h4>
      </div>
      <div className="advisory-body">
        <p>Score: {crop.score}</p>
        <p>Season: {crop.season}</p>
        <p>{crop.zone_match ? "Zone aligned" : "Zone mismatch"}</p>
      </div>
    </div>
  );
};

export default AdvisoryCard;
