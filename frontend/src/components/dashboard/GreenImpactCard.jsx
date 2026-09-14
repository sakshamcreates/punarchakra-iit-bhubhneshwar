import { Recycle, RefreshCw, Wrench, Leaf } from "lucide-react";
import Card from "../ui/Card";

export default function GreenImpactCard({ recovered, reused, recycled, refurbished, score, label }) {
  const stats = [
    { key: "recovered", label: "Recovered", value: recovered, icon: Leaf },
    { key: "reused", label: "Reused", value: reused, icon: RefreshCw },
    { key: "recycled", label: "Recycled", value: recycled, icon: Recycle },
    { key: "refurbished", label: "Refurbished", value: refurbished, icon: Wrench }
  ];

  return (
    <Card className="green-impact-card" hoverable>
      <div className="green-impact-card__header">
        <div>
          <h3>Green impact</h3>
          <p>{label}</p>
        </div>
        <span className="green-impact-card__score">{score}</span>
      </div>

      <div className="green-impact-card__stats">
        {stats.map(({ key, label: statLabel, value, icon: Icon }) => (
          <div key={key} className="green-impact-card__stat">
            <div className="green-impact-card__stat-icon">
              <Icon size={16} />
            </div>
            <span className="eyebrow">{statLabel}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </Card>
  );
}
