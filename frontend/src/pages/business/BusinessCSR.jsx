import { useEffect, useState } from "react";
import BusinessShell from "../../components/business/BusinessShell";
import { getCSRMetrics } from "../../services/businessService";

export default function BusinessCSR() {
  const [metrics, setMetrics] = useState(null);
  useEffect(() => { getCSRMetrics().then(setMetrics); }, []);

  return (
    <BusinessShell>
      <div className="business-page">
        <h2>CSR Impact</h2>
        {!metrics ? <div>Loading…</div> : (
          <div className="card">
            <div>Devices Donated <strong>{metrics.devicesDonated}</strong></div>
            <div>Students Impacted <strong>{metrics.studentsImpacted}</strong></div>
            <div>E-waste Diverted <strong>{metrics.ewasteDivertedTonnes} tonnes</strong></div>
            <div>CO₂ Avoided <strong>{metrics.co2AvoidedTonnes} tonnes</strong></div>
          </div>
        )}
      </div>
    </BusinessShell>
  );
}
