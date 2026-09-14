import { ScanSearch, Scale, ShieldCheck, GitBranch, Zap, CheckCircle2, RotateCcw } from "lucide-react";

const stages = [
  { title: "Inspect", detail: "Read condition and specs from the device.", icon: ScanSearch },
  { title: "Evaluate", detail: "Weigh resale, parts, repair, auction and scrap.", icon: Scale },
  { title: "Check constraints", detail: "Confirm what's actually possible for this item.", icon: ShieldCheck },
  { title: "Decide", detail: "Choose the route with the best recovered value.", icon: GitBranch },
  { title: "Execute", detail: "Carry the decision through in the application.", icon: Zap },
  { title: "Verify", detail: "Confirm the outcome matches the decision.", icon: CheckCircle2 },
  { title: "Replan", detail: "Reconsider the route if it doesn't hold up.", icon: RotateCcw },
];

export default function AutonomousResolutionFlow() {
  return (
    <section className="container home-v2-section home-v2-section--tight">
      <div className="home-v2-section-head">
        <p className="home-v2-eyebrow">How the autonomous resolution works</p>
        <h2>From your request to a real-world resolution.</h2>
      </div>

      <ol className="home-v2-flow-strip">
        {stages.map(({ title, detail, icon: Icon }, index) => (
          <li key={title} className="home-v2-flow-step">
            <div className="home-v2-flow-step__head">
              <span className="home-v2-flow-step__icon">
                <Icon size={17} />
              </span>
              <span className="home-v2-flow-step__index">{index + 1}</span>
            </div>
            <strong>{title}</strong>
            <p>{detail}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
