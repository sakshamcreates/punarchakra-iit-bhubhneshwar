const { randomUUID } = require('crypto');
const agentRepository = require('../data/agentRepository');
const { AGENT_EVENT_TYPES, LOG_LEVELS } = require('../constants/agentConstants');

/*
 * Builds and stores structured timeline events for an agent session.
 * This is the single place that shapes an event, so the eventual
 * frontend timeline (Phase 3) can render straight off getTimeline()
 * output without any hardcoded display logic — matching Step 3's
 * "the timeline must eventually be generated from actual agent
 * events" requirement.
 *
 * Phase 15: extends the Phase 2 event shape with structured
 * observability fields (sessionId, itemId, level, stage, status, route,
 * action, errorCode, reason, attempt, failureClass) so the full agent
 * lifecycle is machine-reconstructable by filtering on sessionId, without
 * touching any of the original fields the frontend timeline already reads
 * (id, type, timestamp, message, tool, input, output, decision, success,
 * metadata). Every new field is optional and defaults to null — "not
 * every event needs every field" — so this is purely additive.
 */

function createError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

// Default log level per event type, used only when the caller doesn't pass
// details.level explicitly. Recoverable business/environment failures
// (a blocked route, a replan, an escalation) are WARN, not ERROR — only an
// unexpected tool/system failure (a thrown exception) is ERROR. A caller
// that already knows the failure classification (see FAILURE_CLASSES)
// should just pass details.level directly rather than relying on this.
function defaultLevel(type, details = {}) {
  if (details.success === false) {
    if (type === 'TOOL_RESULT') {
      return 'ERROR';
    }
    if (type === 'FINAL_OUTCOME') {
      return details.failureClass === 'TOOL_INFRASTRUCTURE' ||
        details.failureClass === 'INTERNAL_SYSTEM'
        ? 'ERROR'
        : 'WARN';
    }
    return 'WARN';
  }

  if (type === 'HUMAN_REVIEW' || type === 'REPLAN') {
    // A REPLAN event only ever fires after a real execution failure was
    // already observed — it is the recovery step, not the failure itself,
    // but it still represents something going off the happy path.
    return 'WARN';
  }

  return 'INFO';
}

// Prefer structured JSON logs for server-side logging (spec Step 15).
// Deliberately a SMALL, fixed field set — never the full event (no
// input/output/metadata) — so this can never leak a large payload, a
// base64 image, or a secret into server logs even if a caller's
// details.metadata accidentally carried one. A logging failure must never
// break agent execution (engineering rule 12), so this never throws.
function writeStructuredLog(event) {
  try {
    console.log(
      JSON.stringify({
        timestamp: event.timestamp,
        level: event.level,
        eventType: event.type,
        sessionId: event.sessionId,
        itemId: event.itemId,
        eventId: event.id,
        stage: event.stage,
        status: event.status,
        tool: event.tool,
        route: event.route,
        action: event.action,
        success: event.success,
        errorCode: event.errorCode,
        failureClass: event.failureClass,
        attempt: event.attempt,
        reason: event.reason,
      }),
    );
  } catch (_error) {
    // Never let a logging failure break the agent's real execution.
  }
}

// type: one of AGENT_EVENT_TYPES
// details: { message, tool, input, output, decision, success, metadata,
//            level, stage, status, route, action, errorCode, reason,
//            attempt, failureClass }
function recordEvent(sessionId, type, details = {}) {
  if (!AGENT_EVENT_TYPES.includes(type)) {
    throw createError(`Unknown agent event type: ${type}`);
  }

  // Phase 15: look the session up first (rather than only relying on
  // agentRepository.addEvent's own not-found check below) so every event
  // can carry itemId for session/item correlation without every call site
  // having to pass it in separately — the session is the one place itemId
  // already lives.
  const session = agentRepository.findSessionById(sessionId);
  if (!session) {
    throw createError('Agent session not found', 404);
  }

  const event = {
    id: randomUUID(),
    type,
    timestamp: new Date().toISOString(),
    message: details.message || null,
    tool: details.tool || null,
    input: details.input !== undefined ? details.input : null,
    output: details.output !== undefined ? details.output : null,
    decision: details.decision !== undefined ? details.decision : null,
    success: details.success !== undefined ? details.success : null,
    metadata: details.metadata || null,

    // Phase 15 structured fields (additive — see module comment above).
    sessionId,
    itemId: session.itemId || null,
    level: LOG_LEVELS.includes(details.level)
      ? details.level
      : defaultLevel(type, details),
    stage: details.stage || null,
    status: details.status || session.currentStatus || null,
    route: details.route || null,
    action: details.action || null,
    errorCode: details.errorCode || null,
    reason: details.reason || null,
    attempt: details.attempt !== undefined ? details.attempt : null,
    failureClass: details.failureClass || null,
  };

  const stored = agentRepository.addEvent(sessionId, event);
  if (!stored) {
    throw createError('Agent session not found', 404);
  }

  writeStructuredLog(stored);

  return stored;
}

function getTimeline(sessionId) {
  const events = agentRepository.getEvents(sessionId);
  if (!events) {
    throw createError('Agent session not found', 404);
  }

  return events;
}

module.exports = {
  recordEvent,
  getTimeline,
};
