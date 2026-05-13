import React from "react";
import { useCityContext } from "../state/CityContext";
import { useCityDetail } from "../hooks/useCityDetail";
import AdvisoryCard from "../components/AdvisoryCard";

const CropAdvisor: React.FC = () => {
  const { selectedCity } = useCityContext();
  const { detail, loading, error } = useCityDetail(selectedCity);

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>Crop Advisor</h1>
          <p>Ranked crops based on climate fit, water stress, and 5-year trajectory.</p>
        </div>
      </div>

      {loading && <p>Loading advisory...</p>}
      {error && <p className="error">{error}</p>}

      {detail && (
        <div className="card-grid">
          {detail.advisory.ranked_crops.map((crop, idx) => (
            <AdvisoryCard key={`${crop.crop}-${idx}`} crop={crop} rank={idx + 1} />
          ))}
        </div>
      )}
    </section>
  );
};

export default CropAdvisor;
