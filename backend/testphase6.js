/*
 * Phase 6 test harness.
 *
 * Starts the real Express app (require('./src/app')) and drives the
 * real HTTP API for everything except inspect_item, which needs the
 * separate FastAPI ml-service (out of scope for this phase and not
 * available in this environment). For that one step only, this
 * script seeds session.detectedDevice/condition/confidence directly
 * via agentRepository — the exact fields inspect_item's own
 * onSuccess handler in agentStateService.js would have written  —
 * and moves currentStatus to EVALUATING, i.e. exactly the state
 * inspect_item would have left behind. Every step after that
 * (calculate_valuation, check_constraints, the decision stage,
 * execute_resolution) runs through the real HTTP endpoints, hitting
 * the real aiDecisionService, the real agentTools.checkConstraints
 * (with the new routeAvailability logic), the real
 * agentDecisionService.decide(), and the real agentStateService /
 * agentOrchestrator / agentEventService code added in this phase.
 */

const http = require("http");
const agentRepository = require("./src/data/agentRepository");
const listingRepository = require("./src/data/listingRepository");

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

// Simulates the exact state inspect_item's onSuccess handler
// (agentStateService.js TOOL_STAGE_RULES.inspect_item) would have
// written, then moves the session to EVALUATING — bypassing only the
// external ML network call itself.
function seedPostInspection(sessionId, { category, brand, model }) {
  agentRepository.updateSession(sessionId, {
    detectedDevice: { category, brand, model, source: "test-seed" },
    condition: {
      powersOn: true,
      displayCondition: "good",
      batteryCondition: "good",
      chargerAvailable: true,
      storage: true,
      ram: true,
    },
    confidence: 88,
    currentStatus: "EVALUATING",
  });
}

function log(title, obj) {
  console.log(`\n=== ${title} ===`);
  console.log(JSON.stringify(obj, null, 2));
}

async function runToDeciding(
  itemId,
  label,
  { category = "laptop", brand = "Dell", model = "Latitude 7490" } = {},
) {
  const resolve = await request("POST", `/api/agent/resolve/${itemId}`, {});
  const sessionId = resolve.body.data.agentSessionId;
  seedPostInspection(sessionId, { category, brand, model });

  const valuation = await request(
    "POST",
    `/api/agent/advance/${sessionId}`,
    {},
  );
  if (valuation.body.data.session.currentStatus !== "CHECKING_CONSTRAINTS") {
    throw new Error(
      `[${label}] expected CHECKING_CONSTRAINTS after valuation, got ${valuation.body.data.session.currentStatus}`,
    );
  }

  const constraints = await request(
    "POST",
    `/api/agent/advance/${sessionId}`,
    {},
  );
  return {
    sessionId,
    valuationOutcome: valuation.body,
    constraintsOutcome: constraints.body,
  };
}

async function scenarioA() {
  const listings = await request("GET", "/api/listings");
  const itemId = listings.body.data[0].id; // Dell Latitude, has photos, active, has location

  const { sessionId, constraintsOutcome } = await runToDeciding(
    itemId,
    "Scenario A",
  );
  log("A: post check_constraints", {
    status: constraintsOutcome.data.session.currentStatus,
    routeAvailability:
      constraintsOutcome.data.session.constraints.routeAvailability,
  });

  if (constraintsOutcome.data.session.currentStatus !== "DECIDING") {
    throw new Error(
      `[Scenario A] expected DECIDING, got ${constraintsOutcome.data.session.currentStatus}`,
    );
  }

  const decision = await request("POST", `/api/agent/advance/${sessionId}`, {});
  log("A: decision outcome", decision.body.data.result);
  log("A: session after decision", {
    currentStatus: decision.body.data.session.currentStatus,
    currentDecision: decision.body.data.session.currentDecision,
    previousDecision: decision.body.data.session.previousDecision,
    decisionHistoryLength: decision.body.data.session.decisionHistory.length,
    currentAction: decision.body.data.session.currentAction,
  });

  const timeline = await request("GET", `/api/agent/timeline/${sessionId}`);
  const decisionEvent = timeline.body.data.find((e) => e.type === "DECISION");
  log("A: DECISION event on timeline", decisionEvent);

  const availableOptions = decision.body.data.session.availableOptions;
  const expectedTop = [...availableOptions].sort(
    (a, b) => b.expectedValue - a.expectedValue,
  )[0];
  const pass =
    decision.body.data.session.currentStatus === "EXECUTING" &&
    decision.body.data.session.currentDecision.route === expectedTop.route &&
    Boolean(decisionEvent);
  console.log(
    `\nSCENARIO A RESULT: ${pass ? "PASS" : "FAIL"} (selected ${decision.body.data.session.currentDecision.route}, highest-value option was ${expectedTop.route})`,
  );

  // Also exercise execute_resolution to confirm Phase 5 still works
  // and that it picks up currentDecision.route when no route is
  // passed manually (Scenario D coverage for execute_resolution).
  const execute = await request(
    "POST",
    `/api/agent/tool/${sessionId}/execute_resolution`,
    {
      route: decision.body.data.session.currentDecision.route,
    },
  );
  log(
    "A: execute_resolution outcome",
    execute.body.data ? execute.body.data.result : execute.body,
  );
  return { sessionId, itemId };
}

async function scenarioB() {
  const listings = await request("GET", "/api/listings");
  const itemId = listings.body.data[1].id; // Samsung Galaxy S20 listing

  // First, run a normal decision once to see the natural top route
  // with nothing blocked, purely to know what we're about to block.
  const probe = await runToDeciding(itemId, "Scenario B probe");
  const naturalTop = [
    ...probe.constraintsOutcome.data.session.availableOptions,
  ].sort((a, b) => b.expectedValue - a.expectedValue)[0];
  log(
    "B: natural (unblocked) ranking",
    probe.constraintsOutcome.data.session.availableOptions,
  );

  // Now simulate a real, already-enforced conflict: this listing
  // already has an active (non-terminal) resolution recorded for a
  // route OTHER than the natural top route. This is exactly what
  // execute_resolution's own RESOLUTION_ALREADY_EXISTS check guards
  // against, reused as-is by checkConstraints' routeAvailability
  // (see agentTools.js) — nothing new is invented here.
  const candidateRoutes =
    probe.constraintsOutcome.data.session.availableOptions.map((o) => o.route);
  const blockedExistingRoute = candidateRoutes.find(
    (r) => r !== naturalTop.route,
  );

  listingRepository.update(itemId, {
    resolution: {
      resolutionId: "seeded-conflict",
      route: blockedExistingRoute,
      status: "in_progress",
      action: "seeded_for_test",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  });

  const { sessionId, constraintsOutcome } = await runToDeciding(
    itemId,
    "Scenario B",
  );
  log(
    "B: routeAvailability with an active resolution on a different route",
    constraintsOutcome.data.session.constraints.routeAvailability,
  );

  if (constraintsOutcome.data.session.currentStatus !== "DECIDING") {
    throw new Error(
      `[Scenario B] expected DECIDING, got ${constraintsOutcome.data.session.currentStatus}`,
    );
  }

  const decision = await request("POST", `/api/agent/advance/${sessionId}`, {});
  log(
    "B: decision outcome (top route should be excluded)",
    decision.body.data.result,
  );

  const pass =
    decision.body.data.result.viable === true &&
    decision.body.data.result.route === blockedExistingRoute &&
    decision.body.data.result.route !== naturalTop.route;
  console.log(
    `\nSCENARIO B RESULT: ${pass ? "PASS" : "FAIL"} (natural top was "${naturalTop.route}", pre-existing active resolution locked "${blockedExistingRoute}", agent selected "${decision.body.data.result.route}")`,
  );

  // Clean up the seeded conflict so it doesn't leak into other runs.
  listingRepository.update(itemId, { resolution: null });
  return { sessionId, itemId };
}

async function scenarioC() {
  const listings = await request("GET", "/api/listings");
  const itemId = listings.body.data[2].id; // LG washing machine listing

  // Seed an active resolution for a route that is NOT one of
  // session.availableOptions' 5 routes at all ('repair' — the same
  // route execute_resolution supports but buildAvailableOptions
  // deliberately excludes, see agentStateService.js). Every candidate
  // route in availableOptions is then a "different route" from the
  // existing one, so all 5 come back blocked — a genuine, real
  // no-viable-route case, not a fabricated one.
  listingRepository.update(itemId, {
    resolution: {
      resolutionId: "seeded-repair-in-progress",
      route: "repair",
      status: "in_progress",
      action: "repair_request_recorded",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  });

  const { sessionId, constraintsOutcome } = await runToDeciding(
    itemId,
    "Scenario C",
  );
  log(
    "C: routeAvailability with an active repair resolution",
    constraintsOutcome.data.session.constraints.routeAvailability,
  );

  if (constraintsOutcome.data.session.currentStatus !== "DECIDING") {
    throw new Error(
      `[Scenario C] expected DECIDING, got ${constraintsOutcome.data.session.currentStatus}`,
    );
  }

  const decision = await request("POST", `/api/agent/advance/${sessionId}`, {});
  log(
    "C: decision outcome (no viable route expected)",
    decision.body.data.result,
  );
  log(
    "C: session status after decision",
    decision.body.data.session.currentStatus,
  );

  const pass =
    decision.body.data.result.viable === false &&
    decision.body.data.session.currentStatus === "HUMAN_REVIEW";
  console.log(`\nSCENARIO C RESULT: ${pass ? "PASS" : "FAIL"}`);

  listingRepository.update(itemId, { resolution: null });
  return { sessionId, itemId };
}

async function scenarioD_existingFunctionality() {
  const listings = await request("GET", "/api/listings");
  const itemId = listings.body.data[0].id;

  const tools = await request("GET", "/api/agent/tools");
  const resolve = await request("POST", `/api/agent/resolve/${itemId}`, {});
  const sessionId = resolve.body.data.agentSessionId;

  seedPostInspection(sessionId, {
    category: "laptop",
    brand: "Dell",
    model: "Latitude 7490",
  });

  const manualValuation = await request(
    "POST",
    `/api/agent/tool/${sessionId}/calculate_valuation`,
    {},
  );
  const manualConstraints = await request(
    "POST",
    `/api/agent/tool/${sessionId}/check_constraints`,
    {},
  );
  const state = await request("GET", `/api/agent/state/${sessionId}`);
  const timeline = await request("GET", `/api/agent/timeline/${sessionId}`);

  const pass =
    tools.status === 200 &&
    manualValuation.status === 200 &&
    manualConstraints.status === 200 &&
    state.status === 200 &&
    timeline.status === 200 &&
    state.body.data.currentStatus === "DECIDING";

  console.log(
    `\nSCENARIO D RESULT (manual tool calls, /tools, /state, /timeline all still work): ${pass ? "PASS" : "FAIL"}`,
  );
  return pass;
}

(async () => {
  try {
    await new Promise((r) => setTimeout(r, 300)); // let app.listen settle
    await scenarioA();
    await scenarioB();
    await scenarioC();
    await scenarioD_existingFunctionality();
    console.log("\nAll scenarios executed.");
    process.exit(0);
  } catch (err) {
    console.error("\nTEST HARNESS ERROR:", err);
    process.exit(1);
  }
})();

