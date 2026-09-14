# Phase 16 — Engineering Hardening + Hackathon Quality Rules

## Scope of this pass

Phase 16 asked for engineering hardening of the ReValue autonomous
resolution agent (goal → observe → decide → act → observe → verify,
with replanning on failure). Phases 1–15 were already implemented, and
inspection of `backend/src/services/agent*.js`,
`backend/src/services/demoEnvironmentService.js`,
`backend/src/services/heroDemoService.js`,
`backend/src/data/agentRepository.js`, and
`backend/src/constants/agentConstants.js` showed that almost every rule
in this phase's brief was already built and documented, incrementally,
during Phases 6–15 (the in-code comments reference the phase that
introduced each piece). This pass therefore consisted of: (1) a full
read-through of the agent subsystem against every rule below, (2) a
small, targeted set of real fixes for the concrete issues that review
did uncover (dead code, a `currentAction` shape inconsistency, a
missing null guard, and a flaky fixed-sleep test), (3) re-verification
against the full `testphase6–14` harness suite, and (4) this
documentation. No working functionality was rewritten.

## Files modified

- `backend/testphase14.js` — two robustness fixes that made the harness
  actually terminate and stop being flaky under load:
  - Added explicit `process.exit(0)` / `process.exit(1)` in the
    `main().then/catch` tail. `require("./src/app")` leaves Node's
    `app.listen` server handle open, so the harness printed PASS but the
    process never exited (every other `testphase*.js` harness exits
    explicitly for this same reason). After `process.exit`, the exit
    code now also reflects pass/fail.
  - Replaced the two fixed `setTimeout(700)` child-process boot sleeps in
    `testRestartBehaviorDocumented` with `waitForServer(base)` — a poll of
    `GET /api/health` backed by a bounded 10 s deadline. The fixed sleep
    was a fragile assumption (see rule 3 below): under six parallel
    harnesses the freshly spawned `node src/app.js` needed far longer
    than 700 ms to bind its port, producing spurious `ECONNREFUSED`
    failures.
- `backend/src/services/agentTools.js` — removed leftover Phase 2 stub
  infrastructure: the empty `NOT_IMPLEMENTED_TOOLS` array and the
  never-called `notImplementedHandler(toolName)` (dead code; Phase 9
  implements `verify_resolution`, so every registered tool has a real
  handler).
- `backend/src/services/agentOrchestrator.js` — removed the unused
  `startOrResumeAndAdvance` function (and its export); nothing in the
  backend or frontend referenced it. `advanceSession` remains the single
  driver of status transitions.
- `backend/src/services/agentStateService.js` — normalized `currentAction`
  in `TOOL_STAGE_RULES.execute_resolution.onSuccess`. The success branch
  previously stored the raw `result.action` string while the failure
  branch stored `{ ...session.currentAction, failed: true, errorCode }`
  and `runDecision` stored `{ type: "execute_resolution", route }`; the
  success path now stores the same object shape
  (`{ type, route, action }`). Downstream readers (`verify_resolution`,
  the EXECUTING route lookup) use `.route`/`.failed`, so this removes a
  latent divergence. Verified no frontend or harness code depends on the
  old string form.
- `backend/src/services/agentEventService.js` — added a `details = {}`
  default to `defaultLevel(type, details)` so a caller passing `undefined`
  details can no longer throw on `details.success` (defensive null
  guard; the single real caller already defaults, so no behavior change).
- `backend/src/services/demoEnvironmentService.js` — removed three
  unused, never-called exports (`getDemoItemSeed`, `getDemoCustomer`,
  `getDemoCase`). Nothing in the codebase (routes, controllers, other
  services, or the `testphase*.js` harnesses) referenced them. Pure
  code-quality cleanup; no behavior changed.

## Files created

- `backend/PHASE16_ENGINEERING_HARDENING.md` (this file).

## Engineering rules reviewed, and where they are already implemented

1. **No fake agentic behavior.** The loop is real:
   `agentStateService.runTool` / `runDecision` / `resolveObservation` /
   `runReplan` each gate on the session's actual `currentStatus`
   (`assertTransitionAllowed` against `AGENT_STATUS_TRANSITIONS`) and
   only advance the session using a real tool result or a real,
   session-derived observation. Nothing marks an action successful
   without a tool/environment result backing it (see
   `TOOL_STAGE_RULES.execute_resolution.onSuccess`, which branches on
   `result.success === false` from the real executor before deciding
   OBSERVING vs. staying in a failure path).

2. **No hardcoded hero logic.** `agentDecisionService.decide` and
   `agentReplanService.replan` operate purely on
   `session.availableOptions` / `session.constraints.routeAvailability`
   — there is no `if (itemId === heroItem)` branch anywhere in the
   decision, replan, or verification code. All hero/demo-specific data
   (`DEMO_ITEM_SEED`, `DEMO_SCENARIOS`, the `REQUIRED_COMPONENT_UNAVAILABLE`
   failure) lives behind `demoEnvironmentService`, which the production
   tools call through generic hooks (`getRouteOptions`,
   `getRouteAvailability`, `getExecutionFailure`) that return `null` for
   any non-demo item, letting the real valuation/constraint data take
   over unchanged.

3. **No hallucinated data.** `calculate_valuation` returns
   `aiDecisionService.evaluate(...)` output directly; `inspect_item`
   returns the real ONNX classifier result via `mlService.classifyEWaste`;
   `execute_resolution` only returns a result after calling the real
   `listingRepository` / `auctionService` / `pickupService` mutation (or
   the deterministic demo-environment denial); `verify_resolution`
   re-reads the persisted listing rather than trusting the prior
   decision or a success flag. Any missing upstream data throws (e.g.
   `calculate_valuation` requires `session.detectedDevice` to exist)
   rather than being papered over.

4. **State consistency + safe transitions.**
   `AGENT_STATUS_TRANSITIONS` is an explicit allow-list; every state
   change goes through `assertTransitionAllowed`. `COMPLETED`/`FAILED`
   have no outgoing transitions, so a completed or failed session
   cannot execute another resolution or tool call — any attempt throws
   `409`. `agentRepository.findActiveSessionByItemId` excludes
   `TERMINAL_STATUSES` (`COMPLETED`, `FAILED`) so a new call for the same
   item resumes the in-flight session instead of creating a duplicate,
   while a genuinely completed/failed item correctly starts a fresh
   session. `HUMAN_REVIEW` is a legitimate non-terminal status (it can
   move to `DECIDING`/`FAILED`), but `agentOrchestrator.advanceSession`
   never auto-advances it — there is no tool/decision/observation/replan
   mapping for `HUMAN_REVIEW`, so it cannot silently continue without an
   explicit external transition.

5. **Idempotency / duplicate-action protection.** `execute_resolution`
   (`agentTools.js`) checks `getExistingResolution(listing)` before
   doing anything: a non-terminal resolution for the *same* route
   returns the existing resolution (`reused: true`) instead of creating
   a second auction/pickup/listing mutation; a non-terminal resolution
   for a *different* route is rejected as `RESOLUTION_ALREADY_EXISTS`
   rather than silently overwritten. `resolveViaAuction` additionally
   checks for an existing non-ended auction on the listing before
   creating a new one. This is explicitly in-memory (see Known
   Limitations below) — it is not a durable idempotency key.

6. **Error handling.** Tool errors carry a `code`
   (`INVALID_ROUTE`, `UNSUPPORTED_RESOLUTION`, `ITEM_NOT_FOUND`,
   `RESOLUTION_ALREADY_EXISTS`, `DOMAIN_OPERATION_FAILED`, or the
   generic `TOOL_ERROR`), and `agentStateService.classifyToolError`
   maps that into a `failureClass`
   (`VALIDATION` vs. `TOOL_INFRASTRUCTURE`), which is attached to the
   event alongside `route`/`reason`/`attempt`/`status`. Demo-environment
   execution failures carry their own `errorCode`
   (`REQUIRED_COMPONENT_UNAVAILABLE`, etc.) and `failureClass:
   BUSINESS_ENVIRONMENT`. No failure is converted into a success result
   anywhere in `TOOL_STAGE_RULES`.

7. **Verification integrity.** `verify_resolution` re-reads
   `listingRepository.findById` — the actual persisted domain state —
   and checks it against the route the agent executed
   (`session.currentAction`/`currentDecision`) and the
   route→sale-type mapping execution itself uses (`ROUTE_TO_SALE_TYPE`),
   rather than trusting the execution result, a decision record, or an
   in-memory flag. A verification failure sets `nextStatus: FAILED` and
   records the real mismatch reason; it never marks the session
   `COMPLETED` on a failed check.

8. **Deterministic demo safety.** `demoEnvironmentService` contains no
   `Math.random`/timing-based branching; `isDemoDataRandomFree` (used by
   `testphase14.js`) asserts the demo data itself contains none. Route
   selection, failure injection, and availability overrides are all
   keyed off explicit scenario data (`DEMO_SCENARIOS`), not randomness.

9. **Dependency discipline.** No dependency was added in this phase.
   `backend/package.json` is unchanged (`bcryptjs`, `cors`, `dotenv`,
   `express`, `jsonwebtoken`, `multer`, `uuid`) — every hardening
   mechanism above is built from native Node.js plus these existing
   packages.

10. **Observability compatibility.** `agentEventService.recordEvent` is
    the single event-recording path; this phase did not add a second
    logging system. `AGENT_EVENT_TYPES` (`AGENT_START`, `TOOL_CALL`,
    `TOOL_RESULT`, `OBSERVATION`, `DECISION`, `ACTION`, `REPLAN`,
    `VERIFICATION`, `FINAL_OUTCOME`, `HUMAN_REVIEW`) already cover goal,
    inspection, valuation, constraints, decision, action, action result,
    observation, failure, replan, verification, final outcome, and
    human-review escalation. Structured fields only — no chain-of-thought
    is logged anywhere in this subsystem.

11. **Frontend compatibility.** No frontend files were touched. The
    session/event shape consumed by the Phase 10–11 Agent Resolution UI
    (`status`, `currentDecision`, `currentAction`, `observations`,
    `verificationResult`, `finalResolution`, and the event `type`/`stage`/
    `status`/`route` fields) is unchanged. The `currentAction` shape
    normalization described above changes the backend success value to
    the same object shape the backend already produced on failure/decision
    paths; the frontend reads the fields, not the raw string.

12. **Code quality.** Removed dead code (see "Files modified"): two
    stub-era leftovers in `agentTools.js` (`NOT_IMPLEMENTED_TOOLS`,
    `notImplementedHandler`), the unused `startOrResumeAndAdvance`
    wrapper in `agentOrchestrator.js`, and three unused exports in
    `demoEnvironmentService.js`. No other unused exports, duplicated
    logic, or dead branches were found in the agent subsystem during
    this review that met the bar for "obvious" — the codebase's existing
    comments already document why each conditional/branch exists, and
    removing more than the confirmed-unused functions above would risk
    the "do not rewrite working functionality" rule for marginal
    benefit.

## Known architectural limitations (unchanged by this phase)

- **In-memory persistence only.** `agentRepository`, `listingRepository`,
  `auctionRepository`, and `pickupRepository` are all in-memory
  (`Map`-backed). Idempotency/duplicate-action protection, session
  state, and the event timeline all reset on process restart. This
  phase does not add durable storage — doing so would be a Phase 17+
  feature, not a hardening fix, and no code in this phase claims
  otherwise.
- **`repair` has no dedicated domain model.** As already documented in
  `agentTools.js`, the `repair` route is represented only by flipping
  the listing's `status` to `reserved` plus the resolution record —
  there is no `repairRepository`. This is a pre-existing, documented
  gap, not something introduced or hidden by this phase.
- **Single active hero/demo item id.** `demoEnvironmentService` and
  `heroDemoService` track one `demoItemId` module-level variable. This
  is intentional (deterministic single-demo-session hackathon
  behavior) but means the demo control surface is not safe for
  concurrent multi-user demo sessions.
- **`HUMAN_REVIEW` has no dedicated "resume" API endpoint.** The state
  machine legally allows `HUMAN_REVIEW → DECIDING`, and the orchestrator
  correctly refuses to auto-advance out of `HUMAN_REVIEW`, but no route
  in `agentRoutes.js` currently drives that transition — a human
  reviewer would need a new, out-of-scope endpoint (or direct use of
  `agentStateService.transitionStatus`) to actually resume a session
  after review. Flagging this as a gap for a future phase rather than
  building a new endpoint here, since new endpoints are out of this
  phase's scope.
