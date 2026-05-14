import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCityContext } from "../state/CityContext";
import { useFarmerProfile } from "../state/FarmerProfileContext";

const Intake: React.FC = () => {
  const { selectedCity, setSelectedCity, cities, loading, error } = useCityContext();
  const { profile, setProfile, markSubmitted } = useFarmerProfile();
  const [local, setLocal] = useState(profile);
  const navigate = useNavigate();

  const update = (field: keyof typeof local, value: string) => {
    setLocal({ ...local, [field]: value });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setProfile(local);
    markSubmitted();
    navigate("/dashboard");
  };

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>Farmer Intake</h1>
          <p>Tell us your crop goals and resources. We will run the analysis for your city.</p>
        </div>
      </div>

      <form className="card intake-form" onSubmit={handleSubmit}>
        {error && <p className="error">{error}</p>}
        <div className="form-grid">
          <label>
            City
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              disabled={loading || cities.length === 0}
            >
              {cities.length === 0 && <option value="">Loading cities...</option>}
              {cities.map((city) => (
                <option key={city.city} value={city.city}>
                  {city.city}
                </option>
              ))}
            </select>
          </label>
          <label>
            Crop you want to grow
            <input
              placeholder="e.g. wheat, rice"
              value={local.desiredCrop}
              onChange={(e) => update("desiredCrop", e.target.value)}
            />
          </label>
          <label>
            Budget (INR)
            <input
              placeholder="Approx. budget"
              value={local.budgetINR}
              onChange={(e) => update("budgetINR", e.target.value)}
            />
          </label>
          <label>
            Land size (hectares)
            <input
              placeholder="e.g. 1.5"
              value={local.landSizeHa}
              onChange={(e) => update("landSizeHa", e.target.value)}
            />
          </label>
          <label>
            Water access
            <select value={local.waterAccess} onChange={(e) => update("waterAccess", e.target.value)}>
              <option value="">Select</option>
              <option value="rainfed">Rainfed only</option>
              <option value="groundwater">Groundwater wells</option>
              <option value="canal">Canal irrigation</option>
              <option value="mixed">Mixed sources</option>
            </select>
          </label>
          <label>
            Irrigation method available
            <select value={local.irrigationType} onChange={(e) => update("irrigationType", e.target.value)}>
              <option value="">Select</option>
              <option value="drip">Drip</option>
              <option value="sprinkler">Sprinkler</option>
              <option value="flood">Flood</option>
              <option value="none">No irrigation setup</option>
            </select>
          </label>
          <label>
            Preferred season
            <select value={local.season} onChange={(e) => update("season", e.target.value)}>
              <option value="">Select</option>
              <option value="kharif">Kharif</option>
              <option value="rabi">Rabi</option>
              <option value="annual">Annual</option>
            </select>
          </label>
        </div>
        <button type="submit" className="primary" disabled={loading || !selectedCity}>
          {loading ? "Loading data..." : "Run analysis"}
        </button>
      </form>
    </section>
  );
};

export default Intake;
