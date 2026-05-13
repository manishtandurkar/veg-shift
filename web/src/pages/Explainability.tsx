import React from "react";
import { useCityContext } from "../state/CityContext";
import { useCityDetail } from "../hooks/useCityDetail";

const Explainability: React.FC = () => {
  const { selectedCity } = useCityContext();
  const { detail, loading, error } = useCityDetail(selectedCity);

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>Explainability</h1>
          <p>Top drivers influencing the risk forecast.</p>
        </div>
      </div>

      {loading && <p>Loading explainability...</p>}
      {error && <p className="error">{error}</p>}

      {detail && (
        <div className="card-grid">
          <div className="card">
            <h3>City drivers</h3>
            <ul>
              {detail.shap.city_top.map((item) => (
                <li key={item.feature}>
                  {item.feature}: {item.score.toFixed(4)}
                </li>
              ))}
            </ul>
          </div>
          <div className="card">
            <h3>Global drivers</h3>
            <ul>
              {detail.shap.global_top.map((item) => (
                <li key={item.feature}>
                  {item.feature}: {item.score.toFixed(4)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
};

export default Explainability;
