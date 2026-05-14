import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCityContext } from "../state/CityContext";
import { useFarmerProfile } from "../state/FarmerProfileContext";
import { useLanguage } from "../state/LanguageContext";
import { t } from "../i18n";

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

  const { lang } = useLanguage();

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>{t(lang, 'intake.title')}</h1>
          <p>{t(lang, 'intake.desc')}</p>
        </div>
      </div>

      <form className="card intake-form" onSubmit={handleSubmit}>
        {error && <p className="error">{error}</p>}
        <div className="form-grid">
          <label>
            {t(lang, 'nav.city')}
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              disabled={loading || cities.length === 0}
            >
              {cities.length === 0 && <option value="">{t(lang, 'loading')}</option>}
              {cities.map((city) => (
                <option key={city.city} value={city.city}>
                  {city.city}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t(lang, "intake.crop")}
            <input
              placeholder={t(lang, "intake.crop.placeholder")}
              value={local.desiredCrop}
              onChange={(e) => update("desiredCrop", e.target.value)}
            />
          </label>
          <label>
            {t(lang, "intake.budget")}
            <input
              placeholder={t(lang, "intake.budget.placeholder")}
              value={local.budgetINR}
              onChange={(e) => update("budgetINR", e.target.value)}
            />
          </label>
          <label>
            {t(lang, "intake.land")}
            <input
              placeholder={t(lang, "intake.land.placeholder")}
              value={local.landSizeHa}
              onChange={(e) => update("landSizeHa", e.target.value)}
            />
          </label>
          <label>
            {t(lang, "intake.water")}
            <select value={local.waterAccess} onChange={(e) => update("waterAccess", e.target.value)}>
              <option value="">{t(lang, "intake.select")}</option>
              <option value="rainfed">{t(lang, "intake.rainfed")}</option>
              <option value="groundwater">{t(lang, "intake.groundwater")}</option>
              <option value="canal">{t(lang, "intake.canal")}</option>
              <option value="mixed">{t(lang, "intake.mixed")}</option>
            </select>
          </label>
          <label>
            {t(lang, "intake.irrigation")}
            <select value={local.irrigationType} onChange={(e) => update("irrigationType", e.target.value)}>
              <option value="">{t(lang, "intake.select")}</option>
              <option value="drip">{t(lang, "intake.drip")}</option>
              <option value="sprinkler">{t(lang, "intake.sprinkler")}</option>
              <option value="flood">{t(lang, "intake.flood")}</option>
              <option value="none">{t(lang, "intake.none")}</option>
            </select>
          </label>
          <label>
            {t(lang, "intake.season")}
            <select value={local.season} onChange={(e) => update("season", e.target.value)}>
              <option value="">{t(lang, "intake.select")}</option>
              <option value="kharif">{t(lang, "season.kharif")}</option>
              <option value="rabi">{t(lang, "season.rabi")}</option>
              <option value="annual">{t(lang, "season.annual")}</option>
            </select>
          </label>
        </div>
        <button type="submit" className="primary" disabled={loading || !selectedCity}>
          {loading ? t(lang, 'loading') : t(lang, 'dashboard.title')}
        </button>
      </form>
    </section>
  );
};

export default Intake;
