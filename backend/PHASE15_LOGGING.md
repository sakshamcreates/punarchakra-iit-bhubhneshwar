# Phase 15 — Structured Agent Logging & Observability

## 1. Purpose

Phases 1–14 built a real autonomous resolution agent (inspect → value →
check constraints → decide → execute → observe → replan → verify → finish)
and a human-readable timeline on top of it (`agentEventService` +
`AgentTimeline`/`AgentStory` on the frontend). That timeline was always
built from real events, but the events themselves were shaped for display
text, not for machine analysis: no session/item correlation field on the
event object, no log level, no consistent way to ask "show me every
`REQUIRED_COMPONENT_UNAVAILABLE` failure across every session."

Phase 15 makes the same, real agent lifecycle **machine-reconstructable**:
given a `sessionId`, a developer (or a log aggregator) can filter the
event stream and see exactly what the agent observed, decided, did, and
why — without parsing prose `message` strings.

This phase adds fields and one new event type. It does not change any
agent behavior, decision logic, or state transition — see
`agentStateService.js`'s existing `TOOL_STAGE_RULES` / `runDecision` /
`runReplan`, all of which are untouched except for the event-recording
calls at the end of each function.

## 2. Structured event schema

Every event recorded by `agentEventService.recordEvent` now has this
shape. Fields present since Phase 2 are marked "(Phase 2)"; everything
else is new in Phase 15 and additive — every new field defaults to
`null` when a caller doesn't supply it, so nothing that already reads the
Phase 2 fields breaks.

| Field | Since | Description |
|---|---|---|
| `id` | Phase 2 | Unique event id (`crypto.randomUUID()`). |
| `type` | Phase 2 | One of `AGENT_EVENT_TYPES` (see §3). |
| `timestamp` | Phase 2 | ISO-8601 timestamp. |
| `message` | Phase 2 | Human-readable summary, for the frontend timeline. |
| `tool` | Phase 2 | Tool name, when the event is tool-related. |
| `input` / `output` | Phase 2 | Tool input/output (base64 images redacted — see §9). |
| `decision` | Phase 2 | A decision/replan summary object, when relevant. |
| `success` | Phase 2 | Boolean outcome, when the event has one. |
| `metadata` | Phase 2 | Free-form extra data (kept small — see §2 note below). |
| `sessionId` | **Phase 15** | The agent session this event belongs to. |
| `itemId` | **Phase 15** | The listing/item the session is resolving, read from the session so callers never have to pass it themselves. |
| `level` | **Phase 15** | `INFO` \| `WARN` \| `ERROR` \| `DEBUG` — see §14. |
| `stage` | **Phase 15** | A stable stage name (e.g. `VALUATION_RESULT`, `TOOL_CALL`, `HUMAN_REVIEW`) — see §4 for the mapping onto `type`. |
| `status` | **Phase 15** | The session's `currentStatus` after this event (or the in-progress status for `TOOL_CALL`). |
| `route` | **Phase 15** | The resolution route the event concerns, when there is one. |
| `action` | **Phase 15** | A short description of the intended/executed action (currently set on `ACTION` events). |
| `errorCode` | **Phase 15** | The structured error code from a tool result or thrown error, when the event represents a failure. |
| `reason` | **Phase 15** | A short, non-chain-of-thought reason string (see §6). |
| `attempt` | **Phase 15** | `session.attemptCount` at the time of the event. |
| `failureClass` | **Phase 15** | One of `FAILURE_CLASSES` (see §9), only set on failure-shaped events. |

Not every event sets every field — a `TOOL_CALL` event has no
`errorCode`, a successful `DECISION` has no `failureClass`. This mirrors
the existing Phase 2 convention (`decision`, `output`, etc. are already
`null` when not applicable).

`metadata` payloads are kept to what the frontend/spec actually needs
(e.g. `consideredOptions`/`excludedOptions` on `DECISION`, the full
`replanRecord` on `REPLAN`) — never a full raw tool result dumped
wholesale beyond what Phase 9 already stored there.

## 3. Event types

`constants/agentConstants.js` → `AGENT_EVENT_TYPES`:

```
AGENT_START, TOOL_CALL, TOOL_RESULT, OBSERVATION, DECISION, ACTION,
REPLAN, VERIFICATION, FINAL_OUTCOME, HUMAN_REVIEW
```

Only `HUMAN_REVIEW` is new in Phase 15. Every other structured lifecycle
stage the observability spec asks for already has a home in an existing
type — see §4. `VERIFICATION` was already declared but, like Phase 2–9
before it, verification outcomes are recorded as `FINAL_OUTCOME` with
`tool: "verify_resolution"` (the frontend's `getEventPhaseLabel` already
special-cases this to display "Verification"). Phase 15 keeps that
convention rather than emitting a second, competing event for the same
moment.

## 4. Required-observability → event-type mapping

| Required stage | Event type | How to find it |
|---|---|---|
| SESSION_CREATED | `AGENT_START` | `stage: "SESSION_CREATED"` |
| GOAL_ESTABLISHED | `AGENT_START` | same event, `metadata.goal` (set atomically with session creation) |
| TOOL_CALL | `TOOL_CALL` | `stage: "TOOL_CALL"` |
| TOOL_RESULT | `TOOL_RESULT` | `stage: "TOOL_RESULT"` |
| INSPECTION_RESULT | `OBSERVATION` | `tool: "inspect_item"`, `stage: "INSPECTION_RESULT"` |
| VALUATION_RESULT | `OBSERVATION` | `tool: "calculate_valuation"`, `stage: "VALUATION_RESULT"` |
| CONSTRAINT_RESULT | `OBSERVATION` or `FINAL_OUTCOME` | `tool: "check_constraints"`, `stage: "CONSTRAINT_RESULT"` |
| DECISION | `DECISION` | `stage: "DECISION"` |
| ACTION | `ACTION` | `stage: "ACTION"` |
| ACTION_RESULT | `OBSERVATION` | `tool: "execute_resolution"`, `stage: "ACTION_RESULT"` |
| OBSERVATION | `OBSERVATION` | (all of the above are also, literally, observations) |
| FAILURE | any event with `success: false` or `level: "ERROR"/"WARN"` | filter on `level`/`errorCode`/`failureClass` |
| REPLAN | `REPLAN` | `stage: "REPLAN"` |
| VERIFICATION | `FINAL_OUTCOME` | `tool: "verify_resolution"`, `stage: "VERIFICATION"` |
| FINAL_OUTCOME | `FINAL_OUTCOME` | `stage: "FINAL_OUTCOME"` (tool error path) or `"VERIFICATION"` (normal completion) |
| HUMAN_REVIEW / ESCALATION | `HUMAN_REVIEW` | `stage: "HUMAN_REVIEW"` |

`TOOL_TO_RESULT_STAGE` in `agentStateService.js` is the single lookup
table that drives the `INSPECTION_RESULT` / `VALUATION_RESULT` /
`CONSTRAINT_RESULT` / `ACTION_RESULT` / `VERIFICATION` stage labels.

## 5. Correlation / session IDs

Every event now carries `sessionId` and `itemId` directly (previously
only implicit via which session's event array it lived in —
`agentRepository`'s `eventsBySession` map is unchanged). `attempt` is
carried on every execution-related event
(`TOOL_CALL`/`TOOL_RESULT`/`OBSERVATION`/`DECISION`/`ACTION`/`REPLAN`).
`eventId` is the existing `id` field.

A developer can reconstruct one full agent execution with:

```
GET /api/agent/timeline/:sessionId
```

filtered/grouped by `sessionId` (already the case — `getTimeline` is
unchanged) and ordered by `timestamp`/array order (also unchanged).

## 6. Log levels

`constants/agentConstants.js` → `LOG_LEVELS = ['INFO', 'WARN', 'ERROR', 'DEBUG']`.

Default assignment (`agentEventService.defaultLevel`), overridable per
call via `details.level`:

- **INFO** — normal lifecycle: session start, tool calls, successful tool
  results, viable decisions, actions, successful observations, successful
  final outcomes.
- **WARN** — recoverable business/environment failure: a failed
  `execute_resolution` observation, a `REPLAN` (viable or not — replanning
  only ever happens after a real failure), a `HUMAN_REVIEW` escalation, a
  non-viable `DECISION`.
- **ERROR** — unexpected tool/system failure: a `TOOL_RESULT` where the
  tool itself threw, or a `FINAL_OUTCOME` whose `failureClass` is
  `TOOL_INFRASTRUCTURE` or `INTERNAL_SYSTEM`.
- **DEBUG** — reserved for future developer-diagnostics events; no
  current call site sets this.

Not every event is forced to `ERROR` — a blocked resolution route or a
replan is expected agent behavior, not a bug, and stays at `WARN`.

`reason` is always a short, structured-fact string derived from real data
(a tool's `reason`/`message`, a decision's exclusion reasoning, a replan's
computed reason) — never the model's private reasoning process. No event
in this system is produced by an LLM chain-of-thought to begin with
(`agentDecisionService`/`agentReplanService` are deterministic, rule-based
policies), so there is nothing to strip; this is stated here for the
record and to keep future tool/decision work honoring the same rule.

## 7. Tool logging

`TOOL_CALL` captures `tool`, `sessionId`, `itemId` (via the event
schema), `attempt`, and a **redacted** `input` (see §9). `TOOL_RESULT`
captures `tool`, `success`, a concise `output` (the tool's own return
value — never enlarged), and `errorCode` on failure.

## 8. Decision logging

Every `DECISION` event carries: `route` (selected route, or `null` if
non-viable), `decision.consideredOptions` / `decision.excludedOptions`
(candidate + blocked routes, from the real decision policy —
`agentDecisionService.decide`), `reason`, `attempt`, and whether this was
a fresh decision or a post-replan one (distinguishable via
`decision.consideredOptions` reflecting the replan's updated route
availability, and the presence of a preceding `REPLAN` event in the same
session). No selection logic lives in the logging code — it only reports
what `agentDecisionService`/`agentReplanService` already decided.

## 9. Action logging

`ACTION` events carry `route`, `action` (e.g.
`execute_resolution("repair")`), and `attempt` — recorded the moment the
decision stage commits to a route, before `execute_resolution` actually
runs. The corresponding `ACTION_RESULT` (an `OBSERVATION` event tagged
`tool: "execute_resolution"`) carries `success`/`route`/`errorCode` plus a
concise state-mutation summary in `metadata` (the same `observations`
array Phase 9 already appended to the session — a real domain entity id,
e.g. `resolutionId`/`auctionId`/`pickupId`, when the executor created
one). Nothing here claims a mutation the executor didn't actually perform
— `metadata` is the literal `updates` object `TOOL_STAGE_RULES.execute_resolution.onSuccess`
already computed from the real tool result.

## 10. Observation logging

`OBSERVATION` events (pre-decision and post-execution alike) are only
ever recorded from a real tool result — `agentToolRegistry.callTool`'s
return value, never a fabricated `success`/`errorCode`. `execute_resolution`'s
structured environment failure (`{ success:false, errorCode, route, reason }`,
produced by `demoEnvironmentService.getExecutionFailure`) flows straight
into the `OBSERVATION` event's `success`/`route`/`errorCode`/`reason`
fields unchanged.

## 11. Failure classification

`constants/agentConstants.js` → `FAILURE_CLASSES`:

- `BUSINESS_ENVIRONMENT` — the demo/business environment refused a route
  (`execute_resolution` returning `success:false`, e.g.
  `REQUIRED_COMPONENT_UNAVAILABLE`), a non-viable decision/replan, or a
  failed verification (the resolution didn't take hold in domain state).
- `VALIDATION` — a precondition/business-rule failure at
  `check_constraints` (e.g. `LISTING_NOT_RESOLVABLE`), or a tool throwing
  a caller/business-facing error (`INVALID_ROUTE`, `UNSUPPORTED_RESOLUTION`,
  `ITEM_NOT_FOUND`, `RESOLUTION_ALREADY_EXISTS`, `DOMAIN_OPERATION_FAILED`
  — see `VALIDATION_ERROR_CODES` in `agentStateService.js`).
- `TOOL_INFRASTRUCTURE` — a tool threw an error that isn't one of the
  known validation codes above (default assumption for an unexpected tool
  exception, e.g. the ML classification service being unreachable).
- `INTERNAL_SYSTEM` — reserved for future use (no current call site
  distinguishes this from `TOOL_INFRASTRUCTURE`; both are logged at
  `ERROR`).

The existing hero failure, `REQUIRED_COMPONENT_UNAVAILABLE`, is always
`BUSINESS_ENVIRONMENT` — it is the demo environment's own structured
"no" (`demoEnvironmentService`), not a thrown exception, and Phase 15
does not change that behavior, only how it's classified for logging.

## 12. Replan logging

`REPLAN` events carry `route` (the selected alternative, or `null`),
`errorCode`/`reason` (from the just-failed attempt), `attempt`, and
`metadata` holding the full `replanRecord` computed by
`agentReplanService.replan` — `previousDecision`, `failedRoute`,
`excludedRoutes`, `consideredAlternatives`, `selectedAlternative`. All of
these values come from real session state (`session.observations`,
`session.currentDecision`, `session.constraints.routeAvailability`) —
nothing is hardcoded for the hero scenario.

## 13. Verification logging

Verification's outcome is recorded on the `FINAL_OUTCOME` event emitted
by `TOOL_STAGE_RULES.verify_resolution.onSuccess` (`stage: "VERIFICATION"`),
carrying `route`, `success`/`failureClass`, and `reason` straight from
`verify_resolution`'s real check against persisted listing state (see
`agentTools.verifyResolution`). A successful execution never marks
verification successful by itself — `session.verificationResult` and this
event only exist once `verify_resolution` itself has run and returned a
verdict.

## 14. Final outcome logging

`FINAL_OUTCOME` events (whichever path produced them — verification
success/failure or a tool-level session failure) carry `sessionId`,
`itemId`, `status` (`COMPLETED`/`FAILED`), `route`, `attempt`, and
`success`. Whether replanning occurred and the verification status are
already visible on the session itself
(`session.replanHistory.length > 0`, `session.verificationResult`) and
in the event stream (a preceding `REPLAN` event, a preceding
`FINAL_OUTCOME` with `stage: "VERIFICATION"`).

## 15. HUMAN_REVIEW / escalation logging

`agentStateService.recordHumanReviewEscalation` is the single function
that records a `HUMAN_REVIEW` event, called from every stage that can
land a session in `HUMAN_REVIEW`:

- `check_constraints` review flags (inside `runTool`),
- a non-viable `DECISION` (no route was ever viable),
- a non-viable `REPLAN` (every alternative failed, or
  `MAX_RESOLUTION_ATTEMPTS` was reached).

Each records the real `reason` string from that stage, `attempt`
(`session.attemptCount`), and `metadata.blockedRoutes` /
`metadata.remainingOptions` read from the actual session state
(`excludedOptions`, `constraints.routeAvailability`,
`availableOptions`) — never fabricated.

## 16. Sensitive-data exclusions

- **Base64 images are never logged or stored on an event.**
  `agentStateService.redactToolInput` replaces `input.image.base64` on
  `inspect_item`'s `TOOL_CALL` event with a
  `[REDACTED_BASE64_<n>_CHARS]` placeholder before the event is recorded
  — the raw bytes never reach `agentRepository`, the timeline API, or the
  structured console log.
- **The structured console log line** (`agentEventService.writeStructuredLog`,
  §17) only ever serializes a small, fixed field set (timestamp, level,
  eventType, sessionId, itemId, eventId, stage, status, tool, route,
  action, success, errorCode, failureClass, attempt, reason) — it never
  includes `input`, `output`, or `metadata`, so a large payload placed in
  those fields by a future call site still can't leak into server logs.
- No API key, auth token, password, or secret is ever read by this
  subsystem in the first place (this codebase's agent tools don't accept
  or handle any), so there is nothing to redact there beyond the general
  rule of never adding them to `metadata`/`output` in future work.
- No chain-of-thought is logged, because none is produced —
  `agentDecisionService`/`agentReplanService` are deterministic, rule
  evaluated policies, not LLM calls. `reason` fields are short, structured
  facts (which route, which error code, which options were excluded and
  why), matching the "decision facts, not hidden reasoning" requirement.

## 17. Output format

Every recorded event is also written as one structured JSON line to
stdout via `console.log(JSON.stringify({...}))` in
`agentEventService.writeStructuredLog` (see the level/field list in §16).
A logging failure (a serialization error, for instance) is caught and
silently ignored — it can never throw and break the agent's real
execution (engineering rule: "Logging failures must not break agent
execution").

No logging framework was introduced; this is deliberately the lightest
option for a system with no existing logger, per Step 15 of the phase
spec.

## 18. Hero trace example

With the `SCENARIO_FAILURE_REPLAN` hero scenario active
(`demoEnvironmentService.enableRequiredComponentUnavailable` /
`setActiveScenario`), a normal run through the agent — no fabricated demo
events, just the real state machine producing real tool results —
produces this event sequence (fields abbreviated for readability):

```
AGENT_START      stage=SESSION_CREATED           status=IDLE
TOOL_CALL        tool=inspect_item                status=INSPECTING
TOOL_RESULT      tool=inspect_item     success=true
OBSERVATION      tool=inspect_item      stage=INSPECTION_RESULT
TOOL_CALL        tool=calculate_valuation         status=EVALUATING
TOOL_RESULT      tool=calculate_valuation success=true
OBSERVATION      tool=calculate_valuation stage=VALUATION_RESULT
TOOL_CALL        tool=check_constraints           status=CHECKING_CONSTRAINTS
TOOL_RESULT      tool=check_constraints success=true
OBSERVATION      tool=check_constraints stage=CONSTRAINT_RESULT status=DECIDING
DECISION         route=repair          stage=DECISION   status=EXECUTING  attempt=0
ACTION           route=repair          stage=ACTION     status=EXECUTING
TOOL_CALL        tool=execute_resolution          status=EXECUTING attempt=0
TOOL_RESULT      tool=execute_resolution success=true   (tool call itself completed)
OBSERVATION      tool=execute_resolution stage=ACTION_RESULT status=OBSERVING
                 success=false errorCode=REQUIRED_COMPONENT_UNAVAILABLE
                 failureClass=BUSINESS_ENVIRONMENT level=WARN attempt=1
REPLAN           route=parts   stage=REPLAN  status=DECIDING
                 errorCode=REQUIRED_COMPONENT_UNAVAILABLE  attempt=1  level=WARN
DECISION         route=parts   stage=DECISION  status=EXECUTING  attempt=1
ACTION           route=parts   stage=ACTION    status=EXECUTING
TOOL_CALL        tool=execute_resolution          status=EXECUTING attempt=1
TOOL_RESULT      tool=execute_resolution success=true
OBSERVATION      tool=execute_resolution stage=ACTION_RESULT status=VERIFYING
                 success=true attempt=2
TOOL_CALL        tool=verify_resolution            status=VERIFYING
TOOL_RESULT      tool=verify_resolution success=true
FINAL_OUTCOME    tool=verify_resolution stage=VERIFICATION status=COMPLETED
                 route=parts success=true
```

(`OBSERVATION`'s `success:false` above is nested — see §2's `metadata`
note: `event.success` itself is only set explicitly on
`TOOL_RESULT`/`REPLAN`/`FINAL_OUTCOME`, per the existing Phase 9
`getEventTone` convention on the frontend; the `execute_resolution`
`OBSERVATION`'s pass/fail lives in `metadata.observations[-1].success`
and is mirrored onto the new `errorCode`/`route`/`failureClass` top-level
fields this phase adds.)

This sequence is produced by the real `agentOrchestrator.advanceSession`
loop driving a real session through the real scenario — nothing above is
a hand-authored demo event.

## Files changed

- `backend/src/constants/agentConstants.js` — added `HUMAN_REVIEW` to
  `AGENT_EVENT_TYPES`; added `LOG_LEVELS` and `FAILURE_CLASSES`.
- `backend/src/services/agentEventService.js` — extended the event shape
  with the Phase 15 structured fields, added `defaultLevel`, and added
  `writeStructuredLog` (JSON console log per recorded event).
- `backend/src/services/agentStateService.js` — every existing
  `recordEvent` call site now passes the new structured fields; added
  `TOOL_TO_RESULT_STAGE`, `classifyToolError`, `redactToolInput`, and
  `recordHumanReviewEscalation`.
- `backend/PHASE15_LOGGING.md` — this file.

No other file was changed. `agentRepository.js`, `agentToolRegistry.js`,
`agentDecisionService.js`, `agentReplanService.js`, `agentOrchestrator.js`,
`agentController.js`, `agentRoutes.js`, `demoEnvironmentService.js`,
`heroDemoService.js`, and every frontend component
(`AgentTimeline`/`AgentTimelineEvent`/`AgentToolActivity`/`AgentDecisionCard`/
`AgentOutcome`/`utils/agentTimeline.js`) are untouched — they already only
read the Phase 2 fields these changes leave in place, so no compatibility
shim was needed.
