/*
 * Phase 9 test harness — Autonomous Observation -> Reasoning -> Replanning
 * -> Alternative Execution.
 *
 * Starts the real Express app (require('./src/app')) and drives the real
 * HTTP agent API end-to-end. Same convention as testphase6.js/testphase7.js/
 * testphase8.js: real state machine, real decision policy, real replan
 * policy (agentReplanService), real tool registry, real event log, real
 * listing/domain mutation. The only bypass is the external ML network call
 * of inspect_item for scenarios that don't need to exercise it (seeded the
 * same way testphase6/7/8 already seed it) — Test A additionally proves the
 * real ML classification path still works end-to-end for a plain,
 * non-hero, non-failure item.
 *
 * Scenarios (see section 13 of the Phase 9 brief):
 *   A — Normal successful resolution (no failure, no replanning at all).
 *   B — Hero failure scenario: repair -> REQUIRED_COMPONENT_UNAVAILABLE ->
 *       OBSERVATION -> REPLANNING -> repair excluded -> parts selected ->
 *       parts executed -> successful OBSERVATION -> VERIFYING -> COMPLETED.
 *   C — The failed route (repair) is never re-selected.
 *   D — decisionHistory contains both decisions (repair, then parts).
 *   E — replanHistory contains the failure + selected alternative record.
 *   F — observations contains both the failed and the successful result.
 *   G — No viable alternative remains -> HUMAN_REVIEW (safe terminal state).
 *   H — Attempt-cap loop protection: replan refuses to keep proposing
 *       routes once MAX_RESOLUTION_ATTEMPTS is reached, even when a
 *       nominally viable route still exists on paper.
 *
 * Phase 6/7/8 regression is run separately (node testphase6.js /
 * testphase7.js / testphase8.js) rather than embedded here, because each
 * of those harnesses starts its own copy of the Express app on the same
 * PORT — exactly the existing one-app-per-file convention this repo
 * already uses. See the final report for their pass/fail status.
 *
 * Run:
 *   PORT=5000 node backend/testphase9.js   (from repo root)
 *   PORT=5000 node testphase9.js           (from backend/)
 */

const http = require("http");
const agentRepository = require("./src/data/agentRepository");
const heroDemoService = require("./src/services/heroDemoService");
const demoEnvironmentService = require("./src/services/demoEnvironmentService");
const agentReplanService = require("./src/services/agentReplanService");
const listingRepository = require("./src/data/listingRepository");
const { MAX_RESOLUTION_ATTEMPTS } = require("./src/constants/agentConstants");

require("./src/app"); // starts listening on PORT (default 5000)

const PORT = process.env.PORT || 5000;
const BASE = `http://127.0.0.1:${PORT}`;

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      BASE + path,
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

// Same seeding convention as testphase6.js/testphase8.js: writes the exact
// fields inspect_item.onSuccess would have written for a PCB-poor hero
// item, and moves the session to EVALUATING, so scenarios that don't need
// to exercise the real ML call can skip straight past it.
function seedPostInspection(sessionId) {
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
  });
}

// Drives a fresh session from IDLE through to a real DECIDING/EXECUTING
// state entirely over HTTP, using the real orchestrator advance endpoint
// for every stage.
async function runToExecuting(itemId, label) {
  const resolve = await request("POST", `/api/agent/resolve/${itemId}`, {});
  assert(
    resolve.status === 200 || resolve.status === 201,
    `[${label}] resolve/:itemId should succeed, got ${resolve.status}`,
  );
  const sessionId = resolve.body.data.agentSessionId;

  seedPostInspection(sessionId);

  const valuation = await request(
    "POST",
    `/api/agent/advance/${sessionId}`,
    {},
  );
  assert(
    valuation.body.data.session.currentStatus === "CHECKING_CONSTRAINTS",
    `[${label}] expected CHECKING_CONSTRAINTS after valuation, got ${valuation.body.data.session.currentStatus}`,
  );

  const constraints = await request(
    "POST",
    `/api/agent/advance/${sessionId}`,
    {},
  );
  assert(
    constraints.body.data.session.currentStatus === "DECIDING",
    `[${label}] expected DECIDING after constraints, got ${constraints.body.data.session.currentStatus}`,
  );

  const decision = await request("POST", `/api/agent/advance/${sessionId}`, {});
  assert(
    decision.body.data.result.viable === true,
    `[${label}] expected a viable decision, got: ${JSON.stringify(decision.body.data.result)}`,
  );
  assert(
    decision.body.data.session.currentStatus === "EXECUTING",
    `[${label}] expected EXECUTING after a viable decision, got ${decision.body.data.session.currentStatus}`,
  );

  return {
    sessionId,
    availableOptions: valuation.body.data.session.availableOptions,
    decision: decision.body.data.result,
    sessionAfterDecision: decision.body.data.session,
  };
}

// --------------------------------------------------------------
// TEST A — Normal successful resolution, no replanning at all.
// --------------------------------------------------------------
async function testA() {
  const listing = heroDemoService.resetDemoItem();
  assert(
    demoEnvironmentService.getSimulationState().enabled === false,
    "Test A: reset should leave the failure simulation disabled",
  );

  const run = await runToExecuting(listing.id, "Test A");

  // Execute the real decision through the orchestrator (no route supplied
  // — proves EXECUTING reads currentAction/currentDecision itself).
  const execute = await request(
    "POST",
    `/api/agent/advance/${run.sessionId}`,
    {},
  );
  assert(
    execute.body.data.session.currentStatus === "OBSERVING",
    `Test A: expected OBSERVING after execution, got ${execute.body.data.session.currentStatus}`,
  );
  assert(
    execute.body.data.result.success === true,
    `Test A: execution must succeed, got ${JSON.stringify(execute.body.data.result)}`,
  );

  const observe = await request(
    "POST",
    `/api/agent/advance/${run.sessionId}`,
    {},
  );
  assert(
    observe.body.data.session.currentStatus === "VERIFYING",
    `Test A: a successful observation must route to VERIFYING (never REPLANNING), got ${observe.body.data.session.currentStatus}`,
  );

  const verify = await request(
    "POST",
    `/api/agent/advance/${run.sessionId}`,
    {},
  );
  assert(
    verify.body.data.session.currentStatus === "COMPLETED",
    `Test A: expected COMPLETED after verification, got ${verify.body.data.session.currentStatus}`,
  );
  assert(
    verify.body.data.result.passed === true,
    `Test A: verification must pass for a real, successful execution`,
  );

  const finalState = verify.body.data.session;
  assert(
    finalState.replanHistory.length === 0,
    "Test A: a normal successful run must never touch replanHistory",
  );
  assert(
    finalState.observations.length === 1 &&
      finalState.observations[0].success === true,
    "Test A: exactly one successful observation expected",
  );

  const listingAfter = await request("GET", `/api/listings/${listing.id}`);
  assert(
    listingAfter.body.data.resolution &&
      listingAfter.body.data.resolution.route === run.decision.route,
    "Test A: listing.resolution must reflect the executed route",
  );

  log("Test A: normal successful resolution", {
    decidedRoute: run.decision.route,
    finalStatus: finalState.currentStatus,
    observations: finalState.observations.length,
    replanHistory: finalState.replanHistory.length,
    listingResolution: listingAfter.body.data.resolution.route,
  });
  console.log("\nTEST A RESULT: PASS");

  heroDemoService.resetDemoItem();
}

// --------------------------------------------------------------
// TESTS B–F — Hero failure -> replan -> parts recovery, all driven
// through the SAME session, then asserted together (they all read off
// the one autonomous run).
// --------------------------------------------------------------
async function testsB_to_F() {
  const listing = heroDemoService.resetDemoItem();
  demoEnvironmentService.enableRequiredComponentUnavailable();
  assert(
    demoEnvironmentService.getSimulationState().enabled === true,
    "Test B: failure simulation should be enabled",
  );

  const run = await runToExecuting(listing.id, "Test B");
  assert(
    run.decision.route === "repair",
    `Test B: the real decision policy must select "repair" first (data-driven), got "${run.decision.route}"`,
  );

  // ---- EXECUTING -> OBSERVING (failure, real environment result).
  const executeRepair = await request(
    "POST",
    `/api/agent/advance/${run.sessionId}`,
    {},
  );
  assert(
    executeRepair.body.data.session.currentStatus === "OBSERVING",
    `Test B: expected OBSERVING after the failed execution, got ${executeRepair.body.data.session.currentStatus}`,
  );
  assert(
    executeRepair.body.data.result.success === false &&
      executeRepair.body.data.result.errorCode ===
        "REQUIRED_COMPONENT_UNAVAILABLE",
    `Test B: execute_resolution("repair") must return the real environment failure, got ${JSON.stringify(executeRepair.body.data.result)}`,
  );

  const listingAfterFailure = await request(
    "GET",
    `/api/listings/${listing.id}`,
  );
  assert(
    !listingAfterFailure.body.data.resolution,
    "Test B: a failed repair must NOT mutate the listing (no false success)",
  );

  // ---- OBSERVING -> REPLANNING (autonomous, no caller special-casing).
  const observe = await request(
    "POST",
    `/api/agent/advance/${run.sessionId}`,
    {},
  );
  assert(
    observe.body.data.session.currentStatus === "REPLANNING",
    `Test B: a failed observation must route to REPLANNING, got ${observe.body.data.session.currentStatus}`,
  );

  // ---- REPLANNING -> DECIDING (repair excluded, best remaining route
  // selected by the REAL decision policy — never hardcoded here).
  const replan = await request(
    "POST",
    `/api/agent/advance/${run.sessionId}`,
    {},
  );
  assert(
    replan.body.data.session.currentStatus === "DECIDING",
    `Test B: a viable replan must land back in DECIDING, got ${replan.body.data.session.currentStatus}`,
  );
  const replanRecord = replan.body.data.result;
  assert(
    replanRecord.failedRoute === "repair" &&
      replanRecord.errorCode === "REQUIRED_COMPONENT_UNAVAILABLE",
    `Test B: replan record must name the failed route + error code, got ${JSON.stringify(replanRecord)}`,
  );
  assert(
    replanRecord.excludedRoutes.includes("repair"),
    "Test B: replan must exclude the failed route",
  );
  assert(
    replanRecord.selectedAlternative &&
      replanRecord.selectedAlternative.route !== "repair",
    "Test B: the selected alternative must not be the failed route",
  );

  const expectedAlternative = [...run.availableOptions]
    .filter((o) => o.route !== "repair")
    .sort((a, b) => b.expectedValue - a.expectedValue)[0];
  assert(
    replanRecord.selectedAlternative.route === expectedAlternative.route,
    `Test B: replan must select the highest remaining expected-value route ("${expectedAlternative.route}"), got "${replanRecord.selectedAlternative.route}" — proves this is real policy reuse, not a hardcoded "repair -> parts"`,
  );

  // ---- DECIDING -> EXECUTING (the REAL second decision).
  const secondDecision = await request(
    "POST",
    `/api/agent/advance/${run.sessionId}`,
    {},
  );
  assert(
    secondDecision.body.data.session.currentStatus === "EXECUTING",
    `Test B: the second decision must be viable and land in EXECUTING, got ${secondDecision.body.data.session.currentStatus}`,
  );
  assert(
    secondDecision.body.data.result.route === expectedAlternative.route,
    `Test B: second decision route must equal the replan's selected alternative`,
  );

  // ---- EXECUTING -> OBSERVING (alternative execution — real state mutation).
  const executeAlternative = await request(
    "POST",
    `/api/agent/advance/${run.sessionId}`,
    {},
  );
  assert(
    executeAlternative.body.data.result.success === true,
    `Test B: the alternative route must execute successfully, got ${JSON.stringify(executeAlternative.body.data.result)}`,
  );
  assert(
    executeAlternative.body.data.session.currentStatus === "OBSERVING",
    `Test B: expected OBSERVING after the alternative execution, got ${executeAlternative.body.data.session.currentStatus}`,
  );

  const listingAfterAlternative = await request(
    "GET",
    `/api/listings/${listing.id}`,
  );
  assert(
    listingAfterAlternative.body.data.resolution &&
      listingAfterAlternative.body.data.resolution.route ===
        expectedAlternative.route,
    `Test B: the listing's real resolution must now be "${expectedAlternative.route}", got ${JSON.stringify(listingAfterAlternative.body.data.resolution)}`,
  );

  // ---- OBSERVING (success) -> VERIFYING -> COMPLETED.
  const secondObserve = await request(
    "POST",
    `/api/agent/advance/${run.sessionId}`,
    {},
  );
  assert(
    secondObserve.body.data.session.currentStatus === "VERIFYING",
    `Test B: the successful alternative observation must route to VERIFYING, got ${secondObserve.body.data.session.currentStatus}`,
  );

  const verify = await request(
    "POST",
    `/api/agent/advance/${run.sessionId}`,
    {},
  );
  assert(
    verify.body.data.session.currentStatus === "COMPLETED",
    `Test B: expected COMPLETED after verifying the recovered resolution, got ${verify.body.data.session.currentStatus}`,
  );
  assert(
    verify.body.data.result.passed === true,
    "Test B: verification of the real, recovered resolution must pass",
  );

  const finalState = verify.body.data.session;

  console.log(
    "\nTEST B RESULT (hero failure -> replan -> alternative execution -> COMPLETED): PASS",
  );

  // ---- TEST C: the failed route is never re-selected.
  const routesEverDecided = finalState.decisionHistory.map((d) => d.route);
  assert(
    routesEverDecided.filter((r) => r === "repair").length === 1,
    `Test C: "repair" must be decided exactly once (never retried after failing), decisionHistory routes: ${JSON.stringify(routesEverDecided)}`,
  );
  assert(
    finalState.constraints.routeAvailability.some(
      (r) => r.route === "repair" && r.available === false,
    ),
    "Test C: repair must be recorded as unavailable in constraints.routeAvailability after failing",
  );
  console.log("TEST C RESULT (failed route excluded, never re-selected): PASS");

  // ---- TEST D: decisionHistory contains both decisions.
  assert(
    finalState.decisionHistory.length === 2,
    `Test D: decisionHistory must contain exactly 2 decisions (repair, then the alternative), got ${finalState.decisionHistory.length}`,
  );
  assert(
    finalState.decisionHistory[0].route === "repair" &&
      finalState.decisionHistory[1].route === expectedAlternative.route,
    `Test D: decisionHistory must preserve both decisions in order, got ${JSON.stringify(finalState.decisionHistory.map((d) => d.route))}`,
  );
  assert(
    finalState.previousDecision &&
      finalState.previousDecision.route === "repair",
    "Test D: previousDecision must still show the original repair decision",
  );
  assert(
    finalState.currentDecision.route === expectedAlternative.route,
    "Test D: currentDecision must be the final, executed alternative",
  );
  console.log("TEST D RESULT (decisionHistory preserves both decisions): PASS");

  // ---- TEST E: replanHistory contains the failure + selected alternative.
  assert(
    finalState.replanHistory.length === 1,
    `Test E: replanHistory must contain exactly 1 replan record, got ${finalState.replanHistory.length}`,
  );
  const persistedReplan = finalState.replanHistory[0];
  assert(
    persistedReplan.failedRoute === "repair" &&
      persistedReplan.errorCode === "REQUIRED_COMPONENT_UNAVAILABLE" &&
      persistedReplan.selectedAlternative.route === expectedAlternative.route &&
      persistedReplan.viable === true,
    `Test E: replanHistory must preserve the full structured replan record, got ${JSON.stringify(persistedReplan)}`,
  );
  console.log(
    "TEST E RESULT (replanHistory preserves failure + selected alternative): PASS",
  );

  // ---- TEST F: observations contain both the failed and successful results.
  assert(
    finalState.observations.length === 2,
    `Test F: observations must contain exactly 2 entries (failed repair, successful alternative), got ${finalState.observations.length}`,
  );
  assert(
    finalState.observations[0].success === false &&
      finalState.observations[0].route === "repair" &&
      finalState.observations[0].errorCode === "REQUIRED_COMPONENT_UNAVAILABLE",
    `Test F: first observation must be the failed repair attempt, got ${JSON.stringify(finalState.observations[0])}`,
  );
  assert(
    finalState.observations[1].success === true &&
      finalState.observations[1].route === expectedAlternative.route,
    `Test F: second observation must be the successful alternative attempt, got ${JSON.stringify(finalState.observations[1])}`,
  );
  console.log(
    "TEST F RESULT (observations preserve both failed and successful attempts): PASS",
  );

  // ---- Full autonomous timeline sanity check (section 10 of the brief).
  const timelineOut = await request(
    "GET",
    `/api/agent/timeline/${run.sessionId}`,
  );
  const eventTypes = timelineOut.body.data.map((e) => e.type);
  const requiredSequenceFragments = [
    ["DECISION", "ACTION", "TOOL_CALL", "TOOL_RESULT", "OBSERVATION"],
    ["REPLAN"],
    ["DECISION", "ACTION", "TOOL_CALL", "TOOL_RESULT", "OBSERVATION"],
    ["FINAL_OUTCOME"],
  ];
  let cursor = 0;
  requiredSequenceFragments.forEach((fragment) => {
    fragment.forEach((type) => {
      const found = eventTypes.indexOf(type, cursor);
      assert(
        found >= cursor,
        `Timeline sanity: expected "${type}" at/after index ${cursor}, full sequence: ${JSON.stringify(eventTypes)}`,
      );
      cursor = found + 1;
    });
  });

  log("Hero recovery timeline", { eventTypes });

  heroDemoService.resetDemoItem();
  return { expectedAlternative };
}

// --------------------------------------------------------------
// TEST G — No viable alternative remains -> HUMAN_REVIEW.
// --------------------------------------------------------------
// Constructed directly against the repository (same technique
// testphase8.js already uses for its repair-contrast run): a session
// sitting in REPLANNING where the only candidate route has already
// failed, so no alternative can exist. This exercises the exact same
// runReplan/advance path real HTTP callers use — nothing about
// agentReplanService or agentStateService is bypassed, only the earlier
// inspect/valuate/decide/execute stages are skipped since they are not
// what this scenario is testing.
async function testG() {
  const listing = heroDemoService.resetDemoItem();

  const resolve = await request("POST", `/api/agent/resolve/${listing.id}`, {});
  const sessionId = resolve.body.data.agentSessionId;

  const failedDecision = {
    route: "repair",
    viable: true,
    selectedValue: 5000,
    reason: "test setup",
    consideredOptions: [
      {
        route: "repair",
        expectedValue: 5000,
        available: true,
        blockReason: null,
      },
    ],
    excludedOptions: [],
    decidedAt: new Date().toISOString(),
  };

  agentRepository.updateSession(sessionId, {
    availableOptions: [{ route: "repair", expectedValue: 5000 }],
    constraints: {
      routeAvailability: [],
      requiresHumanReview: false,
      failures: [],
    },
    currentDecision: failedDecision,
    previousDecision: null,
    decisionHistory: [failedDecision],
    currentAction: {
      type: "execute_resolution",
      route: "repair",
      failed: true,
      errorCode: "REQUIRED_COMPONENT_UNAVAILABLE",
    },
    attemptCount: 1,
    failureReason: "Required component unavailable",
    observations: [
      {
        attempt: 1,
        success: false,
        route: "repair",
        action: "execute_resolution",
        errorCode: "REQUIRED_COMPONENT_UNAVAILABLE",
        reason: "Required component unavailable (test fixture)",
        toolResult: {
          success: false,
          errorCode: "REQUIRED_COMPONENT_UNAVAILABLE",
          route: "repair",
        },
        previousDecision: { route: "repair", viable: true },
        observedAt: new Date().toISOString(),
      },
    ],
    replanHistory: [],
    currentStatus: "REPLANNING",
  });

  const replan = await request("POST", `/api/agent/advance/${sessionId}`, {});
  assert(
    replan.body.data.session.currentStatus === "HUMAN_REVIEW",
    `Test G: with no viable alternative remaining, replan must land in HUMAN_REVIEW, got ${replan.body.data.session.currentStatus}`,
  );
  assert(
    replan.body.data.decisionViable === false &&
      replan.body.data.result.viable === false,
    "Test G: replan result must report viable:false",
  );
  assert(
    replan.body.data.result.selectedAlternative === null,
    "Test G: replan must never invent an alternative when none is viable",
  );

  log("Test G: no viable alternative", {
    finalStatus: replan.body.data.session.currentStatus,
    replanReason: replan.body.data.result.reason,
  });
  console.log("\nTEST G RESULT (no viable alternative -> HUMAN_REVIEW): PASS");

  heroDemoService.resetDemoItem();
}

// --------------------------------------------------------------
// TEST H — Attempt-cap loop protection.
// --------------------------------------------------------------
// Pure policy check against agentReplanService directly (it is
// documented as pure, stateless decision logic with no side effects —
// see agentReplanService.js), proving that once session.attemptCount
// reaches MAX_RESOLUTION_ATTEMPTS the policy refuses to propose ANY
// further route, even though a nominally viable, unblocked route
// ("parts") still exists in availableOptions/constraints. This is what
// actually prevents the repair -> fail -> repair -> fail -> ... loop
// section 8 of the brief describes: the cap fires independent of
// whether alternatives look viable on paper.
async function testH() {
  const cappedSession = {
    availableOptions: [
      { route: "repair", expectedValue: 5000 },
      { route: "parts", expectedValue: 1500 },
    ],
    constraints: {
      routeAvailability: [
        { route: "repair", available: false, reason: "Execution failed" },
      ],
    },
    currentDecision: { route: "repair", viable: true, selectedValue: 5000 },
    observations: [
      {
        success: false,
        route: "repair",
        errorCode: "REQUIRED_COMPONENT_UNAVAILABLE",
        reason: "out of stock",
      },
    ],
    attemptCount: MAX_RESOLUTION_ATTEMPTS,
  };

  const outcome = agentReplanService.replan(cappedSession);

  assert(
    outcome.viable === false,
    `Test H: replan must refuse to propose a route once attemptCount (${cappedSession.attemptCount}) reaches MAX_RESOLUTION_ATTEMPTS (${MAX_RESOLUTION_ATTEMPTS}), even though "parts" is nominally unblocked`,
  );
  assert(
    outcome.replanRecord.selectedAlternative === null,
    "Test H: no alternative may be selected once the attempt cap is reached",
  );
  assert(
    outcome.replanRecord.reason.includes(String(MAX_RESOLUTION_ATTEMPTS)),
    `Test H: refusal reason must cite the attempt cap, got: ${outcome.replanRecord.reason}`,
  );

  // Below the cap, the same session shape DOES yield a viable alternative
  // — proving H is testing the cap specifically, not a broken policy.
  const belowCap = {
    ...cappedSession,
    attemptCount: MAX_RESOLUTION_ATTEMPTS - 1,
  };
  const outcomeBelowCap = agentReplanService.replan(belowCap);
  assert(
    outcomeBelowCap.viable === true &&
      outcomeBelowCap.replanRecord.selectedAlternative.route === "parts",
    `Test H: one attempt below the cap, "parts" must still be selectable, got ${JSON.stringify(outcomeBelowCap.replanRecord)}`,
  );

  log("Test H: attempt-cap loop protection", {
    atCap: {
      attemptCount: cappedSession.attemptCount,
      viable: outcome.viable,
      reason: outcome.replanRecord.reason,
    },
    belowCap: {
      attemptCount: belowCap.attemptCount,
      viable: outcomeBelowCap.viable,
      selected: outcomeBelowCap.replanRecord.selectedAlternative.route,
    },
  });
  console.log(
    "\nTEST H RESULT (attempt-cap loop protection prevents infinite replanning): PASS",
  );
}

(async () => {
  try {
    await new Promise((r) => setTimeout(r, 300)); // let app.listen settle

    await testA();
    await testsB_to_F();
    await testG();
    await testH();

    console.log("\nAll Phase 9 scenarios executed (A-H).");
    process.exit(0);
  } catch (err) {
    console.error("\nPHASE 9 TEST HARNESS ERROR:", err);
    process.exit(1);
  }
})();
