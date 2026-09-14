const listingRepository = require("../data/listingRepository");
const agentRepository = require("../data/agentRepository");
const agentEventService = require("./agentEventService");
const agentToolRegistry = require("./agentToolRegistry");
const agentDecisionService = require("./agentDecisionService");
const agentReplanService = require("./agentReplanService");
const demoEnvironmentService = require("./demoEnvironmentService");
require("./agentTools"); // registers inspect_item / calculate_valuation / check_constraints / execute_resolution / verify_resolution

const {
  AGENT_STATUS_TRANSITIONS,
  FAILURE_CLASSES,
} = require("../constants/agentConstants");

// Phase 15: per-tool label for the structured "stage" field on the
// OBSERVATION/FINAL_OUTCOME event each tool's onSuccess handler emits, so a
// developer filtering the log for e.g. VALUATION_RESULT does not have to
// know that valuation happens to be reported through the OBSERVATION event
// type. Reuses the existing event, just names the stage it represents.
const TOOL_TO_RESULT_STAGE = {
  inspect_item: "INSPECTION_RESULT",
  calculate_valuation: "VALUATION_RESULT",
  check_constraints: "CONSTRAINT_RESULT",
  execute_resolution: "ACTION_RESULT",
  verify_resolution: "VERIFICATION",
};

// Phase 15: tool-thrown error codes that represent a caller/business
// mistake (bad input, a genuine domain conflict) rather than an unexpected
// infrastructure failure. Anything not in this list is classified
// TOOL_INFRASTRUCTURE — the safer default for "something we didn't expect
// went wrong in a tool".
const VALIDATION_ERROR_CODES = [
  "INVALID_ROUTE",
  "UNSUPPORTED_RESOLUTION",
  "ITEM_NOT_FOUND",
  "RESOLUTION_ALREADY_EXISTS",
  "DOMAIN_OPERATION_FAILED",
];

function classifyToolError(error) {
  if (error && VALIDATION_ERROR_CODES.includes(error.code)) {
    return FAILURE_CLASSES.VALIDATION;
  }
  return FAILURE_CLASSES.TOOL_INFRASTRUCTURE;
}

// Phase 15: the one piece of tool input that must never reach a log line or
// the stored event — inspect_item's raw base64 image payload (engineering
// rule 6 / Step 5). Every other field on the input is left untouched.
function redactToolInput(toolName, input) {
  if (
    toolName !== "inspect_item" ||
    !input ||
    typeof input !== "object" ||
    !input.image ||
    typeof input.image !== "object"
  ) {
    return input || null;
  }

  const { base64, ...restOfImage } = input.image;
  return {
    ...input,
    image: {
      ...restOfImage,
      base64:
        typeof base64 === "string"
          ? `[REDACTED_BASE64_${base64.length}_CHARS]`
          : base64,
    },
  };
}

// Phase 15: records the one new event type (HUMAN_REVIEW) whenever a
// session lands in HUMAN_REVIEW, regardless of which stage escalated it
// (check_constraints review flags, a non-viable decision, or a replan that
// found no alternative). This is additive — the stage that actually caused
// the escalation still records its own event exactly as before; this only
// adds a dedicated, easy-to-filter escalation record alongside it.
function recordHumanReviewEscalation(sessionId, updatedSession, reason, extra = {}) {
  agentEventService.recordEvent(sessionId, "HUMAN_REVIEW", {
    message: `Escalated to human review: ${reason}`,
    stage: "HUMAN_REVIEW",
    status: "HUMAN_REVIEW",
    reason,
    attempt: updatedSession.attemptCount || 0,
    metadata: {
      attemptCount: updatedSession.attemptCount || 0,
      blockedRoutes: extra.blockedRoutes || [],
      remainingOptions: extra.remainingOptions || [],
    },
  });
}

/*
 * Owns the agent session state machine.
 *
 * Phase 2 scope: this only gates and records the three tools that
 * have real handlers (inspect_item -> calculate_valuation ->
 * check_constraints), moving the session as far as DECIDING /
 * HUMAN_REVIEW / FAILED. It deliberately does NOT choose a route,
 * execute anything, or replan — that is the Phase 3 orchestrator's
 * job, built on top of this same state machine and event log.
 */

function createError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function assertTransitionAllowed(fromStatus, toStatus) {
  const allowed = AGENT_STATUS_TRANSITIONS[fromStatus] || [];
  if (!allowed.includes(toStatus)) {
    throw createError(
      `Cannot move agent session from ${fromStatus} to ${toStatus}`,
      409,
    );
  }
}

function createSession(itemId, goal) {
  const listing = listingRepository.findById(itemId);
  if (!listing) {
    throw createError(`No item found for itemId "${itemId}"`, 404);
  }

  const now = new Date().toISOString();

  const session = agentRepository.createSession({
    itemId,
    goal: goal || "Resolve this e-waste item for the best available outcome.",

    detectedDevice: null,
    condition: null,
    confidence: null,
    // Phase 12 / PS5-2: real customer record (userRepository join, see
    // agentTools.retrieveCustomer), populated once inspect_item runs.
    customer: null,

    valuation: null,
    availableOptions: null,

    constraints: null,

    currentDecision: null,
    previousDecision: null,

    currentAction: null,
    currentStatus: "IDLE",

    attemptCount: 0,
    failureReason: null,

    toolResults: {},

    // Phase 9: structured observations of every execute_resolution attempt
    // (success or failure) — generated from the real tool result, never
    // from UI text. See TOOL_STAGE_RULES.execute_resolution.onSuccess.
    observations: [],

    decisionHistory: [],
    replanHistory: [],

    verificationResult: null,
    finalResolution: null,

    createdAt: now,
    updatedAt: now,
  });

  // Phase 15: this single event covers both SESSION_CREATED and
  // GOAL_ESTABLISHED — the two happen atomically (a session is never
  // created without its goal), so a second event would only duplicate the
  // same timestamp/session for no new information. The goal is on
  // metadata.goal for anyone filtering for GOAL_ESTABLISHED specifically.
  agentEventService.recordEvent(session.agentSessionId, "AGENT_START", {
    message: `Agent session started for item ${itemId}`,
    stage: "SESSION_CREATED",
    status: "IDLE",
    metadata: { itemId, goal: session.goal },
  });

  return session;
}

// "Start/continue" per Step 5: return an existing non-terminal
// session for this item if one exists, otherwise create a new one.
function getOrCreateSession(itemId, goal) {
  const existing = agentRepository.findActiveSessionByItemId(itemId);
  if (existing) {
    return { session: existing, created: false };
  }

  return { session: createSession(itemId, goal), created: true };
}

function getState(sessionId) {
  const session = agentRepository.findSessionById(sessionId);
  if (!session) {
    throw createError("Agent session not found", 404);
  }
  return session;
}

function getTimeline(sessionId) {
  // Throws 404 itself if the session doesn't exist.
  return agentEventService.getTimeline(sessionId);
}

function listTools() {
  return agentToolRegistry.listTools();
}

function recordToolResult(sessionId, toolName, result) {
  const session = getState(sessionId);
  const toolResults = {
    ...session.toolResults,
    [toolName]: { output: result, calledAt: new Date().toISOString() },
  };

  return agentRepository.updateSession(sessionId, { toolResults });
}

function buildAvailableOptions(valuation, session) {
  const demoOptions = demoEnvironmentService.getRouteOptions(session);
  if (demoOptions) {
    return demoOptions;
  }

  const options = [
    { route: "whole", expectedValue: valuation.valuation.wholeValue },
    { route: "parts", expectedValue: valuation.valuation.partsValue },
    {
      route: "auction",
      expectedValue: Math.round(
        (valuation.valuation.auctionMin + valuation.valuation.auctionMax) / 2,
      ),
    },
    { route: "scrap", expectedValue: valuation.valuation.scrapValue },
    { route: "donate", expectedValue: 0 },
  ];

  const repairOption = demoEnvironmentService.getRepairRouteOption(session);

  if (repairOption) {
    options.push({
      route: repairOption.route,
      expectedValue: repairOption.expectedValue,
    });
  }

  return options;
}

// Stage rules for the three real, order-dependent tools. Anything not
// listed here (execute_resolution, verify_resolution) is callable via
// runTool without a status gate — their handlers throw NOT_IMPLEMENTED
// regardless, so there is nothing to gate yet.
const TOOL_STAGE_RULES = {
  // IDLE and EVALUATING are two distinct statuses in AGENT_STATUS_TRANSITIONS,
  // so inspect_item has to move the session through an INSPECTING
  // "in progress" status on its way from IDLE to EVALUATING — unlike
  // the other two tools below, whose pre-status already IS their
  // in-progress status.
  inspect_item: {
    requiredStatus: "IDLE",
    inProgressStatus: "INSPECTING",
    onSuccess: (session, result) => ({
      updates: {
        detectedDevice: result.detectedDevice,
        condition: result.condition,
        confidence: result.confidence,
        // Phase 12 / PS5-2: real customer record retrieved alongside
        // the item inspection (see agentTools.retrieveCustomer).
        customer: result.customer,
      },
      nextStatus: "EVALUATING",
      eventType: "OBSERVATION",
      eventMessage: `Inspected item ${session.itemId}: detected ${result.detectedDevice.category || "unknown category"}.`,
    }),
  },

  calculate_valuation: {
    requiredStatus: "EVALUATING",
    onSuccess: (session, result) => ({
      updates: {
        valuation: result,
        availableOptions: buildAvailableOptions(result, session),
      },
      nextStatus: "CHECKING_CONSTRAINTS",
      eventType: "OBSERVATION",
      eventMessage: `Valuation complete. Suggested route: ${result.recommendation.route}.`,
    }),
  },

  check_constraints: {
    requiredStatus: "CHECKING_CONSTRAINTS",
    onSuccess: (session, result) => {
      let nextStatus = "DECIDING";
      if (result.failures.length > 0) {
        nextStatus = "FAILED";
      } else if (result.requiresHumanReview) {
        nextStatus = "HUMAN_REVIEW";
      }

      return {
        updates: {
          constraints: result,
          failureReason:
            result.failures.length > 0
              ? result.failures.map((f) => f.message).join("; ")
              : session.failureReason,
        },
        nextStatus,
        eventType: result.failures.length > 0 ? "FINAL_OUTCOME" : "OBSERVATION",
        eventMessage:
          result.failures.length > 0
            ? `Constraint check failed: ${result.failures.map((f) => f.code).join(", ")}`
            : `Constraint check passed${result.requiresHumanReview ? " with review flags" : ""}.`,
      };
    },
  },

  // Phase 5 built this against a placeholder: with no real decision
  // stage yet, execute_resolution itself owned the DECIDING ->
  // EXECUTING transition (requiredStatus DECIDING, inProgressStatus
  // EXECUTING) so a manual caller could go straight from
  // check_constraints's DECIDING to executing a route of their
  // choosing.
  //
  // Phase 6 replaces that placeholder with a real decision stage
  // (agentStateService.runDecision, via agentDecisionService.decide)
  // that now OWNS the DECIDING -> EXECUTING transition: it is the
  // one that actually chooses the route from live valuation +
  // constraints data. By the time execute_resolution runs, the
  // session is therefore already sitting in EXECUTING with
  // currentDecision/currentAction populated by that real decision —
  // matching the "execute_resolution already expects the agent to be
  // in the execution stage" behavior this phase requires. There is no
  // separate in-progress status to move through first anymore (the
  // decision stage already put the session there), so
  // inProgressStatus is removed rather than duplicated.
  //
  // Phase 9: BOTH branches now record a structured, tool-result-derived
  // OBSERVATION into session.observations (success, route, action,
  // errorCode, reason, attemptCount, timestamp, toolResult,
  // previousDecision — the section 9.1 field list) and both emit an
  // OBSERVATION event for the executed attempt, so the event history is
  // symmetric: DECISION -> ACTION (intended) -> TOOL_CALL -> TOOL_RESULT
  // -> OBSERVATION. On success the session holds at OBSERVING and the
  // orchestrator routes it to VERIFYING; on failure it routes to
  // REPLANNING (the autonomous recovery loop — never a silent stop).
  execute_resolution: {
    requiredStatus: "EXECUTING",
    onSuccess: (session, result) => {
      const buildObservation = (failed) => ({
        attempt: (session.attemptCount || 0) + 1,
        success: !failed,
        route: result.route,
        action: failed
          ? "execute_resolution"
          : result.action || `execute_resolution("${result.route}")`,
        errorCode: failed ? result.errorCode || null : null,
        reason: failed ? result.reason || null : null,
        toolResult: result,
        previousDecision: session.currentDecision
          ? { route: session.currentDecision.route, viable: session.currentDecision.viable }
          : { route: result.route, viable: true },
        observedAt: new Date().toISOString(),
      });

      if (result.success === false) {
        // Phase 8: a structured execution failure surfaced by the demo
        // environment (e.g. REQUIRED_COMPONENT_UNAVAILABLE). The tool call
        // itself completed and returned a real failure result (the
        // environment returned { success:false, errorCode, route, reason }
        // — see demoEnvironmentService + agentTools.executeResolution), so
        // the agent moves EXECUTING -> OBSERVING and records that failure
        // as an OBSERVATION. This is NOT a terminal FAILED and NOT a false
        // success: no resolution was written (executeResolution returns
        // before any domain mutation), and the failure details are kept on
        // the session in the existing fields (currentAction, failureReason,
        // attemptCount, observations) plus
        // session.toolResults.execute_resolution.output.
        const failedAction = session.currentAction
          ? { ...session.currentAction, failed: true, errorCode: result.errorCode }
          : {
              type: "execute_resolution",
              route: result.route,
              failed: true,
              errorCode: result.errorCode,
            };

        return {
          updates: {
            currentAction: failedAction,
            // Only fill currentDecision in if the decision stage hasn't
            // already set one (mirrors the success branch below).
            currentDecision: session.currentDecision || {
              route: result.route,
              decidedAt: new Date().toISOString(),
            },
            attemptCount: (session.attemptCount || 0) + 1,
            failureReason: result.reason,
            observations: [...(session.observations || []), buildObservation(true)],
          },
          nextStatus: "OBSERVING",
          eventType: "OBSERVATION",
          eventMessage:
            `Execution of resolution route "${result.route}" failed: ` +
            `${result.errorCode} — ${result.reason}`,
        };
      }

      return {
        updates: {
          // Normalized to the same object shape runDecision writes
          // ({ type, route, ... }) — downstream code reads
          // currentAction.route/failed, so the raw `result.action` string
          // (e.g. "listing_sale_type_set_to_parts") must not be stored
          // directly here or the two code paths diverge in shape.
          currentAction: {
            type: "execute_resolution",
            route: result.route,
            action: result.action,
          },
          // Only fill currentDecision in if the decision stage hasn't
          // already set one (e.g. a manual/test call to
          // execute_resolution against a session that never went
          // through DECIDING) — otherwise the real decision already
          // recorded on the session is preserved untouched.
          currentDecision: session.currentDecision || {
            route: result.route,
            decidedAt: new Date().toISOString(),
          },
          attemptCount: (session.attemptCount || 0) + 1,
          observations: [...(session.observations || []), buildObservation(false)],
        },
        nextStatus: "OBSERVING",
        eventType: "OBSERVATION",
        eventMessage:
          `Executed resolution route "${result.route}" via ${result.action}` +
          `${result.reused ? " (reused existing resolution)" : ""}.`,
      };
    },
  },

  // Phase 9: real verification. verify_resolution (agentTools.js) checks
  // the persisted listing/domain state against the resolution the agent
  // executed — passed means the route actually took hold, so the session
  // completes with a FINAL_OUTCOME; failed verification is a real,
  // terminal failure, never a fabricated success. (VERIFYING -> COMPLETED
  // / FAILED were both already legal in AGENT_STATUS_TRANSITIONS from
  // Phase 2.)
  verify_resolution: {
    requiredStatus: "VERIFYING",
    onSuccess: (session, result) => {
      if (result.passed) {
        return {
          updates: {
            verificationResult: result,
            finalResolution: {
              route: result.route,
              resolutionId: result.resolutionId,
              status: "verified",
              outcome: "completed",
              verifiedAt: result.verifiedAt,
            },
          },
          nextStatus: "COMPLETED",
          eventType: "FINAL_OUTCOME",
          eventMessage: `Resolution "${result.route}" verified — ${result.reason}`,
        };
      }

      return {
        updates: {
          verificationResult: result,
          failureReason: result.reason,
        },
        nextStatus: "FAILED",
        eventType: "FINAL_OUTCOME",
        eventMessage: `Verification failed for resolution "${result.route}": ${result.reason}`,
      };
    },
  },
};

// Runs a registered tool against a session, gating on the state
// machine when the tool has an order dependency, and logging
// TOOL_CALL / TOOL_RESULT (+ a follow-on OBSERVATION/FINAL_OUTCOME)
// events either way.
async function runTool(sessionId, toolName, input) {
  let session = getState(sessionId);
  const rule = TOOL_STAGE_RULES[toolName];

  if (rule && session.currentStatus !== rule.requiredStatus) {
    throw createError(
      `Tool "${toolName}" requires status ${rule.requiredStatus}, but session is ${session.currentStatus}`,
      409,
    );
  }

  // Some tools (inspect_item) have a distinct "in progress" status
  // between their required starting status and their success status
  // (IDLE -> INSPECTING -> EVALUATING). Others (calculate_valuation,
  // check_constraints) start already sitting in their in-progress
  // status, so there is nothing to move through first.
  const runningStatus =
    rule && rule.inProgressStatus
      ? rule.inProgressStatus
      : rule
        ? rule.requiredStatus
        : session.currentStatus;

  if (rule && rule.inProgressStatus) {
    assertTransitionAllowed(session.currentStatus, rule.inProgressStatus);
    session = agentRepository.updateSession(sessionId, {
      currentStatus: rule.inProgressStatus,
    });
  }

  agentEventService.recordEvent(sessionId, "TOOL_CALL", {
    tool: toolName,
    // Phase 15: never store/log the raw base64 image payload — see
    // redactToolInput.
    input: redactToolInput(toolName, input),
    message: `Calling ${toolName}`,
    stage: "TOOL_CALL",
    status: runningStatus,
    attempt: session.attemptCount || 0,
  });

  let result;
  try {
    result = await agentToolRegistry.callTool(toolName, input, { session });
  } catch (error) {
    const errorCode = error.code || "TOOL_ERROR";
    const failureClass = classifyToolError(error);

    agentEventService.recordEvent(sessionId, "TOOL_RESULT", {
      tool: toolName,
      success: false,
      output: { error: error.message },
      message: `${toolName} failed: ${error.message}`,
      stage: "TOOL_RESULT",
      status: runningStatus,
      errorCode,
      reason: error.message,
      failureClass,
      attempt: session.attemptCount || 0,
    });

    if (rule) {
      assertTransitionAllowed(runningStatus, "FAILED");
      const updated = agentRepository.updateSession(sessionId, {
        currentStatus: "FAILED",
        failureReason: error.message,
        errorCode,
      });

      agentEventService.recordEvent(sessionId, "FINAL_OUTCOME", {
        tool: toolName,
        success: false,
        message: `Session failed during ${toolName}: ${error.message}`,
        stage: "FINAL_OUTCOME",
        status: "FAILED",
        errorCode,
        reason: error.message,
        failureClass,
      });

      return { session: updated, error };
    }

    throw error;
  }

  recordToolResult(sessionId, toolName, result);

  agentEventService.recordEvent(sessionId, "TOOL_RESULT", {
    tool: toolName,
    success: true,
    output: result,
    message: `${toolName} succeeded`,
    stage: "TOOL_RESULT",
    status: runningStatus,
    attempt: session.attemptCount || 0,
  });

  if (!rule) {
    return { session: getState(sessionId), result };
  }

  const { updates, nextStatus, eventType, eventMessage } = rule.onSuccess(
    session,
    result,
  );
  assertTransitionAllowed(runningStatus, nextStatus);

  const updated = agentRepository.updateSession(sessionId, {
    ...updates,
    currentStatus: nextStatus,
  });

  // Phase 15: route/errorCode/reason/failureClass, read straight off the
  // real tool result — never fabricated. execute_resolution's structured
  // environment failure ({ success:false, errorCode, route, reason }) is
  // the main producer of these; the other tools simply have nothing to
  // report here and every field stays null.
  const outcomeRoute =
    (result && result.route) ||
    (updates && updates.currentAction && updates.currentAction.route) ||
    (updates && updates.currentDecision && updates.currentDecision.route) ||
    null;
  const outcomeFailed = result && result.success === false;
  const verificationFailed =
    toolName === "verify_resolution" && result && result.passed === false;
  const constraintFailed =
    toolName === "check_constraints" && nextStatus === "FAILED";

  let outcomeFailureClass = null;
  if (outcomeFailed) {
    outcomeFailureClass = FAILURE_CLASSES.BUSINESS_ENVIRONMENT;
  } else if (verificationFailed) {
    outcomeFailureClass = FAILURE_CLASSES.BUSINESS_ENVIRONMENT;
  } else if (constraintFailed) {
    outcomeFailureClass = FAILURE_CLASSES.VALIDATION;
  }

  agentEventService.recordEvent(sessionId, eventType, {
    tool: toolName,
    message: eventMessage,
    // Phase 9: surface the follow-on state on OBSERVATION and FINAL_OUTCOME
    // events too (observations / verificationResult / finalResolution), so
    // anyone rendering the timeline from events alone sees the structured
    // outcome — including the success flag on the terminal FINAL_OUTCOME.
    metadata:
      eventType === "OBSERVATION" || eventType === "FINAL_OUTCOME"
        ? updates
        : undefined,
    stage: TOOL_TO_RESULT_STAGE[toolName] || eventType,
    status: nextStatus,
    route: outcomeRoute,
    errorCode: (result && result.errorCode) || null,
    reason:
      (result && result.reason) ||
      (updates && updates.failureReason) ||
      null,
    failureClass: outcomeFailureClass,
    attempt:
      updates && updates.attemptCount !== undefined
        ? updates.attemptCount
        : session.attemptCount || 0,
    ...(eventType === "FINAL_OUTCOME"
      ? { success: nextStatus === "COMPLETED" }
      : {}),
  });

  // Phase 15: check_constraints is the only tool-driven stage that can land
  // a session in HUMAN_REVIEW (via reviewFlags) — surface the dedicated
  // escalation event alongside the CONSTRAINT_RESULT event just recorded.
  if (nextStatus === "HUMAN_REVIEW") {
    const reviewFlags =
      (result && Array.isArray(result.reviewFlags) && result.reviewFlags) ||
      [];
    recordHumanReviewEscalation(
      sessionId,
      updated,
      reviewFlags.map((flag) => flag.message).join("; ") ||
        "constraint check requires human review",
      { remainingOptions: (updated.availableOptions || []).map((o) => o.route) },
    );
  }

  return { session: updated, result };
}

// Phase 6: runs the decision policy (agentDecisionService.decide)
// against a session currently sitting in DECIDING, and records the
// outcome on the session + timeline exactly like runTool does for a
// tool call — but this is not a tool call (there is no LLM call, no
// registry lookup, no TOOL_CALL/TOOL_RESULT pair), so it is a
// separate, smaller function rather than being squeezed into
// TOOL_STAGE_RULES/runTool above.
//
// On a viable decision: DECIDING -> EXECUTING, currentDecision set,
// previousDecision carries the prior currentDecision forward (null on
// the first decision), decisionHistory appended (never overwritten),
// currentAction set to the resolution the agent intends to execute
// next (execute_resolution already reads currentDecision/route itself
// when a manual caller doesn't pass one — see TOOL_STAGE_RULES.execute_resolution
// above — this only makes that intent explicit and inspectable).
//
// On no viable route: DECIDING -> HUMAN_REVIEW (an existing, legal
// transition from DECIDING). Nothing is executed and no route is
// fabricated; failureReason and the decision record explain why.
function runDecision(sessionId) {
  const session = getState(sessionId);

  if (session.currentStatus !== "DECIDING") {
    throw createError(
      `Decision logic requires status DECIDING, but session is ${session.currentStatus}`,
      409,
    );
  }

  const outcome = agentDecisionService.decide(session);

  const decisionRecord = {
    route: outcome.route,
    viable: outcome.viable,
    selectedValue: outcome.viable ? outcome.selectedValue : null,
    reason: outcome.reason,
    consideredOptions: outcome.consideredOptions,
    excludedOptions: outcome.excludedOptions,
    decidedAt: outcome.decidedAt,
  };

  const nextStatus = outcome.viable ? "EXECUTING" : "HUMAN_REVIEW";
  assertTransitionAllowed(session.currentStatus, nextStatus);

  const updates = {
    previousDecision: session.currentDecision || null,
    currentDecision: decisionRecord,
    decisionHistory: [...(session.decisionHistory || []), decisionRecord],
    currentStatus: nextStatus,
  };

  if (outcome.viable) {
    updates.currentAction = {
      type: "execute_resolution",
      route: outcome.route,
    };
  } else {
    updates.failureReason = outcome.reason;
  }

  const updated = agentRepository.updateSession(sessionId, updates);

  agentEventService.recordEvent(sessionId, "DECISION", {
    message: outcome.viable
      ? `Decided to pursue resolution route "${outcome.route}" (expected value ${outcome.selectedValue}).`
      : "No viable resolution route currently exists; routing to human review.",
    decision: decisionRecord,
    metadata: {
      consideredOptions: outcome.consideredOptions,
      excludedOptions: outcome.excludedOptions,
    },
    stage: "DECISION",
    status: nextStatus,
    route: outcome.viable ? outcome.route : null,
    reason: outcome.reason,
    attempt: session.attemptCount || 0,
    failureClass: outcome.viable ? null : FAILURE_CLASSES.BUSINESS_ENVIRONMENT,
  });

  // Phase 8 (additive, user-approved): record the agent's INTENDED
  // action right after the decision, so the timeline reads
  // DECISION -> ACTION -> TOOL_CALL -> TOOL_RESULT -> OBSERVATION for
  // both the success and the (later) failure path. The real execution
  // then runs through runTool as its own TOOL_CALL/TOOL_RESULT pair —
  // this event only makes the decision's intention explicit and
  // inspectable, and leaves every existing event untouched.
  if (outcome.viable) {
    agentEventService.recordEvent(sessionId, "ACTION", {
      message: `Agent intends to execute_resolution("${outcome.route}")`,
      tool: "execute_resolution",
      metadata: { expectedValue: outcome.selectedValue },
      stage: "ACTION",
      status: nextStatus,
      route: outcome.route,
      action: `execute_resolution("${outcome.route}")`,
      attempt: session.attemptCount || 0,
    });
  } else {
    // Phase 15: DECIDING can escalate directly to HUMAN_REVIEW when no
    // viable route remains at all (as opposed to a replan-driven escalation
    // after a failed execution attempt — see runReplan below).
    recordHumanReviewEscalation(sessionId, updated, outcome.reason, {
      blockedRoutes: (outcome.excludedOptions || []).map((o) => o.route),
    });
  }

  return { session: updated, decision: decisionRecord, viable: outcome.viable };
}

// Phase 9: resolves what an OBSERVING session should do next, purely from
// the real observation recorded on the session. A failed attempt routes to
// REPLANNING (autonomous recovery); a successful attempt routes to
// VERIFYING. This is a status transition only — no event is fabricated
// here; the REPLAN / FINAL_OUTCOME events are emitted by their own stages.
function resolveObservation(sessionId) {
  const session = getState(sessionId);

  if (session.currentStatus !== "OBSERVING") {
    throw createError(
      `resolveObservation requires status OBSERVING, but session is ${session.currentStatus}`,
      409,
    );
  }

  const observations = session.observations || [];
  const lastObservation =
    observations.length > 0 ? observations[observations.length - 1] : null;
  const lastFailed = lastObservation
    ? lastObservation.success === false
    : Boolean(session.currentAction && session.currentAction.failed);

  const nextStatus = lastFailed ? "REPLANNING" : "VERIFYING";
  assertTransitionAllowed(session.currentStatus, nextStatus);

  const updated = agentRepository.updateSession(sessionId, {
    currentStatus: nextStatus,
  });

  return { session: updated, nextStatus };
}

// Phase 9: runs the replan policy (agentReplanService.replan — the pure
// exclusion/selection logic, see that file) against a session currently
// sitting in REPLANNING, and records the outcome on the session + timeline
// exactly like runDecision does for a decision — but this is not a tool
// call (no registry lookup, no TOOL_CALL/TOOL_RESULT pair), so it is a
// separate function rather than being squeezed into TOOL_STAGE_RULES.
//
// On a viable alternative: REPLANNING -> DECIDING, and the route is NOT
// executed here — the next DECIDING stage re-runs the REAL decision policy
// (runDecision) on the now-excluded availability view, so the new decision
// goes through the exact same DECISION event + decisionHistory append as
// the first one, then a NEW ACTION + NEW EXECUTING -> execute_resolution.
//
// On no viable alternative (or after MAX_RESOLUTION_ATTEMPTS): REPLANNING
// -> HUMAN_REVIEW. No alternative route is invented.
function runReplan(sessionId) {
  const session = getState(sessionId);

  if (session.currentStatus !== "REPLANNING") {
    throw createError(
      `Replan logic requires status REPLANNING, but session is ${session.currentStatus}`,
      409,
    );
  }

  const outcome = agentReplanService.replan(session);
  const nextStatus = outcome.viable ? "DECIDING" : "HUMAN_REVIEW";
  assertTransitionAllowed(session.currentStatus, nextStatus);

  const replanRecord = outcome.replanRecord;
  const updates = {
    constraints: outcome.updatedConstraints,
    replanHistory: [...(session.replanHistory || []), replanRecord],
    currentStatus: nextStatus,
  };
  if (!outcome.viable) {
    updates.failureReason = replanRecord.reason;
  }

  const updated = agentRepository.updateSession(sessionId, updates);

  const selected = replanRecord.selectedAlternative;
  agentEventService.recordEvent(sessionId, "REPLAN", {
    message: outcome.viable
      ? `Replanned after "${replanRecord.failedRoute}" failed (${replanRecord.errorCode}): ` +
        `excluded routes ${replanRecord.excludedRoutes.join(", ")}; selected ` +
        `"${selected.route}" (expected value ${selected.expectedValue}).`
      : `Replanning found no viable alternative after "${replanRecord.failedRoute}" ` +
        `failed (${replanRecord.errorCode}): ${replanRecord.reason}`,
    decision: selected ? { route: selected.route, selectedValue: selected.expectedValue } : null,
    metadata: replanRecord,
    success: outcome.viable,
    stage: "REPLAN",
    status: nextStatus,
    route: selected ? selected.route : null,
    errorCode: replanRecord.errorCode,
    reason: replanRecord.reason,
    attempt: replanRecord.attempt,
    failureClass: outcome.viable ? null : FAILURE_CLASSES.BUSINESS_ENVIRONMENT,
  });

  if (!outcome.viable) {
    // Phase 15: replanning exhausted every alternative (or hit
    // MAX_RESOLUTION_ATTEMPTS) — this is the autonomous-recovery-failed
    // escalation path, distinct from DECIDING's "no route was ever viable"
    // escalation above.
    recordHumanReviewEscalation(sessionId, updated, replanRecord.reason, {
      blockedRoutes: replanRecord.excludedRoutes || [],
    });
  }

  return { session: updated, replan: replanRecord, viable: outcome.viable };
}

// Thin, gated status transition for stages the state machine owns but that
// record no event of their own (currently only OBSERVING -> REPLANNING /
// VERIFYING via resolveObservation, which already wraps this). Kept private
// unless a future stage needs an event-less move; exported for the
// orchestrator's resolveObservation usage path.
function transitionStatus(sessionId, toStatus) {
  const session = getState(sessionId);
  assertTransitionAllowed(session.currentStatus, toStatus);
  return agentRepository.updateSession(sessionId, {
    currentStatus: toStatus,
  });
}

module.exports = {
  createSession,
  getOrCreateSession,
  getState,
  getTimeline,
  listTools,
  runTool,
  runDecision,
  resolveObservation,
  runReplan,
  transitionStatus,
};
