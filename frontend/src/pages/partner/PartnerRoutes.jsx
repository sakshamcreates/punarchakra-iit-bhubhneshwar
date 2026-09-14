import { useEffect, useState } from "react";
import PartnerShell from "../../components/partner/PartnerShell";
import { getRoutePlan } from "../../services/kabadiwalaService";

export default function PartnerRoutes() {
  const [route, setRoute] = useState(null);

  useEffect(() => {
    getRoutePlan().then(setRoute);
  }, []);

  return (
    <PartnerShell>
      <div className="partner-page">
        <h2>Route Planner</h2>
        {!route ? (
          <div>Loading route…</div>
        ) : (
          <div className="partner-card route-plan">
            <ol className="route-ordered">
              {route.stops.map((s) => (
                <li key={s.id} className="route-stop-row">{s.name}</li>
              ))}
            </ol>
            <div className="muted">{route.totalDistanceKm} km — ₹{route.estimatedFuelCost} estimated fuel</div>
          </div>
        )}
      </div>
    </PartnerShell>
  );
}
