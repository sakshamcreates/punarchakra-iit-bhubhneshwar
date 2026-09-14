import { ScanSearch, Scale, ShieldCheck, Zap } from "lucide-react";
import SectionHeader from "../ui/SectionHeader";
import Button from "../ui/Button";
import { resolutionPathCopy } from "../../data/sellFlowMockData";

const AGENT_STAGES = [
  { icon: ScanSearch, label: "Inspect" },
  { icon: Scale, label: "Evaluate" },
  { icon: ShieldCheck, label: "Check constraints" },
  { icon: Zap, label: "Execute" },
];

export default function ReadyToResolveStep({ device, evaluation, onStartResolution, starting, error }) {
  const recommended = resolutionPathCopy[evaluation.recommendation.route];

  return (
    <div className="sell-v2-panel">
      <SectionHeader
        eyebrow="Step 6 · Ready to resolve"
        title="Your device is ready for the resolution agent."
        description="Everything captured so far — the device, its condition, and the valuation — is handed to the autonomous resolution agent to execute."
      />

      <div className="sell-v2-ready-card">
        <div className="sell-v2-ready-card__summary">
          <div>
            <span className="sell-v2-eyebrow-sm">Device</span>
            <strong>
              {device.brand} {device.series}
            </strong>
          </div>
          <div>
            <span className="sell-v2-eyebrow-sm">Recommended route</span>
            <strong>{recommended.name}</strong>
          </div>
          <div>
            <span className="sell-v2-eyebrow-sm">Estimated recovery</span>
            <strong>
              {typeof evaluation.valuation.wholeValue === "number"
                ? `₹${evaluation.valuation.wholeValue.toLocaleString("en-IN")}`
                : "—"}
            </strong>
          </div>
        </div>

        <div className="sell-v2-ready-card__stages">
          <span className="sell-v2-eyebrow-sm">What happens next</span>
          <ol>
            {AGENT_STAGES.map(({ icon: Icon, label }) => (
              <li key={label}>
                <span className="sell-v2-ready-card__stage-icon">
                  <Icon size={14} />
                </span>
                {label}
              </li>
            ))}
          </ol>
        </div>

        <Button
          variant="primary"
          className="sell-v2-ready-card__cta"
          onClick={onStartResolution}
          disabled={starting}
        >
          {starting ? "Starting resolution…" : "Start Resolution"}
        </Button>

        {error && <p className="sell-v2-valuation-note">{error}</p>}
      </div>
    </div>
  );
}
