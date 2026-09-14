/*
 * Phase 12 — PS#5 Compliance Test Harness
 * "Autonomous Customer Resolution Agent"
 *
 * This is NOT a re-run of Phase 6-9 in different words. It exists to prove,
 * with real assertions against the real HTTP API and real repository state,
 * that the existing Punarchakra agent satisfies the exact PS#5 requirements
 * (see PHASE12_PS5_TRACEABILITY.md for the full requirement-by-requirement
 * mapping). Same conventions as testphase6-9.js:
 *
 *   - require("./src/app") starts the real Express app (real state machine,
 *     real decision/replan policy, real tool registry, real event log, real
 *     listing/auction/pickup domain mutation).
 *   - inspect_item's real ML network call is bypassed via seedPostInspection
 *     for tests that are not specifically about inspection/classification
 *     (exact same convention as testphase6/8/9 — the ml-service FastAPI
 *     process is not assumed to be running for this harness). PS5-2's
 *     customer-retrieval proof (Test B) does NOT need the ML call at all —
 *     retrieveCustomer() is a pure function of the listing, called directly.
 *
 * Run:
 *   PORT=5000 node backend/testphase12.js   (from repo root)
 *   PORT=5000 node testphase12.js           (from backend/)
 */

const http = require("http");
const path = require("path");
const { execFileSync } = require("child_process");

const agentRepository = require("./src/data/agentRepository");
const listingRepository = require("./src/data/listingRepository");
const userRepository = require("./src/data/userRepository");
const heroDemoService = require("./src/services/heroDemoService");
const demoEnvironmentService = require("./src/services/demoEnvironmentService");
const agentDecisionService = require("./src/services/agentDecisionService");
const agentReplanService = require("./src/services/agentReplanService");
const agentTools = require("./src/services/agentTools");
const { MAX_RESOLUTION_ATTEMPTS } = require("./src/constants/agentConstants");

require("./src/app"); // starts listening on PORT (default 5000)

const PORT = process.env.PORT || 5000;
const BASE = `http://127.0.0.1:${PORT}`;

function request(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      BASE + urlPath,
      {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          let parsed = null;
          try {
            parsed = JSON.parse(raw);
          } catch (e) {
            parsed = raw;
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      },
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

function log(title, obj) {
  console.log(`\n=== ${title} ===`);
  console.log(JSON.stringify(obj, null, 2));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

// Same seeding convention as testphase6/8/9.js: writes the exact fields
// inspect_item's onSuccess handler would have written, so scenarios that
// are not about inspection itself can skip the real ML network call.
function seedPostInspection(sessionId, overrides = {}) {
  agentRepository.updateSession(sessionId, {
    detectedDevice: {
      category: "pcb",
      brand: "Generic",
      model: "Motherboard-X1",
      source: "test-seed",
    },
    condition: {
      powersOn: false,
      displayCondition: "poor",
      batteryCondition: "poor",
      chargerAvailable: false,
      storage: true,
      ram: true,
      photosHint: true,
    },
    confidence: 83,
    currentStatus: "EVALUATING",
    ...overrides,
  });
}

async function runToDeciding(itemId, label) {
  const resolve = await request("POST", `/api/agent/resolve/${itemId}`, {});
  assert(
    resolve.status === 200 || resolve.status === 201,
    `[${label}] resolve/:itemId should succeed, got ${resolve.status}`,
  );
  const sessionId = resolve.body.data.agentSessionId;

  seedPostInspection(sessionId);

  const valuation = await request("POST", `/api/agent/advance/${sessionId}`, {});
  assert(
    valuation.body.data.session.currentStatus === "CHECKING_CONSTRAINTS",
    `[${label}] expected CHECKING_CONSTRAINTS, got ${valuation.body.data.session.currentStatus}`,
  );

  const constraints = await request("POST", `/api/agent/advance/${sessionId}`, {});
  assert(
    constraints.body.data.session.currentStatus === "DECIDING",
    `[${label}] expected DECIDING, got ${constraints.body.data.session.currentStatus}`,
  );

  return { sessionId, valuationSession: valuation.body.data.session, decidingSession: constraints.body.data.session };
}

// --------------------------------------------------------------
// TEST A — PS5-1: customer's goal + current case state is explicit
// --------------------------------------------------------------
async function testA_goalAndCaseState() {
  const listing = heroDemoService.resetDemoItem();
  const resolve = await request("POST", `/api/agent/resolve/${listing.id}`, {});
  assert(resolve.status === 201, "Test A: expected a brand-new session (201)");

  const session = resolve.body.data;

  assert(
    typeof session.goal === "string" && session.goal.length > 0,
    "Test A: session.goal must be an explicit, non-empty objective",
  );
  assert(session.itemId === listing.id, "Test A: session must reference the exact case (item) id");
  assert(session.currentStatus === "IDLE", "Test A: a fresh case starts IDLE, not fabricated as already-decided");

  // Case-state fields PS5-1 requires the agent to retain across the loop —
  // asserted as own keys (not merely present in some blob), since a real
  // decision-making session must be able to read each independently.
  const requiredCaseStateFields = [
    "itemId", "goal", "detectedDevice", "condition", "customer", "valuation",
    "availableOptions", "constraints", "currentDecision", "previousDecision",
    "currentAction", "currentStatus", "attemptCount", "failureReason",
    "observations", "decisionHistory", "replanHistory", "verificationResult",
    "finalResolution",
  ];
  requiredCaseStateFields.forEach((field) => {
    assert(
      Object.prototype.hasOwnProperty.call(session, field),
      `Test A: session case state is missing required field "${field}"`,
    );
  });

  log("Test A: PS5-1 goal + case state", {
    goal: session.goal,
    itemId: session.itemId,
    currentStatus: session.currentStatus,
    caseStateFieldsPresent: requiredCaseStateFields.length,
  });
  console.log("\nTEST A RESULT (PS5-1 goal + case state): PASS");

  heroDemoService.resetDemoItem();
}

// --------------------------------------------------------------
// TEST B — PS5-2: retrieve customer / order / inventory / policy info
// from REAL systems, not hardcoded/fabricated data.
// --------------------------------------------------------------
async function testB_informationRetrieval() {
  // B1. Customer retrieval — real registered user (userRepository join).
  const realUser = userRepository.create({
    name: "Ananya Rao",
    email: "ananya.rao@example.com",
    passwordHash: "irrelevant-for-this-test",
    role: "seller",
    location: "Pune",
  });
  const realUserListing = listingRepository.create({
    seller_id: realUser.id,
    category: "electronics",
    subcategory: "laptop",
    brand: "HP",
    model: "Pavilion 15",
    condition: "fair",
    description: "PS5-2 test listing with a real registered seller.",
    images: [],
    price: 10000,
    location: "Pune",
    sale_type: "fixed",
    status: "active",
  });

  const realCustomer = agentTools.retrieveCustomer(realUserListing);
  assert(
    realCustomer.source === "user_repository" &&
      realCustomer.name === "Ananya Rao" &&
      realCustomer.email === "ananya.rao@example.com",
    `Test B1: retrieveCustomer must join a real userRepository record when one exists, got ${JSON.stringify(realCustomer)}`,
  );

  // B2. Customer retrieval — seed listing whose seller_id has no matching
  // registered user. Must NOT fabricate a name; must say so honestly.
  const seedListing = listingRepository.findAll()[0]; // seller_id: 'user_1', never registered
  const fallbackCustomer = agentTools.retrieveCustomer(seedListing);
  assert(
    fallbackCustomer.source === "seller_id_only_no_registered_user_record" &&
      fallbackCustomer.name === null,
    `Test B2: retrieveCustomer must not fabricate a name for an unregistered seller_id, got ${JSON.stringify(fallbackCustomer)}`,
  );

  // B3. Order/case info + policy — real check_constraints run against the
  // real valuation engine's output, consumed (not decorative) by decide().
  const listing = heroDemoService.resetDemoItem();
  const { sessionId, decidingSession } = await runToDeciding(listing.id, "Test B3");

  assert(
    decidingSession.valuation &&
      decidingSession.valuation.valuation &&
      typeof decidingSession.valuation.valuation.wholeValue === "number",
    "Test B3: valuation (order/case evidence) must come from the real valuation engine output",
  );
  assert(
    decidingSession.constraints &&
      Array.isArray(decidingSession.constraints.routeAvailability),
    "Test B3: policy/constraints info (routeAvailability) must be present and real (from check_constraints)",
  );

  // B4. Inventory equivalent — repair-component availability, real and
  // environment-sourced (demoEnvironmentService), not invented in the
  // decision layer. Off by default for a non-hero item:
  const nonHeroOptionRoutes = decidingSession.availableOptions.map((o) => o.route);
  assert(
    !nonHeroOptionRoutes.includes("repair"),
    "Test B4: repair/inventory candidate must NOT appear for a non-demo-scoped item (no fabricated inventory signal)",
  );

  log("Test B: PS5-2 information retrieval", {
    realCustomer,
    fallbackCustomer,
    valuationSample: decidingSession.valuation.valuation,
    routeAvailabilitySample: decidingSession.constraints.routeAvailability[0],
    nonHeroRoutes: nonHeroOptionRoutes,
  });
  console.log("\nTEST B RESULT (PS5-2 customer/order/inventory/policy retrieval): PASS");

  heroDemoService.resetDemoItem();
}

// --------------------------------------------------------------
// TEST C / H — PS5-3 + constraint-change-changes-decision proof.
// Same session data, decide() called twice with two different real
// constraint views — proves selection is data-driven, not hardcoded.
// --------------------------------------------------------------
async function testC_and_H_decisionIsDataDriven() {
  const listing = heroDemoService.resetDemoItem();
  const { decidingSession } = await runToDeciding(listing.id, "Test C/H");

  // Baseline: nothing blocked -> decide() should pick the highest-value
  // route with no exclusions.
  const baselineDecision = agentDecisionService.decide(decidingSession);
  assert(baselineDecision.viable === true, "Test C: baseline decision must be viable");
  const baselineRoute = baselineDecision.route;

  // Now block exactly the route decide() picked, via the SAME
  // routeAvailability signal check_constraints already produces (not a
  // second, competing mechanism) — and re-run decide() on that view.
  const blockedConstraints = {
    ...decidingSession.constraints,
    routeAvailability: (decidingSession.constraints.routeAvailability.length
      ? decidingSession.constraints.routeAvailability
      : decidingSession.availableOptions.map((o) => ({ route: o.route, available: true, reason: null }))
    ).map((entry) =>
      entry.route === baselineRoute
        ? { route: entry.route, available: false, reason: "TEST_FORCED_BLOCK" }
        : entry,
    ),
  };
  // Ensure every route has an explicit entry (decide() treats a missing
  // entry as available, so the block above only proves anything if the
  // formerly-best route now has an explicit false entry).
  const hasBlockEntry = blockedConstraints.routeAvailability.some(
    (e) => e.route === baselineRoute && e.available === false,
  );
  assert(hasBlockEntry, "Test C/H: test setup failed to actually block the baseline route");

  const afterBlockDecision = agentDecisionService.decide({
    ...decidingSession,
    constraints: blockedConstraints,
  });

  assert(
    afterBlockDecision.viable === true,
    "Test H: a different viable route must still exist after blocking the top one",
  );
  assert(
    afterBlockDecision.route !== baselineRoute,
    `Test H: blocking "${baselineRoute}" must change the selected route, but decide() still picked it`,
  );
  assert(
    afterBlockDecision.excludedOptions.some((o) => o.route === baselineRoute && o.blockReason === "TEST_FORCED_BLOCK"),
    "Test H: the blocked route must appear in excludedOptions with the real block reason",
  );

  log("Test C/H: PS5-3 autonomous selection is data-driven; constraint change changes decision", {
    baselineRoute,
    baselineValue: baselineDecision.selectedValue,
    afterBlockRoute: afterBlockDecision.route,
    afterBlockValue: afterBlockDecision.selectedValue,
  });
  console.log("\nTEST C/H RESULT (PS5-3 selection + constraint-change-changes-decision): PASS");

  heroDemoService.resetDemoItem();
}

// --------------------------------------------------------------
// TEST D — PS5-4: execute_resolution causes a REAL state mutation.
// STATE BEFORE -> EXECUTE -> STATE AFTER, independently re-fetched.
// --------------------------------------------------------------
async function testD_realStateChange() {
  const listing = heroDemoService.resetDemoItem();
  const { sessionId } = await runToDeciding(listing.id, "Test D");

  const beforeExec = await request("GET", `/api/listings/${listing.id}`);
  assert(
    !beforeExec.body.data.resolution,
    "Test D: listing must have no resolution recorded before execution",
  );
  const statusBefore = beforeExec.body.data.status;
  const saleTypeBefore = beforeExec.body.data.sale_type;

  const decision = await request("POST", `/api/agent/advance/${sessionId}`, {});
  assert(decision.body.data.result.viable === true, "Test D: expected a viable decision");
  const executedRoute = decision.body.data.result.route;

  const execute = await request("POST", `/api/agent/advance/${sessionId}`, {});
  assert(
    execute.body.data.session.currentStatus === "OBSERVING",
    `Test D: expected OBSERVING after execute_resolution, got ${execute.body.data.session.currentStatus}`,
  );
  assert(execute.body.data.result.success === true, "Test D: execution must genuinely succeed for this scenario");

  const afterExec = await request("GET", `/api/listings/${listing.id}`);
  assert(
    afterExec.body.data.resolution && afterExec.body.data.resolution.route === executedRoute,
    "Test D: listing.resolution must reflect the executed route after a fresh, independent GET",
  );
  const mutated =
    afterExec.body.data.status !== statusBefore ||
    afterExec.body.data.sale_type !== saleTypeBefore ||
    Boolean(afterExec.body.data.resolution);
  assert(mutated, "Test D: at least one real domain field must have changed — a 200 response alone is not proof");

  log("Test D: PS5-4 real state-changing action", {
    executedRoute,
    statusBefore, statusAfter: afterExec.body.data.status,
    saleTypeBefore, saleTypeAfter: afterExec.body.data.sale_type,
    resolutionAfter: afterExec.body.data.resolution,
  });
  console.log("\nTEST D RESULT (PS5-4 real, independently-observed state mutation): PASS");

  heroDemoService.resetDemoItem();
}

// --------------------------------------------------------------
// TEST E — PS5-5: verify_resolution independently queries actual state,
// and does NOT simply trust the execution's own success flag.
// --------------------------------------------------------------
async function testE_independentVerification() {
  const listing = heroDemoService.resetDemoItem();
  const { sessionId } = await runToDeciding(listing.id, "Test E");

  await request("POST", `/api/agent/advance/${sessionId}`, {}); // DECIDING -> EXECUTING
  const execute = await request("POST", `/api/agent/advance/${sessionId}`, {}); // EXECUTING -> OBSERVING
  assert(execute.body.data.result.success === true, "Test E: execution must succeed before verifying");

  await request("POST", `/api/agent/advance/${sessionId}`, {}); // OBSERVING -> VERIFYING

  // Sabotage: erase the resolution record directly in the repository —
  // simulating "the execution claimed success but the domain state does
  // not actually reflect it" — WITHOUT going through execute_resolution
  // again. If verify_resolution trusted the earlier execution result (or
  // session.currentAction) instead of re-reading real state, this sabotage
  // would go undetected and verification would still pass.
  listingRepository.update(listing.id, { resolution: undefined });

  const verify = await request("POST", `/api/agent/advance/${sessionId}`, {});
  assert(
    verify.body.data.result.passed === false,
    "Test E: verify_resolution must FAIL when the independently-read domain state no longer shows the resolution, " +
      "proving it does not simply trust execute_resolution's earlier success",
  );
  assert(
    verify.body.data.session.currentStatus === "FAILED",
    `Test E: a failed verification must be a real terminal FAILED, got ${verify.body.data.session.currentStatus}`,
  );
  assert(
    /No resolution record exists/.test(verify.body.data.result.reason || ""),
    "Test E: the failure reason must reflect the actual missing state, not a generic message",
  );

  log("Test E: PS5-5 independent verification", {
    verificationPassed: verify.body.data.result.passed,
    reason: verify.body.data.result.reason,
    finalStatus: verify.body.data.session.currentStatus,
  });
  console.log("\nTEST E RESULT (PS5-5 verification independently re-reads state; does not trust prior success): PASS");

  heroDemoService.resetDemoItem();
}

// --------------------------------------------------------------
// TESTS F / I / J — PS5-6 (adapt) + failed-route-excluded + verified outcome.
// Reuses the deterministic hero failure (repair -> REQUIRED_COMPONENT_UNAVAILABLE),
// asserting the full observe -> replan -> alternative -> execute -> verify chain
// in PS#5 vocabulary.
// --------------------------------------------------------------
async function testF_I_J_adaptAndVerifyOutcome() {
  const listing = heroDemoService.resetDemoItem();
  demoEnvironmentService.enableRequiredComponentUnavailable();

  const resolve = await request("POST", `/api/agent/resolve/${listing.id}`, {});
  const sessionId = resolve.body.data.agentSessionId;
  seedPostInspection(sessionId);

  const valuation = await request("POST", `/api/agent/advance/${sessionId}`, {});
  assert(
    valuation.body.data.session.availableOptions.some((o) => o.route === "repair"),
    "Test F: the demo environment must supply 'repair' as a decision-eligible inventory-backed candidate",
  );

  await request("POST", `/api/agent/advance/${sessionId}`, {}); // -> DECIDING
  const decision1 = await request("POST", `/api/agent/advance/${sessionId}`, {}); // -> EXECUTING
  assert(
    decision1.body.data.result.route === "repair",
    `Test F: the agent must autonomously select "repair" as the highest-value viable route, got ${decision1.body.data.result.route}`,
  );

  const execute1 = await request("POST", `/api/agent/advance/${sessionId}`, {}); // EXECUTING -> OBSERVING (fails)
  assert(execute1.body.data.result.success === false, "Test F: repair execution must fail (environment-originated)");
  assert(
    execute1.body.data.result.errorCode === "REQUIRED_COMPONENT_UNAVAILABLE",
    "Test F: the failure must be the deterministic environment signal, not a fabricated one",
  );

  const observe1 = await request("POST", `/api/agent/advance/${sessionId}`, {}); // OBSERVING -> REPLANNING
  assert(
    observe1.body.data.session.currentStatus === "REPLANNING",
    `Test F: a failed observation must route to REPLANNING (autonomous adaptation), got ${observe1.body.data.session.currentStatus}`,
  );

  const replan = await request("POST", `/api/agent/advance/${sessionId}`, {}); // REPLANNING -> DECIDING
  assert(
    replan.body.data.result.excludedRoutes.includes("repair"),
    "Test F: replan must explicitly exclude the failed route",
  );
  assert(
    replan.body.data.session.currentStatus === "DECIDING",
    "Test F: a viable alternative must route back to DECIDING (a REAL second decision, not a fabricated one)",
  );

  const decision2 = await request("POST", `/api/agent/advance/${sessionId}`, {}); // -> EXECUTING
  assert(
    decision2.body.data.result.route !== "repair" && decision2.body.data.result.viable === true,
    `Test I: the failed route ("repair") must never be re-selected; got ${decision2.body.data.result.route}`,
  );
  const alternativeRoute = decision2.body.data.result.route;

  const execute2 = await request("POST", `/api/agent/advance/${sessionId}`, {}); // -> OBSERVING (succeeds)
  assert(
    execute2.body.data.result.success === true,
    "Test F: the alternative route must actually execute and succeed",
  );

  const observe2 = await request("POST", `/api/agent/advance/${sessionId}`, {}); // -> VERIFYING
  assert(observe2.body.data.session.currentStatus === "VERIFYING", "Test F: a successful re-attempt must route to VERIFYING");

  const verify = await request("POST", `/api/agent/advance/${sessionId}`, {}); // -> COMPLETED
  assert(verify.body.data.result.passed === true, "Test J: final outcome must be independently verified as passed");
  assert(verify.body.data.session.currentStatus === "COMPLETED", "Test J: session must reach a real terminal COMPLETED");
  assert(
    verify.body.data.session.finalResolution &&
      verify.body.data.session.finalResolution.route === alternativeRoute,
    "Test J: finalResolution must reflect the actually-verified alternative route",
  );

  const finalSession = verify.body.data.session;
  assert(
    finalSession.decisionHistory.length === 2 &&
      finalSession.decisionHistory[0].route === "repair" &&
      finalSession.decisionHistory[1].route === alternativeRoute,
    "Test I: decisionHistory must show exactly the failed decision then the alternative — never a re-pick of the failed route",
  );
  assert(finalSession.replanHistory.length === 1, "Test F: exactly one replan event expected for a single failure");
  assert(
    finalSession.observations.length === 2 &&
      finalSession.observations[0].success === false &&
      finalSession.observations[1].success === true,
    "Test F: observations must show the real failed attempt then the real successful attempt, in order",
  );

  const listingAfter = await request("GET", `/api/listings/${listing.id}`);
  assert(
    listingAfter.body.data.resolution && listingAfter.body.data.resolution.route === alternativeRoute,
    "Test J: the listing's actual persisted resolution must match the verified alternative route",
  );

  log("Test F/I/J: PS5-6 adapt + failed-route-excluded + verified final outcome", {
    failedRoute: "repair",
    alternativeRoute,
    decisionHistory: finalSession.decisionHistory.map((d) => d.route),
    replanCount: finalSession.replanHistory.length,
    observations: finalSession.observations.map((o) => ({ route: o.route, success: o.success })),
    finalResolution: finalSession.finalResolution,
  });
  console.log("\nTEST F/I/J RESULT (PS5-6 adaptation, failed-route exclusion, verified outcome): PASS");

  heroDemoService.resetDemoItem();
}

// --------------------------------------------------------------
// TEST G — PS5-7: safe escalation to HUMAN_REVIEW only when no safe
// autonomous route remains — never fabricated success, never an
// arbitrary escalation.
// --------------------------------------------------------------
async function testG_safeEscalation() {
  const listing = heroDemoService.resetDemoItem();
  demoEnvironmentService.enableRequiredComponentUnavailable();

  const resolve = await request("POST", `/api/agent/resolve/${listing.id}`, {});
  const sessionId = resolve.body.data.agentSessionId;
  seedPostInspection(sessionId);

  await request("POST", `/api/agent/advance/${sessionId}`, {}); // valuation
  const constraintsStep = await request("POST", `/api/agent/advance/${sessionId}`, {}); // -> DECIDING
  const sessionAtDeciding = constraintsStep.body.data.session;

  // Force "every route except repair is already blocked" using the SAME
  // routeAvailability signal check_constraints already produces (not a new,
  // invented mechanism) — the real-world equivalent of "every other
  // recovery route is already committed/unavailable for this item". This
  // is what lets the single repair failure below be the genuinely last
  // safe option, so escalation is not arbitrary.
  agentRepository.updateSession(sessionId, {
    constraints: {
      ...sessionAtDeciding.constraints,
      routeAvailability: sessionAtDeciding.constraints.routeAvailability.map((entry) =>
        entry.route === "repair"
          ? entry
          : { route: entry.route, available: false, reason: "TEST_FORCED_NO_OTHER_ROUTE_AVAILABLE" },
      ),
    },
  });

  const decision = await request("POST", `/api/agent/advance/${sessionId}`, {}); // decide repair -> EXECUTING
  assert(
    decision.body.data.result.route === "repair" && decision.body.data.result.viable === true,
    `Test G setup: repair must be the only viable route at this point, got ${JSON.stringify(decision.body.data.result)}`,
  );

  const execute = await request("POST", `/api/agent/advance/${sessionId}`, {}); // execute repair -> fails -> OBSERVING
  assert(execute.body.data.result.success === false, "Test G setup: repair execution must fail (environment-originated)");

  await request("POST", `/api/agent/advance/${sessionId}`, {}); // -> REPLANNING

  const replan = await request("POST", `/api/agent/advance/${sessionId}`, {});
  assert(
    replan.body.data.session.currentStatus === "HUMAN_REVIEW",
    `Test G: with no safe route left, session must escalate to HUMAN_REVIEW, got ${replan.body.data.session.currentStatus}`,
  );
  assert(
    replan.body.data.decisionViable === false,
    "Test G: escalation must be reported as a genuine non-viable outcome, not a disguised success",
  );

  const finalSession = replan.body.data.session;
  assert(
    typeof finalSession.failureReason === "string" && finalSession.failureReason.length > 0,
    "Test G: HUMAN_REVIEW must preserve a concrete failure reason",
  );
  assert(
    finalSession.replanHistory.length >= 1 && finalSession.decisionHistory.length >= 1,
    "Test G: HUMAN_REVIEW must preserve decision + replan history for a human to inspect",
  );
  assert(
    finalSession.observations.some((o) => o.success === false),
    "Test G: HUMAN_REVIEW must preserve the real observed failure(s) that led here",
  );
  assert(
    !finalSession.finalResolution,
    "Test G: escalation must NOT fabricate a finalResolution — nothing was safely completed",
  );

  log("Test G: PS5-7 safe escalation", {
    finalStatus: finalSession.currentStatus,
    failureReason: finalSession.failureReason,
    decisionHistory: finalSession.decisionHistory.map((d) => d.route),
    replanHistory: finalSession.replanHistory.length,
  });
  console.log("\nTEST G RESULT (PS5-7 escalation only when no safe route remains; nothing fabricated): PASS");

  heroDemoService.resetDemoItem();
}

// --------------------------------------------------------------
// TEST K — Attempt/loop protection: replan refuses to keep proposing
// routes once MAX_RESOLUTION_ATTEMPTS is reached (pure policy check —
// direct unit call, exact same policy the HTTP flow above uses).
// --------------------------------------------------------------
async function testK_loopProtection() {
  const listing = heroDemoService.resetDemoItem();
  const { decidingSession } = await runToDeciding(listing.id, "Test K");

  const cappedSession = {
    ...decidingSession,
    attemptCount: MAX_RESOLUTION_ATTEMPTS,
    currentDecision: { route: decidingSession.availableOptions[0].route },
    observations: [
      {
        success: false,
        route: decidingSession.availableOptions[0].route,
        errorCode: "TEST_FAILURE",
        reason: "forced failure for loop-protection test",
      },
    ],
  };

  const outcome = agentReplanService.replan(cappedSession);
  assert(
    outcome.viable === false,
    "Test K: replan must refuse to propose a new route once MAX_RESOLUTION_ATTEMPTS is reached",
  );
  assert(
    /Maximum resolution attempts/.test(outcome.replanRecord.reason),
    "Test K: the refusal reason must explicitly cite the attempt cap, not a generic message",
  );

  const belowCapSession = { ...cappedSession, attemptCount: MAX_RESOLUTION_ATTEMPTS - 1 };
  const outcomeBelowCap = agentReplanService.replan(belowCapSession);
  assert(
    outcomeBelowCap.viable === true,
    "Test K: one attempt below the cap, a viable alternative must still be proposed (the cap is real, not always-on)",
  );

  log("Test K: attempt/loop protection", {
    atCap: { attemptCount: cappedSession.attemptCount, viable: outcome.viable, reason: outcome.replanRecord.reason },
    belowCap: { attemptCount: belowCapSession.attemptCount, viable: outcomeBelowCap.viable },
  });
  console.log("\nTEST K RESULT (attempt/loop protection): PASS");

  heroDemoService.resetDemoItem();
}

// --------------------------------------------------------------
// TEST L — Phase 6-9 regression, run as real child processes against
// this same codebase (each starts its own copy of the app on its own
// port — same one-app-per-file convention already used by this repo).
// Phase 10/11 have no dedicated backend test harness in this repo (they
// are the frontend); their check is a build/lint pass, run separately
// per the final report, not embedded here.
// --------------------------------------------------------------
function testL_regression() {
  const regressionFiles = ["testphase6.js", "testphase8.js", "testphase9.js"];
  // testphase7.js is intentionally excluded from this automated regression
  // run: it requires the ml-service FastAPI process to be running
  // (real image classification over HTTP) and fails closed with a clear,
  // honest 502 in this environment when that process is not up — see the
  // Phase 12 traceability doc's "Known limitations" section. This is an
  // environment/dependency gap, not a code regression.
  const results = {};

  regressionFiles.forEach((file, index) => {
    const port = 5200 + index;
    try {
      execFileSync(process.execPath, [path.join(__dirname, file)], {
        cwd: __dirname,
        env: { ...process.env, PORT: String(port) },
        timeout: 30000,
        stdio: "pipe",
      });
      results[file] = "PASS";
    } catch (error) {
      results[file] = `FAIL (${error.message.split("\n")[0]})`;
    }
  });

  log("Test L: Phase 6/8/9 regression (child processes)", results);

  const anyFailed = Object.values(results).some((v) => v !== "PASS");
  assert(!anyFailed, `Test L: regression failure(s): ${JSON.stringify(results)}`);

  console.log("\nTEST L RESULT (Phase 6/8/9 regression, run against the Phase 12 codebase): PASS");
  return results;
}

(async () => {
  try {
    await new Promise((r) => setTimeout(r, 300)); // let app.listen settle

    await testA_goalAndCaseState();
    await testB_informationRetrieval();
    await testC_and_H_decisionIsDataDriven();
    await testD_realStateChange();
    await testE_independentVerification();
    await testF_I_J_adaptAndVerifyOutcome();
    await testG_safeEscalation();
    await testK_loopProtection();
    testL_regression();

    console.log("\nAll Phase 12 PS#5 compliance scenarios executed (A-L).");
    process.exit(0);
  } catch (err) {
    console.error("\nPHASE 12 TEST HARNESS ERROR:", err);
    process.exit(1);
  }
})();
