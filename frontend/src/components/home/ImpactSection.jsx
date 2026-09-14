import { Leaf, Recycle, ShieldCheck } from "lucide-react";

const principles = [
  {
    icon: Leaf,
    title: "Extend device life",
    detail: "A device that still functions is worth more in use than in a scrap pile.",
  },
  {
    icon: Recycle,
    title: "Recover materials",
    detail: "When reuse isn't possible, components and materials are routed for proper recovery.",
  },
  {
    icon: ShieldCheck,
    title: "Keep e-waste out of landfills",
    detail: "Every device kept in circulation is one that doesn't end up discarded.",
  },
];

export default function ImpactSection() {
  return (
    <section className="container home-v2-section home-v2-section--tight">
      <div className="home-v2-impact">
        <div className="home-v2-section-head">
          <p className="home-v2-eyebrow">Why it matters</p>
          <h2>Keep electronics in circulation.</h2>
          <p className="home-v2-impact-lede">
            Every device that finds a new home reduces e-waste and conserves resources.
          </p>
        </div>

        <div className="home-v2-impact-grid">
          {principles.map(({ icon: Icon, title, detail }) => (
            <div key={title} className="home-v2-impact-card">
              <Icon size={20} />
              <h3>{title}</h3>
              <p>{detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
