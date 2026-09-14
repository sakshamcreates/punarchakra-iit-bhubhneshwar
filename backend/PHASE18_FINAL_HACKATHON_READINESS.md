# Phase 18 — Final Hackathon Quality + Demo Readiness

This is the final implementation phase. Phases 1–17 already built and
hardened the agent end-to-end (state model, tools, decision policy,
constraints, execution, observation, replanning, verification,
orchestration, event logging, frontend UI, integration fixes). This
phase reviewed the whole system once more specifically for demo/judge
readability and found it already consistent — see "Final readiness
review" below for what was checked. No component was rebuilt.

Companion documents (not superseded, still accurate):
`PHASE12_PS5_TRACEABILITY.md` (requirement-by-requirement PS#5 mapping
with test evidence), `PHASE15_LOGGING.md` (event/observability design),
`PHASE16_ENGINEERING_HARDENING.md` (state-safety, idempotency, error
handling), `PHASE17_FINAL_INTEGRATION.md` (cross-layer wiring, including
the two integration fixes made in that pass).

## 1. Final Agent Flow

```
IDLE → INSPECTING → EVALUATING → CHECKING_CONSTRAINTS → DECIDING
     → EXECUTING → OBSERVING → VERIFYING → COMPLETED
```

On an execution failure, `OBSERVING` routes to `REPLANNING` instead of
`VERIFYING`:

```
... → EXECUTING → OBSERVING (failed) → REPLANNING → DECIDING
    → EXECUTING → OBSERVING (succeeded) → VERIFYING → COMPLETED
```

`agentOrchestrator.advanceSession` is the single driver of every arrow
above — it reads `session.currentStatus` and dispatches to
`agentStateService.runTool` / `runDecision` / `resolveObservation` /
`runReplan`. No other code path advances a session's status.

## 2. Autonomous Decision

`agentDecisionService.decide()` picks the highest-`expectedValue`
route from `session.availableOptions` that is not marked unavailable
in `session.constraints.routeAvailability`. It contains no
route-specific branching (no `if (route === "repair")`), so the same
function is what both the hero demo and any real listing go through —
the demo's specific outcome comes from the *evidence* it is given
(available routes + a scripted supply-availability signal), not from a
special code path.

## 3. Real State-Changing Execution

`execute_resolution` performs an actual domain mutation per route:
`listingRepository.update` (whole/parts/donate/repair-status),
`auctionService.createAuction` (auction), or
`pickupService.createPickup` (scrap). It is idempotent for repeated
calls on the same route (`reused: true` instead of a duplicate
record) and rejects a conflicting route on an existing non-terminal
resolution (`RESOLUTION_ALREADY_EXISTS`). See
`PHASE16_ENGINEERING_HARDENING.md` §5 for the full idempotency
argument.

## 4. Environment Feedback

Execution failures are real tool *results*, not thrown exceptions:
`{ success: false, errorCode, route, reason }`, sourced from
`demoEnvironmentService.getExecutionFailure` for the deterministic
demo scenario, or from a genuine domain conflict otherwise. This
result is what moves the session from `EXECUTING` to `OBSERVING` —
the agent's next stage decision is made from this real result, never
from an assumption.

## 5. Failure Handling

`agentStateService.resolveObservation` reads the last entry in
`session.observations` (written directly from the execution result) to
decide `OBSERVING → REPLANNING` (failure) vs. `OBSERVING → VERIFYING`
(success). No status transition happens without a corresponding real
observation.

## 6. Replanning

`agentReplanService.replan()` excludes every route that has actually
failed (from `session.observations` and the running
`routeAvailability` view), then re-runs the *same* `decide()` policy
on that updated view — it does not implement a second, separate
selection algorithm and does not hardcode "repair → parts" or any
other route pair. `MAX_RESOLUTION_ATTEMPTS` (3) bounds the loop: once
reached, or once no viable alternative remains, the session goes to
`HUMAN_REVIEW` instead of retrying forever.

## 7. Independent Verification

`verify_resolution` re-reads the persisted `listing` from
`listingRepository` (not the execution result, not a cached flag) and
checks it against the route the agent actually executed and the
route→sale-type mapping execution itself uses. A verification failure
sets the session to `FAILED` — it never marks a session `COMPLETED` on
a failed check, and a "successful execution" is never treated as
equivalent to a "verified outcome."

## 8. HUMAN_REVIEW Behavior

`HUMAN_REVIEW` is reached only when: `check_constraints` raises review
flags, `decide()` finds no viable route at all, or `replan()` finds no
viable alternative (including hitting `MAX_RESOLUTION_ATTEMPTS`). In
every case the session preserves `failureReason`, `decisionHistory`,
`replanHistory`, and `observations` — nothing is discarded, and no
route is force-selected merely to reach a terminal status. `COMPLETED`
and `FAILED` have no outgoing transitions in
`AGENT_STATUS_TRANSITIONS`, and `HUMAN_REVIEW`, while not fully
terminal, is never auto-advanced by the orchestrator (see
`PHASE17_FINAL_INTEGRATION.md`).

## 9. Frontend Demonstration

`AgentResolutionPage` drives the loop by repeatedly calling
`advance()` and rendering whatever session/timeline state comes back —
it computes nothing itself. `AgentStory` renders the closed loop
(Decide → Act → Result → Replan → Verify) directly from
`decisionHistory` / `observations` / `replanHistory` /
`verificationResult`; `AgentStatus` shows the current stage; `AgentOutcome`
shows the final COMPLETED/HUMAN_REVIEW/FAILED state; `AgentTimeline` /
`AgentToolActivity` show the underlying structured events. Visual style
follows the existing ReValue design system already in `styles.css` (no
dark dashboard, neon, animated AI graphics, or fabricated metrics were
introduced at any phase — confirmed by inspection in this pass).

## 10. PS#5 Traceability

`PHASE12_PS5_TRACEABILITY.md` contains the full requirement-by-requirement
mapping. Summary: customer → `userRepository` join (with an honest
fallback when no registered account exists); order/case → the e-waste
`listing` + agent `session`; inventory → the demo environment's
repair-component-availability signal (deliberately scoped to the demo
item only, not fabricated for arbitrary listings); policy →
`check_constraints`; refund/replacement/cancellation → the six
resolution routes (whole/parts/auction/scrap/donate/repair), each a
genuine distinct state change. No PS#5 noun was force-fit onto an
unrelated ReValue field; where no honest equivalent exists, the
traceability doc says so.

## 11. Deterministic Demo Behavior

`demoEnvironmentService` contains no `Math.random`, no `Date.now`-based
branching, and no timing dependency — scenario outcomes are keyed
purely off explicit, static scenario data (`DEMO_SCENARIOS`), verified
by `isDemoDataRandomFree()`. The demo control surface
(`heroDemoService` + the `/agent/demo/*` routes) only ever resets or
seeds data and flips which scenario is active — it never sets
`finalResolution`, `COMPLETED`, or a timeline event directly. Every
demo milestone (inspect → valuate → constraints → decide → execute →
observe failure → replan → execute alternative → observe success →
verify → complete) is produced by the same
`agentOrchestrator`/`agentStateService`/tool pipeline a non-demo item
uses.

## 12. Known Limitations

(Unchanged from Phases 16–17; restated here for a single, final,
truthful summary — see those documents for detail):

- **In-memory persistence only.** `agentRepository`, `listingRepository`,
  `auctionRepository`, and `pickupRepository` are all in-memory. A
  backend restart loses all session/timeline/domain state. This is not
  hidden behind any "durable" claim anywhere in the code or docs.
- **`repair` has no dedicated domain repository** — it is represented
  only via the listing's `status` field, since no repair-tracking
  table exists in the ReValue domain model.
- **Single module-level demo item id** (`heroDemoService`/
  `demoEnvironmentService`) — the demo control surface is not safe for
  concurrent multi-judge/multi-tab demo sessions; resetting the demo
  affects the one shared demo item.
- **No API endpoint drives `HUMAN_REVIEW → DECIDING`.** The transition
  is legal in the state machine, but resuming a session parked in
  human review would require a new endpoint, which is out of scope for
  this phase (no new endpoints were added).
- **Inventory/policy signals are real but narrow.** The
  repair-component-availability signal and the constraint checks are
  genuine, but they are the specific, honest equivalents ReValue's
  existing domain actually supports — not a general-purpose enterprise
  inventory/policy system.

## Final readiness review performed in this phase (no changes needed)

- Re-checked the full happy-path and failure/replan event sequence
  against `agentEventService`'s event types and confirmed both match
  the lifecycle in section 1/6 of this document.
- Scanned all agent-related backend and frontend files for unused
  imports, stray debug logging (`console.log`/`debugger`), and
  TODO/FIXME markers — none found in the agent subsystem. (Pre-existing
  `console.log` debug statements in unrelated, pre-agent files —
  `aiController.js`, `app.js`, `SellResultsPage.jsx` — are outside the
  autonomous-agent scope of Phases 1–17 and were left untouched, per
  the instruction not to rewrite existing ReValue systems.)
- Checked the Agent Resolution UI's CSS for dark/neon/robot-graphic
  styling — none present; it follows the existing ReValue visual
  system.
- Confirmed no stray temp/backup files exist under `backend/` or
  `frontend/src/`.
- No files were created or modified in this phase beyond this
  document — Phases 16 and 17 already performed the concrete cleanup
  (removed two unused backend exports, removed one orphaned frontend
  component, fixed one real frontend/backend integration gap in
  `agentService.advance()`) that this final pass would otherwise have
  flagged.
