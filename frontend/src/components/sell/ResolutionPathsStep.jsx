import { Gavel, Layers, Leaf, Recycle, Smartphone } from "lucide-react";
import SectionHeader from "../ui/SectionHeader";
import Badge from "../ui/Badge";
import { buildResolutionPaths } from "../../data/sellFlowMockData";

const ROUTE_ICONS = {
  whole: Smartphone,
  parts: Layers,
  auction: Gavel,
  scrap: Recycle,
  donate: Leaf,
};

function formatValue(value) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return `₹${value}`;
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

export default function ResolutionPathsStep({ evaluation }) {
  const paths = buildResolutionPaths(evaluation);

  return (
    <div className="sell-v2-panel">
      <SectionHeader
        eyebrow="Step 5 · Available resolution paths"
        title="Every route this device qualifies for."
        description="The resolution agent will check constraints and pick the strongest one — here's how they compare."
      />

      <div className="sell-v2-paths-grid">
        {paths.map((path) => {
          const Icon = ROUTE_ICONS[path.route];
          return (
            <div key={path.route} className={`sell-v2-path-card ${path.recommended ? "is-recommended" : ""}`}>
              {path.recommended && <Badge className="sell-v2-path-card__badge">Recommended</Badge>}
              <span className="sell-v2-path-card__icon">
                <Icon size={18} />
              </span>
              <strong>{path.name}</strong>
              <span className="sell-v2-path-card__tag">{path.tag}</span>
              <p>{path.description}</p>
              <div className="sell-v2-path-card__value">{formatValue(path.value)}</div>
            </div>
          );
        })}
      </div>

      <p className="sell-v2-valuation-note">{evaluation.recommendation.reason}</p>
    </div>
  );
}
