import { AlertTriangle, CheckCircle2, Flag, RefreshCw, ArrowRight, Circle } from "lucide-react";
import {
  getEventPhaseLabel,
  getEventTone,
  observationErrorCode,
} from "../../utils/agentTimeline";

function iconFor(event, tone) {
  if (event.type === "REPLAN") return <RefreshCw size={16} />;
  if (event.type === "AGENT_START") return <Flag size={16} />;
  if (event.type === "ACTION") return <ArrowRight size={16} />;
  if (tone === "failure") return <AlertTriangle size={16} />;
  if (tone === "success") return <CheckCircle2 size={16} />;
  return <Circle size={12} />;
}

function formatTime(timestamp) {
  if (!timestamp) return "";
  try {
    return new Date(timestamp).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch (error) {
    return "";
  }
}

export default function AgentTimelineEvent({ event }) {
  const tone = getEventTone(event);
  const phase = getEventPhaseLabel(event);
  const isEnvironmentResult =
    event.type === "OBSERVATION" && event.tool === "execute_resolution";
  const errorCode =
    isEnvironmentResult && tone === "failure" ? observationErrorCode(event) : null;

  return (
    <li className={`agent-timeline__item agent-timeline__item--${tone}`}>
      <span className={`agent-timeline__icon agent-timeline__icon--${tone}`}>{iconFor(event, tone)}</span>
      <div className="agent-timeline__body">
        <div className="agent-timeline__meta-row">
          <span className="agent-timeline__phase">{phase}</span>
          {isEnvironmentResult ? (
            <span className="agent-timeline__env">
              environment feedback{errorCode ? ` · ${errorCode}` : ""}
            </span>
          ) : null}
          <span className="agent-timeline__meta">{formatTime(event.timestamp)}</span>
        </div>
        <p className="agent-timeline__message">{event.message}</p>
      </div>
    </li>
  );
}