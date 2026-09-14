import {
  LayoutGrid,
  Tags,
  Archive,
  Gavel,
  Truck,
  Heart,
  Receipt
} from "lucide-react";

const primaryItems = [
  { label: "Overview", icon: LayoutGrid },
  { label: "My Listings", icon: Tags },
  { label: "Scrap Locker", icon: Archive },
  { label: "Auctions", icon: Gavel },
  { label: "Pickup Tracking", icon: Truck }
];

const secondaryItems = [
  { label: "Saved Products", icon: Heart },
  { label: "Transactions", icon: Receipt }
];

export default function DashboardSidebar() {
  return (
    <aside className="dashboard-sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand__mark">↺</div>
        <div>
          <strong>Punarchakra</strong>
          <p>Consumer dashboard</p>
        </div>
      </div>

      <nav className="sidebar-nav">
        {primaryItems.map(({ label, icon: Icon }) => (
          <button key={label} className={`sidebar-link ${label === "Overview" ? "active" : ""}`}>
            <Icon size={17} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-divider" />

      <nav className="sidebar-group">
        {secondaryItems.map(({ label, icon: Icon }) => (
          <button key={label} className="sidebar-link sidebar-link--secondary">
            <Icon size={16} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-impact">
        <span className="eyebrow">Green impact</span>
        <strong>742</strong>
        <p>Circular Champion</p>
      </div>
    </aside>
  );
}
