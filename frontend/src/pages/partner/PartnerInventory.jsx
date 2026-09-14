import { useEffect, useState } from "react";
import PartnerShell from "../../components/partner/PartnerShell";
import { getInventory } from "../../services/kabadiwalaService";

export default function PartnerInventory() {
  const [inventory, setInventory] = useState(null);

  useEffect(() => {
    getInventory().then(setInventory);
  }, []);

  return (
    <PartnerShell>
      <div className="partner-page">
        <h2>Inventory</h2>
        {inventory === null ? (
          <div>Loading inventory…</div>
        ) : inventory.length === 0 ? (
          <div>No inventory.</div>
        ) : (
          <table className="inventory-table">
            <thead>
              <tr>
                <th>Material</th>
                <th>Quantity</th>
                <th>Est. Value</th>
                <th>Demand Trend</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((it) => (
                <tr key={it.id}>
                  <td>{it.material}</td>
                  <td>{it.quantity} {it.unit}</td>
                  <td>₹{it.estimatedValue.toLocaleString()}</td>
                  <td>{it.demandTrend}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="partner-card ai-suggestion">
          <h3>AI Suggestion</h3>
          <div>"Copper demand is 18% higher this week. Consider holding aluminium and selling copper."</div>
        </div>
      </div>
    </PartnerShell>
  );
}
