import { Smartphone, Wrench, Gavel, Recycle, Leaf } from "lucide-react";

const outcomes = [
  { id: "resell", label: "Resell", icon: Smartphone, angle: -55 },
  { id: "repair", label: "Repair", icon: Wrench, angle: -10 },
  { id: "auction", label: "Auction", icon: Gavel, angle: 35 },
  { id: "recycle", label: "Recycle", icon: Recycle, angle: 80 },
];

function pointOnArc(radius, angleDeg) {
  const angle = (angleDeg * Math.PI) / 180;
  return { x: 210 + radius * Math.cos(angle), y: 200 + radius * Math.sin(angle) };
}

export default function HeroDeviceVisual() {
  return (
    <div className="home-v2-hero-visual-inner" aria-hidden="true">
      <svg viewBox="0 0 420 340" xmlns="http://www.w3.org/2000/svg">
        {outcomes.map((node) => {
          const end = pointOnArc(150, node.angle);
          return (
            <line
              key={`line-${node.id}`}
              x1="210"
              y1="200"
              x2={end.x}
              y2={end.y}
              stroke="rgba(23, 85, 58, 0.16)"
              strokeWidth="1"
              strokeDasharray="3 6"
            />
          );
        })}
      </svg>

      <div className="home-v2-device-card">
        <div className="home-v2-device-card__glyph">
          <Smartphone size={30} strokeWidth={1.6} />
        </div>
        <span>One device</span>
        <strong>Multiple outcomes</strong>
      </div>

      {outcomes.map((node) => {
        const pos = pointOnArc(150, node.angle);
        const Icon = node.icon;
        return (
          <div
            key={node.id}
            className="home-v2-outcome-node"
            style={{ left: `${(pos.x / 420) * 100}%`, top: `${(pos.y / 340) * 100}%` }}
          >
            <span className="home-v2-outcome-node__icon">
              <Icon size={16} />
            </span>
            <span className="home-v2-outcome-node__label">{node.label}</span>
          </div>
        );
      })}

      <Leaf size={18} className="home-v2-hero-leaf home-v2-hero-leaf--a" />
      <Leaf size={14} className="home-v2-hero-leaf home-v2-hero-leaf--b" />
    </div>
  );
}
