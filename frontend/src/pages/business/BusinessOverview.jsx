import { useEffect, useState } from "react";
import BusinessShell from "../../components/business/BusinessShell";
import { getBusinessOverview } from "../../services/businessService";

export default function BusinessOverview() {
  const [overview, setOverview] = useState(null);
  useEffect(() => { getBusinessOverview().then(setOverview); }, []);

  return (
    <BusinessShell>
      <div className="business-page">
        <h2>Business Overview</h2>
        {!overview ? <div>Loading…</div> : (
          <div className="business-stats">
            <div className="card">
              <div className="muted">Assets Uploaded</div>
              <div className="metric">{overview.totalAssets}</div>
            </div>
            <div className="card">
              <div className="muted">Expected Recovery</div>
              <div className="metric">₹{overview.expectedRecovery.toLocaleString()}</div>
            </div>
          </div>
        )}
      </div>
    </BusinessShell>
  );
}
