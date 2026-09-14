// Phase 10 + Phase 11: pure, presentation-only helpers over the REAL
// event + session shapes produced by the backend agent subsystem
// (agentEventService -> events, agentStateService -> session). Nothing
// here invents an event, a message, a status, a decision, or a replan —
// every value returned is read straight off the backend object it was
// already recorded on. Phase 11 adds the "closed loop" story builder
// (buildAgentStory) so the UI can present the GOAL -> OBSERVE -> DECIDE
// -> ACT -> OBSERVE RESULT -> (REPLAN) -> VERIFY lifecycle from the
// persisted decisionHistory / replanHistory / observations, never from a
// frontend decision engine.

// Tool-level plumbing events. Rendered separately (compact "tool
// activity" feed) so the main timeline stays at the GOAL -> OBSERVATION
// -> DECISION -> ACTION -> RESULT level the hackathon demo needs to be
// readable in ~10 seconds (see Phase 10 spec, section 20).
const TOOL_LEVEL_EVENT_TYPES = new Set(["TOOL_CALL", "TOOL_RESULT"]);

// The three tools that run BEFORE the decision stage. Their OBSERVATION
// events are "pre-flight" observations (item inspected, item valued,
// constraints checked) — not execution results. Everything the agent
// actually did to a route is tool === "execute_resolution".
const PREFLIGHT_TOOLS = new Set([
  "inspect_item",
  "calculate_valuation",
  "check_constraints",
]);

export function isMainTimelineEvent(event) {
  return Boolean(event) && !TOOL_LEVEL_EVENT_TYPES.has(event.type);
}

export function isToolActivityEvent(event) {
  return (
    Boolean(event) &&
    (event.type === "TOOL_RESULT" ||
      event.type === "REPLAN" ||
      // Failed execute_resolution OBSERVATIONs are the environment's
      // result — they belong in the compact activity feed as well as on
      // the main timeline (Phase 11 section 11).
      (event.type === "OBSERVATION" &&
        event.tool === "execute_resolution" &&
        observationFailed(event)))
  );
}

function observationFailed(event) {
  const observations =
    event && event.metadata && Array.isArray(event.metadata.observations)
      ? event.metadata.observations
      : null;
  if (observations && observations.length > 0) {
    return observations[observations.length - 1].success === false;
  }
  return false;
}

// The structured error code of the latest recorded observation on an
// execute_resolution OBSERVATION event (e.g. REQUIRED_COMPONENT_UNAVAILABLE).
// Never parsed from the message prose.
export function observationErrorCode(event) {
  const observations =
    event && event.metadata && Array.isArray(event.metadata.observations)
      ? event.metadata.observations
      : null;
  if (observations && observations.length > 0) {
    const last = observations[observations.length - 1];
    return last && last.errorCode ? last.errorCode : null;
  }
  return null;
}

// success | failure | neutral — used to pick an icon/tone. Only ever
// derived from booleans/fields the backend actually set on that event.
export function getEventTone(event) {
  if (!event) return "neutral";

  switch (event.type) {
    case "FINAL_OUTCOME":
    case "TOOL_RESULT":
    case "REPLAN":
      // agentStateService/agentEventService set `success` explicitly
      // for every event of these three types (see agentStateService.js
      // runTool/runReplan) — never inferred here.
      if (event.success === false) return "failure";
      if (event.success === true) return "success";
      return "neutral";

    case "DECISION":
      if (event.decision && event.decision.viable === false) return "failure";
      return "success";

    case "OBSERVATION": {
      // execute_resolution's OBSERVATION events don't set event.success
      // directly, but they DO append a structured observation record
      // (see agentStateService.TOOL_STAGE_RULES.execute_resolution) —
      // read that instead of guessing from the message text.
      const observations =
        event.metadata && Array.isArray(event.metadata.observations)
          ? event.metadata.observations
          : null;
      if (observations && observations.length > 0) {
        const last = observations[observations.length - 1];
        if (last && last.success === false) return "failure";
      }
      return "success";
    }

    default:
      return "neutral";
  }
}

// Sorted (ascending, as recorded) list of events suitable for the main
// timeline.
export function getMainTimelineEvents(events) {
  return (Array.isArray(events) ? events : []).filter(isMainTimelineEvent);
}

// Phase-11: a short, truthful label for the role an event plays in the
// loop (DECISION / ACTION / RESULT / REPLAN / VERIFICATION / ...). This is
// what lets a judge tell "what the agent decided" apart from "what the
// agent executed" and "what actually happened" at a glance — even though
// every one of them is a row on the same timeline.
export function getEventPhaseLabel(event) {
  if (!event) return "";
  switch (event.type) {
    case "AGENT_START":
      return "Start";
    case "DECISION":
      return "Decision";
    case "ACTION":
      return "Action";
    case "REPLAN":
      return "Replan";
    case "FINAL_OUTCOME":
      // verify_resolution's onSuccess emits the FINAL_OUTCOME event with
      // tool set — that IS the verification verdict, so label it so.
      return event.tool === "verify_resolution" ? "Verification" : "Outcome";
    case "OBSERVATION":
      return event.tool === "execute_resolution" ? "Result" : "Observation";
    case "TOOL_CALL":
      return "Tool";
    case "TOOL_RESULT":
      return "Tool result";
    default:
      return event.type;
  }
}

// Phase-11: a consistent, human label for a resolution route ("repair"
// -> "Repair", "parts" -> "Parts recovery").
const ROUTE_LABELS = {
  repair: "Repair",
  parts: "Parts recovery",
  whole: "Sell whole",
  auction: "Auction",
  scrap: "Scrap",
  donate: "Donate",
};

export function routeLabel(route) {
  if (!route) return "—";
  if (typeof route === "string" && ROUTE_LABELS[route]) return ROUTE_LABELS[route];
  if (typeof route === "string") return route.charAt(0).toUpperCase() + route.slice(1);
  return String(route);
}

// Phase-11: what the agent is "doing" at each backend status. Truthful to
// agentStateService's stage semantics — no invented "thinking" text.
export const STATUS_ACTIVITY = {
  IDLE: {
    label: "Waiting for input",
    detail: "Needs an inspection image of the item to begin.",
  },
  INSPECTING: {
    label: "Inspecting the item",
    detail: "Classifying the item from the inspection image.",
  },
  EVALUATING: {
    label: "Valuing every route",
    detail: "Calculating the expected value of each resolution route.",
  },
  CHECKING_CONSTRAINTS: {
    label: "Checking what can be executed",
    detail: "Checking which resolutions are actually executable for this item.",
  },
  DECIDING: {
    label: "Deciding on a resolution",
    detail: "Choosing the highest-value resolution route that is still viable.",
  },
  EXECUTING: {
    label: "Executing the chosen resolution",
    detail: "Applying the chosen resolution route to the item.",
  },
  OBSERVING: {
    label: "Observing the result",
    detail: "Checking what actually happened after the execution attempt.",
  },
  REPLANNING: {
    label: "Replanning",
    detail: "Removing the failed route and selecting the best remaining alternative.",
  },
  VERIFYING: {
    label: "Verifying the outcome",
    detail: "Confirming the executed resolution took effect on the item.",
  },
  COMPLETED: {
    label: "Completed",
    detail: "Resolution executed and independently verified.",
  },
  FAILED: {
    label: "Failed",
    detail: "The session could not complete a resolution.",
  },
  HUMAN_REVIEW: {
    label: "Needs human review",
    detail: "No viable autonomous resolution was found — a person needs to decide.",
  },
};

// Phase-11: the set of routes the agent has observed failing / excluded so
// far, merged from every source the backend records it in (constraints,
// observations, replan history). Returns [{ route, reason }].
export function getBlockedRoutes(session) {
  if (!session) return [];

  const blocked = new Map();
  const push = (route, reason) => {
    if (!route) return;
    if (!blocked.has(route)) {
      blocked.set(route, reason || "route no longer viable");
    }
  };

  const constraintEntries =
    session.constraints && Array.isArray(session.constraints.routeAvailability)
      ? session.constraints.routeAvailability
      : [];
  constraintEntries.forEach((entry) => {
    if (entry && entry.available === false) push(entry.route, entry.reason);
  });

  const observations = Array.isArray(session.observations)
    ? session.observations
    : [];
  observations
    .filter((o) => o && o.success === false)
    .forEach((o) => {
      push(
        o.route,
        `Execution failed (${o.errorCode || "EXECUTION_FAILURE"})${o.reason ? `: ${o.reason}` : ""}`,
      );
    });

  const replans = Array.isArray(session.replanHistory) ? session.replanHistory : [];
  replans.forEach((r) => {
    if (Array.isArray(r && r.excludedRoutes)) {
      r.excludedRoutes.forEach((route) => push(route, r.failureReason || null));
    }
  });

  return [...blocked.entries()].map(([route, reason]) => ({ route, reason }));
}

// Phase-11: availableOptions enriched with the current availability state
// (available | blocked) — used to show the routes the agent could still
// pick beside the ones it has already tried and excluded.
export function buildRouteAvailability(session) {
  if (!session) return [];
  const options = Array.isArray(session.availableOptions)
    ? session.availableOptions
    : [];
  const blocked = new Map(getBlockedRoutes(session).map((b) => [b.route, b.reason]));

  return options.map((option) => ({
    route: option.route,
    expectedValue: option.expectedValue,
    available: !blocked.has(option.route),
    blocked: blocked.has(option.route),
    reason: blocked.get(option.route) || null,
  }));
}

// Phase-11: the closed-loop story, built ONLY from the persisted session
// records (decisionHistory / replanHistory / observations / verification).
// Each execution attempt pairs one real decision with the observation of
// what actually happened when it was executed, and — when that attempt
// failed — the replan record that excluded it. This is the same data the
// timeline shows, shaped into the loop a judge can read in seconds.
export function buildAgentStory(session, events) {
  if (!session) return null;

  const decisionHistory = Array.isArray(session.decisionHistory)
    ? session.decisionHistory
    : [];
  const replanHistory = Array.isArray(session.replanHistory)
    ? session.replanHistory
    : [];
  const observations = Array.isArray(session.observations)
    ? session.observations
    : [];

  const attempts = decisionHistory.map((decision, index) => {
    return {
      index: index + 1,
      decision,
      // The action the decision led to — always the real tool call shape
      // the orchestrator executes (execute_resolution for the decided
      // route). This is the "intended action" runDecision records.
      action: { tool: "execute_resolution", route: decision.route },
      // Observation aligned by attempt order: every execution attempt
      // appends exactly one observation.
      observation: observations[index] || null,
      // The replan that explains why this decision's route failed — keyed
      // by the failedRoute it names, never by array position.
      replan:
        replanHistory.find((r) => r && r.failedRoute === decision.route) ||
        null,
    };
  });

  // Sessions reached OBSERVING/REPLANNING/VERIFYING through a manual/test
  // tool call (no DECIDING stage): the attempts list would otherwise be
  // empty despite real observations — surface them so the loop is never
  // silently blank.
  if (attempts.length === 0 && observations.length > 0) {
    observations.forEach((observation) => {
      attempts.push({
        index: attempts.length + 1,
        decision: observation.previousDecision
          ? {
              route: observation.previousDecision.route,
              viable: observation.previousDecision.viable,
            }
          : null,
        action: {
          tool: "execute_resolution",
          route: observation.route,
        },
        observation,
        replan: null,
      });
    });
  }

  const review =
    session.currentStatus === "HUMAN_REVIEW"
      ? {
          failureReason: session.failureReason || null,
          attemptCount: session.attemptCount || 0,
          blockedRoutes: getBlockedRoutes(session),
        }
      : null;

  const failed =
    session.currentStatus === "FAILED"
      ? { failureReason: session.failureReason || null }
      : null;

  return {
    goal: session.goal || null,
    status: session.currentStatus,
    statusActivity:
      STATUS_ACTIVITY[session.currentStatus] || {
        label: session.currentStatus,
        detail: "",
      },
    attempts,
    preflight: buildPreflight(session),
    // verificationResult only exists once verify_resolution has actually
    // run and returned a verdict; until then the loop is still VERIFYING.
    // Kept regardless of pass/fail — verify_resolution's own "not
    // confirmed" verdict is itself a real, structured event the loop
    // should show, not just the terminal FAILED status it leads to.
    verification: session.verificationResult || null,
    finalResolution: session.finalResolution || null,
    review,
    failed,
    latest: getLatestActivity(events),
  };
}

// The pre-decision observations, reconstructed from the session fields
// those tools wrote (no events needed — the session is source of truth).
function buildPreflight(session) {
  const steps = [];

  if (session.detectedDevice) {
    steps.push({
      key: "inspect",
      label: "Inspect",
      done: true,
      detail:
        session.detectedDevice.categoryLabel ||
        session.detectedDevice.category ||
        "classified",
    });
  }

  if (session.valuation) {
    const recommendation = session.valuation.recommendation;
    steps.push({
      key: "valuate",
      label: "Value",
      done: true,
      detail: recommendation
        ? `suggested ${routeLabel(recommendation.route)}`
        : "valued",
    });
  }

  if (session.constraints) {
    const failures = Array.isArray(session.constraints.failures)
      ? session.constraints.failures
      : [];
    const reviewFlags = Array.isArray(session.constraints.reviewFlags)
      ? session.constraints.reviewFlags
      : [];
    steps.push({
      key: "constraints",
      label: "Constraints",
      done: failures.length === 0,
      // A constraint failure is terminal — surface the codes.
      failed: failures.length > 0,
      detail:
        failures.length > 0
          ? failures.map((f) => f.code || f.message).join(", ")
          : reviewFlags.length > 0
            ? "passed with review flags"
            : "passed",
    });
  }

  return steps;
}

// "What just happened" — the latest main-timeline event, labelled with its
// loop phase. Read off the real event; never guessed from currentStatus.
export function getLatestActivity(events) {
  const mainEvents = getMainTimelineEvents(events);
  if (mainEvents.length === 0) return null;

  const last = mainEvents[mainEvents.length - 1];
  return {
    phase: getEventPhaseLabel(last),
    tone: getEventTone(last),
    message: last.message,
    type: last.type,
    tool: last.tool,
    timestamp: last.timestamp,
  };
}

// Compact tool-activity feed: real TOOL_RESULT + REPLAN + failed-execute
// OBSERVATION events only, each reduced to the fields the spec asks for
// (tool name, success/failure, error code on failure, environment-result
// marker on execution failures, adaptation marker on replans).
export function getToolActivityRows(events) {
  const rows = (Array.isArray(events) ? events : [])
    .filter(isToolActivityEvent)
    .map((event) => {
      // A replan IS the adaptation step.
      if (event.type === "REPLAN") {
        return {
          id: event.id,
          kind: "replan",
          tone: getEventTone(event),
          label: "replanning",
          detail: null,
          timestamp: event.timestamp,
        };
      }

      // A failed execute OBSERVATION is the environment's verdict on the
      // action — a distinct kind from a tool result.
      if (event.type === "OBSERVATION" && event.tool === "execute_resolution") {
        const observations =
          event.metadata && Array.isArray(event.metadata.observations)
            ? event.metadata.observations
            : null;
        const last =
          observations && observations.length > 0
            ? observations[observations.length - 1]
            : null;
        return {
          id: event.id,
          kind: "environment",
          tone: "failure",
          label: "environment result",
          detail: (last && last.errorCode) || null,
          timestamp: event.timestamp,
        };
      }

      const failed = event.success === false;
      const errorCode =
        failed && event.output && typeof event.output === "object"
          ? event.output.errorCode
          : null;

      return {
        id: event.id,
        kind: "tool",
        tone: getEventTone(event),
        label: event.tool,
        detail: errorCode || null,
        timestamp: event.timestamp,
      };
    });

  return rows;
}

// Phase-11: a colloquial leading label for a tool-activity row, so the
// feed reads as a story (INSPECT / VALUATE / CONSTRAINTS / ACTION /
// ENVIRONMENT RESULT / ADAPTATION / VERIFY) instead of raw tool names.
export function getToolActivityStageLabel(tool) {
  switch (tool) {
    case "inspect_item":
      return "inspect";
    case "calculate_valuation":
      return "valuate";
    case "check_constraints":
      return "constraints";
    case "execute_resolution":
      return "action";
    case "verify_resolution":
      return "verify";
    default:
      return tool;
  }
}