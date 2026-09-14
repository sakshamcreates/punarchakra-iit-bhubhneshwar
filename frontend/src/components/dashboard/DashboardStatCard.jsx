import Card from "../ui/Card";

export default function DashboardStatCard({ value, label, icon: Icon, tone = "default" }) {
  return (
    <Card className={`stat-card stat-card--${tone}`} hoverable>
      {Icon ? (
        <div className="stat-card__icon">
          <Icon size={tone === "hero" ? 22 : 18} />
        </div>
      ) : null}
      <div className="stat-card__value">{value}</div>
      <div className="stat-card__label">{label}</div>
    </Card>
  );
}
