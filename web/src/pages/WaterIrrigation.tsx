import React from "react";
import { useCityContext } from "../state/CityContext";
import { useCityDetail } from "../hooks/useCityDetail";
import ActionSteps from "../components/ActionSteps";

const WaterIrrigation: React.FC = () => {
  const { selectedCity } = useCityContext();
  const { detail, loading, error } = useCityDetail(selectedCity);

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>Water & Irrigation</h1>
          <p>Recharge stress, irrigation method, and sowing guidance.</p>
        </div>
      </div>

      {loading && <p>Loading irrigation strategy...</p>}
      {error && <p className="error">{error}</p>}

      {detail && (
        <div className="card-grid">
          <div className="card">
            <h3>RSI Level</h3>
            <p>{detail.irrigation.rsi_level}</p>
            <p>Recharge efficiency: {detail.irrigation.recharge_efficiency}</p>
          </div>
          <div className="card">
            <h3>Groundwater depth</h3>
            <p>{detail.irrigation.gw_depth_mbgl} mbgl</p>
            <p>Depletion rate: {detail.irrigation.depletion_rate}</p>
          </div>
          <ActionSteps
            irrigationMethod={detail.irrigation.irrigation_method}
            sowingWindow={detail.irrigation.optimal_sow_window}
            avoidCrops={detail.irrigation.avoid_crops}
            recommendedCrops={detail.irrigation.recommended_crops}
          />
        </div>
      )}
    </section>
  );
};

export default WaterIrrigation;
