import { useEffect, useState } from "react";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import SectionHeader from "../components/ui/SectionHeader";
import { getRecyclerDemand, getAggregatedMaterialSupply } from "../services/ecosystemService.js";

export default function RecyclerPage() {
  const [demand, setDemand] = useState([]);
  const [supply, setSupply] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    Promise.all([getRecyclerDemand(), getAggregatedMaterialSupply()])
      .then(([demandData, supplyData]) => {
        setDemand(demandData);
        setSupply(supplyData);
      })
      .catch(() => setError("Unable to load recycler demand and supply."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="container section ecosystem-page">
      <div className="page-intro">
        <SectionHeader
          eyebrow="Recycler"
          title="Material demand and supply"
          description="View aggregated network supply across the Punarchakra ecosystem for high-demand recyclables."
        />
      </div>

      {loading ? (
        <Card className="ecosystem-loading">Loading recycler demand…</Card>
      ) : error ? (
        <Card className="ecosystem-error">{error}</Card>
      ) : (
        <>
          <div className="ecosystem-grid ecosystem-grid--demand">
            {demand.map((item) => (
              <Card key={item.id} className="eco-demand-card">
                <div className="eco-demand-header">
                  <strong>{item.material}</strong>
                  <span>{item.demandTonnes} tonnes</span>
                </div>
                <p className="eco-demand-caption">Current demand from recyclers</p>
              </Card>
            ))}
          </div>

          <SectionHeader
            title="Aggregated Supply Available"
            description="Punarchakra combines fragmented ecosystem supply into usable material streams."
          />

          <div className="ecosystem-grid ecosystem-grid--supply">
            {supply.map((item) => {
              const fillPercentage = Math.min(100, Math.round((item.availableTonnes / item.demandTonnes) * 100));
              return (
                <Card key={item.id} className="eco-supply-card">
                  <div className="eco-supply-header">
                    <strong>{item.material}</strong>
                    <span>{item.availableTonnes} t available</span>
                  </div>
                  <div className="eco-supply-meta">Demand: {item.demandTonnes} tonnes</div>
                  <div className="supply-bar">
                    <div className="supply-bar__fill" style={{ width: `${fillPercentage}%` }} />
                  </div>
                  <div className="eco-supply-subtitle">Available through Punarchakra network</div>
                  <div className="eco-supply-sources">
                    {item.sources.map((source) => (
                      <div key={source.source} className="supply-source-row">
                        <span>{source.source}</span>
                        <strong>{source.tonnes} t</strong>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
