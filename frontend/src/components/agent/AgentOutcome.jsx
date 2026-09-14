import { CheckCircle2, XCircle, UserCheck } from "lucide-react";
import Card from "../ui/Card";
import { formatCurrency } from "../../utils/formatters";
import {
  routeLabel,
  getBlockedRoutes,
} from "../../utils/agentTimeline";

function formatTime(timestamp) {
  if (!timestamp) return "";
  try {
    return new Date(timestamp).toLocaleString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch (error) {
    return "";
  }
}

export default function AgentOutcome({ session }) {
  if (!session) return null;
  const status = session.currentStatus;

  if (status === "COMPLETED") {
    const outcome = session.finalResolution || {};
    const verification = session.verificationResult || {};
    const value =
      Array.isArray(session.availableOptions) &&
      session.availableOptions.find((option) => option.route === outcome.route);

    return (
      <Card className="agent-outcome agent-outcome--success">
        <div className="agent-outcome__header">
          <CheckCircle2 size={22} />
          <div>
            <span className="agent-outcome__eyebrow">Final outcome — proof of execution</span>
            <h3>{routeLabel(outcome.route)}</h3>
          </div>
        </div>
        <dl className="agent-outcome__grid">
          <div>
            <dt>Execution</dt>
            <dd>Completed</dd>
          </div>
          <div>
            <dt>Verification</dt>
            <dd>{verification.passed ? "Confirmed" : "Unconfirmed"}</dd>
          </div>
          {value ? (
            <div>
              <dt>Expected value</dt>
              <dd>{formatCurrency(value.expectedValue)}</dd>
            </div>
          ) : null}
          {verification.resolutionStatus ? (
            <div>
              <dt>Resolution state</dt>
              <dd>{verification.resolutionStatus}</dd>
            </div>
          ) : null}
          {verification.listingStatus ? (
            <div>
              <dt>Item state</dt>
              <dd>{verification.listingStatus}</dd>
            </div>
          ) : null}
          {verification.expectedSaleType ? (
            <div>
              <dt>Sale type</dt>
              <dd>{verification.expectedSaleType}</dd>
            </div>
          ) : null}
          {verification.resolutionId ? (
            <div>
              <dt>Resolution id</dt>
              <dd className="agent-outcome__mono">…{verification.resolutionId.slice(-6)}</dd>
            </div>
          ) : null}
          {outcome.verifiedAt ? (
            <div>
              <dt>Verified at</dt>
              <dd>{formatTime(outcome.verifiedAt)}</dd>
            </div>
          ) : null}
        </dl>
        {verification.reason ? (
          <p className="agent-outcome__note">
            {verification.reason}
          </p>
        ) : null}
        {outcome.route ? (
          <p className="agent-outcome__note agent-outcome__note--proof">
            The agent did not just decide {routeLabel(outcome.route)} — it executed it and independently confirmed
            the resulting item state ({verification.resolutionStatus || "resolved"}{verification.listingStatus ? `, status ${verification.listingStatus}` : ""}).
          </p>
        ) : null}
      </Card>
    );
  }

  if (status === "HUMAN_REVIEW") {
    const blocked = getBlockedRoutes(session);
    const failedObservations = (Array.isArray(session.observations) ? session.observations : []).filter(
      (o) => o && o.success === false,
    );

    return (
      <Card className="agent-outcome agent-outcome--review">
        <div className="agent-outcome__header">
          <UserCheck size={22} />
          <div>
            <span className="agent-outcome__eyebrow">Human review needed</span>
            <h3>No viable autonomous resolution was found</h3>
          </div>
        </div>
        <p className="agent-outcome__note">
          {session.failureReason ||
            "The agent tried the available routes but could not find a resolution it could safely execute autonomously."}
        </p>
        <p className="agent-outcome__meta">Attempts made: {session.attemptCount || 0}</p>
        {blocked.length > 0 ? (
          <div className="agent-outcome__chips">
            {blocked.map((entry) => (
              <span className="agent-chip agent-chip--blocked" key={entry.route}>
                ✕ {routeLabel(entry.route)}: {entry.reason}
              </span>
            ))}
          </div>
        ) : null}
        {failedObservations.length > 0 ? (
          <ul className="agent-outcome__observations">
            {failedObservations.map((obs, index) => (
              <li key={index}>
                <strong>{routeLabel(obs.route)}</strong>
                {obs.errorCode ? <code> {obs.errorCode}</code> : null}
                {obs.reason ? ` — ${obs.reason}` : ""}
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
    );
  }

  if (status === "FAILED") {
    return (
      <Card className="agent-outcome agent-outcome--failed">
        <div className="agent-outcome__header">
          <XCircle size={22} />
          <div>
            <span className="agent-outcome__eyebrow">Session failed</span>
            <h3>Resolution could not complete</h3>
          </div>
        </div>
        {session.failureReason ? <p className="agent-outcome__note">{session.failureReason}</p> : null}
      </Card>
    );
  }

  return null;
}