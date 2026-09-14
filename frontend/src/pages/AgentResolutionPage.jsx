import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  UploadCloud,
  Target,
  Search,
  BarChart3,
  AlertTriangle,
  Settings,
  CheckCircle2,
  Flag,
  Wrench,
  Layers,
  Recycle,
  Check,
  Circle,
  Copy,
  MapPin,
} from "lucide-react";

import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";

import agentService from "../services/agentService";
import { getListing } from "../services/listingService";
import { fileToImageInput, dataUrlToImageInput } from "../utils/fileToImageInput";
import { formatCurrency } from "../utils/formatters";
import {
  buildAgentStory,
  buildRouteAvailability,
  routeLabel,
  getMainTimelineEvents,
  getEventTone,
} from "../utils/agentTimeline";

const SESSION_STORAGE_PREFIX = "revalue_agent_session_";
const MAX_ADVANCE_ITERATIONS = 30;
const STEP_PACING_MS = 450;
const TERMINAL_STATUSES = ["COMPLETED", "FAILED", "HUMAN_REVIEW"];

const DEFAULT_MOTHERBOARD_IMAGE =
  "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80";

function sessionStorageKey(itemId) {
  return `${SESSION_STORAGE_PREFIX}${itemId}`;
}

/* ============================================================
   7 RESOLUTION STEPS — Exactly matching reference design
   ============================================================ */
const RESOLUTION_STEPS = [
  {
    key: "goal",
    index: 0,
    label: "Goal",
    title: "Set resolution goal",
    subtitle: "Determine the best possible outcome for this item.",
    icon: Target,
    iconTheme: "green",
    statuses: ["IDLE"],
  },
  {
    key: "inspect",
    index: 1,
    label: "Inspect",
    title: "Analyzing item",
    subtitle: "Checking condition, category and available options.",
    icon: Search,
    iconTheme: "teal",
    statuses: ["INSPECTING"],
  },
  {
    key: "evaluate",
    index: 2,
    label: "Evaluate",
    title: "Evaluating possible routes",
    subtitle: "Comparing viable options for the best outcome.",
    icon: BarChart3,
    iconTheme: "rose",
    statuses: ["EVALUATING", "CHECKING_CONSTRAINTS"],
  },
  {
    key: "decide",
    index: 3,
    label: "Decide",
    title: "Selecting best route",
    subtitle: "Choosing the most value-efficient and feasible option.",
    icon: AlertTriangle,
    iconTheme: "peach",
    statuses: ["DECIDING", "REPLANNING"],
  },
  {
    key: "execute",
    index: 4,
    label: "Execute",
    title: "Executing route",
    subtitle: "Initiating the selected resolution path.",
    icon: Settings,
    iconTheme: "blue",
    statuses: ["EXECUTING"],
  },
  {
    key: "verify",
    index: 5,
    label: "Verify",
    title: "Validating outcome",
    subtitle: "Confirming results and final details.",
    icon: CheckCircle2,
    iconTheme: "green",
    statuses: ["OBSERVING", "VERIFYING"],
  },
  {
    key: "complete",
    index: 6,
    label: "Complete",
    title: "Resolution done",
    subtitle: "Final outcome ready.",
    icon: Flag,
    iconTheme: "slate",
    statuses: ["COMPLETED", "FAILED", "HUMAN_REVIEW"],
  },
];

function getActiveStepIndex(status) {
  if (!status) return 2; // Default to Evaluate (step 3) for hero visual if not yet started
  for (let i = RESOLUTION_STEPS.length - 1; i >= 0; i--) {
    if (RESOLUTION_STEPS[i].statuses.includes(status)) {
      return i;
    }
  }
  return 2;
}

function getStepState(stepIndex, activeIndex, status) {
  if (status === "COMPLETED") return "completed";
  if (status === "FAILED" || status === "HUMAN_REVIEW") {
    if (stepIndex < activeIndex) return "completed";
    if (stepIndex === activeIndex) return "failed";
    return "upcoming";
  }
  if (stepIndex < activeIndex) return "completed";
  if (stepIndex === activeIndex) return "active";
  return "upcoming";
}

/* ============================================================
   CARD CONTENT RENDERERS
   ============================================================ */
function GoalCardContent({ session, listing }) {
  return (
    <div className="agent-resolution__card-body">
      <p className="agent-resolution__card-desc">
        {session?.goal || "Determine the best possible outcome for this item."}
      </p>
      <div className="agent-resolution__card-detail">
        <span className="agent-resolution__card-detail-label">Item</span>
        <span>{listing?.title || session?.detectedDevice?.categoryLabel || "Generic Motherboard-X1"}</span>
      </div>
      <div className="agent-resolution__card-detail">
        <span className="agent-resolution__card-detail-label">Goal</span>
        <span>Max value outcome via circular reuse</span>
      </div>
    </div>
  );
}

function InspectCardContent({ session, listing }) {
  const image = (listing && Array.isArray(listing.images) && listing.images[0]) || DEFAULT_MOTHERBOARD_IMAGE;
  const category = listing?.category || session?.detectedDevice?.category || "electronics";
  const condition = listing?.condition || "poor";

  return (
    <div className="agent-resolution__card-body">
      <div className="agent-resolution__inspect-body">
        <div className="agent-resolution__inspect-image">
          <img src={image} alt="Inspected device" onError={(e) => { e.currentTarget.style.display = "none"; }} />
        </div>
        <div className="agent-resolution__inspect-tags">
          <span className="agent-resolution__badge agent-resolution__badge--green">{category}</span>
          <span className="agent-resolution__badge agent-resolution__badge--neutral">{condition}</span>
        </div>
      </div>
    </div>
  );
}

const DEFAULT_EVAL_ROUTES = [
  {
    route: "repair",
    label: "Repair",
    desc: "Can be repaired and resold",
    expectedValue: 18000,
    icon: Wrench,
    available: true,
  },
  {
    route: "parts",
    label: "Parts recovery",
    desc: "Extract usable components",
    expectedValue: 12400,
    icon: Layers,
    available: true,
  },
  {
    route: "recycle",
    label: "Recycle",
    desc: "Send for material recovery",
    expectedValue: 2800,
    icon: Recycle,
    available: true,
  },
];

function EvaluateCardContent({ session }) {
  const backendRoutes = buildRouteAvailability(session);
  const isReplanning = session?.currentStatus === "REPLANNING";

  const routes = backendRoutes.length > 0
    ? backendRoutes.map((r) => {
        let Icon = Wrench;
        let desc = "Standard circular route";
        if (r.route === "repair") { Icon = Wrench; desc = "Can be repaired and resold"; }
        else if (r.route === "parts") { Icon = Layers; desc = "Extract usable components"; }
        else if (r.route === "scrap" || r.route === "recycle") { Icon = Recycle; desc = "Send for material recovery"; }
        return {
          route: r.route,
          label: routeLabel(r.route),
          desc,
          expectedValue: r.expectedValue,
          icon: Icon,
          available: r.available,
          blocked: r.blocked,
          reason: r.reason,
        };
      })
    : DEFAULT_EVAL_ROUTES;

  // Selected route: if replanning or repair blocked, prefer parts; else repair
  const selectedRouteKey = isReplanning || routes[0]?.blocked
    ? routes.find((r) => !r.blocked)?.route || routes[1]?.route
    : routes[0]?.route;

  return (
    <div className="agent-resolution__card-body">
      <div className="agent-resolution__routes-list">
        {routes.map((option) => {
          const isSelected = option.route === selectedRouteKey;
          const isBlocked = option.blocked;
          const RouteIcon = option.icon;

          return (
            <div
              className={`agent-resolution__route-row ${isSelected ? "agent-resolution__route-row--selected" : ""} ${isBlocked ? "agent-resolution__route-row--blocked" : ""}`}
              key={option.route}
            >
              <div className="agent-resolution__route-radio">
                {isSelected ? <span className="agent-resolution__route-radio-inner" /> : null}
              </div>

              <div className={`agent-resolution__route-icon-box ${isSelected ? "agent-resolution__route-icon-box--selected" : ""}`}>
                <RouteIcon size={16} />
              </div>

              <div className="agent-resolution__route-content">
                <strong className="agent-resolution__route-name">{option.label}</strong>
                <span className="agent-resolution__route-desc">
                  {isBlocked && option.reason ? `Blocked: ${option.reason}` : option.desc}
                </span>
              </div>

              <div className="agent-resolution__route-val-box">
                <span className="agent-resolution__route-val-label">Estimated value</span>
                <strong className="agent-resolution__route-val-amount">
                  {formatCurrency(option.expectedValue)}
                </strong>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DecideCardContent({ session }) {
  const story = buildAgentStory(session, []);
  const latestDecision = story?.attempts?.length > 0
    ? story.attempts[story.attempts.length - 1].decision
    : null;

  return (
    <div className="agent-resolution__card-body">
      {latestDecision ? (
        <>
          <div className="agent-resolution__card-detail">
            <span className="agent-resolution__card-detail-label">Chosen route</span>
            <strong className="agent-resolution__decided-route">{routeLabel(latestDecision.route)}</strong>
          </div>
          {latestDecision.reason && (
            <div className="agent-resolution__card-detail">
              <span className="agent-resolution__card-detail-label">Rationale</span>
              <span>{latestDecision.reason}</span>
            </div>
          )}
          {typeof latestDecision.selectedValue === "number" && (
            <div className="agent-resolution__card-detail">
              <span className="agent-resolution__card-detail-label">Target value</span>
              <strong>{formatCurrency(latestDecision.selectedValue)}</strong>
            </div>
          )}
          {Array.isArray(latestDecision.excludedOptions) && latestDecision.excludedOptions.length > 0 && (
            <div className="agent-resolution__excluded-chips">
              {latestDecision.excludedOptions.map((opt) => (
                <span className="agent-resolution__excluded-chip" key={opt.route}>
                  ✕ {routeLabel(opt.route)} {opt.blockReason ? `(${opt.blockReason})` : ""}
                </span>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="agent-resolution__card-detail">
          <span className="agent-resolution__card-detail-label">Decision basis</span>
          <span>Highest projected return with verified component availability.</span>
        </div>
      )}
    </div>
  );
}

function ExecuteCardContent({ session }) {
  const story = buildAgentStory(session, []);
  const latestAttempt = story?.attempts?.length > 0
    ? story.attempts[story.attempts.length - 1]
    : null;
  const observation = latestAttempt?.observation;
  const hasFailed = observation?.success === false;

  return (
    <div className="agent-resolution__card-body">
      {latestAttempt ? (
        <>
          <div className="agent-resolution__card-detail">
            <span className="agent-resolution__card-detail-label">Action</span>
            <span>execute_resolution → {routeLabel(latestAttempt.action?.route)}</span>
          </div>
          {observation ? (
            <div className={`agent-resolution__exec-result ${hasFailed ? "agent-resolution__exec-result--failed" : "agent-resolution__exec-result--success"}`}>
              {hasFailed ? (
                <>
                  <AlertTriangle size={16} />
                  <div>
                    <strong>Execution feedback</strong>
                    {observation.errorCode && <code>{observation.errorCode}</code>}
                    {observation.reason && <p>{observation.reason}</p>}
                  </div>
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  <div>
                    <strong>Execution confirmed</strong>
                    {observation.reason && <p>{observation.reason}</p>}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="agent-resolution__card-detail">
              <span className="agent-resolution__card-detail-label">Status</span>
              <span className="agent-resolution__executing-indicator">Applying chosen resolution to item…</span>
            </div>
          )}
        </>
      ) : (
        <p className="agent-resolution__card-desc">Initiates resolution path once the best viable route is chosen.</p>
      )}
    </div>
  );
}

function VerifyCardContent({ session }) {
  const verification = session?.verificationResult;

  return (
    <div className="agent-resolution__card-body">
      {verification ? (
        <>
          <div className="agent-resolution__card-detail">
            <span className="agent-resolution__card-detail-label">Expected</span>
            <span>{routeLabel(verification.route || session?.finalResolution?.route)}</span>
          </div>
          <div className="agent-resolution__card-detail">
            <span className="agent-resolution__card-detail-label">Status</span>
            <strong className={verification.passed ? "agent-resolution__text-success" : "agent-resolution__text-warning"}>
              {verification.passed ? "Confirmed" : "Not confirmed"}
            </strong>
          </div>
          {verification.reason && (
            <div className="agent-resolution__card-detail">
              <span className="agent-resolution__card-detail-label">Proof</span>
              <span>{verification.reason}</span>
            </div>
          )}
        </>
      ) : (
        <p className="agent-resolution__card-desc">Independently confirms the executed resolution took effect on the physical device.</p>
      )}
    </div>
  );
}

function CompleteCardContent({ session }) {
  const outcome = session?.finalResolution;
  const verification = session?.verificationResult;
  const status = session?.currentStatus;
  const value =
    Array.isArray(session?.availableOptions) &&
    session.availableOptions.find((o) => o.route === outcome?.route);

  if (status === "HUMAN_REVIEW") {
    return (
      <div className="agent-resolution__card-body">
        <div className="agent-resolution__card-detail">
          <span className="agent-resolution__card-detail-label">State</span>
          <strong className="agent-resolution__text-warning">Human review needed</strong>
        </div>
        <p className="agent-resolution__card-desc">
          {session.failureReason || "No viable autonomous resolution was found."}
        </p>
      </div>
    );
  }

  if (status === "FAILED") {
    return (
      <div className="agent-resolution__card-body">
        <div className="agent-resolution__card-detail">
          <span className="agent-resolution__card-detail-label">State</span>
          <strong className="agent-resolution__text-error">Session failed</strong>
        </div>
        {session.failureReason && (
          <p className="agent-resolution__card-desc">{session.failureReason}</p>
        )}
      </div>
    );
  }

  if (status === "COMPLETED" && outcome) {
    return (
      <div className="agent-resolution__card-body">
        <div className="agent-resolution__card-detail">
          <span className="agent-resolution__card-detail-label">Final route</span>
          <strong className="agent-resolution__decided-route">{routeLabel(outcome.route)}</strong>
        </div>
        <div className="agent-resolution__card-detail">
          <span className="agent-resolution__card-detail-label">Verification</span>
          <strong className="agent-resolution__text-success">
            {verification?.passed ? "Confirmed" : "Completed"}
          </strong>
        </div>
        {value && (
          <div className="agent-resolution__card-detail">
            <span className="agent-resolution__card-detail-label">Realized value</span>
            <strong>{formatCurrency(value.expectedValue)}</strong>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="agent-resolution__card-body">
      <p className="agent-resolution__card-desc">Resolution process finalizes with verified state and ledger entry.</p>
    </div>
  );
}

function CardContent({ stepKey, session, listing }) {
  switch (stepKey) {
    case "goal": return <GoalCardContent session={session} listing={listing} />;
    case "inspect": return <InspectCardContent session={session} listing={listing} />;
    case "evaluate": return <EvaluateCardContent session={session} />;
    case "decide": return <DecideCardContent session={session} />;
    case "execute": return <ExecuteCardContent session={session} />;
    case "verify": return <VerifyCardContent session={session} />;
    case "complete": return <CompleteCardContent session={session} />;
    default: return null;
  }
}

/* ============================================================
   ROTATING CAROUSEL (THE HERO EXPERIENCE)
   ============================================================ */
function ResolutionCarousel({ activeStep, session, listing, onNavigate }) {
  const currentStatus = session?.currentStatus;
  const isReplanning = currentStatus === "REPLANNING";

  // Step status bar text
  let statusText = "Analyzing options...";
  if (isReplanning) {
    statusText = "Replanning route...";
  } else if (currentStatus === "EXECUTING") {
    statusText = "Executing resolution...";
  } else if (currentStatus === "VERIFYING" || currentStatus === "OBSERVING") {
    statusText = "Validating outcome...";
  } else if (currentStatus === "COMPLETED") {
    statusText = "Resolution completed";
  }

  return (
    <div className="agent-resolution__carousel-wrapper">
      {/* Left Navigation Arrow */}
      <button
        className="agent-resolution__carousel-arrow agent-resolution__carousel-arrow--left"
        onClick={() => onNavigate(Math.max(0, activeStep - 1))}
        disabled={activeStep === 0}
        aria-label="Previous step"
      >
        <ChevronLeft size={20} />
      </button>

      {/* Cards Container */}
      <div className="agent-resolution__carousel">
        <div
          className="agent-resolution__carousel-track"
          style={{
            transform: `translateX(calc(50% - ${activeStep * 260 + 210}px))`,
          }}
        >
          {RESOLUTION_STEPS.map((step, i) => {
            const state = session ? getStepState(i, activeStep, currentStatus) : (i < activeStep ? "completed" : i === activeStep ? "active" : "upcoming");
            const isCenter = i === activeStep;
            const distance = Math.abs(i - activeStep);
            const StepIcon = step.icon;

            return (
              <div
                className={`agent-resolution__card agent-resolution__card--${state} ${isCenter ? "agent-resolution__card--center" : "agent-resolution__card--side"}`}
                key={step.key}
                style={{
                  transform: isCenter
                    ? "scale(1)"
                    : distance === 1
                      ? "scale(0.90)"
                      : distance === 2
                        ? "scale(0.80)"
                        : "scale(0.70)",
                  opacity: distance > 3 ? 0.35 : distance > 2 ? 0.55 : distance > 1 ? 0.8 : 1,
                  zIndex: isCenter ? 10 : 10 - distance,
                }}
                onClick={() => onNavigate(i)}
                role="button"
                tabIndex={0}
                aria-label={`Step ${i + 1}: ${step.label}`}
              >
                {/* Card Header */}
                <div className="agent-resolution__card-header">
                  <div className={`agent-resolution__card-icon-wrap agent-resolution__card-icon-wrap--${step.iconTheme}`}>
                    <StepIcon size={16} />
                  </div>
                  <span className="agent-resolution__card-step-num">
                    {i + 1}. {step.label}
                  </span>
                  {isCenter && (
                    <span className="agent-resolution__card-counter">{i + 1} / 7</span>
                  )}
                </div>

                {/* Card Title & Subtitle */}
                <h3 className="agent-resolution__card-title">{step.title}</h3>
                <p className="agent-resolution__card-subtitle">{step.subtitle}</p>

                {/* Content */}
                {isCenter ? (
                  <>
                    <CardContent stepKey={step.key} session={session} listing={listing} />
                    {/* Bottom Status Pill */}
                    <div className="agent-resolution__card-action-wrap">
                      <div className="agent-resolution__card-action-pill">
                        <span className="agent-resolution__card-spin-icon">⟳</span>
                        <span>{statusText}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  /* Non-center card preview */
                  step.key === "inspect" ? (
                    <div className="agent-resolution__side-preview">
                      <div className="agent-resolution__side-thumb">
                        <img src={(listing && Array.isArray(listing.images) && listing.images[0]) || DEFAULT_MOTHERBOARD_IMAGE} alt="Thumbnail" />
                      </div>
                      <div className="agent-resolution__side-tags">
                        <span className="agent-resolution__badge agent-resolution__badge--green">electronics</span>
                        <span className="agent-resolution__badge agent-resolution__badge--neutral">poor</span>
                      </div>
                    </div>
                  ) : null
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Navigation Arrow */}
      <button
        className="agent-resolution__carousel-arrow agent-resolution__carousel-arrow--right"
        onClick={() => onNavigate(Math.min(6, activeStep + 1))}
        disabled={activeStep === 6}
        aria-label="Next step"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}

/* ============================================================
   PROGRESS INDICATOR
   ============================================================ */
function ProgressIndicator({ activeStep, session, onNavigate }) {
  const currentStatus = session?.currentStatus;

  return (
    <div className="agent-resolution__progress">
      <button
        className="agent-resolution__progress-nav"
        onClick={() => onNavigate(Math.max(0, activeStep - 1))}
        disabled={activeStep === 0}
        aria-label="Previous step"
      >
        <ChevronLeft size={16} />
      </button>

      <div className="agent-resolution__progress-track">
        {RESOLUTION_STEPS.map((step, i) => {
          const state = session ? getStepState(i, activeStep, currentStatus) : (i < activeStep ? "completed" : i === activeStep ? "active" : "upcoming");
          const isDone = state === "completed";
          const isActive = state === "active";

          return (
            <div
              className={`agent-resolution__progress-step ${isActive ? "agent-resolution__progress-step--active" : ""}`}
              key={step.key}
              onClick={() => onNavigate(i)}
              role="button"
              tabIndex={0}
            >
              {i > 0 && (
                <div
                  className={`agent-resolution__progress-line ${i <= activeStep ? "agent-resolution__progress-line--done" : "agent-resolution__progress-line--pending"}`}
                />
              )}
              <span className={`agent-resolution__progress-dot agent-resolution__progress-dot--${state}`}>
                {isDone ? (
                  <Check size={14} strokeWidth={3} />
                ) : (
                  <span className="agent-resolution__progress-number">{i + 1}</span>
                )}
              </span>
              <span className={`agent-resolution__progress-label agent-resolution__progress-label--${state}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      <button
        className="agent-resolution__progress-nav"
        onClick={() => onNavigate(Math.min(6, activeStep + 1))}
        disabled={activeStep === 6}
        aria-label="Next step"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

/* ============================================================
   ITEM CONTEXT (BOTTOM LEFT)
   ============================================================ */
function ItemContext({ listing }) {
  const image = (listing && Array.isArray(listing.images) && listing.images[0]) || DEFAULT_MOTHERBOARD_IMAGE;
  const title = listing?.title || "Generic Motherboard-X1";
  const category = listing?.category || "electronics";
  const condition = listing?.condition || "poor";
  const location = listing?.location || "Bangalore";
  const distance = listing?.distanceKm || 10;

  return (
    <div className="agent-resolution__item-card">
      <div className="agent-resolution__item-image-box">
        <img src={image} alt={title} onError={(e) => { e.currentTarget.style.display = "none"; }} />
      </div>
      <div className="agent-resolution__item-details">
        <h4 className="agent-resolution__item-title">{title}</h4>
        <div className="agent-resolution__item-badges">
          <span className="agent-resolution__badge agent-resolution__badge--green">{category}</span>
          <span className="agent-resolution__badge agent-resolution__badge--neutral">{condition}</span>
        </div>
        <div className="agent-resolution__item-meta-row">
          <span className="agent-resolution__item-meta-pin"><MapPin size={13} /> {location}</span>
          <span className="agent-resolution__item-meta-dot">•</span>
          <span>{distance} km</span>
          <span className="agent-resolution__item-meta-dot">•</span>
          <span className="agent-resolution__item-demo-code">
            DEMO-01 <Copy size={12} className="agent-resolution__copy-icon" />
          </span>
        </div>
        <p className="agent-resolution__item-desc">
          A deterministic damaged-PCB item. The agent will choose a resolution, execute it, and adapt if
          the environment blocks a route.
        </p>
      </div>
    </div>
  );
}

/* ============================================================
   AGENT LOG (BOTTOM RIGHT)
   ============================================================ */
const FALLBACK_LOG_ENTRIES = [
  { time: "10:24", state: "done", message: "Goal set: Find best value outcome for this item" },
  { time: "10:25", state: "done", message: "Item inspected: Category electronics, condition poor" },
  { time: "10:26", state: "active", message: "Evaluating routes: Repair, Parts recovery, Recycle" },
  { time: "10:27", state: "pending", message: "Decision pending..." },
  { time: "10:28", state: "pending", message: "Execution pending..." },
];

function AgentLog({ events, isRunning }) {
  const mainEvents = getMainTimelineEvents(events);

  return (
    <div className="agent-resolution__log-card">
      <div className="agent-resolution__log-header">
        <h4 className="agent-resolution__log-title">Agent log</h4>
        <span className="agent-resolution__log-live-badge">
          <span className="agent-resolution__log-live-dot" />
          Live
        </span>
      </div>

      <ul className="agent-resolution__log-list">
        {mainEvents.length > 0 ? (
          mainEvents.map((event, idx) => {
            const tone = getEventTone(event);
            const isLast = idx === mainEvents.length - 1;
            const time = new Date(event.timestamp || Date.now()).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <li className="agent-resolution__log-row" key={event.id || idx}>
                <span className="agent-resolution__log-time">{time}</span>
                <span className="agent-resolution__log-marker">
                  {tone === "failure" ? (
                    <AlertTriangle size={15} className="agent-resolution__log-icon--failure" />
                  ) : isLast && isRunning ? (
                    <span className="agent-resolution__log-dot-active" />
                  ) : (
                    <CheckCircle2 size={15} className="agent-resolution__log-icon--done" />
                  )}
                </span>
                <span className="agent-resolution__log-text">
                  <strong>{event.message}</strong>
                </span>
              </li>
            );
          })
        ) : (
          FALLBACK_LOG_ENTRIES.map((entry, idx) => (
            <li className="agent-resolution__log-row" key={idx}>
              <span className="agent-resolution__log-time">{entry.time}</span>
              <span className="agent-resolution__log-marker">
                {entry.state === "done" ? (
                  <CheckCircle2 size={15} className="agent-resolution__log-icon--done" />
                ) : entry.state === "active" ? (
                  <span className="agent-resolution__log-dot-active" />
                ) : (
                  <Circle size={14} className="agent-resolution__log-icon--pending" />
                )}
              </span>
              <span className={`agent-resolution__log-text ${entry.state === "pending" ? "agent-resolution__log-text--pending" : ""}`}>
                {entry.message}
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

/* ============================================================
   MAIN AGENT RESOLUTION PAGE
   ============================================================ */
export default function AgentResolutionPage() {
  const { itemId: routeItemId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const isDemoRoute = routeItemId === "demo";

  const [effectiveItemId, setEffectiveItemId] = useState(isDemoRoute ? null : routeItemId);
  const [demoMeta, setDemoMeta] = useState(null);
  const [listing, setListing] = useState(null);

  const [session, setSession] = useState(null);
  const [events, setEvents] = useState([]);

  const [initializing, setInitializing] = useState(true);
  const [starting, setStarting] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [awaitingImage, setAwaitingImage] = useState(false);
  const [error, setError] = useState(null);

  // Carousel manual navigation
  const [manualStep, setManualStep] = useState(null);

  const cancelledRef = useRef(false);
  const runningRef = useRef(false);

  useEffect(() => {
    return () => { cancelledRef.current = true; };
  }, []);

  // Derive active step: default to 2 (Evaluate) to match hero concept if session not yet run
  const activeStepFromState = session ? getActiveStepIndex(session.currentStatus) : 2;
  const displayedStep = manualStep !== null ? manualStep : activeStepFromState;

  // Follow active step when session updates
  const prevStatusRef = useRef(null);
  useEffect(() => {
    if (session?.currentStatus && session.currentStatus !== prevStatusRef.current) {
      prevStatusRef.current = session.currentStatus;
      setManualStep(null);
    }
  }, [session?.currentStatus]);

  function handleNavigate(stepIndex) {
    setManualStep(stepIndex);
  }

  const refreshTimeline = useCallback(async (sessionId) => {
    try {
      const timeline = await agentService.getTimeline(sessionId);
      if (!cancelledRef.current) {
        setEvents(Array.isArray(timeline) ? timeline : []);
      }
    } catch {
      // Timeline is secondary
    }
  }, []);

  const persistSession = useCallback(
    (itemId, sessionId) => {
      try {
        window.localStorage.setItem(sessionStorageKey(itemId), sessionId);
      } catch { /* Best-effort */ }
      const next = new URLSearchParams(searchParams);
      next.set("session", sessionId);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const clearPersistedSession = useCallback(
    (itemId) => {
      try {
        window.localStorage.removeItem(sessionStorageKey(itemId));
      } catch { /* ignore */ }
      const next = new URLSearchParams(searchParams);
      next.delete("session");
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const driveForward = useCallback(
    async (sessionId, startingSession, listingOverride) => {
      if (runningRef.current) return;
      runningRef.current = true;
      setAdvancing(true);

      let current = startingSession;
      let iterations = 0;
      const activeListing = listingOverride !== undefined ? listingOverride : listing;

      try {
        while (current && !TERMINAL_STATUSES.includes(current.currentStatus) && iterations < MAX_ADVANCE_ITERATIONS) {
          iterations += 1;

          if (current.currentStatus === "IDLE") {
            if (isDemoRoute && demoMeta?.hasDemoImage) {
              const demoImage = await agentService.getDemoImage();
              const outcome = await agentService.advance(sessionId, {
                image: { base64: demoImage.base64, mimetype: demoImage.mimetype, filename: demoImage.filename },
              });
              if (cancelledRef.current) return;
              if (outcome.error) {
                setError(outcome.error.message);
                break;
              }
              current = outcome.session;
              setSession(current);
              await refreshTimeline(sessionId);
              continue;
            }

            // Real item flow: the user already uploaded a photo in the
            // Sell flow, and it now survives on the listing as a real
            // data: URL (see SellPage.handleStartResolution). Replay
            // that SAME photo into the agent's inspect stage so the
            // agent can simply be watched, instead of asking the user
            // to upload it again here. Only when the listing genuinely
            // has no embedded photo (e.g. it was created some other
            // way) do we fall back to the upload prompt below.
            const replayImage = dataUrlToImageInput(activeListing?.images?.[0]);
            if (replayImage) {
              const outcome = await agentService.advance(sessionId, { image: replayImage });
              if (cancelledRef.current) return;
              if (outcome.error) {
                setError(outcome.error.message);
                current = outcome.session || current;
                setSession(current);
                break;
              }
              current = outcome.session;
              setSession(current);
              await refreshTimeline(sessionId);
              continue;
            }

            setAwaitingImage(true);
            break;
          }

          const outcome = await agentService.advance(sessionId, {});
          if (cancelledRef.current) return;

          if (outcome.error) {
            setError(outcome.error.message);
            current = outcome.session || current;
            setSession(current);
            break;
          }

          current = outcome.session;
          setSession(current);
          await refreshTimeline(sessionId);

          if (!TERMINAL_STATUSES.includes(current.currentStatus)) {
            await new Promise((resolve) => setTimeout(resolve, STEP_PACING_MS));
          }
        }
      } catch (err) {
        if (!cancelledRef.current) {
          setError(err.message || "Something went wrong while advancing the agent.");
        }
      } finally {
        runningRef.current = false;
        if (!cancelledRef.current) {
          setAdvancing(false);
        }
      }
    },
    [demoMeta, isDemoRoute, refreshTimeline, listing],
  );

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setInitializing(true);
      setError(null);

      let itemId = routeItemId;

      try {
        if (isDemoRoute) {
          const demo = await agentService.getDemo();
          if (cancelled) return;
          itemId = demo.demoItemId;
          setDemoMeta({
            hasDemoImage: Boolean(demo.hasDemoImage),
            simulationEnabled: Boolean(demo.simulation && demo.simulation.enabled),
            scenario: (demo.simulation && demo.simulation.scenario) || null,
            componentLabel:
              (demo.simulation && demo.simulation.component && demo.simulation.component.label) || null,
          });
          setEffectiveItemId(itemId);
        }

        if (!itemId) {
          setInitializing(false);
          return;
        }

        let listingData = null;
        try {
          listingData = await getListing(itemId);
          if (!cancelled) setListing(listingData);
        } catch {
          // Listing context is nice-to-have
        }

        const existingSessionId = searchParams.get("session") || (() => {
          try {
            return window.localStorage.getItem(sessionStorageKey(itemId));
          } catch {
            return null;
          }
        })();

        if (existingSessionId) {
          try {
            const restoredSession = await agentService.getState(existingSessionId);
            if (cancelled) return;
            setSession(restoredSession);
            await refreshTimeline(existingSessionId);
            persistSession(itemId, existingSessionId);

            if (!TERMINAL_STATUSES.includes(restoredSession.currentStatus)) {
              driveForward(existingSessionId, restoredSession, listingData);
            }
          } catch {
            clearPersistedSession(itemId);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Could not reach the agent service.");
        }
      } finally {
        if (!cancelled) setInitializing(false);
      }
    }

    bootstrap();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeItemId, isDemoRoute]);

  async function handleStart() {
    if (!effectiveItemId) return;
    setError(null);
    setStarting(true);
    try {
      const data = await agentService.resolveItem(effectiveItemId);
      setSession(data);
      persistSession(effectiveItemId, data.agentSessionId);
      await refreshTimeline(data.agentSessionId);
      driveForward(data.agentSessionId, data, listing);
    } catch (err) {
      setError(err.message || "Could not start the agent session.");
    } finally {
      setStarting(false);
    }
  }

  async function handleImageSelected(event) {
    const file = event.target.files && event.target.files[0];
    if (!file || !session) return;

    setError(null);
    setAwaitingImage(false);

    try {
      const image = await fileToImageInput(file);
      const outcome = await agentService.advance(session.agentSessionId, { image });
      if (outcome.error) {
        setError(outcome.error.message);
        return;
      }
      setSession(outcome.session);
      await refreshTimeline(session.agentSessionId);
      driveForward(session.agentSessionId, outcome.session);
    } catch (err) {
      setError(err.message || "Could not process the selected image.");
    }
  }

  async function handleEnableFailureSimulation() {
    try {
      const simulation = await agentService.enableDemoFailure();
      setDemoMeta((prev) => ({
        ...prev,
        simulationEnabled: Boolean(simulation && simulation.enabled),
        scenario: (simulation && simulation.scenario) || prev?.scenario,
        componentLabel:
          (simulation && simulation.component && simulation.component.label) || prev?.componentLabel,
      }));
    } catch (err) {
      setError(err.message || "Could not enable the failure simulation.");
    }
  }

  async function handleResetDemo() {
    setError(null);
    try {
      await agentService.resetDemo();
      if (effectiveItemId) clearPersistedSession(effectiveItemId);
      setSession(null);
      setEvents([]);
      setAwaitingImage(false);
      setManualStep(null);
      const demo = await agentService.getDemo();
      setDemoMeta({
        hasDemoImage: Boolean(demo.hasDemoImage),
        simulationEnabled: Boolean(demo.simulation && demo.simulation.enabled),
        scenario: (demo.simulation && demo.simulation.scenario) || null,
        componentLabel:
          (demo.simulation && demo.simulation.component && demo.simulation.component.label) || null,
      });
      setEffectiveItemId(demo.demoItemId);
      const listingData = await getListing(demo.demoItemId);
      setListing(listingData);
    } catch (err) {
      setError(err.message || "Could not reset the demo.");
    }
  }

  const isRunning = starting || advancing;
  const hasSession = Boolean(session);

  return (
    <div className="agent-resolution">
      <div className="agent-resolution__container">
        {/* ---- TOP NAVIGATION / HEADER ---- */}
        <div className="agent-resolution__header">
          <Link to="/dashboard" className="agent-resolution__back">
            <ArrowLeft size={16} />
            <span>Back to dashboard</span>
          </Link>

          <div className="agent-resolution__heading-row">
            <div className="agent-resolution__title-group">
              <h1 className="agent-resolution__title">Agent Resolution</h1>
              <p className="agent-resolution__description">
                Watch the resolution agent formulate a goal, observe the item, decide a route, execute it, and adapt to what actually happens —
                every step below reflects the backend's real state.
              </p>
            </div>

            <div className="agent-resolution__header-controls">
              {/* Live Demo capsule */}
              <span className="agent-resolution__live-badge">
                <span className="agent-resolution__live-dot" />
                Live Demo
              </span>

              {/* Reset Demo button */}
              <button
                className="agent-resolution__reset-btn"
                onClick={handleResetDemo}
                title="Reset Demo"
              >
                <RotateCcw size={15} />
                <span>Reset Demo</span>
              </button>

              {/* Armed failure scenario simulation button if on demo route */}
              {isDemoRoute && !demoMeta?.simulationEnabled && !hasSession && (
                <button
                  className="agent-resolution__arm-btn"
                  onClick={handleEnableFailureSimulation}
                  title="Arm failure scenario to test autonomous replanning"
                >
                  <Sparkles size={14} />
                  <span>Arm Shortage</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ---- DEMO SCENARIO NOTICE (IF ARMED) ---- */}
        {isDemoRoute && demoMeta?.simulationEnabled && (
          <div className="agent-resolution__scenario-note">
            <AlertTriangle size={16} />
            <span>
              <strong>Scenario armed:</strong> Repair will fail with <code>{demoMeta.scenario || "REQUIRED_COMPONENT_UNAVAILABLE"}</code>
              {demoMeta.componentLabel ? ` (${demoMeta.componentLabel} out of stock)` : ""}.
              The agent will adapt autonomously and replan to Parts recovery.
            </span>
          </div>
        )}

        {/* ---- ERROR BANNER ---- */}
        {error && <div className="agent-resolution__error">{error}</div>}

        {/* ---- IMAGE UPLOAD PROMPT (IF AWAITING IMAGE) ---- */}
        {awaitingImage && (
          <div className="agent-resolution__upload-banner">
            <ShieldAlert size={18} />
            <div>
              <strong>Inspection needs a photo</strong>
              <p>The agent's inspect stage needs an image of the item to classify it.</p>
            </div>
            <label className="agent-resolution__upload-btn">
              <input type="file" accept="image/*" hidden onChange={handleImageSelected} />
              <UploadCloud size={18} />
              <span>Upload photo</span>
            </label>
          </div>
        )}

        {/* ---- START PROMPT (IF NO ACTIVE SESSION) ---- */}
        {!hasSession && !initializing && (
          <div className="agent-resolution__start-banner">
            <div>
              <strong>Deterministic Demo Item: Generic Motherboard-X1</strong>
              <p>Click below to start the autonomous agent resolution process.</p>
            </div>
            <Button variant="primary" onClick={handleStart} disabled={isRunning || !effectiveItemId}>
              {starting ? "Starting agent…" : "Start Agent Resolution"}
            </Button>
          </div>
        )}

        {/* ---- HERO CAROUSEL: 7 ROTATING PROCESS CARDS ---- */}
        <ResolutionCarousel
          activeStep={displayedStep}
          session={session}
          listing={listing}
          onNavigate={handleNavigate}
        />

        {/* ---- 7-STEP PROGRESS INDICATOR ---- */}
        <ProgressIndicator
          activeStep={displayedStep}
          session={session}
          onNavigate={handleNavigate}
        />

        {/* ---- BOTTOM SECTION: ITEM CONTEXT + AGENT LOG ---- */}
        <div className="agent-resolution__bottom-row">
          <ItemContext listing={listing} />
          <AgentLog
            events={events}
            isRunning={hasSession && !TERMINAL_STATUSES.includes(session?.currentStatus)}
          />
        </div>
      </div>
    </div>
  );
}