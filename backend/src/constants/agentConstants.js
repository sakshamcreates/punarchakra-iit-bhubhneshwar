/*
 * Punarchakra — Autonomous E-Waste Resolution Agent
 * Phase 2: foundation constants (state machine + event vocabulary)
 *
 * These are shared by agentStateService, agentEventService and
 * agentToolRegistry so the whole agent subsystem draws from one
 * source of truth, matching the pattern already used by
 * listingConstants.js and pickupService.js's VALID_STATUSES/NEXT_STATUS.
 */

const AGENT_STATUSES = [
  'IDLE',
  'INSPECTING',
  'EVALUATING',
  'CHECKING_CONSTRAINTS',
  'DECIDING',
  'EXECUTING',
  'OBSERVING',
  'VERIFYING',
  'REPLANNING',
  'COMPLETED',
  'FAILED',
  'HUMAN_REVIEW'
];

// Terminal statuses never transition anywhere else.
const TERMINAL_STATUSES = ['COMPLETED', 'FAILED'];

// Phase 9: hard cap on resolution attempts for one session. Every
// completed execute_resolution call (success or failure) increments
// session.attemptCount; once it reaches this cap the replan policy
// stops offering new routes and the session lands in HUMAN_REVIEW /
// FAILED instead of looping forever (see agentReplanService).
const MAX_RESOLUTION_ATTEMPTS = 3;

// Explicit allow-list of legal next statuses per current status.
// Mirrors pickupService's NEXT_STATUS map, but as a fan-out list
// since the agent's flow branches (success vs failure vs replan)
// instead of being a single linear chain.
const AGENT_STATUS_TRANSITIONS = {
  IDLE: ['INSPECTING', 'FAILED'],
  INSPECTING: ['EVALUATING', 'FAILED'],
  EVALUATING: ['CHECKING_CONSTRAINTS', 'FAILED'],
  CHECKING_CONSTRAINTS: ['DECIDING', 'HUMAN_REVIEW', 'FAILED'],
  DECIDING: ['EXECUTING', 'HUMAN_REVIEW', 'FAILED'],
  EXECUTING: ['OBSERVING', 'FAILED'],
  // Phase 9: a failed execution observation routes to REPLANNING; a
  // successful one routes to VERIFYING. (Phase 8 shipped OBSERVING as
  // ['VERIFYING','FAILED'] only — REPLANNING is the new, legal target.)
  OBSERVING: ['REPLANNING', 'VERIFYING', 'FAILED'],
  VERIFYING: ['COMPLETED', 'REPLANNING', 'FAILED'],
  REPLANNING: ['DECIDING', 'HUMAN_REVIEW', 'FAILED'],
  HUMAN_REVIEW: ['DECIDING', 'FAILED'],
  COMPLETED: [],
  FAILED: []
};

const AGENT_EVENT_TYPES = [
  'AGENT_START',
  'TOOL_CALL',
  'TOOL_RESULT',
  'OBSERVATION',
  'DECISION',
  'ACTION',
  'REPLAN',
  'VERIFICATION',
  'FINAL_OUTCOME',
  // Phase 15: the one genuinely new event type. Every other structured
  // lifecycle stage the observability spec asks for already has a home in
  // an existing event type (SESSION_CREATED/GOAL_ESTABLISHED -> AGENT_START,
  // INSPECTION_RESULT/VALUATION_RESULT/CONSTRAINT_RESULT/ACTION_RESULT ->
  // OBSERVATION, VERIFICATION -> FINAL_OUTCOME with tool "verify_resolution"
  // — see agentEventService's TOOL_TO_RESULT_STAGE). HUMAN_REVIEW/escalation
  // had no equivalent event before Phase 15 (it was only a status value),
  // so this is additive, not a rename of anything working.
  'HUMAN_REVIEW',
];

// Phase 15: shared log-level vocabulary for structured events (see
// agentEventService.defaultLevel). INFO = normal lifecycle, WARN =
// recoverable business/environment failure, ERROR = unexpected tool/system
// failure, DEBUG = developer diagnostics (reserved for future use; no event
// site sets this today).
const LOG_LEVELS = ['INFO', 'WARN', 'ERROR', 'DEBUG'];

// Phase 15: failure classification vocabulary (spec Step 9). Attached as
// `failureClass` on events that represent a failure, so a developer can
// tell "the business/demo environment said no" apart from "our own tool
// code threw an unexpected exception" without re-deriving it from prose.
const FAILURE_CLASSES = {
  BUSINESS_ENVIRONMENT: 'BUSINESS_ENVIRONMENT',
  VALIDATION: 'VALIDATION',
  TOOL_INFRASTRUCTURE: 'TOOL_INFRASTRUCTURE',
  INTERNAL_SYSTEM: 'INTERNAL_SYSTEM',
};

// The five tools the eventual orchestrator will call. Phase 2 only
// gives inspect_item / calculate_valuation / check_constraints real
// handlers — execute_resolution and verify_resolution are registered
// so the API surface and registry shape are final, but their handlers
// deliberately throw NOT_IMPLEMENTED (see services/agentTools.js).
const AGENT_TOOL_NAMES = [
  'inspect_item',
  'calculate_valuation',
  'check_constraints',
  'execute_resolution',
  'verify_resolution'
];

module.exports = {
  AGENT_STATUSES,
  TERMINAL_STATUSES,
  AGENT_STATUS_TRANSITIONS,
  AGENT_EVENT_TYPES,
  AGENT_TOOL_NAMES,
  MAX_RESOLUTION_ATTEMPTS,
  LOG_LEVELS,
  FAILURE_CLASSES,
};
