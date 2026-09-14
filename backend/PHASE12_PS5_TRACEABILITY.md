# Phase 12 — PS#5 Traceability

## 1. Authoritative Problem Statement

> **Problem Statement 5: Autonomous Customer Resolution Agent**
> Build an autonomous customer-resolution agent whose objective is to actually
> resolve a customer's issue across simulated enterprise systems, rather than
> merely classify the ticket or generate a reply. The agent should inspect
> customer/order/policy information, decide an appropriate resolution,
> execute state-changing actions, verify their effects, and replan when an
> action is blocked or a new constraint appears.
>
> Required workflow:
> - Understand the customer's goal and current case state.
> - Retrieve customer, order, inventory, and policy information.
> - Select a resolution based on available evidence and constraints.
> - Execute a simulated refund, replacement, cancellation, or other permitted
>   action.
> - Verify the state change.
> - Adapt if inventory, policy, or another system prevents the original plan.
> - Escalate only when the system cannot safely complete the objective.

## 2. Domain mapping (ReValue / Punarchakra → PS#5)

| PS#5 concept | ReValue mapping | Legitimacy note |
|---|---|---|
| Customer | Registered `userRepository` record joined via `listing.seller_id` | Real join added in Phase 12 (`agentTools.retrieveCustomer`). Honest fallback when the seller_id has no registered account (seed/demo data) — see §8. |
| Order / case | The e-waste `listing` + the agent `session` built on it | The listing is the "thing under resolution"; the session is the case record. Not relabeled — the listing already had exactly this role since Phase 1. |
| Inventory / availability | Repair-component availability, modeled by `demoEnvironmentService` | ReValue has no warehouse/inventory system. The closest legitimate equivalent is "is the required repair component in stock" — a real, environment-sourced signal, not a rename of an unrelated field. Scoped to the hero-demo item only (see §8, limitation). |
| Policy / business rules | `check_constraints` (`agentTools.checkConstraints`) + `routeAvailability` | Real constraint checks: listing status, location, detection confidence, positive-value routes, existing-resolution conflicts. |
| Refund / replacement / cancellation | `execute_resolution` routes: `whole`, `parts`, `auction`, `scrap`, `donate`, `repair` | Each route is a genuine, distinct state-changing action in the ReValue domain (relist, part out, auction, recycle, donate, repair), not a synonym for the same action six times. |

No PS#5 noun is force-fit onto an unrelated ReValue field. Where no honest equivalent exists (a real multi-item "order" with SKUs, a real warehouse inventory table), this document says so plainly rather than pretending.

## 3. Compliance matrix

| PS#5 Requirement | ReValue Mapping | Exact Implementation | Evidence | Test | Status |
|---|---|---|---|---|---|
| **PS5-1** Understand goal + case state | Explicit `session.goal`; full case-state object | `agentStateService.createSession` (session shape); `agentRepository` | `session.goal`, `session.itemId`, `session.currentStatus`, `session.customer`, `session.decisionHistory`, etc. — 19 named case-state fields | `testphase12.js` Test A | **PASS** |
| **PS5-2** Retrieve customer/order/inventory/policy | Customer via `userRepository` join; order via `listing`; inventory via `demoEnvironmentService`; policy via `check_constraints` | `agentTools.retrieveCustomer` (new, Phase 12), `agentTools.inspectItem`, `agentTools.calculateValuation`, `agentTools.checkConstraints`, `demoEnvironmentService.getRepairRouteOption` | `session.customer`, `session.valuation.valuation`, `session.constraints.routeAvailability` | `testphase12.js` Test B | **PASS** (with honest limitation — see §8) |
| **PS5-3** Select resolution from evidence + constraints | Real, non-hardcoded decision policy | `agentDecisionService.decide()` | `session.currentDecision`, `DECISION` event, `decisionHistory` | `testphase12.js` Test C/H; `agentDecisionService` has no route-specific branching | **PASS** |
| **PS5-4** Execute state-changing action | `execute_resolution` mutates listing/auction/pickup state | `agentTools.executeResolution`, `ROUTE_EXECUTORS` (`resolveViaListingStateChange`, `resolveViaAuction`, `resolveViaPickup`, `resolveRepair`) | `listing.resolution`, `listing.sale_type`, `listing.status`, real `Auction`/`Pickup` records | `testphase12.js` Test D (before/after GET) | **PASS** |
| **PS5-5** Verify state change | `verify_resolution` independently re-reads listing state | `agentTools.verifyResolution` | `session.verificationResult`, `FINAL_OUTCOME` event | `testphase12.js` Test E (sabotage test: erases `listing.resolution` directly, proves verification is not fooled) | **PASS** |
| **PS5-6** Adapt to blocked action / new constraint | Observe failure → replan → exclude failed route → re-decide → re-execute | `agentStateService.resolveObservation`, `agentReplanService.replan`, `agentStateService.runReplan` | `session.observations`, `session.replanHistory`, `REPLAN` event | `testphase12.js` Test F/I/J (hero deterministic failure) | **PASS** |
| **PS5-7** Escalate only when no safe route remains | `HUMAN_REVIEW` when `decide()`/`replan()` find no viable route | `agentStateService.runDecision`, `agentStateService.runReplan` | `session.currentStatus === "HUMAN_REVIEW"`, preserved `failureReason`/`decisionHistory`/`replanHistory`/`observations` | `testphase12.js` Test G | **PASS** |

## 4. Requirement-by-requirement detail

### PS5-1 — Goal + case state
- **Directly implemented.** `createSession()` sets an explicit `goal` string (default: *"Resolve this e-waste item for the best available outcome."*) and initializes every case-state field the agent will read/write for the rest of the loop (`detectedDevice`, `condition`, `customer`, `valuation`, `availableOptions`, `constraints`, `currentDecision`, `previousDecision`, `currentAction`, `currentStatus`, `attemptCount`, `failureReason`, `observations`, `decisionHistory`, `replanHistory`, `verificationResult`, `finalResolution`).
- The agent reads from this state at every stage (`agentDecisionService.decide(session)`, `agentReplanService.replan(session)`) rather than re-deriving a textual summary each time.
- **File/function:** `backend/src/services/agentStateService.js:createSession`.
- **Test:** `testphase12.js` Test A asserts every field exists as its own key.

### PS5-2 — Customer / order / inventory / policy retrieval
- **Customer (new in Phase 12):** `agentTools.retrieveCustomer(listing)` joins `listing.seller_id` against the real `userRepository` (populated by the actual signup flow, `listingService.js: seller_id: user.id`). When a real registered user exists, the agent gets a real name/email/location. This is called from `inspectItem()` and stored on `session.customer` — case state from the very first tool call.
- **Order/case:** the `listing` itself, retrieved via `listingRepository.findById` in every tool (`inspectItem`, `calculateValuation`, `checkConstraints`, `executeResolution`, `verifyResolution`) — never cached/duplicated data, always a fresh repository read.
- **Inventory:** `demoEnvironmentService.getRepairRouteOption(session)` — a real, environment-owned signal for repair-component availability. Consumed by `agentStateService.buildAvailableOptions`, which only adds `repair` as a candidate when the environment says so.
- **Policy:** `agentTools.checkConstraints` — real checks against `listing.status`, `listing.location`, `session.confidence`, and the valuation engine's output, producing `failures`, `reviewFlags`, and `routeAvailability` that `agentDecisionService.decide()` genuinely consumes (excluding blocked routes; see PS5-3).
- **Test:** `testphase12.js` Test B — separately proves (B1) a real user join, (B2) the honest fallback for unregistered seller_ids, (B3) that valuation/constraints data is real and structured, (B4) that the inventory signal is *not* fabricated for non-hero items (repair never appears as a candidate unless the environment supplies it).

### PS5-3 — Resolution selection
- `agentDecisionService.decide()` contains **zero route names** hardcoded into the selection logic. It reads `session.availableOptions` (route + expectedValue) and `session.constraints.routeAvailability` (route + available + reason), excludes blocked options, and picks the highest remaining expected value.
- **Proof it's not hardcoded:** `testphase12.js` Test C/H calls `decide()` twice on the same session — once unmodified, once with the previously-winning route explicitly blocked — and asserts the selected route changes and the exclusion reason is exactly what was supplied.
- **File/function:** `backend/src/services/agentDecisionService.js:decide`.

### PS5-4 — State-changing execution
- `agentTools.executeResolution` dispatches to `ROUTE_EXECUTORS`:
  - `whole` / `parts` / `donate` → `listingRepository.update` (real field mutation: `sale_type`, `status`, `price`).
  - `auction` → `auctionService.createAuction` (a real, separately-queryable `Auction` record).
  - `scrap` → `pickupService.createPickup` (a real, separately-queryable `Pickup` record).
  - `repair` → `listingRepository.update` (status → `reserved`) — the smallest honest state change available, since no dedicated repair repository exists (documented limitation, §8).
- **Proof it's a real mutation, not a 200 OK:** `testphase12.js` Test D fetches the listing via `GET /api/listings/:id` *before* execution, executes, then fetches it again via a fresh, independent `GET` and asserts the resolution/sale_type/status actually changed.

### PS5-5 — Independent verification
- `agentTools.verifyResolution` re-reads the listing via `listingRepository.findById` (not the cached session/tool result) and checks: (a) a resolution record exists, (b) it matches the route the agent executed, (c) `listing.sale_type` matches what that route is supposed to produce (`ROUTE_TO_SALE_TYPE` — the exact same map `executeResolution` uses, so it can't drift).
- **Proof it doesn't just trust the execution result:** `testphase12.js` Test E deliberately erases `listing.resolution` directly in the repository *after* a successful execution (without calling `execute_resolution` again), then runs `verify_resolution` and asserts it fails with the correct, specific reason. If verification trusted `session.currentAction`/the execution's own `success:true`, this sabotage would go undetected.

### PS5-6 — Adapt to blocked action
- The hero deterministic scenario: `demoEnvironmentService` supplies `repair` as a viable decision-time candidate, then reports `REQUIRED_COMPONENT_UNAVAILABLE` at execution time — a real tool **result** (not a thrown error), so the agent's state machine routes `EXECUTING → OBSERVING` (not a terminal `FAILED`).
- `agentStateService.resolveObservation` reads the real observation (`success: false`) and routes `OBSERVING → REPLANNING`.
- `agentReplanService.replan()` excludes the failed route via the *same* `routeAvailability` signal `decide()` already consumes, then calls `agentDecisionService.decide()` **unchanged** on the updated view — the alternative is chosen by the same audited policy, never a special-cased "if repair fails, pick parts."
- **Test:** `testphase12.js` Test F/I/J drives this exact chain over the real HTTP API and asserts: the failed route never reappears in `decisionHistory`, the replan record cites the real `errorCode`, and the second execution is a real, independently-verified mutation.

### PS5-7 — Safe escalation
- `HUMAN_REVIEW` is reached exactly two ways, both honest: (1) `checkConstraints` sets `requiresHumanReview` from real review flags (low confidence, no viable monetary route, missing location); (2) `agentDecisionService.decide()` / `agentReplanService.replan()` return `viable: false` when no candidate route remains available or the attempt cap (`MAX_RESOLUTION_ATTEMPTS = 3`) is reached.
- Nothing is fabricated on escalation: `finalResolution` is never set, `failureReason` is a concrete string, and `decisionHistory` / `replanHistory` / `observations` are preserved for a human to inspect.
- **Test:** `testphase12.js` Test G forces every route except the one about to fail into an explicit `unavailable` state (reusing the existing `routeAvailability` signal — not a new mechanism), lets the repair failure happen, and asserts the session lands in `HUMAN_REVIEW` with a genuinely non-viable decision report and no fabricated `finalResolution`.

## 5. Information provenance

| Decision input | Origin |
|---|---|
| Item classification (`detectedDevice`) | Real ML pipeline — `mlService.classifyEWaste` → FastAPI `/scrap/classify` → ONNX MobileNetV3 |
| Customer | `userRepository.findById(listing.seller_id)` (real join, Phase 12) |
| Valuation (`session.valuation`) | `aiDecisionService.evaluate()` — existing, already-audited valuation engine |
| Inventory/availability (`repair` candidate) | `demoEnvironmentService.getRepairRouteOption` (hero-item-scoped) |
| Policy / constraints | `agentTools.checkConstraints` |
| Decision | `agentDecisionService.decide` |
| Execution failure | `demoEnvironmentService.getExecutionFailure` (deterministic) or a real thrown domain error |
| Replan | `agentReplanService.replan` |
| State after execution | `listingRepository` / `auctionService` / `pickupService` (real domain repositories) |
| Verification | `agentTools.verifyResolution` — independent repository re-read |

Nothing in this chain is hallucinated: every input the agent reasons over comes from a named, real service or repository call, traceable in the table above.

## 6. Anti-pattern audit (Step 12)

| Anti-pattern | Found? | Notes |
|---|---|---|
| UI says "thinking", backend does nothing | No | Frontend (`agentService.js`) is a thin real API client; no client-side fabricated status text. |
| Hardcoded `if failure => parts` | No | `agentReplanService.replan()` reuses `agentDecisionService.decide()` on an updated availability view; no route name is special-cased. |
| `execute_resolution` returns success without state change | No | Every success branch calls a real repository/service mutation (`listingRepository.update`, `auctionService.createAuction`, `pickupService.createPickup`). Verified in Test D. |
| `verify_resolution` trusts `execute_resolution`'s result | No | Re-reads `listingRepository.findById` independently. Verified via sabotage in Test E. |
| Failure displayed without a real tool/environment failure | No | The only simulated failure (`REQUIRED_COMPONENT_UNAVAILABLE`) is a real tool **result** returned by `demoEnvironmentService`, recorded as a real `OBSERVATION` event — never fabricated UI text. |
| Replan ignores current constraints | No | `replan()` reads `session.constraints.routeAvailability` and `session.observations` before selecting. |
| Fabricated timeline events | No | Every event (`AGENT_START`, `TOOL_CALL`, `TOOL_RESULT`, `OBSERVATION`, `DECISION`, `ACTION`, `REPLAN`, `VERIFICATION`/`FINAL_OUTCOME`) is recorded from a real state transition in `agentStateService`/`agentEventService`. |
| Arbitrary `HUMAN_REVIEW` | No | Only reached from `requiresHumanReview` (real review flags) or `viable: false` (real "nothing left" outcomes). |

No anti-patterns from Step 12 were found in the Phase 1–11 codebase. The one gap found (below) was a retrieval gap, not a fabrication.

## 7. Frontend PS#5 proof (Step 13)

- `AgentItemPanel.jsx` — item/goal, case state, route availability (evidence), and (Phase 12 addition) the retrieved customer, all read from `session`/`listing` props with no invented text.
- `AgentDecisionCard.jsx` / `AgentTimeline.jsx` / `AgentTimelineEvent.jsx` / `AgentToolActivity.jsx` — render the real event log (`agentService.getTimeline`) and real decision/replan records — decision reasoning text shown to the judge is the exact `reason` string `agentDecisionService`/`agentReplanService` produced, not separately authored copy.
- `AgentOutcome.jsx` — renders `verificationResult`/`finalResolution` from session state.
- No dark/neon/robot/futuristic redesign was introduced; the Phase 12 addition (one customer line in `AgentItemPanel`) reuses the existing card/typography styles (`agent-item-panel__goal`-style rule).
- The full failure→adapt loop (repair selected → repair attempted → component unavailable → replan → parts selected → parts executed → verified) is reconstructable entirely from `GET /api/agent/timeline/:sessionId`, which the frontend already calls — confirmed by `testphase12.js` Test F/I/J driving the identical sequence over HTTP.

## 8. Honest limitations

- **PS#5 says "inventory."** ReValue has no warehouse/stock-keeping system. The only real "availability" signal implemented is repair-component availability (`demoEnvironmentService`), and it is intentionally scoped to the hero-demo item — there is no general inventory service behind the other five routes (`whole`/`parts`/`auction`/`scrap`/`donate`). This is disclosed, not hidden: Test B4 explicitly asserts `repair` never appears as a candidate for a non-demo item.
- **Customer retrieval depends on real signup.** `retrieveCustomer()` only returns a real name/email for listings created through the actual signup + listing-creation flow (`user.id` as `seller_id`). The repository's built-in seed listings (`user_1`, `user_2`, `user_3`) and the hero-demo listing (`demo_seller_pcb_001`) were never created through that flow, so they resolve to the honest fallback (`id` only, explicit `source` label) rather than a fabricated name. This is expected and by design — it is precisely the "no such record exists" case a real enterprise system would also report honestly.
- **`repair` has no dedicated domain model.** Unlike the other five routes, "repair" is represented only as a listing status change (`reserved`) — there is no `repairRepository`/`RepairOrder` entity in this codebase. This was already true before Phase 12 and is unchanged; documented here for completeness per PS5-4.
- **Phase 10/11 (frontend) have no dedicated backend test harness.** They are verified by build/inspection (Step 15) and by `testphase12.js` Test F/I/J exercising the exact HTTP sequence the frontend timeline components consume — not by a frontend unit-test file, since this repo has none for any phase.
- **`testphase7.js` requires the ml-service (FastAPI/ONNX) process running.** In an environment where that process is not started, `testphase7.js` fails closed with an honest `502 E-waste classification failed: fetch failed` rather than a silent pass — this is an environment/dependency gap, not a Phase 12 regression, and is excluded from `testphase12.js`'s automated Test L for that reason (see that test's inline comment).
