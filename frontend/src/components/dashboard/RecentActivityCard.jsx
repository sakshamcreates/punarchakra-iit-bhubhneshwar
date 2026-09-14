import { Package, Truck, CheckCircle2, Clock } from "lucide-react";
import Card from "../ui/Card";

function resolveIcon(status) {
  const value = String(status || "").toLowerCase();
  if (value.includes("pickup")) return Truck;
  if (value.includes("complete") || value.includes("delivered") || value.includes("sold")) return CheckCircle2;
  if (value.includes("list")) return Package;
  return Clock;
}

export default function RecentActivityCard({ product, status, detail, estimate }) {
  const Icon = resolveIcon(status);

  return (
    <Card className="recent-activity-card" hoverable>
      <div className="recent-activity-card__icon">
        <Icon size={17} />
      </div>
      <div className="recent-activity-card__content">
        <div className="recent-activity-card__header">
          <h3>{product}</h3>
          <span>{status}</span>
        </div>
        <p>{detail}</p>
        <div className="recent-activity-card__footer">
          <span className="eyebrow">Estimated</span>
          <strong>{estimate}</strong>
        </div>
      </div>
    </Card>
  );
}
