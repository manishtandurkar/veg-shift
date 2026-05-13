import React from "react";
import { useCityContext } from "../state/CityContext";

const CitySelector: React.FC = () => {
  const { cities, selectedCity, setSelectedCity } = useCityContext();

  return (
    <label className="city-selector">
      <span>City</span>
      <select
        value={selectedCity}
        onChange={(event) => setSelectedCity(event.target.value)}
      >
        {cities.map((city) => (
          <option key={city.city} value={city.city}>
            {city.city}
          </option>
        ))}
      </select>
    </label>
  );
};

export default CitySelector;
