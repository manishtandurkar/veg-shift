import React from "react";
import { useCityContext } from "../state/CityContext";
import { useCityDetail } from "../hooks/useCityDetail";
import EvidenceCard from "../components/EvidenceCard";
import RiskMeter from "../components/RiskMeter";
import TrendStrip from "../components/TrendStrip";

const CityOverview: React.FC = () => {
  const { selectedCity, cities } = useCityContext();
  const summary = cities.find((c) => c.city === selectedCity);
  const { detail, loading, error } = useCityDetail(selectedCity);

  if (!summary) return null;

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>{selectedCity}</h1>
          <p>Climate transition, crop risk, and local evidence.</p>
        </div>
        <RiskMeter level={summary.risk_level} />
      </div>

      {detail && (
        <div className="card-grid">
          <div className="card">
            <h3>Current zone</h3>
            <p>{detail.advisory.current_zone}</p>
          </div>
          <div className="card">
            <h3>Recent CVLE events</h3>
            <p>{summary.recent_cvle_count} in last 5 years</p>
          </div>
          <div className="card">
            <h3>Trend</h3>
            <TrendStrip slope={detail.trend.slope} trend={detail.trend.trend} />
          </div>
        </div>
      )}

      <div className="section">
        <h2>Climate transitions</h2>
        {detail?.transitions?.length ? (
          <div className="table">
            {detail.transitions.map((item, idx) => (
              <div key={`${item.transition_year}-${idx}`} className="table-row">
                <span>{item.transition_year}</span>
                <span>{item.from_zone} → {item.to_zone}</span>
                <span>Confirmed {item.years_confirmed} years</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="card muted">No transition detected for this city.</div>
        )}
      </div>

      <div className="section">
        <h2>Evidence from the ground</h2>
        {loading && <p>Loading evidence...</p>}
        {error && <p className="error">{error}</p>}
        <div className="card-grid">
          {detail?.evidence?.map((item, idx) => (
            <EvidenceCard key={`${item.title}-${idx}`} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default CityOverview;
