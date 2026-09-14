import { useEffect, useState } from "react";
import PartnerShell from "../../components/partner/PartnerShell";
import { getNearbyPickups, acceptPickup } from "../../services/kabadiwalaService";

export default function PartnerPickups() {
  const [pickups, setPickups] = useState(null);
  const [loadingIds, setLoadingIds] = useState([]);

  useEffect(() => {
    load();
  }, []);

  function load() {
    setPickups(null);
    getNearbyPickups().then(setPickups);
  }

  function onAccept(id) {
    setLoadingIds((s) => [...s, id]);
    acceptPickup(id)
      .then(() => getNearbyPickups())
      .then((list) => setPickups(list))
      .finally(() => setLoadingIds((s) => s.filter((x) => x !== id)));
  }

  return (
    <PartnerShell>
      <div className="partner-page">
        <h2>Pickup Opportunities</h2>
        {pickups === null ? (
          <div>Loading pickups…</div>
        ) : pickups.length === 0 ? (
          <div>No pickups nearby.</div>
        ) : (
          <div className="pickup-grid">
            <div className="pickup-list">
              {pickups.map((p) => (
                <div key={p.id} className={`pickup-item ${p.status}`}>
                  <div className="pickup-main">
                    <div className="pickup-title">{p.item}</div>
                    <div className="muted">{p.area} — {p.distanceKm} km</div>
                    <div className="muted">{p.weightKg ? `${p.weightKg} kg` : "—"}</div>
                  </div>
                  <div className="pickup-meta">
                    <div className="value">{p.estimatedValue}</div>
                    <button disabled={p.status !== "available" || loadingIds.includes(p.id)} onClick={() => onAccept(p.id)}>
                      {p.status === "accepted" ? "Accepted" : loadingIds.includes(p.id) ? "Accepting…" : "Accept Pickup"}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pickup-map-mock partner-card">
              <div className="map-legend">Map (mock)</div>
              <div className="map-area">
                {pickups.map((p) => (
                  <div key={p.id} className={`map-marker ${p.status}`} style={{ top: `${10 + p.distanceKm * 5}%` }}>
                    {p.item} — {p.distanceKm} km
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </PartnerShell>
  );
}
