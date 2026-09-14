import { CircleDashed, IndianRupee, TrendingUp } from "lucide-react";
import SectionHeader from "../ui/SectionHeader";
import Button from "../ui/Button";

function formatCurrency(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

export default function ValuationStep({ evaluation, status = "done", error, onRetry }) {
  if (status === "loading" || (!evaluation && status !== "error")) {
    return (
      <div className="sell-v2-panel">
        <SectionHeader
          eyebrow="Step 4 · Estimated valuation"
          title="Here's what this device could be worth."
          description="Calling the real valuation service with the device profile and condition you provided."
        />
        <div className="sell-v2-empty">
          <span className="sell-v2-empty__icon">
            <CircleDashed size={22} />
          </span>
          <p>Running the valuation…</p>
        </div>
      </div>
    );
  }

  if (status === "error" || !evaluation) {
    return (
      <div className="sell-v2-panel">
        <SectionHeader
          eyebrow="Step 4 · Estimated valuation"
          title="Here's what this device could be worth."
          description="Calculated from the device profile and condition you provided, across every route we track."
        />
        <div className="sell-v2-empty">
          <span className="sell-v2-empty__icon">
            <CircleDashed size={22} />
          </span>
          <p>{error || "Could not evaluate this device."}</p>
          {onRetry && (
            <Button variant="primary" onClick={onRetry}>
              Try again
            </Button>
          )}
        </div>
      </div>
    );
  }

  const { valuation, condition, confidence } = evaluation;

  const cards = [
    { label: "Whole device", value: formatCurrency(valuation.wholeValue) },
    { label: "Component parts", value: formatCurrency(valuation.partsValue) },
    { label: "Auction range", value: `${formatCurrency(valuation.auctionMin)}–${formatCurrency(valuation.auctionMax)}` },
    { label: "Scrap recovery", value: formatCurrency(valuation.scrapValue) },
  ];

  return (
    <div className="sell-v2-panel">
      <SectionHeader
        eyebrow="Step 4 · Estimated valuation"
        title="Here's what this device could be worth."
        description="Calculated from the device profile and condition you provided, across every route we track."
      />

      <div className="sell-v2-valuation-head">
        <span className="sell-v2-valuation-icon">
          <IndianRupee size={20} />
        </span>
        <div>
          <span className="sell-v2-eyebrow-sm">Condition rating</span>
          <strong>{condition.label}</strong>
        </div>
        <div className="sell-v2-valuation-confidence">
          <TrendingUp size={15} />
          {confidence}% estimate confidence
        </div>
      </div>

      <div className="sell-v2-valuation-grid">
        {cards.map((card) => (
          <div className="sell-v2-valuation-card" key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </div>
        ))}
      </div>

      <p className="sell-v2-valuation-note">
        Estimates come from the resolution agent's valuation service. Final pricing is confirmed once the
        resolution agent verifies the device.
      </p>
    </div>
  );
}
