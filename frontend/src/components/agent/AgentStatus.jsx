import { AlertTriangle, RefreshCw, UserCheck } from "lucide-react";
import { STATUS_ACTIVITY } from "../../utils/agentTimeline";

// Phase 11: the main forward-moving stages, in order. REPLANNING /
// HUMAN_REVIEW / FAILED are real statuses too but are interrupts to this
// line, not steps on it — they're shown as a callout instead (see below).
const STEPS = [
  { key: "INSPECTING", label: "Inspect" },
  { key: "EVALUATING", label: "Value" },
  { key: "CHECKING_CONSTRAINTS", label: "Check" },
  { key: "DECIDING", label: "Decide" },
  { key: "EXECUTING", label: "Execute" },
  { key: "OBSERVING", label: "Observe" },
  { key: "VERIFYING", label: "Verify" },
  { key: "COMPLETED", label: "Done" },
];

function stepIndex(status) {
  if (status === "IDLE") return -1;
  const idx = STEPS.findIndex((s) => s.key === status);
  return idx;
}

export default function AgentStatus({ status }) {
  const isInterrupt = status === "REPLANNING" || status === "HUMAN_REVIEW" || status === "FAILED";
  const activeIndex = isInterrupt ? STEPS.length : stepIndex(status);

  const activity = STATUS_ACTIVITY[status] || { label: status, detail: "" };

  return (
    <div className="agent-status">
      <div className="agent-status__now">
        <div className="agent-status__now-head">
          <span className="agent-status__now-eyebrow">Current stage</span>
          {isInterrupt ? (
            <span className={`agent-status__now-tag agent-status__now-tag--${status.toLowerCase()}`}>
              {status === "REPLANNING" ? <RefreshCw size={13} /> : status === "HUMAN_REVIEW" ? <UserCheck size={13} /> : <AlertTriangle size={13} />}
              {status}
            </span>
          ) : (
            <span className="agent-status__now-tag">{status}</span>
          )}
        </div>
        <h3 className="agent-status__now-label">{activity.label}</h3>
        <p className="agent-status__now-detail">{activity.detail}</p>
      </div>

      <div className="agent-status__steps">
        {STEPS.map((step, index) => {
          const isCompletedRun = status === "COMPLETED";
          const isDone = isCompletedRun ? index <= activeIndex : index < activeIndex;
          const isActive = !isCompletedRun && index === activeIndex;
          const stateClass = isDone ? "is-done" : isActive ? "is-active" : "";
          return (
            <div className={`agent-status__step ${stateClass}`} key={step.key}>
              <span className="agent-status__dot">
                {isDone ? (
                  <span className="agent-status__dot-check">✓</span>
                ) : isActive ? (
                  <span className="agent-status__dot-spinner" aria-hidden="true" />
                ) : null}
              </span>
              <span className="agent-status__step-label">{step.label}</span>
            </div>
          );
        })}
      </div>

      {isInterrupt ? (
        <div className={`agent-status__callout agent-status__callout--${status.toLowerCase()}`}>
          {status === "REPLANNING" ? <RefreshCw size={16} /> : status === "HUMAN_REVIEW" ? <UserCheck size={16} /> : <AlertTriangle size={16} />}
          <span>
            {status === "REPLANNING"
              ? "Replanning — the executed route failed (environment feedback) and the agent is choosing the best remaining alternative."
              : status === "HUMAN_REVIEW"
                ? "Routed to human review — no safe autonomous route remains after observing the failures below."
                : "Session failed — the process could not complete a resolution."}
          </span>
        </div>
      ) : null}
    </div>
  );
}