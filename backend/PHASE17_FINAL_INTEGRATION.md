# Phase 17 — Final Integration + Implementation Order Hardening

## Scope of this pass

Phases 1–16 already implement every layer in the required order (agent
state model → tool interfaces → inspection/valuation/constraints →
execution → verification → orchestration → failure handling →
replanning → frontend UI → timeline → demo integration). This pass
inspected the seams *between* those layers — backend service to
backend service, and backend API to frontend consumer — for broken
connections, duplicated logic, and naming mismatches, and fixed only
what was actually broken. No phase was rebuilt.

## Files created

- `backend/PHASE17_FINAL_INTEGRATION.md` (this file).

## Files modified

- `frontend/src/services/agentService.js` — targeted integration fix,
  see "Integration issues fixed" below.
- `frontend/src/components/agent/AgentDecisionCard.jsx` — **deleted**
  (dead code; see below).

## Integration issues fixed

### 1. `agentService.advance()` swallowed the backend's structured error path (real bug)

`agentController.advance` intentionally returns a non-2xx HTTP status
with a JSON body `{ success: false, message, data: outcome }` whenever
`agentOrchestrator.advanceSession` itself reports `outcome.error` (for
example: an `EXECUTING` session with no decided route). This is the
correct backend behavior — it is a real, structured failure, not a
fabricated one.

However, `frontend/src/services/apiClient.js` throws a plain `Error`
for *any* non-2xx response (`parseResponse`: `if (!response.ok) throw
...`). That meant `agentService.advance()` never actually returned the
`outcome` object on this path — it threw before `unwrap()` ran. But
both call sites in `AgentResolutionPage.jsx` (`driveForward` and
`handleImageSelected`) are written against the *other* contract: they
`await agentService.advance(...)` and then branch on
`outcome.error`/`outcome.session`. That branch was unreachable dead
code; a real orchestrator-level failure instead fell into the generic
`catch` block, which only sets a plain error banner and does not
preserve the session snapshot for that turn.

**Fix (frontend-only, no backend/API contract change):**
`agentService.advance()` now catches the thrown error and, if it
carries the structured body the backend already sends
(`err.body.data`), returns that instead of re-throwing — restoring the
exact `{ session, error, ... }` shape the page already expects. Any
other kind of thrown error (network failure, unexpected 500 with no
structured body) still propagates as before. This is the smallest fix
that reconnects an existing, already-written UI failure path to the
data the backend was already sending; it required no changes to
`agentController.js`, `agentOrchestrator.js`, or the API shape.

### 2. Removed an orphaned, superseded frontend component (dead code)

`frontend/src/components/agent/AgentDecisionCard.jsx` rendered
`decisionHistory`/`replanHistory` from the session — but it was never
imported anywhere in the frontend. It was fully superseded by
`AgentStory.jsx` (Phase 11's closed-loop view), which renders the same
data plus the preflight/verification/review states
`AgentDecisionCard` did not cover. Confirmed via a repo-wide search
that no route, page, or component referenced it before deleting it.
This is pure dead-code removal — no behavior changes for any page that
was actually reachable.

### Reviewed and confirmed already-consistent (no change needed)

- **Session field names.** `agentSessionId`, `currentStatus`,
  `detectedDevice`, `valuation`, `availableOptions`, `constraints`,
  `currentDecision`/`previousDecision`/`decisionHistory`,
  `currentAction`, `observations`, `attemptCount`, `failureReason`,
  `replanHistory`, `verificationResult`, `finalResolution`, `customer`
  (including the `customer.source` sentinel values) all match 1:1
  between `agentStateService.js`/`agentTools.js` and every frontend
  consumer (`agentTimeline.js`, `AgentStory.jsx`, `AgentOutcome.jsx`,
  `AgentItemPanel.jsx`, `AgentResolutionPage.jsx`).
- **Event shape.** `agentEventService.recordEvent`'s field set
  (`type`, `message`, `tool`, `metadata`, `success`, `route`,
  `errorCode`, `reason`, `attempt`, `stage`, `status`) is read
  consistently by `agentTimeline.js`'s `getEventTone` /
  `getEventPhaseLabel` / `getToolActivityRows` — every event-type
  branch matches a real field the backend actually sets for that event
  type (e.g. `FINAL_OUTCOME`/`TOOL_RESULT`/`REPLAN` always set
  `success` explicitly; `OBSERVATION` events for `execute_resolution`
  always carry `metadata.observations`).
- **Route vocabulary.** `whole | parts | auction | scrap | donate |
  repair` is the same closed set everywhere it appears:
  `agentStateService.buildAvailableOptions`,
  `agentTools.RESOLUTION_ROUTES`/`ROUTE_TO_SALE_TYPE`,
  `agentDecisionService`/`agentReplanService` (which never hardcode a
  route name, only ever echo what they were given), and the frontend's
  `ROUTE_LABELS`.
- **API routes ↔ frontend service calls.** Every function in
  `agentService.js` maps to exactly one route in `agentRoutes.js`
  (`resolve/:itemId`, `state/:sessionId`, `timeline/:sessionId`,
  `tools`, `tool/:sessionId/:toolName`, `advance/:sessionId`, and the
  `demo/*` control surface) with no unused or missing endpoints on
  either side.
- **Demo isolation.** The demo/hero pipeline (`heroDemoService`,
  `demoEnvironmentService`) does not shortcut `finalResolution` — the
  frontend's `/agent/demo` route still calls `resolveItem` →
  `driveForward`, which drives the exact same
  `advance`/`runTool`/`runDecision`/`runReplan` path a non-demo item
  uses. The only demo-specific behavior is data injection
  (`getRouteOptions`/`getRouteAvailability`/`getExecutionFailure`
  returning non-null only for the active scenario's item), not a
  parallel code path.

## Final integrated execution flow

**Happy path** (state → event, left to right):

```
resolveItem/getOrCreateSession   AGENT_START        (IDLE)
inspect_item                     TOOL_CALL/RESULT
                                  → OBSERVATION       (EVALUATING)
calculate_valuation               TOOL_CALL/RESULT
                                  → OBSERVATION       (CHECKING_CONSTRAINTS)
check_constraints                 TOOL_CALL/RESULT
                                  → OBSERVATION       (DECIDING)
runDecision (agentDecisionService) DECISION + ACTION  (EXECUTING)
execute_resolution                TOOL_CALL/RESULT
                                  → OBSERVATION       (OBSERVING)
resolveObservation (success)                          (VERIFYING)
verify_resolution                 TOOL_CALL/RESULT
                                  → FINAL_OUTCOME     (COMPLETED)
```

**Failure/replan path** (diverges at OBSERVING):

```
execute_resolution fails          TOOL_RESULT
                                  → OBSERVATION (failed)  (OBSERVING)
resolveObservation (failed)                              (REPLANNING)
runReplan (agentReplanService)     REPLAN              (DECIDING, if viable)
runDecision (2nd time)              DECISION + ACTION   (EXECUTING)
execute_resolution (alt. route)     TOOL_CALL/RESULT
                                    → OBSERVATION       (OBSERVING)
... continues to VERIFYING/COMPLETED, or to HUMAN_REVIEW
    if runReplan finds no viable alternative / MAX_RESOLUTION_ATTEMPTS
    is reached.
```

At every arrow above, the orchestrator (`agentOrchestrator.advanceSession`)
is the single driver: it reads `session.currentStatus`, dispatches to
the matching state-machine function (`runTool` / `runDecision` /
`resolveObservation` / `runReplan`), and returns the updated session —
the frontend's `driveForward` loop just calls `advance` repeatedly
until a terminal/interrupt status, rendering whatever state comes back.

**State flow between stages:** each stage only ever reads state a
previous stage actually wrote — `calculate_valuation` requires
`session.detectedDevice` (set by `inspect_item`); `check_constraints`
requires `session.valuation`; `runDecision` requires
`session.availableOptions` + `session.constraints`; `execute_resolution`
reads the route from `session.currentAction`/`currentDecision` (set by
`runDecision`); `verify_resolution` reads
`session.currentAction`/`currentDecision` again to know which route to
verify against the persisted listing. No stage duplicates another
stage's computation — valuation numbers, classification, and
constraint checks are computed exactly once and passed forward on the
session.

**Frontend integration:** `AgentResolutionPage` is the only place that
drives the loop (via `agentService.advance`), and every other agent
component (`AgentStatus`, `AgentStory`, `AgentOutcome`, `AgentItemPanel`,
`AgentTimeline`, `AgentToolActivity`) is a pure, read-only view over
`session`/`events` as returned by the backend — none of them compute a
decision, a replan, or a verification verdict themselves.

**Timeline/observability integration:** the frontend never invents an
event; `agentTimeline.js`'s helpers only ever branch on fields the
backend already recorded (`type`, `success`, `metadata.observations`,
`decision.viable`, etc.), matching the Phase 15 structured-event
contract unchanged.

## Remaining architectural limitations

(Carried over from Phase 16, still accurate — not addressed by this
integration pass, since none of them are integration gaps):

- All repositories (`agentRepository`, `listingRepository`,
  `auctionRepository`, `pickupRepository`) remain in-memory; no durable
  persistence exists.
- `repair` still has no dedicated domain repository — it is
  represented only via the listing's `status` field.
- Demo/hero item tracking uses a single module-level `demoItemId`, not
  safe for concurrent demo sessions.
- `HUMAN_REVIEW → DECIDING` is a legal state transition with no API
  endpoint to drive it; a session parked in `HUMAN_REVIEW` cannot be
  resumed by the current frontend/backend surface without a new
  endpoint (out of scope for this integration-only phase).
