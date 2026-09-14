import { Check } from "lucide-react";

export default function SellFlowRail({ steps, currentIndex }) {
  return (
    <ol className="sell-v2-rail" aria-label="Device resolution progress">
      {steps.map((step, index) => {
        const isActive = index === currentIndex;
        const isComplete = index < currentIndex;
        const Icon = step.icon;

        return (
          <li
            key={step.id}
            className={`sell-v2-rail__item ${isActive ? "is-active" : ""} ${
              isComplete ? "is-complete" : ""
            }`}
          >
            <span className="sell-v2-rail__icon">
              {isComplete ? <Check size={15} /> : <Icon size={15} />}
            </span>
            <span className="sell-v2-rail__label">{step.label}</span>
            {index < steps.length - 1 && <span className="sell-v2-rail__connector" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}
