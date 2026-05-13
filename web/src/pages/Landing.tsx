import React from "react";
import { Link } from "react-router-dom";
import { useCityContext } from "../state/CityContext";
import RiskMeter from "../components/RiskMeter";

const Landing: React.FC = () => {
  const { cities } = useCityContext();

  return (
    <section className="page">
      <div className="hero">
        <h1>VegShift</h1>
        <p>
          A climate adaptation platform that tells farmers and advisors which crops are safe today,
          which are becoming risky, and how to respond before losses compound.
        </p>
        <div className="hero-actions">
          <Link className="primary" to="/intake">Start farmer intake</Link>
          <Link className="secondary" to="/reports">Download a report</Link>
        </div>
      </div>

      <div className="card-grid">
        {cities.slice(0, 3).map((city) => (
          <div key={city.city} className="card city-preview" style={{ "--delay": "0.05s" } as React.CSSProperties}>
            <div className="card-header">
              <h3>{city.city}</h3>
              <span className="tag">{city.current_zone ?? "Zone"}</span>
            </div>
            <RiskMeter level={city.risk_level} />
            <p>Top crops: {city.top_crops.map((c) => c.crop).join(", ")}</p>
          </div>
        ))}
      </div>

      <div className="mission">
        <h2>Why this matters</h2>
        <p>
          Climate shifts are shrinking sowing windows, depleting groundwater, and making traditional crops
          unreliable. VegShift transforms climate and groundwater signals into clear, actionable advice
          aligned with SDG 13: Climate Action.
        </p>
      </div>
    </section>
  );
};

export default Landing;
