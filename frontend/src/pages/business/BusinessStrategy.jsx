import { useEffect, useState } from "react";
import BusinessShell from "../../components/business/BusinessShell";
import { getSellingStrategy } from "../../services/businessService";

export default function BusinessStrategy() {
  const [strategy, setStrategy] = useState(null);
  useEffect(() => { getSellingStrategy().then(setStrategy); }, []);

  return (
    <BusinessShell>
      <div className="business-page">
        <h2>Selling Strategy</h2>
        {!strategy ? <div>Loading…</div> : (
          <div>
            <div className="card">
              <div className="muted">Expected Recovery</div>
              <div className="metric">₹{strategy.expectedRecovery.toLocaleString()}</div>
            </div>

            <div className="card" style={{ marginTop: 12 }}>
              {strategy.strategy.map(s => (
                <div key={s.id} className="strategy-row">
                  <div className="muted">{s.category}</div>
                  <div>{s.count}</div>
                  <div className="bar"><div style={{ width: `${s.percentage}%` }} /></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </BusinessShell>
  );
}
