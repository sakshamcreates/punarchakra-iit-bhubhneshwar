import { useState } from "react";
import BusinessShell from "../../components/business/BusinessShell";
import { searchProcurement } from "../../services/businessService";

export default function BusinessProcurement() {
  const [query, setQuery] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [location, setLocation] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  function findSupply() {
    const req = { query, quantity: Number(quantity), location };
    setLoading(true);
    searchProcurement(req).then((res) => {
      setResults({ suppliers: res, requested: req.quantity });
    }).finally(() => setLoading(false));
  }

  const totalAvailable = results ? results.suppliers.reduce((s, x) => s + x.availableQuantity, 0) : 0;
  const matched = Math.min(totalAvailable, results ? results.requested : 0);
  const fulfillment = results ? Math.round((matched / results.requested) * 100) : 0;

  return (
    <BusinessShell>
      <div className="business-page">
        <h2>Procurement</h2>
        <div className="card">
          <div className="form-field">
            <label>What do you need?</label>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. 500 laptop SSDs" />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Quantity" />
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" />
            <button className="btn btn-primary" onClick={findSupply} disabled={loading}>Find Supply</button>
          </div>
        </div>

        {loading && <div>Searching…</div>}

        {results && (
          <div className="card" style={{ marginTop: 12 }}>
            <div>Requested: {results.requested}</div>
            <div>Matched: {matched}</div>
            <div>Fulfillment: {fulfillment}%</div>
            <h4 style={{ marginTop: 8 }}>Suppliers</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr><th>Name</th><th>Type</th><th>Available</th><th>Location</th></tr>
              </thead>
              <tbody>
                {results.suppliers.map(s => (
                  <tr key={s.id}><td>{s.name}</td><td>{s.type}</td><td>{s.availableQuantity}</td><td className="muted">{s.location}</td></tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 8 }}>Total available: {totalAvailable}</div>
          </div>
        )}
      </div>
    </BusinessShell>
  );
}
