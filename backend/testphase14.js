/*
 * Phase 14 — deterministic synthetic enterprise/demo data + Phase 13
 * robustness integration harness.
 *
 * Runs the real Express app and drives the real /api/agent orchestration
 * endpoints. Inspection is seeded with the exact state inspect_item would
 * leave behind so this deterministic data test does not depend on the
 * external ML process.
 */

const http = require("http");
const { execFileSync, spawn } = require("child_process");

const agentRepository = require("./src/data/agentRepository");
const listingRepository = require("./src/data/listingRepository");
const heroDemoService = require("./src/services/heroDemoService");
const demoEnvironmentService = require("./src/services/demoEnvironmentService");
const agentDecisionService = require("./src/services/agentDecisionService");
const { DEMO_SCENARIOS } = require("./src/data/demo/demoData");

require("./src/app");

const PORT = process.env.PORT || 5000;
const BASE = `http://127.0.0.1:${PORT}`;

function request(method, urlPath, body, base = BASE) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      base + urlPath,
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

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

function log(title, obj) {
  console.log(`\n=== ${title} ===`);
  console.log(JSON.stringify(obj, null, 2));
}

function seedPostInspection(sessionId, scenario) {
  agentRepository.updateSession(sessionId, {
    detectedDevice: {
      category: scenario.inspection.category,
      brand: scenario.inspection.brand,
      model: scenario.inspection.model,
      source: "phase14-seed",
    },
    condition: {
      powersOn: scenario.id === "SCENARIO_NORMAL_REPAIR",
      displayCondition: scenario.id === "SCENARIO_NORMAL_REPAIR" ? "fair" : "poor",
      batteryCondition: scenario.id === "SCENARIO_NORMAL_REPAIR" ? "fair" : "poor",
      chargerAvailable: scenario.id === "SCENARIO_NORMAL_REPAIR",
      storage: true,
      ram: true,
      photosHint: true,
    },
    confidence: scenario.inspection.confidence,
    currentStatus: "EVALUATING",
  });
}

async function resetScenario(scenarioId) {
  const reset = await request("POST", "/api/agent/demo/reset", { scenarioId });
  assert(reset.status === 200 && reset.body.success, `reset ${scenarioId} should succeed`);
  return reset.body.data;
}

async function startScenario(scenarioId) {
  const scenario = DEMO_SCENARIOS[scenarioId];
  await resetScenario(scenarioId);
  const resolve = await request("POST", `/api/agent/resolve/${scenario.itemId}`, {});
  assert(resolve.status === 201, `${scenarioId}: expected a fresh session, got ${resolve.status}`);
  seedPostInspection(resolve.body.data.agentSessionId, scenario);
  return { scenario, sessionId: resolve.body.data.agentSessionId };
}

async function advance(sessionId) {
  const out = await request("POST", `/api/agent/advance/${sessionId}`, {});
  assert(out.status === 200 && out.body.success, `advance ${sessionId} failed: ${JSON.stringify(out.body)}`);
  return out.body.data;
}

async function runScenarioToTerminal(scenarioId) {
  const { scenario, sessionId } = await startScenario(scenarioId);
  const statuses = [];
  let current = agentRepository.findSessionById(sessionId);
  for (let i = 0; i < 20 && !["COMPLETED", "FAILED", "HUMAN_REVIEW"].includes(current.currentStatus); i += 1) {
    const outcome = await advance(sessionId);
    current = outcome.session;
    statuses.push(current.currentStatus);
  }
  const timeline = await request("GET", `/api/agent/timeline/${sessionId}`);
  return { scenario, sessionId, finalState: current, statuses, events: timeline.body.data };
}

function logicalSummary(run) {
  return {
    status: run.finalState.currentStatus,
    decisions: run.finalState.decisionHistory.map((d) => d.route),
    replans: run.finalState.replanHistory.map((r) => ({ failedRoute: r.failedRoute, selected: r.selectedAlternative && r.selectedAlternative.route })),
    observations: run.finalState.observations.map((o) => ({ success: o.success, route: o.route, errorCode: o.errorCode })),
    finalRoute: run.finalState.finalResolution && run.finalState.finalResolution.route,
  };
}

async function testA_demoDataLoadsDeterministically() {
  const first = await resetScenario("SCENARIO_FAILURE_REPLAN");
  const second = await resetScenario("SCENARIO_FAILURE_REPLAN");
  assert(first.simulation.activeScenarioId === "SCENARIO_FAILURE_REPLAN", "scenario should activate deterministically");
  assert(JSON.stringify(first.scenarios) === JSON.stringify(second.scenarios), "scenario list must be stable across resets");
  assert(demoEnvironmentService.isDemoDataRandomFree(), "demo data must not contain random generators");
  console.log("TEST A RESULT (demo data loads deterministically): PASS");
}

async function testB_normalRepairCompletes() {
  const run = await runScenarioToTerminal("SCENARIO_NORMAL_REPAIR");
  assert(run.finalState.currentStatus === "COMPLETED", `normal repair expected COMPLETED, got ${run.finalState.currentStatus}`);
  assert(run.finalState.finalResolution.route === "repair", "normal repair should verify repair route");
  console.log("TEST B RESULT (normal repair completes): PASS");
  return run;
}

async function testC_D_failureReplansToParts() {
  const run = await runScenarioToTerminal("SCENARIO_FAILURE_REPLAN");
  const observations = run.finalState.observations;
  assert(observations[0].errorCode === "REQUIRED_COMPONENT_UNAVAILABLE", "failure scenario must observe REQUIRED_COMPONENT_UNAVAILABLE");
  assert(run.finalState.replanHistory[0].selectedAlternative.route === "parts", "failure scenario must replan to parts");
  assert(run.finalState.finalResolution.route === "parts", "failure scenario must complete with verified parts route");
  console.log("TEST C RESULT (REQUIRED_COMPONENT_UNAVAILABLE observed): PASS");
  console.log("TEST D RESULT (failure replans to parts): PASS");
  return run;
}

async function testE_noViableHumanReview() {
  const run = await runScenarioToTerminal("SCENARIO_NO_VIABLE_ROUTE");
  assert(run.finalState.currentStatus === "HUMAN_REVIEW", `no viable route expected HUMAN_REVIEW, got ${run.finalState.currentStatus}`);
  assert(run.finalState.decisionHistory[0].viable === false, "no viable route must not fabricate a viable decision");
  console.log("TEST E RESULT (no viable route -> HUMAN_REVIEW): PASS");
}

async function testF_availabilityChangesRouteSelection() {
  const scenario = DEMO_SCENARIOS.SCENARIO_CONSTRAINT_SWITCH;
  demoEnvironmentService.setActiveScenario("SCENARIO_CONSTRAINT_SWITCH");
  const blockedAvailability = demoEnvironmentService.getRouteAvailability({ itemId: scenario.itemId, availableOptions: scenario.routeOptions });
  const blockedDecision = agentDecisionService.decide({
    availableOptions: scenario.routeOptions,
    valuation: { recommendation: { route: "repair", reason: "demo" } },
    constraints: { routeAvailability: blockedAvailability },
  });
  assert(blockedDecision.route === "parts", `blocked repair should select parts, got ${blockedDecision.route}`);

  demoEnvironmentService.setRouteAvailability("SCENARIO_CONSTRAINT_SWITCH", "repair", true);
  const changedAvailability = demoEnvironmentService.getRouteAvailability({ itemId: scenario.itemId, availableOptions: scenario.routeOptions });
  const repairedDecision = agentDecisionService.decide({
    availableOptions: scenario.routeOptions,
    valuation: { recommendation: { route: "repair", reason: "demo" } },
    constraints: { routeAvailability: changedAvailability },
  });
  assert(repairedDecision.route === "repair", `changing availability should select repair, got ${repairedDecision.route}`);
  console.log("TEST F RESULT (availability changes route selection): PASS");
}

async function testG_resetRestoresState() {
  const run = await runScenarioToTerminal("SCENARIO_FAILURE_REPLAN");
  assert(run.finalState.currentStatus === "COMPLETED", "setup run should complete");
  await resetScenario("SCENARIO_FAILURE_REPLAN");
  const listing = listingRepository.findById("item-demo-001");
  assert(!listing.resolution, "reset must clear listing resolution");
  assert(!agentRepository.findActiveSessionByItemId("item-demo-001"), "reset must clear active sessions");
  console.log("TEST G RESULT (reset restores deterministic initial state): PASS");
}

async function testH_sameScenarioTwiceEquivalent() {
  const first = logicalSummary(await runScenarioToTerminal("SCENARIO_FAILURE_REPLAN"));
  const second = logicalSummary(await runScenarioToTerminal("SCENARIO_FAILURE_REPLAN"));
  assert(JSON.stringify(first) === JSON.stringify(second), `repeated scenarios differ: ${JSON.stringify({ first, second })}`);
  console.log("TEST H RESULT (same scenario twice equivalent): PASS");
}

async function testI_randomFree() {
  const text = require("fs").readFileSync(require("path").join(__dirname, "src", "data", "demo", "demoData.js"), "utf8");
  assert(!/Math\.random|randomUUID|uuidv4\(/.test(text), "demo data file must not use random generators");
  console.log("TEST I RESULT (demo data requires no random values): PASS");
}

async function testPhase13_invalidInputsAndIdempotency() {
  const missing = await request("POST", "/api/agent/resolve/", {});
  assert(missing.status === 404, "missing item id route should be controlled 404");
  const unknown = await request("POST", "/api/agent/resolve/not-a-real-item", {});
  assert(unknown.status === 404, "unknown item id should be controlled 404");
  const missingSession = await request("GET", "/api/agent/state/not-a-real-session");
  assert(missingSession.status === 404, "unknown session should be controlled 404");
  const invalidRoute = await request("GET", "/api/not-a-route");
  assert(invalidRoute.status === 404, "invalid route should be controlled 404");

  const { sessionId } = await startScenario("SCENARIO_NORMAL_REPAIR");
  const beforeDecision = await request("POST", `/api/agent/tool/${sessionId}/execute_resolution`, { route: "repair" });
  assert(beforeDecision.status === 409, "execute before decision should be controlled 409");

  await advance(sessionId); // valuation
  await advance(sessionId); // constraints
  await advance(sessionId); // decision -> executing
  const first = await advance(sessionId); // execute
  assert(first.result.success === true, "first execution should succeed");
  const duplicate = await request("POST", `/api/agent/tool/${sessionId}/execute_resolution`, { route: "repair" });
  assert(duplicate.status === 409, "duplicate execute in OBSERVING should be blocked by state gate");

  const refreshedState = await request("GET", `/api/agent/state/${sessionId}`);
  const refreshedTimeline = await request("GET", `/api/agent/timeline/${sessionId}`);
  assert(refreshedState.body.data.currentStatus === "OBSERVING", "refresh state endpoint should retrieve current backend state");
  assert(Array.isArray(refreshedTimeline.body.data) && refreshedTimeline.body.data.length > 0, "timeline endpoint should retrieve events after refresh");
  console.log("PHASE 13 INVALID INPUT / IDEMPOTENCY / REFRESH RESULT: PASS");
}

async function testCombinedResetRunResetRun() {
  const first = logicalSummary(await runScenarioToTerminal("SCENARIO_FAILURE_REPLAN"));
  await resetScenario("SCENARIO_FAILURE_REPLAN");
  const second = logicalSummary(await runScenarioToTerminal("SCENARIO_FAILURE_REPLAN"));
  assert(JSON.stringify(first) === JSON.stringify(second), "reset/run/reset/run should be logically identical");
  console.log("COMBINED PHASE 13+14 RESET/RUN/RESET/RUN RESULT: PASS");
}

// Polls the backend until it answers /api/health, instead of waiting a
// fixed number of milliseconds for a spawned child process to boot.
// A fixed sleep is a fragile assumption (Phase 16) — under CI/full-test
// load a fresh `node src/app.js` can take far longer than a constant
// delay to bind its port, producing spurious ECONNREFUSED failures.
async function waitForServer(base, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const health = await request("GET", "/api/health", null, base);
      if (health.status === 200) {
        return;
      }
    } catch (error) {
      // Connection not ready yet — keep polling.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`server on ${base} did not become healthy within ${timeoutMs}ms`);
}

async function testRestartBehaviorDocumented() {
  const port = Number(PORT) + 77;
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["src/app.js"], {
    cwd: __dirname,
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "ignore", "ignore"],
  });

  try {
    await waitForServer(base);
    await request("POST", "/api/agent/demo/reset", { scenarioId: "SCENARIO_NORMAL_REPAIR" }, base);
    const created = await request("POST", "/api/agent/resolve/item-demo-002", {}, base);
    assert(created.status === 201, "restart probe should create session before restart");
    const sessionId = created.body.data.agentSessionId;
    child.kill();
    await new Promise((resolve) => setTimeout(resolve, 300));

    const child2 = spawn(process.execPath, ["src/app.js"], {
      cwd: __dirname,
      env: { ...process.env, PORT: String(port) },
      stdio: ["ignore", "ignore", "ignore"],
    });
    try {
      await waitForServer(base);
      const after = await request("GET", `/api/agent/state/${sessionId}`, null, base);
      assert(after.status === 404, "agent session should not survive backend restart with in-memory repository");
      const reset = await request("POST", "/api/agent/demo/reset", { scenarioId: "SCENARIO_NORMAL_REPAIR" }, base);
      assert(reset.status === 200, "demo data can be reloaded after backend restart");
    } finally {
      child2.kill();
    }
  } finally {
    child.kill();
  }
  console.log("BACKEND RESTART BEHAVIOR RESULT: PASS (sessions are in-memory; demo data reloads deterministically)");
}

async function main() {
  await testA_demoDataLoadsDeterministically();
  await testB_normalRepairCompletes();
  await testC_D_failureReplansToParts();
  await testE_noViableHumanReview();
  await testF_availabilityChangesRouteSelection();
  await testG_resetRestoresState();
  await testH_sameScenarioTwiceEquivalent();
  await testI_randomFree();
  await testPhase13_invalidInputsAndIdempotency();
  await testCombinedResetRunResetRun();
  await testRestartBehaviorDocumented();
}

main()
  .then(() => {
    console.log("\nPHASE 14 RESULT: PASS");
    console.log("PHASE 13 ROBUSTNESS INTEGRATION RESULT: PASS");
    // Explicitly exit: require("./src/app") leaves app.listen's handle
    // open, so without this the harness passes but the process never
    // terminates (it hangs in CI / chained test runners). Every other
    // testphase*.js harness exits explicitly for the same reason.
    process.exit(0);
  })
  .catch((error) => {
    console.error("\nPHASE 14 RESULT: FAIL");
    console.error(error);
    process.exit(1);
  });
