/*
 * Phase 8 test harness — Deterministic Failure Simulation.
 *
 * Starts the real Express app (require('./src/app')) and drives the
 * real HTTP agent API end-to-end against the deterministic hero-demo
 * item (heroDemoService / heroDemoData): a damaged PCB.
 *
 * Dependency note — exactly the same convention as testphase6.js: this
 * harness uses the real services, real state machine, real decision
 * policy, real tool registry and real heroDemo/event pipeline for
 * EVERY stage after inspection. The ONE step it bypasses is the external
 * ML network call of inspect_item (the ml-service FastAPI process is not
 * running in this environment), and for that single step it seeds the
 * EXACT fields inspect_item's own onSuccess handler (agentStateService
 * TOOL_STAGE_RULES.inspect_item) would have written for this item — pcb
 * category, deriveConditionFromListing("poor") condition, the real
 * computed confidence — and moves the session to EVALUATING, i.e. the
 * state inspect_item would have left behind. This is documented in
 * testphase6.js and is not a mock of the agent: nothing about the
 * decision, execution, constraints, or failure handling is stubbed.
 *
 * Scenarios:
 *   A — Normal execution (failure simulation OFF): decision is
 *       data-driven, execution succeeds, real listing state changes,
 *       and repair is NOT interceptable (the environment reports it
 *       executable). Also proves repair itself still SUCCEEDS when the
 *       environment is not simulating the missing component.
 *   B — REQUIRED_COMPONENT_UNAVAILABLE (simulation ON): the real
 *       decision policy genuinely selects "repair" from decision data,
 *       execute_resolution returns a structured failure from the
 *       environment, NO listing mutation occurs (no false success), the
 *       agent state records the failure, the timeline shows
 *       DECISION -> ACTION -> TOOL_CALL -> TOOL_RESULT -> OBSERVATION,
 *       and the session moves from OBSERVING into REPLANNING (Phase 9 —
 *       see testphase9.js for the full autonomous recovery loop this
 *       harness only proves the entry point of).
 *
 * Run:
 *   node backend/testphase8.js          (from repo root)
 *   node testphase8.js                  (from backend/)
 */

const http = require("http");
const agentRepository = require("./src/data/agentRepository");
const heroDemoService = require("./src/services/heroDemoService");
const demoEnvironmentService = require("./src/services/demoEnvironmentService");

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

// The failed-agent-test helper mirrors testphase6.seedPostInspection: it
// writes the exact fields inspect_item.onSuccess would have written for a
// PCB-poor hero item (detectedDevice, condition via the same
// deriveConditionFromListing("poor") shape, the real computed confidence
// ~83 for this deterministic scenario) and moves the session to EVALUATING.
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

// Drives the REAL pipeline from a fresh session to EXECUTING via the
// real HTTP endpoints + real services:
//   resolve(IDLE) -> [seed inspect] -> calculate_valuation
//     -> check_constraints -> real decision policy -> EXECUTING.
// Returns everything a scenario needs to assert on.
async function runToExecuting(itemId, label) {
  const resolve = await request("POST", `/api/agent/resolve/${itemId}`, {});
  assert(
    resolve.status === 200 || resolve.status === 201,
    `[${label}] resolve/:itemId should succeed, got ${resolve.status}`,
  );
  assert(
    resolve.body.data.currentStatus === "IDLE",
    `[${label}] fresh session should start IDLE, got ${resolve.body.data.currentStatus}`,
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
    `[${label}] expected DECIDING after constraints, got ${constraints.body.data.session.currentStatus}` +
      ` (constraints: ${JSON.stringify(constraints.body.data.session.constraints)})`,
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
    constraintsOutcome: constraints.body,
    decision: decision.body.data.result,
    sessionAfterDecision: decision.body.data.session,
  };
}

// Data-driven expectation, same rule testphase7 defensively asserts:
// the decision MUST be the highest-expectedValue option that
// check_constraints did NOT block. Never a value this harness chose.
function expectedTopRoute(availableOptions, constraintsOutcome) {
  const routeAvailability =
    (constraintsOutcome &&
      constraintsOutcome.data &&
      constraintsOutcome.data.session &&
      constraintsOutcome.data.session.constraints &&
      constraintsOutcome.data.session.constraints.routeAvailability) ||
    [];
  const blockedRoutes = new Set(
    routeAvailability.filter((r) => r.available === false).map((r) => r.route),
  );
  return [...availableOptions]
    .filter((o) => !blockedRoutes.has(o.route))
    .sort((a, b) => b.expectedValue - a.expectedValue)[0];
}

// --------------------------------------------------------------
// Scenario A — Normal execution (failure simulation OFF)
// --------------------------------------------------------------
async function scenarioA() {
  const listing = heroDemoService.resetDemoItem();
  assert(
    demoEnvironmentService.getSimulationState().enabled === false,
    "Scenario A: reset should leave the failure simulation disabled",
  );

  const run = await runToExecuting(listing.id, "Scenario A");

  // Repair must NOT be a candidate when the simulation is off — the
  // environment reports nothing, so availableOptions is exactly the
  // Phase 6/7 set and the natural decision is data-driven (parts for
  // the hero PCB).
  assert(
    !run.availableOptions.some((o) => o.route === "repair"),
    `Scenario A: repair must not be decision-eligible with simulation off, got availableOptions ${JSON.stringify(run.availableOptions)}`,
  );
  const expectedTop = expectedTopRoute(
    run.availableOptions,
    run.constraintsOutcome,
  );
  assert(
    run.decision.route === expectedTop.route,
    `Scenario A: decision picked "${run.decision.route}" but the highest-value unblocked option was "${expectedTop.route}"`,
  );

  // Execute the decided route through the real tool endpoint.
  const execute = await request(
    "POST",
    `/api/agent/tool/${run.sessionId}/execute_resolution`,
    { route: run.decision.route },
  );
  assert(
    execute.status === 200 &&
      execute.body.data.result &&
      execute.body.data.result.success === true,
    `Scenario A: execute_resolution should succeed, got ${execute.status}: ${JSON.stringify(execute.body)}`,
  );

  const listingAfter = await request("GET", `/api/listings/${listing.id}`);
  assert(
    listingAfter.body.data.resolution &&
      listingAfter.body.data.resolution.route === run.decision.route,
    `Scenario A: listing.resolution must reflect the executed route`,
  );

  // The environment must NOT intercept repair execution when the
  // simulation is off — repair is fully executable.
  const denialWhenDisabled = demoEnvironmentService.getExecutionFailure({
    route: "repair",
    session: { itemId: listing.id },
  });
  assert(
    denialWhenDisabled === null,
    "Scenario A: with simulation off the environment must not report a repair execution failure",
  );

  // Prove repair itself still SUCCEEDS when the environment is not
  // simulating the missing component (contrast with Scenario B).
  // Reset the hero item first so the parts resolution just written is
  // cleared — a listing must be free of any active resolution before a
  // different route can be executed (the real conflict guard).
  heroDemoService.resetDemoItem();
  const resolve2 = await request(
    "POST",
    `/api/agent/resolve/${listing.id}`,
    {},
  );
  const sessionId2 = resolve2.body.data.agentSessionId;
  seedPostInspection(sessionId2);
  const val2 = await request("POST", `/api/agent/advance/${sessionId2}`, {});
  const con2 = await request("POST", `/api/agent/advance/${sessionId2}`, {});
  assert(
    con2.body.data.session.currentStatus === "DECIDING",
    `Scenario A: expected DECIDING for repair-contrast run, got ${con2.body.data.session.currentStatus}`,
  );
  agentRepository.updateSession(sessionId2, {
    currentStatus: "EXECUTING",
    currentDecision: { route: "repair", decidedAt: new Date().toISOString() },
  });
  const executeRepair = await request(
    "POST",
    `/api/agent/tool/${sessionId2}/execute_resolution`,
    { route: "repair" },
  );
  assert(
    executeRepair.status === 200 &&
      executeRepair.body.data.result.success === true,
    `Scenario A: repair execution with simulation off should succeed, got ${executeRepair.status}: ${JSON.stringify(executeRepair.body)}`,
  );
  const listingAfterRepair = await request(
    "GET",
    `/api/listings/${listing.id}`,
  );
  assert(
    listingAfterRepair.body.data.resolution &&
      listingAfterRepair.body.data.resolution.route === "repair",
    "Scenario A: repair (sim off) must write a real repair resolution on the listing",
  );

  log("Scenario A: normal run", {
    availableOptions: run.availableOptions,
    decision: run.decision.route,
    executeSuccess: execute.body.data.result.success,
    listingResolution: listingAfter.body.data.resolution,
    repairContrastSuccess: executeRepair.body.data.result.success,
    repairContrastResolutionRoute:
      listingAfterRepair.body.data.resolution.route,
  });
  console.log(
    "\nSCENARIO A RESULT (normal execution, failure simulation OFF): PASS",
  );

  // Restore known state for the next scenario.
  heroDemoService.resetDemoItem();
  return listing.id;
}

// --------------------------------------------------------------
// Scenario B — REQUIRED_COMPONENT_UNAVAILABLE (simulation ON)
// --------------------------------------------------------------
async function scenarioB(heroId) {
  const listing = heroDemoService.resetDemoItem();
  demoEnvironmentService.enableRequiredComponentUnavailable();
  assert(
    demoEnvironmentService.getSimulationState().enabled === true,
    "Scenario B: failure simulation should be enabled after enableRequiredComponentUnavailable()",
  );

  const run = await runToExecuting(listing.id, "Scenario B");

  // The environment reports repair as a decision-eligible route, and the
  // REAL decision policy selects it by ranking — not by any hardcode.
  assert(
    run.availableOptions.some((o) => o.route === "repair"),
    `Scenario B: with simulation ON repair must be decision-eligible, got availableOptions ${JSON.stringify(run.availableOptions)}`,
  );
  const expectedTop = expectedTopRoute(
    run.availableOptions,
    run.constraintsOutcome,
  );
  assert(
    expectedTop.route === "repair",
    `Scenario B: expected the highest-value unblocked option to be "repair", got "${expectedTop.route}"`,
  );
  assert(
    run.decision.route === "repair",
    `Scenario B: the real decision policy selected "${run.decision.route}" — expected "repair" as the genuine data-driven choice`,
  );

  // Execute the decided route (repair) through the real tool endpoint.
  const execute = await request(
    "POST",
    `/api/agent/tool/${run.sessionId}/execute_resolution`,
    { route: run.decision.route },
  );
  assert(
    execute.status === 200 && execute.body.data.result,
    `Scenario B: execute_resolution should return a result, got ${execute.status}: ${JSON.stringify(execute.body)}`,
  );

  const result = execute.body.data.result;
  assert(
    result.success === false,
    `Scenario B: execution must fail (success:false), got ${JSON.stringify(result)}`,
  );
  assert(
    result.errorCode === "REQUIRED_COMPONENT_UNAVAILABLE",
    `Scenario B: errorCode must be REQUIRED_COMPONENT_UNAVAILABLE, got ${result.errorCode}`,
  );
  assert(
    result.route === "repair",
    `Scenario B: failed route must be "repair", got ${result.route}`,
  );
  assert(
    typeof result.reason === "string" && result.reason.length > 0,
    "Scenario B: failure must carry a reason string",
  );

  // ---- NO FALSE SUCCESS: the listing must NOT be mutated as if repair
  // succeeded (no resolution record, status/sale_type untouched).
  const listingAfter = await request("GET", `/api/listings/${listing.id}`);
  assert(
    !listingAfter.body.data.resolution,
    "Scenario B: failed repair must NOT write a resolution record on the listing",
  );
  assert(
    listingAfter.body.data.status === "active",
    `Scenario B: listing status must stay "active", got ${listingAfter.body.data.status}`,
  );
  assert(
    listingAfter.body.data.sale_type === "fixed",
    `Scenario B: listing sale_type must stay "fixed", got ${listingAfter.body.data.sale_type}`,
  );

  // ---- AGENT STATE records the failure in the existing fields.
  const stateOut = await request("GET", `/api/agent/state/${run.sessionId}`);
  const state = stateOut.body.data;
  assert(
    state.currentStatus === "OBSERVING",
    `Scenario B: session must hold at OBSERVING after the failed execution, got ${state.currentStatus}`,
  );
  assert(
    state.attemptCount === 1,
    `Scenario B: attemptCount must be 1 (the failed repair attempt), got ${state.attemptCount}`,
  );
  assert(
    typeof state.failureReason === "string" &&
      state.failureReason.includes("unavailable"),
    `Scenario B: failureReason must describe the unavailable component, got ${state.failureReason}`,
  );
  assert(
    state.currentAction &&
      state.currentAction.failed === true &&
      state.currentAction.errorCode === "REQUIRED_COMPONENT_UNAVAILABLE",
    `Scenario B: currentAction must record the failed action + errorCode, got ${JSON.stringify(state.currentAction)}`,
  );
  const toolEntry = state.toolResults && state.toolResults.execute_resolution;
  assert(
    toolEntry &&
      toolEntry.output &&
      toolEntry.output.success === false &&
      toolEntry.output.errorCode === "REQUIRED_COMPONENT_UNAVAILABLE",
    "Scenario B: session.toolResults.execute_resolution must hold the structured failure",
  );

  // ---- TIMELINE: DECISION -> ACTION -> TOOL_CALL -> TOOL_RESULT
  // -> OBSERVATION, with the failure carried by the real events.
  const timelineOut = await request(
    "GET",
    `/api/agent/timeline/${run.sessionId}`,
  );
  const events = timelineOut.body.data;
  const idx = (type, from = 0) => {
    const i = events.findIndex((e, k) => k >= from && e.type === type);
    return i;
  };

  const iDecision = idx("DECISION");
  const iAction = idx("ACTION", iDecision);
  const iCall = events.findIndex(
    (e, k) =>
      k > iDecision &&
      e.type === "TOOL_CALL" &&
      e.tool === "execute_resolution",
  );
  const iResult = events.findIndex(
    (e, k) =>
      k > iAction &&
      e.type === "TOOL_RESULT" &&
      e.tool === "execute_resolution" &&
      e.output &&
      e.output.errorCode === "REQUIRED_COMPONENT_UNAVAILABLE",
  );
  const iObservation = events.findIndex(
    (e, k) =>
      k > iResult &&
      e.type === "OBSERVATION" &&
      e.metadata &&
      e.metadata.failureReason,
  );

  assert(
    iDecision >= 0 && events[iDecision].decision.route === "repair",
    "Scenario B: timeline must have a DECISION event for repair",
  );
  assert(
    iAction > iDecision && events[iAction].tool === "execute_resolution",
    "Scenario B: timeline must have the intended ACTION event after the decision",
  );
  assert(
    iCall > iAction,
    "Scenario B: timeline must have a TOOL_CALL for execute_resolution after the ACTION",
  );
  assert(
    iResult > iCall,
    "Scenario B: timeline must have a TOOL_RESULT carrying REQUIRED_COMPONENT_UNAVAILABLE",
  );
  assert(
    iObservation > iResult &&
      events[iObservation].message.includes("REQUIRED_COMPONENT_UNAVAILABLE"),
    "Scenario B: timeline must end with an OBSERVATION of the failure",
  );

  // ---- Phase 9 update: OBSERVING no longer holds — the orchestrator now
  // autonomously resolves a failed observation straight into REPLANNING
  // (see agentStateService.resolveObservation / testphase9.js for the full
  // autonomous recovery loop this now feeds into). Phase 8 itself is
  // otherwise unchanged: the failure was still a real, unmutated tool
  // result, and this session is free to continue into Phase 9 behavior
  // rather than being artificially frozen.
  const advanceFromObserving = await request(
    "POST",
    `/api/agent/advance/${run.sessionId}`,
    {},
  );
  assert(
    advanceFromObserving.status === 200 &&
      advanceFromObserving.body.data.advanced === true &&
      advanceFromObserving.body.data.session.currentStatus === "REPLANNING",
    `Scenario B: OBSERVING must now advance into REPLANNING (Phase 9), got ${JSON.stringify(advanceFromObserving.body.data)}`,
  );

  // ---- Determinism: repeating the environment consultation yields the
  // identical failure — no randomness, no time dependence.
  const denial1 = demoEnvironmentService.getExecutionFailure({
    route: "repair",
    session: { itemId: listing.id },
  });
  const denial2 = demoEnvironmentService.getExecutionFailure({
    route: "repair",
    session: { itemId: listing.id },
  });
  assert(
    denial1 &&
      denial2 &&
      denial1.errorCode === denial2.errorCode &&
      denial1.errorCode === "REQUIRED_COMPONENT_UNAVAILABLE",
    "Scenario B: the environment failure must be deterministic across repeated consultations",
  );

  log("Scenario B: failure-demo run", {
    availableOptions: run.availableOptions,
    decision: run.decision,
    executionFailure: result,
    listingAfterFailure: {
      resolution: listingAfter.body.data.resolution,
      status: listingAfter.body.data.status,
      sale_type: listingAfter.body.data.sale_type,
    },
    sessionState: {
      currentStatus: state.currentStatus,
      attemptCount: state.attemptCount,
      failureReason: state.failureReason,
      currentAction: state.currentAction,
    },
    timelineSummary: events
      .filter(
        (e) =>
          e.type === "DECISION" ||
          e.type === "ACTION" ||
          e.type === "TOOL_RESULT" ||
          e.type === "OBSERVATION",
      )
      .map((e) => ({
        type: e.type,
        tool: e.tool,
        message: e.message,
        errorCode: (e.output && e.output.errorCode) || null,
      })),
  });
  console.log("\nSCENARIO B RESULT (REQUIRED_COMPONENT_UNAVAILABLE): PASS");

  // Restore known state so nothing is left dangling for other runs.
  heroDemoService.resetDemoItem();
  return heroId;
}

(async () => {
  try {
    await new Promise((r) => setTimeout(r, 300)); // let app.listen settle

    const heroId = await scenarioA();
    await scenarioB(heroId);

    console.log("\nAll Phase 8 scenarios executed.");
    process.exit(0);
  } catch (err) {
    console.error("\nPHASE 8 TEST HARNESS ERROR:", err);
    process.exit(1);
  }
})();
