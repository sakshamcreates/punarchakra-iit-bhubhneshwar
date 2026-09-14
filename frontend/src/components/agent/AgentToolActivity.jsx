import { AlertTriangle, CheckCircle2, RefreshCw, Eye, Zap } from "lucide-react";
import Card from "../ui/Card";
import {
  getToolActivityRows,
  getToolActivityStageLabel,
} from "../../utils/agentTimeline";

function RowIcon({ row }) {
  if (row.kind === "replan")
    return <RefreshCw size={14} className="agent-tool-row__icon agent-tool-row__icon--replan" />;
  if (row.kind === "environment")
    return <Eye size={14} className="agent-tool-row__icon agent-tool-row__icon--environment" />;
  if (row.tone === "failure")
    return <AlertTriangle size={14} className="agent-tool-row__icon agent-tool-row__icon--failure" />;
  if (row.kind === "tool")
    return <Zap size={14} className="agent-tool-row__icon agent-tool-row__icon--tool" />;
  return <CheckCircle2 size={14} className="agent-tool-row__icon agent-tool-row__icon--success" />;
}

export default function AgentToolActivity({ events }) {
  const rows = getToolActivityRows(events);

  if (rows.length === 0) {
    return null;
  }

  return (
    <Card className="agent-tool-activity">
      <h3>What the agent did</h3>
      <ul className="agent-tool-activity__list">
        {rows.map((row) => {
          const stage =
            row.kind === "replan"
              ? "adaptation"
              : row.kind === "environment"
                ? "environment result"
                : getToolActivityStageLabel(row.label);
          return (
            <li className={`agent-tool-row agent-tool-row--${row.kind}`} key={row.id}>
              <RowIcon row={row} />
              <span className="agent-tool-row__stage">{stage}</span>
              <span className="agent-tool-row__label">{row.label}</span>
              {row.detail ? <span className="agent-tool-row__detail">→ {row.detail}</span> : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}