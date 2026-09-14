import { useEffect, useState } from "react";
import PartnerShell from "../../components/partner/PartnerShell";
import { getKabadiwalaOverview, getInventory, getRoutePlan, getNearbyPickups } from "../../services/kabadiwalaService";

export default function PartnerDashboard() {
  const [overview, setOverview] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [route, setRoute] = useState(null);
  const [pickups, setPickups] = useState([]);

  useEffect(() => {
    getKabadiwalaOverview().then(setOverview);
    getInventory().then(setInventory);
    getRoutePlan().then(setRoute);
    getNearbyPickups().then(setPickups);
  }, []);

  return (
    <PartnerShell>
      <div className="partner-grid">
        <h2 className="partner-title">Operations Dashboard</h2>
        {!overview ? (
          <div>Loading overview…</div>
        ) : (
          <div className="partner-stats">
            <div className="partner-card">
              <div className="muted">Today's Earnings</div>
              <div className="big">₹{overview.todaysEarnings.toLocaleString()}</div>
            </div>
            <div className="partner-card">
              <div className="muted">Available Pickups</div>
              <div className="big">{overview.availablePickups}</div>
            </div>
            <div className="partner-card">
              <div className="muted">Inventory Value</div>
              <div className="big">₹{overview.inventoryValue.toLocaleString()}</div>
            </div>
          </div>
        )}

        <section className="partner-row">
          <div className="partner-card wide">
            <h3>Next Pickup</h3>
            {pickups.length === 0 ? (
              <div>No pickups available</div>
            ) : (
              <div>
                <strong>{pickups[0].item}</strong>
                <div className="muted">{pickups[0].area} — {pickups[0].distanceKm} km</div>
              </div>
            )}
          </div>

          <div className="partner-card wide">
            <h3>Inventory Snapshot</h3>
            <ul className="inventory-snapshot">
              {inventory.slice(0,5).map((it) => (
                <li key={it.id}>{it.material} — {it.quantity} {it.unit}</li>
              ))}
            </ul>
          </div>

          <div className="partner-card suggestion">
            <h3>Suggested Material</h3>
            {overview && (
              <div>
                <strong>{overview.suggestedMaterial.material}</strong>
                <div className="muted">{overview.suggestedMaterial.note}</div>
              </div>
            )}
          </div>
        </section>

        <section className="partner-card route-card">
          <h3>Today's Route</h3>
          {!route ? (
            <div>Loading route…</div>
          ) : (
            <div>
              <div className="route-list">
                {route.stops.map((s, idx) => (
                  <div key={s.id} className="route-stop">
                    <div className="stop-name">{s.name}</div>
                    {idx < route.stops.length - 1 && <div className="route-arrow">↓</div>}
                  </div>
                ))}
              </div>
              <div className="muted">{route.totalDistanceKm} km — ₹{route.estimatedFuelCost} estimated fuel</div>
            </div>
          )}
        </section>
      </div>
    </PartnerShell>
  );
}
