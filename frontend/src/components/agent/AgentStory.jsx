import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  ChevronDown,
  Eye,
  Flag,
  Lightbulb,
  Loader2,
  RefreshCw,
  UserCheck,
  XCircle,
  Zap,
} from "lucide-react";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import { formatCurrency } from "../../utils/formatters";
import {
  buildAgentStory,
  routeLabel,
} from "../../utils/agentTimeline";

/*
 * Phase 11 — the closed-loop view.
 *
 * Renders the agent's session as the autonomous loop it actually is:
 *
 *   GOAL
 *     -> OBSERVE (inspect / value / constraints)
 *     -> DECIDE  -> ACT  -> OBSERVE RESULT
 *          (failure -> REPLAN -> NEW DECIDE -> NEW ACT -> OBSERVE RESULT)
 *     -> VERIFY  -> COMPLETE
 *
 * Every node is derived from the real persisted session records via
 * buildAgentStory() — decisionHistory, replanHistory, observations and
 * verificationResult. Nothing here is invented; a failed result is the
 * environment's feedback, a replan is the recorded exclusion, and the
 * verification block is verify_resolution's actual verdict.
 */

const LOOP = [
  { key: "observe", label: "Observe" },
  { key: "decide", label: "Decide" },
  { key: "act", label: "Act" },
  { key: "observe-result", label: "Observe result" },
  { key: "verify", label: "Verify" },
];

function LoopLabel({ stepClass, icon, text }) {
  return (
    <div className={`agent-loop-step__label ${stepClass ? `agent-loop-step__label--${stepClass}` : ""}`}>
      <span className="agent-loop-step__label-icon">{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function DecisionNode({ attempt, isLatest }) {
  const { decision, index } = attempt;
  if (!decision) return null;

  const excluded = Array.isArray(decision.excludedOptions)
    ? decision.excludedOptions
    : [];

  return (
    <div className={`agent-loop-step agent-loop-step--decision ${isLatest ? "is-latest" : ""}`}>
      <LoopLabel icon={<Lightbulb size={14} />} text={`Decision ${index}`} />
      <div className="agent-loop-node">
        <div className="agent-loop-node__head">
          <span className="agent-loop-node__route">{routeLabel(decision.route)}</span>
          {typeof decision.selectedValue === "number" ? (
            <strong className="agent-loop-node__value">{formatCurrency(decision.selectedValue)}</strong>
          ) : null}
        </div>
        {decision.reason ? <p className="agent-loop-node__reason">{decision.reason}</p> : null}
        {excluded.length > 0 ? (
          <div className="agent-loop-node__chips">
            {excluded.map((option) => (
              <span className="agent-chip agent-chip--blocked" key={`${decision.route}-${option.route}`}>
                ✕ {routeLabel(option.route)}
                {option.blockReason ? ` — ${option.blockReason}` : ""}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ActionNode({ attempt }) {
  const { action } = attempt;
  if (!action) return null;

  return (
    <div className="agent-loop-step agent-loop-step--action">
      <LoopLabel icon={<Zap size={14} />} text="Action" />
      <div className="agent-loop-node agent-loop-node--compact">
        <code>{action.tool}</code>
        <span className="agent-loop-node__sep">→</span>
        <strong>{routeLabel(action.route)}</strong>
      </div>
    </div>
  );
}

function ResultNode({ attempt, live }) {
  const { observation, index } = attempt;

  const waiting =
    !observation &&
    (live === "EXECUTING" || live === "OBSERVING" || live === "VERIFYING");

  if (!observation && !waiting) {
    return null;
  }

  const failed = observation && observation.success === false;
  const succeeded = observation && observation.success === true;

  return (
    <div
      className={`agent-loop-step agent-loop-step--result ${
        failed ? "is-failure" : succeeded ? "is-success" : "is-pending"
      }`}
    >
      <LoopLabel
        stepClass={failed ? "failure" : succeeded ? "success" : "pending"}
        icon={
          failed ? (
            <AlertTriangle size={14} />
          ) : succeeded ? (
            <CheckCircle2 size={14} />
          ) : (
            <Loader2 size={14} className="agent-spin" />
          )
        }
        text={`Result ${index ? `#${index}` : ""}`}
      />
      <div className="agent-loop-node">
        {!observation ? (
          <p className="agent-loop-node__pending">Waiting for the environment’s response…</p>
        ) : failed ? (
          <>
            <div className="agent-loop-node__head">
              <Badge variant="warning">FAILED</Badge>
              {observation.errorCode ? (
                <code className="agent-loop-node__error">{observation.errorCode}</code>
              ) : null}
            </div>
            <p className="agent-loop-node__feedback">
              <Eye size={13} />
              <span>
                Environment feedback — {observation.reason || "the executed route did not succeed."}
              </span>
            </p>
          </>
        ) : (
          <>
            <div className="agent-loop-node__head">
              <Badge>SUCCESS</Badge>
              <span className="agent-loop-node__route">{routeLabel(observation.route)}</span>
            </div>
            <p className="agent-loop-node__feedback agent-loop-node__feedback--ok">
              <Eye size={13} />
              <span>{observation.reason || "The executed route completed."}</span>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function ReplanNode({ attempt }) {
  const { replan } = attempt;
  if (!replan) return null;

  const noViableAlternative = replan.viable === false;
  const excluded = Array.isArray(replan.excludedRoutes) ? replan.excludedRoutes : [];

  return (
    <div className="agent-loop-step agent-loop-step--replan">
      <LoopLabel
        stepClass={noViableAlternative ? "failure" : "replan"}
        icon={<RefreshCw size={14} />}
        text="Replan"
      />
      <div className="agent-loop-node">
        <p className="agent-loop-node__row">
          <span className="agent-loop-node__row-label">Why</span>
          <span>{replan.failureReason || `Route ${routeLabel(replan.failedRoute)} failed`}</span>
        </p>
        <p className="agent-loop-node__row">
          <span className="agent-loop-node__row-label">Changed</span>
          <span>
            {excluded.length > 0 ? excluded.map(routeLabel).join(", ") : routeLabel(replan.failedRoute)}{" "}
            no longer viable — removed from the options
          </span>
        </p>
        {noViableAlternative ? (
          <p className="agent-loop-node__row">
            <span className="agent-loop-node__row-label">Decision</span>
            <span>No alternative route currently viable — routing to human review.</span>
          </p>
        ) : replan.selectedAlternative ? (
          <p className="agent-loop-node__row">
            <span className="agent-loop-node__row-label">Now choosing</span>
            <span>
              <strong>{routeLabel(replan.selectedAlternative.route)}</strong>
              {typeof replan.selectedAlternative.expectedValue === "number"
                ? ` (${formatCurrency(replan.selectedAlternative.expectedValue)})`
                : ""}{" "}
              — the highest-value remaining route
            </span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

function VerifyNode({ verification, finalResolution, live }) {
  const pending = !verification && live === "VERIFYING";
  // verify_resolution can return a real, structured "not confirmed"
  // verdict (passed: false) — that's a genuine outcome of the loop's
  // final stage, not an absence of one, so it gets its own visual state
  // instead of silently disappearing from the story.
  const failed = Boolean(verification) && verification.passed === false;

  return (
    <div
      className={`agent-loop-step agent-loop-step--verify ${
        pending ? "is-pending" : failed ? "is-failure" : "is-success"
      }`}
    >
      <LoopLabel
        stepClass={pending ? "pending" : failed ? "failure" : "success"}
        icon={
          pending ? (
            <Loader2 size={14} className="agent-spin" />
          ) : failed ? (
            <XCircle size={14} />
          ) : (
            <BadgeCheck size={14} />
          )
        }
        text={pending ? "Verifying" : "Verification"}
      />
      <div className="agent-loop-node">
        {pending ? (
          <p className="agent-loop-node__pending">Confirming the executed resolution took effect…</p>
        ) : failed ? (
          <>
            <div className="agent-loop-node__head">
              <Badge variant="warning">NOT CONFIRMED</Badge>
              <span className="agent-loop-node__route">
                {routeLabel(verification.route || (finalResolution && finalResolution.route))}
              </span>
            </div>
            <p className="agent-loop-node__feedback">
              <Eye size={13} />
              <span>
                {verification.reason ||
                  "The executed resolution could not be independently confirmed against the item's actual state."}
              </span>
            </p>
          </>
        ) : (
          <>
            <div className="agent-loop-node__head">
              <Badge>CONFIRMED</Badge>
              <span className="agent-loop-node__route">
                {routeLabel(verification.route || (finalResolution && finalResolution.route))}
              </span>
            </div>
            {verification.reason ? (
              <p className="agent-loop-node__feedback agent-loop-node__feedback--ok">{verification.reason}</p>
            ) : null}
            <dl className="agent-loop-node__grid">
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
                  <dd className="agent-loop-node__mono">{verification.resolutionId.slice(0, 8)}</dd>
                </div>
              ) : null}
              {verification.verifiedAt ? (
                <div>
                  <dt>Verified at</dt>
                  <dd>
                    {new Date(verification.verifiedAt).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </dd>
                </div>
              ) : null}
            </dl>
          </>
        )}
      </div>
    </div>
  );
}

function PreflightStrip({ preflight }) {
  if (!Array.isArray(preflight) || preflight.length === 0) {
    return null;
  }

  return (
    <ol className="agent-story__preflight">
      {preflight.map((step) => (
        <li
          className={`agent-story__preflight-step ${
            step.failed ? "is-failed" : step.done ? "is-done" : "is-pending"
          }`}
          key={step.key}
        >
          {step.failed ? <XCircle size={13} /> : step.done ? <CheckCircle2 size={13} /> : <Loader2 size={13} className="agent-spin" />}
          <span className="agent-story__preflight-label">{step.label}</span>
          {step.detail ? <span className="agent-story__preflight-detail">{step.detail}</span> : null}
        </li>
      ))}
    </ol>
  );
}

function ReplanNote() {
  return (
    <div className="agent-story__replan-note">
      <RefreshCw size={15} />
      <span>
        When the environment blocks an executed route, the agent <strong>excludes that route</strong> and{" "}
        <strong>decides again</strong> — it never silently retries the same action.
      </span>
    </div>
  );
}

export default function AgentStory({ session, events }) {
  const story = buildAgentStory(session, events);
  if (!story) {
    return null;
  }

  const { attempts, review, failed, verification, finalResolution, preflight, latest } = story;
  const live = story.status;

  // Nothing has been observed or decided yet (just started / IDLE).
  const blank =
    attempts.length === 0 &&
    preflight.length === 0 &&
    !review &&
    !failed &&
    !verification;

  return (
    <Card className="agent-story">
      <div className="agent-story__head">
        <div>
          <span className="agent-story__eyebrow">Autonomous resolution loop</span>
          <h3>
            {review
              ? "No viable autonomous route"
              : verification && verification.passed === false
                ? "Resolution loop — verification failed"
                : verification
                  ? "Resolution loop — completed"
                  : failed
                    ? "Resolution loop — failed"
                    : "Resolution loop — in progress"}
          </h3>
        </div>
        <span className="agent-story__badge">Observe → Decide → Act → Observe → Replan → Verify</span>
      </div>

      <p className="agent-story__intro">
        This is not a recommendation. The agent <strong>executes</strong> each chosen route itself,{" "}
        <strong>observes</strong> what the environment actually returned, and — when a route fails —{" "}
        <strong>excludes it and decides again</strong>.
      </p>

      {latest && !blank ? (
        <div className={`agent-story__latest agent-story__latest--${latest.tone}`}>
          <span className="agent-story__latest-phase">{latest.phase}</span>
          <span className="agent-story__latest-message">{latest.message}</span>
        </div>
      ) : null}

      {!blank ? <PreflightStrip preflight={preflight} /> : null}

      <ol className="agent-loop">
        {blank ? (
          <li className="agent-loop__empty">
            <Flag size={16} />
            <span>
              The agent will observe the item, decide a route, execute it, and observe the result — replanning
              automatically if the environment blocks it.
            </span>
          </li>
        ) : (
          <>
            {story.goal ? (
              <li className="agent-loop__goal">
                <span className="agent-loop__goal-label">Goal</span>
                <span>{story.goal}</span>
              </li>
            ) : null}

            {attempts.length > 0 ? (
              attempts.map((attempt) => {
                const isFirst = attempt.index === 1;
                return (
                  <li className="agent-loop__attempt" key={`attempt-${attempt.index}-${attempt.decision?.route || attempt.observation?.route || attempt.index}`}>
                    <DecisionNode attempt={attempt} isLatest={isFirst && attempts.length === 1} />
                    <ActionNode attempt={attempt} />
                    <ResultNode attempt={attempt} live={live} />
                    {attempt.replan ? (
                      <>
                        <ReplanNode attempt={attempt} />
                        <span className="agent-loop__replan-branch">
                          <ChevronDown size={14} />
                          <span>route excluded → agent decides again</span>
                        </span>
                      </>
                    ) : null}
                  </li>
                );
              })
            ) : (
              <li className="agent-loop__awaiting">
                <Loader2 size={15} className="agent-spin" />
                <span>Observing and deciding…</span>
              </li>
            )}

            {verification ? <VerifyNode verification={verification} finalResolution={finalResolution} live={live} /> : null}
            {!verification && live === "VERIFYING" ? (
              <VerifyNode verification={null} finalResolution={finalResolution} live={live} />
            ) : null}

            {review ? (
              <li className="agent-loop-step agent-loop-step--review">
                <LoopLabel stepClass="review" icon={<UserCheck size={14} />} text="Human review" />
                <div className="agent-loop-node">
                  <p className="agent-loop-node__row">
                    <span className="agent-loop-node__row-label">Why</span>
                    <span>{review.failureReason || "No currently viable resolution route could be found."}</span>
                  </p>
                  <p className="agent-loop-node__row">
                    <span className="agent-loop-node__row-label">Attempts</span>
                    <span>{review.attemptCount}</span>
                  </p>
                  {review.blockedRoutes && review.blockedRoutes.length > 0 ? (
                    <div className="agent-loop-node__chips">
                      {review.blockedRoutes.map((b) => (
                        <span className="agent-chip agent-chip--blocked" key={b.route}>
                          ✕ {routeLabel(b.route)} — {b.reason}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </li>
            ) : null}

            {failed ? (
              <li className="agent-loop-step agent-loop-step--failed">
                <LoopLabel stepClass="failure" icon={<XCircle size={14} />} text="Failed" />
                <div className="agent-loop-node">
                  <p className="agent-loop-node__feedback">
                    {failed.failureReason || "The session could not complete a resolution."}
                  </p>
                </div>
              </li>
            ) : null}
          </>
        )}
      </ol>

      {!blank ? <ReplanNote /> : null}

      <div className="agent-story__arch">
        <span className="agent-story__arch-label">Traditional system</span>
        <span className="agent-story__arch-line">Recommendation → human executes</span>
        <span className="agent-story__arch-divider" />
        <span className="agent-story__arch-label agent-story__arch-label--this">ReValue agent</span>
        <span className="agent-story__arch-line agent-story__arch-line--this">
          {LOOP.map((step) => step.label).join(" → ")}
        </span>
      </div>
    </Card>
  );
}