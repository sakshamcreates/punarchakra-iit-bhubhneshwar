const agentStateService = require("./agentStateService");

/*
 * Punarchakra — Autonomous E-Waste Resolution Agent
 * Phase 4: Agent Orchestrator
 *
 * This is the single service responsible for controlling an agent
 * resolution session end-to-end from the outside (controller / future
 * callers) instead of callers having to know which tool to invoke
 * for a given session status themselves.
 *
 * It deliberately contains ZERO business logic (no valuation math,
 * no classification, no constraint rules). Everything it does is
 * orchestration:
 *
 *   read state (agentStateService.getState / getOrCreateSession)
 *     -> decide the next stage from currentStatus (STATUS_TO_TOOL)
 *     -> run the matching tool (agentStateService.runTool, which
 *        itself uses agentToolRegistry + agentRepository +
 *        agentEventService — this file does not touch those
 *        directly, and does not duplicate their logic)
 *     -> return the updated session
 *
 * Phase 4 scope: only the three already-implemented, order-dependent
 * tools (inspect_item -> calculate_valuation -> check_constraints)
 * are wired into the stage map below. DECIDING / EXECUTING /
 * OBSERVING / VERIFYING / REPLANNING are NOT implemented here yet —
 * see "Remaining work" in the phase report. Adding them later is a
 * matter of adding entries to STATUS_TO_TOOL (and, once their tools
 * stop being stubs, giving agentStateService.TOOL_STAGE_RULES a
 * matching onSuccess handler) — this file will not need to be
 * restructured to support that.
 *
 * Phase 6: DECIDING is now wired in too, but NOT via STATUS_TO_TOOL —
 * the decision stage is not a registered tool (agentToolRegistry has
 * no "decide" tool and none should be added; see agentDecisionService
 * for why). advanceSession special-cases DECIDING to call
 * agentStateService.runDecision instead, then falls through to the
 * existing STATUS_TO_TOOL path for every other status exactly as
 * before.
 *
 * Phase 9: the whole loop is now drivable — OBSERVING resolves to
 * REPLANNING (failed) / VERIFYING (succeeded) via
 * agentStateService.resolveObservation (no tool call); REPLANNING runs
 * agentStateService.runReplan (the replan policy — not a tool), which
 * lands back in DECIDING for the real second decision; EXECUTING runs
 * execute_resolution for the route the agent decided (route read from
 * currentAction/currentDecision when the caller supplies none); and
 * VERIFYING runs the real verify_resolution tool, whose successful
 * verdict completes the session. Still zero business logic here — every
 * branch delegates to agentStateService exactly as before.
 */

function createError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

// currentStatus -> the tool that resolves it, for statuses this
// phase actually supports driving automatically. Any status not
// listed here (DECIDING onward, HUMAN_REVIEW, and the terminal
// COMPLETED/FAILED) has no orchestrated stage yet — advanceSession
// returns the session unchanged rather than guessing what to do.
const STATUS_TO_TOOL = {
  IDLE: "inspect_item",
  EVALUATING: "calculate_valuation",
  CHECKING_CONSTRAINTS: "check_constraints",
  EXECUTING: "execute_resolution",
  VERIFYING: "verify_resolution",
};

// The statuses this phase drives forward WITHOUT a registered tool.
const DECISION_STATUS = "DECIDING";
const OBSERVATION_STATUS = "OBSERVING";
const REPLAN_STATUS = "REPLANNING";

// What the orchestrator would do next for a given session, without
// doing it. Useful for a caller (or the future dashboard) that wants
// to show "next up: calculate_valuation" before actually running it.
function describeNextStage(session) {
  if (session.currentStatus === DECISION_STATUS) {
    return {
      currentStatus: session.currentStatus,
      nextTool: null,
      nextStage: "decision",
      canAdvance: true,
    };
  }

  if (session.currentStatus === OBSERVATION_STATUS) {
    return {
      currentStatus: session.currentStatus,
      nextTool: null,
      nextStage: "observation",
      canAdvance: true,
    };
  }

  if (session.currentStatus === REPLAN_STATUS) {
    return {
      currentStatus: session.currentStatus,
      nextTool: null,
      nextStage: "replan",
      canAdvance: true,
    };
  }

  const toolName = STATUS_TO_TOOL[session.currentStatus] || null;

  return {
    currentStatus: session.currentStatus,
    nextTool: toolName,
    nextStage: toolName ? "tool" : null,
    // True only for statuses this phase can actually drive forward.
    // EXECUTING and VERIFYING drive via their registered tools below;
    // the terminal statuses and HUMAN_REVIEW report false here.
    canAdvance: toolName !== null,
  };
}

// Starts a brand-new session for itemId, or resumes the existing
// active (non-terminal) one if there is already one in flight.
// Thin pass-through to agentStateService.getOrCreateSession, which
// already owns this behavior (backed by
// agentRepository.findActiveSessionByItemId) — kept here only so
// callers have a single orchestrator entry point for "give me a
// session to work with" instead of reaching into agentStateService
// directly.
function startOrResumeSession(itemId, goal) {
  if (!itemId) {
    throw createError("startOrResumeSession requires an itemId");
  }

  return agentStateService.getOrCreateSession(itemId, goal);
}

// Runs exactly the one tool call that the session's current status
// calls for, using the state machine that already lives in
// agentStateService.runTool (status gating, tool invocation via
// agentToolRegistry, state update, TOOL_CALL/TOOL_RESULT/OBSERVATION
// event recording, and clean failure handling all happen there —
// this function does not reimplement any of it).
//
// `input` is passed straight through to the tool (e.g. inspect_item
// needs { image: { base64, mimetype, filename } }; the orchestrator
// has no way to fabricate that itself, so it is the caller's job to
// supply it when the next stage requires one).
async function advanceSession(sessionId, input) {
  if (!sessionId) {
    throw createError("advanceSession requires a sessionId");
  }

  const session = agentStateService.getState(sessionId);

// Phase 6: DECIDING has no tool to gate on — the decision policy
// reads state agentStateService already holds (availableOptions,
// constraints.routeAvailability, valuation.recommendation) and
// needs no caller-supplied input, unlike inspect_item/execute_resolution.
if (session.currentStatus === DECISION_STATUS) {
  const {
    session: updatedSession,
    decision,
    viable,
  } = agentStateService.runDecision(sessionId);

  return {
    session: updatedSession,
    toolName: null,
    stage: "decision",
    advanced: true,
    result: decision,
    decisionViable: viable,
    error: null,
  };
}

// Phase 9: OBSERVING is resolved purely from the session's recorded
// observation — no tool call, no caller input. A failed attempt
// routes to REPLANNING (autonomous recovery), a successful one to
// VERIFYING.
if (session.currentStatus === OBSERVATION_STATUS) {
  const { session: updatedSession, nextStatus } =
    agentStateService.resolveObservation(sessionId);

  return {
    session: updatedSession,
    toolName: null,
    stage: "observation",
    advanced: true,
    result: { resolvedFrom: "OBSERVING", resolvedTo: nextStatus },
    error: null,
  };
}

// Phase 9: REPLANNING runs the replan policy (agentStateService.runReplan,
// which delegates to agentReplanService). Not a tool call. A viable
// alternative lands back in DECIDING so the REAL decision stage picks it;
// no viable alternative lands in HUMAN_REVIEW.
if (session.currentStatus === REPLAN_STATUS) {
  const {
    session: updatedSession,
    replan,
    viable,
  } = agentStateService.runReplan(sessionId);

  return {
    session: updatedSession,
    toolName: null,
    stage: "replan",
    advanced: true,
    result: replan,
    decisionViable: viable,
    error: null,
  };
}

const toolName = STATUS_TO_TOOL[session.currentStatus];

if (!toolName) {
  // Nothing this phase knows how to do from here — HUMAN_REVIEW
  // (needs a human decision) or a terminal status. Report that
  // plainly instead of forcing a transition that doesn't exist.
  return {
    session,
    toolName: null,
    stage: null,
    advanced: false,
    result: null,
    error: null,
  };
}

// Phase 9: EXECUTING needs a route. When the caller doesn't supply one,
// the agent executes the route its own decision stage decided —
// currentAction/currentDecision currently sit on the session at EXECUTING.
// This is what makes the post-replan alternative flow fully automatic.
let toolInput = input;
if (session.currentStatus === "EXECUTING") {
  const route =
    (input && input.route) ||
    (session.currentAction && session.currentAction.route) ||
    (session.currentDecision && session.currentDecision.route) ||
    null;

  if (!route) {
    return {
      session,
      toolName: "execute_resolution",
      stage: "tool",
      advanced: false,
      result: null,
      error: {
        status: 409,
        message:
          "Session is EXECUTING but has no decision route to execute (run the DECIDING stage first).",
      },
    };
  }

  toolInput = { ...(input || {}), route };
}

const {
  session: updatedSession,
  result,
  error,
} = await agentStateService.runTool(sessionId, toolName, toolInput);

// agentStateService.runTool already turned a tool failure into a
// FAILED session + FINAL_OUTCOME event rather than throwing, so we
// mirror that here: report the error on the result instead of
// throwing, and never fabricate a success result when there was
// none.
return {
  session: updatedSession,
  toolName,
  stage: "tool",
  advanced: true,
  result: result || null,
  error: error || null,
};
}

module.exports = {
  STATUS_TO_TOOL,
  describeNextStage,
  startOrResumeSession,
  advanceSession,
};
