import React from "react";
import { useCityContext } from "../state/CityContext";
import { useCityDetail } from "../hooks/useCityDetail";
import { useFarmerProfile } from "../state/FarmerProfileContext";
import RiskMeter from "../components/RiskMeter";
import AdvisoryCard from "../components/AdvisoryCard";
import ActionSteps from "../components/ActionSteps";
import EvidenceCard from "../components/EvidenceCard";

const Dashboard: React.FC = () => {
  const { selectedCity, cities } = useCityContext();
  const { profile } = useFarmerProfile();
  const { detail, loading, error } = useCityDetail(selectedCity);
  const summary = cities.find((c) => c.city === selectedCity);

  if (!selectedCity) {
    return (
      <section className="page">
        <div className="card">
          <h3>No city selected</h3>
          <p>Please complete the intake form so we can run the analysis.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>Decision Dashboard</h1>
          <p>Personalized guidance based on your goals and current climate risk.</p>
        </div>
        {summary && <RiskMeter level={summary.risk_level} />}
      </div>

      <div className="card">
        <h3>Your inputs</h3>
        <div className="input-summary">
          <span>City: {selectedCity}</span>
          <span>Desired crop: {profile.desiredCrop || "Not specified"}</span>
          <span>Budget: {profile.budgetINR || "Not specified"}</span>
          <span>Land: {profile.landSizeHa || "Not specified"}</span>
          <span>Water: {profile.waterAccess || "Not specified"}</span>
          <span>Irrigation: {profile.irrigationType || "Not specified"}</span>
          <span>Season: {profile.season || "Not specified"}</span>
        </div>
      </div>

      {loading && <p>Running analysis...</p>}
      {error && <p className="error">{error}</p>}

      {detail && (
        <div className="card-grid">
          <div className="card">
            <h3>Top crop recommendations</h3>
            <div className="card-grid">
              {detail.advisory.ranked_crops.slice(0, 3).map((crop, idx) => (
                <AdvisoryCard key={`${crop.crop}-${idx}`} crop={crop} rank={idx + 1} />
              ))}
            </div>
          </div>
          <ActionSteps
            irrigationMethod={detail.irrigation.irrigation_method}
            sowingWindow={detail.irrigation.optimal_sow_window}
            avoidCrops={detail.irrigation.avoid_crops}
            recommendedCrops={detail.irrigation.recommended_crops}
          />
          <div className="card">
            <h3>Economic protection</h3>
            <p>ERI score: {detail.eri.eri.toFixed(3)}</p>
            <p>{detail.eri.alert ? "Alert: high exploitation risk" : "No exploitation alert"}</p>
            <p>MSP: {detail.eri.msp_inr_per_quintal ?? "N/A"}</p>
            <p>Distress floor: {detail.eri.distress_price_threshold ?? "N/A"}</p>
          </div>
          <div className="card">
            <h3>Trend snapshot</h3>
            <p>Trend: {detail.trend.trend}</p>
            <p>Slope: {detail.trend.slope.toFixed(4)} / yr</p>
            <p>R²: {detail.trend.r_squared.toFixed(3)}</p>
          </div>
          <div className="card">
            <h3>Climate transitions</h3>
            <p>Detected transitions: {detail.transitions.length}</p>
            {detail.transitions[0] && (
              <p>Latest: {detail.transitions[0].from_zone} → {detail.transitions[0].to_zone}</p>
            )}
          </div>
        </div>
      )}

      {detail && (
        <div className="section">
          <h2>Local evidence</h2>
          <div className="card-grid">
            {detail.evidence.map((item, idx) => (
              <EvidenceCard key={`${item.title}-${idx}`} item={item} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default Dashboard;
