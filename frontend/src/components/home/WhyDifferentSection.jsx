import { useState } from "react";
import { ChevronDown, Zap, Layers, RotateCcw, Truck } from "lucide-react";

const items = [
  {
    id: "execute",
    icon: Zap,
    title: "Not just recommendations",
    tagline: "Actually executes and verifies resolutions",
    detail:
      "Once a route is chosen, the agent carries it out in the application itself and checks that the outcome actually matches what was decided — it doesn't stop at a suggestion.",
  },
  {
    id: "routes",
    icon: Layers,
    title: "Multiple recovery paths",
    tagline: "Whole device, parts, repair, auction or scrap",
    detail:
      "Every device is checked against several possible routes at once, so the one that keeps the most value in circulation is the one that gets used.",
  },
  {
    id: "replan",
    icon: RotateCcw,
    title: "Adapts when things fail",
    tagline: "Automatically replans if a route isn't viable",
    detail:
      "If an execution step doesn't hold up — a buyer falls through, a constraint changes — the agent reconsiders and moves to the next best route instead of leaving the item stuck.",
  },
  {
    id: "coordination",
    icon: Truck,
    title: "End-to-end coordination",
    tagline: "From valuation to buyer matching and pickup",
    detail:
      "Valuation, buyer matching and pickup are handled as one coordinated flow, so recovering value doesn't mean juggling several separate services yourself.",
  },
];

export default function WhyDifferentSection() {
  const [openId, setOpenId] = useState(items[0].id);

  return (
    <section className="container home-v2-section home-v2-section--tight">
      <div className="home-v2-section-head">
        <p className="home-v2-eyebrow">What's different</p>
        <h2>Why Punarchakra is different.</h2>
      </div>

      <div className="home-v2-why-list">
        {items.map(({ id, icon: Icon, title, tagline, detail }) => {
          const isOpen = openId === id;
          return (
            <div key={id} className={`home-v2-why-item ${isOpen ? "is-open" : ""}`}>
              <button
                type="button"
                className="home-v2-why-item__trigger"
                aria-expanded={isOpen}
                onClick={() => setOpenId(isOpen ? null : id)}
              >
                <span className="home-v2-why-item__icon">
                  <Icon size={18} />
                </span>
                <span className="home-v2-why-item__heading">
                  <strong>{title}</strong>
                  <span>{tagline}</span>
                </span>
                <ChevronDown size={18} className="home-v2-why-item__chevron" />
              </button>
              {isOpen && <p className="home-v2-why-item__detail">{detail}</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
