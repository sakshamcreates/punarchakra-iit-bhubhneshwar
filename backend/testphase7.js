/*
 * Phase 7 test harness — Hero Demo Scenario.
 *
 * Starts the real Express app (require('./src/app')) and drives the
 * real HTTP agent API end-to-end against the deterministic hero-demo
 * item (heroDemoService / heroDemoData): a damaged PCB.
 *
 * Unlike testphase6.js, this harness does NOT bypass inspect_item.
 * It reads ml-service's own bundled "PCB" training photo from disk and
 * sends it through the real pipeline: mlService.classifyEWaste ->
 * FastAPI /scrap/classify -> ONNX MobileNetV3 scrap classifier. If the
 * ml-service process is not reachable, or its data folder is missing
 * from this checkout, this harness says so plainly and stops rather
 * than faking an inspection result — see hasDemoInspectionImage() /
 * the try/catch around the inspect_item advance call below.
 *
 * Every other stage (calculate_valuation, check_constraints, the
 * DECIDING stage, execute_resolution) runs through the real HTTP
 * endpoints exactly as a normal caller would use them — nothing here
 * re-implements agentDecisionService, aiDecisionService, or a second
 * "demo" pipeline.
 *
 * Run with the ml-service already running on ML_SERVICE_URL
 * (default http://127.0.0.1:8000), e.g.:
 *
 *   (cd ml-service && python3 -m uvicorn app.main:app --port 8000 &)
 *   node backend/testphase7.js
 */

const http = require("http");
const fs = require("fs");
const agentRepository = require("./src/data/agentRepository");
const heroDemoService = require("./src/services/heroDemoService");

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

function loadDemoImageBase64() {
  const buffer = fs.readFileSync(heroDemoService.DEMO_INSPECTION_IMAGE_PATH);
  return buffer.toString("base64");
}

// Runs the full currently-supported hero path (IDLE -> ... ->
// EXECUTING -> execute_resolution) against whatever the hero-demo
// listing looks like RIGHT NOW. Does not reset anything itself — the
// caller resets before invoking this, so this same function can be
// reused for both the first run and the repeatability run (Test E).
async function runHeroPathOnce(itemId, imageBase64, label) {
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
  const sessionCreated = resolve.status === 201;

  // IDLE -> INSPECTING -> EVALUATING (real ML classification)
  const inspect = await request("POST", `/api/agent/advance/${sessionId}`, {
    image: { base64: imageBase64, mimetype: "image/jpeg", filename: "pcb_0.jpg" },
  });
  assert(
    inspect.status === 200 && inspect.body.success,
    `[${label}] inspect_item advance should succeed, got ${inspect.status}: ${JSON.stringify(inspect.body)}`,
  );
  assert(
    inspect.body.data.session.currentStatus === "EVALUATING",
    `[${label}] expected EVALUATING after inspection, got ${inspect.body.data.session.currentStatus}`,
  );
  const detectedDevice = inspect.body.data.session.detectedDevice;
  assert(
    detectedDevice.category === "pcb",
    `[${label}] real classifier should detect category "pcb", got "${detectedDevice.category}" (classifierMaterial: ${detectedDevice.classifierMaterial})`,
  );
  assert(
    inspect.body.data.result.classification.source === "existing_revalue_classifier",
    `[${label}] inspection must come from the real existing classifier, not a fabricated result`,
  );

  // EVALUATING -> CHECKING_CONSTRAINTS (real aiDecisionService.evaluate)
  const valuation = await request("POST", `/api/agent/advance/${sessionId}`, {});
  assert(
    valuation.body.data.session.currentStatus === "CHECKING_CONSTRAINTS",
    `[${label}] expected CHECKING_CONSTRAINTS after valuation, got ${valuation.body.data.session.currentStatus}`,
  );
  const availableOptions = valuation.body.data.session.availableOptions;

  // CHECKING_CONSTRAINTS -> DECIDING (real check_constraints)
  const constraints = await request("POST", `/api/agent/advance/${sessionId}`, {});
  assert(
    constraints.body.data.session.currentStatus === "DECIDING",
    `[${label}] expected DECIDING after constraints, got ${constraints.body.data.session.currentStatus} ` +
      `(constraints: ${JSON.stringify(constraints.body.data.session.constraints)})`,
  );

  // DECIDING -> EXECUTING (real agentDecisionService.decide, via the
  // orchestrator's DECIDING special case)
  const decision = await request("POST", `/api/agent/advance/${sessionId}`, {});
  assert(
    decision.body.data.result.viable === true,
    `[${label}] expected a viable decision for this deterministic scenario, got: ${JSON.stringify(decision.body.data.result)}`,
  );
  assert(
    decision.body.data.session.currentStatus === "EXECUTING",
    `[${label}] expected EXECUTING after a viable decision, got ${decision.body.data.session.currentStatus}`,
  );

  // Data-driven check (Test C): the selected route must be the
  // highest-expectedValue option that check_constraints did NOT block
  // — never a value this harness chose itself.
  const routeAvailability =
    (constraints.body.data.session.constraints &&
      constraints.body.data.session.constraints.routeAvailability) ||
    [];
  const blockedRoutes = new Set(
    routeAvailability.filter((r) => r.available === false).map((r) => r.route),
  );
  const expectedTop = [...availableOptions]
    .filter((o) => !blockedRoutes.has(o.route))
    .sort((a, b) => b.expectedValue - a.expectedValue)[0];
  assert(
    decision.body.data.result.route === expectedTop.route,
    `[${label}] decision engine picked "${decision.body.data.result.route}" but the highest-value ` +
      `unblocked option was "${expectedTop.route}" — route selection must be data-driven`,
  );

  // Test D: actually execute the decided route and confirm real
  // application state changes (not just console output).
  const execute = await request(
    "POST",
    `/api/agent/tool/${sessionId}/execute_resolution`,
    { route: decision.body.data.session.currentDecision.route },
  );
  assert(
    execute.status === 200 && execute.body.data.result.success === true,
    `[${label}] execute_resolution should succeed, got ${execute.status}: ${JSON.stringify(execute.body)}`,
  );

  const listingAfter = await request("GET", `/api/listings/${itemId}`);
  assert(
    listingAfter.body.data.resolution &&
      listingAfter.body.data.resolution.route === decision.body.data.result.route,
    `[${label}] listing.resolution must reflect the executed route`,
  );

  return {
    sessionId,
    sessionCreated,
    availableOptions,
    recommendation: valuation.body.data.session.valuation.recommendation,
    decision: decision.body.data.result,
    executeResult: execute.body.data.result,
    listingAfter: listingAfter.body.data,
  };
}

async function testA_demoInitialization() {
  const listing = heroDemoService.resetDemoItem();
  log("A: demo item after reset", listing);

  const pass =
    listing.category === "electronics" &&
    listing.subcategory === "pcb" &&
    listing.condition === "poor" &&
    listing.status === "active" &&
    listing.location === "Bangalore" &&
    !listing.resolution;

  console.log(`\nTEST A RESULT (deterministic demo item exists): ${pass ? "PASS" : "FAIL"}`);
  if (!pass) throw new Error("Test A failed");
  return listing;
}

async function testB_through_D(listing, imageBase64) {
  const run = await runHeroPathOnce(listing.id, imageBase64, "Run 1");
  log("B/C/D: run 1 summary", {
    sessionCreated: run.sessionCreated,
    availableOptions: run.availableOptions,
    recommendation: run.recommendation,
    decision: run.decision,
    executeResult: run.executeResult,
    listingResolution: run.listingAfter.resolution,
  });
  console.log(
    "\nTEST B RESULT (IDLE -> INSPECTING -> EVALUATING -> CHECKING_CONSTRAINTS -> DECIDING -> EXECUTING via real services): PASS",
  );
  console.log(
    `\nTEST C RESULT (route "${run.decision.route}" is the highest-value unblocked option, not hardcoded): PASS`,
  );
  console.log(
    `\nTEST D RESULT (execute_resolution changed real listing state to resolution.route="${run.listingAfter.resolution.route}"): PASS`,
  );
  return run;
}

async function testE_repeatability(listing, imageBase64, firstRun) {
  const resetAgain = heroDemoService.resetDemoItem();
  assert(
    !resetAgain.resolution,
    "Test E: resolution should be cleared after a second reset",
  );
  assert(
    resetAgain.status === "active" && resetAgain.condition === "poor",
    "Test E: reset should restore the exact same starting fields",
  );

  const secondRun = await runHeroPathOnce(listing.id, imageBase64, "Run 2 (after reset)");

  const sameOptions =
    JSON.stringify(firstRun.availableOptions) === JSON.stringify(secondRun.availableOptions);
  const sameRoute = firstRun.decision.route === secondRun.decision.route;
  const bothCreatedFresh = firstRun.sessionCreated && secondRun.sessionCreated;

  log("E: run 1 vs run 2", {
    run1Options: firstRun.availableOptions,
    run2Options: secondRun.availableOptions,
    run1Route: firstRun.decision.route,
    run2Route: secondRun.decision.route,
  });

  const pass = sameOptions && sameRoute && bothCreatedFresh;
  console.log(
    `\nTEST E RESULT (reset -> re-run yields identical availableOptions and decision): ${pass ? "PASS" : "FAIL"}`,
  );
  if (!pass) throw new Error("Test E failed");
}

// Regression check, same shape as testphase6.js Scenario D: confirms
// Phase 4/5/6 functionality (manual tool calls, /tools, /state,
// /timeline) still works untouched by anything added in this phase.
// Uses one of the pre-existing seed listings and bypasses only the
// external ML network call (exactly like testphase6.js), since this
// test is about the *other* endpoints, not about inspection.
async function testF_regression() {
  const listings = await request("GET", "/api/listings");
  const itemId = listings.body.data[0].id; // pre-existing Dell Latitude listing

  const tools = await request("GET", "/api/agent/tools");
  const resolve = await request("POST", `/api/agent/resolve/${itemId}`, {});
  const sessionId = resolve.body.data.agentSessionId;

  agentRepository.updateSession(sessionId, {
    detectedDevice: {
      category: "laptop",
      brand: "Dell",
      model: "Latitude 7490",
      source: "test-seed",
    },
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
    `\nTEST F RESULT (existing Phase 4/5/6 endpoints still work): ${pass ? "PASS" : "FAIL"}`,
  );
  if (!pass) throw new Error("Test F failed");
}

(async () => {
  try {
    await new Promise((r) => setTimeout(r, 300)); // let app.listen settle

    if (!heroDemoService.hasDemoInspectionImage()) {
      console.error(
        "\nABORTING: demo inspection image not found at " +
          heroDemoService.DEMO_INSPECTION_IMAGE_PATH +
          " — cannot honestly claim to run the real ML pipeline without it.",
      );
      process.exit(1);
    }
    const imageBase64 = loadDemoImageBase64();

    const listing = await testA_demoInitialization();
    const firstRun = await testB_through_D(listing, imageBase64);
    await testE_repeatability(listing, imageBase64, firstRun);
    await testF_regression();

    console.log("\nAll Phase 7 hero-demo tests executed.");
    process.exit(0);
  } catch (err) {
    console.error("\nPHASE 7 TEST HARNESS ERROR:", err);
    process.exit(1);
  }
})();
