import React from "react";
import { useCityContext } from "../state/CityContext";
import { useCityDetail } from "../hooks/useCityDetail";

const Reports: React.FC = () => {
  const { selectedCity } = useCityContext();
  const { detail, loading, error } = useCityDetail(selectedCity);

  const handleDownload = () => {
    if (!detail) return;
    const blob = new Blob([JSON.stringify(detail, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selectedCity.toLowerCase()}-vegshift-report.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h1>Reports</h1>
          <p>Export a city summary for field use or presentations.</p>
        </div>
      </div>

      {loading && <p>Preparing report...</p>}
      {error && <p className="error">{error}</p>}

      {detail && (
        <div className="card">
          <h3>{selectedCity} summary</h3>
          <p>Includes advisory, irrigation strategy, risk profile, and evidence.</p>
          <button type="button" className="primary" onClick={handleDownload}>
            Download JSON report
          </button>
        </div>
      )}
    </section>
  );
};

export default Reports;
