import Card from "../ui/Card";
import Badge from "../ui/Badge";
import { formatCurrency } from "../../utils/formatters";
import { buildRouteAvailability, routeLabel } from "../../utils/agentTimeline";

export default function AgentItemPanel({ listing, session }) {
  const image = listing && Array.isArray(listing.images) ? listing.images[0] : null;
  const detectedDevice = session?.detectedDevice;
  const routes = buildRouteAvailability(session);

  return (
    <Card className="agent-item-panel">
      <div className="agent-item-panel__top">
        {image ? (
          <div className="agent-item-panel__image">
            <img src={image} alt={listing?.title || "Item"} onError={(e) => { e.currentTarget.style.display = "none"; }} />
          </div>
        ) : null}
        <div>
          <span className="eyebrow">Item / goal</span>
          <h3>{listing?.title || detectedDevice?.categoryLabel || "Resolving item"}</h3>
          <div className="agent-item-panel__meta">
            {listing?.category ? <Badge>{listing.category}</Badge> : null}
            {listing?.condition ? <Badge variant="neutral">{listing.condition}</Badge> : null}
          </div>
        </div>
      </div>

      <p className="agent-item-panel__goal">{session?.goal || "Resolve this e-waste item for the best available outcome."}</p>

      {session?.customer ? (
        <p className="agent-item-panel__customer">
          Customer: {session.customer.name || session.customer.id || "unknown"}
          {session.customer.source === "seller_id_only_no_registered_user_record"
            ? " (seller id only — no registered account on file)"
            : ""}
        </p>
      ) : null}

      {routes.length > 0 ? (
        <div className="agent-item-panel__routes">
          {routes.map((option) => {
            const excluded = option.blocked;
            return (
              <div className={`agent-item-panel__route ${excluded ? "is-excluded" : ""}`} key={option.route}>
                <span className="agent-item-panel__route-state">
                  {excluded ? "✕ excluded" : "✓ available"}
                </span>
                <span>{routeLabel(option.route)}</span>
                <strong>{formatCurrency(option.expectedValue)}</strong>
                {excluded && option.reason ? (
                  <span className="agent-item-panel__route-reason">{option.reason}</span>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </Card>
  );
}