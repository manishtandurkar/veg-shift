import React from "react";
import { useCityContext } from "../state/CityContext";
import { useCityDetail } from "../hooks/useCityDetail";

const EconomicProtection: React.FC = () => {
  const { selectedCity } = useCityContext();
  const { detail, loading, error } = useCityDetail(selectedCity);

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>Economic Protection</h1>
          <p>Price floor guidance and exploitation risk signals.</p>
        </div>
      </div>

      {loading && <p>Loading economic protection...</p>}
      {error && <p className="error">{error}</p>}

      {detail && (
        <div className="card-grid">
          <div className="card">
            <h3>Exploitation Risk Index</h3>
            <p>ERI score: {detail.eri.eri.toFixed(3)}</p>
            <p>{detail.eri.alert ? "Alert threshold exceeded" : "Within normal range"}</p>
          </div>
          <div className="card">
            <h3>Primary crop MSP</h3>
            <p>{detail.eri.primary_crop}</p>
            <p>MSP: {detail.eri.msp_inr_per_quintal ?? "N/A"}</p>
            <p>Distress threshold: {detail.eri.distress_price_threshold ?? "N/A"}</p>
          </div>
          <div className="card">
            <h3>Protection links</h3>
            <p>{detail.eri.procurement_center}</p>
            <p>{detail.eri.crop_insurance_scheme}</p>
          </div>
          <div className="card">
            <h3>Alternative crops</h3>
            <p>{detail.eri.alternative_crops.join(", ")}</p>
          </div>
        </div>
      )}
    </section>
  );
};

export default EconomicProtection;
