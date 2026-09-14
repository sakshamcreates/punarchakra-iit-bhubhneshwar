const {
  DEMO_REQUIRED_COMPONENT_LABEL,
  DEMO_REPAIR_SUPPLIER_NET_VALUE,
} = require("../data/heroDemoData");
const { DEMO_SCENARIOS, DEMO_ITEMS, DEMO_CUSTOMERS, DEMO_CASES } = require("../data/demo/demoData");

const REQUIRED_COMPONENT_UNAVAILABLE = "REQUIRED_COMPONENT_UNAVAILABLE";

let failureSimulation = {
  enabled: false,
  scenario: REQUIRED_COMPONENT_UNAVAILABLE,
};

let demoItemId = null;
let activeScenarioId = null;
const availabilityOverrides = new Map();
const policyOverrides = new Map();

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function setDemoItemId(id) {
  demoItemId = id;
}

function enableRequiredComponentUnavailable() {
  failureSimulation = { ...failureSimulation, enabled: true };
  activeScenarioId = "SCENARIO_FAILURE_REPLAN";
}

function reset() {
  failureSimulation = { ...failureSimulation, enabled: false };
  activeScenarioId = null;
  availabilityOverrides.clear();
  policyOverrides.clear();
}

function setActiveScenario(scenarioId) {
  if (!DEMO_SCENARIOS[scenarioId]) {
    const error = new Error(`Unknown demo scenario: ${scenarioId}`);
    error.status = 404;
    throw error;
  }
  activeScenarioId = scenarioId;
  failureSimulation = {
    ...failureSimulation,
    enabled: scenarioId === "SCENARIO_FAILURE_REPLAN",
  };
  return getScenario(scenarioId);
}

function getScenario(scenarioId) {
  const scenario = DEMO_SCENARIOS[scenarioId];
  return scenario ? clone(scenario) : null;
}

function listScenarios() {
  return Object.values(DEMO_SCENARIOS).map((scenario) => ({
    id: scenario.id,
    caseId: scenario.caseId,
    itemId: scenario.itemId,
  }));
}

function getScenarioByItemId(itemId) {
  if (!itemId) return null;
  if (activeScenarioId && DEMO_SCENARIOS[activeScenarioId]?.itemId === itemId) {
    return DEMO_SCENARIOS[activeScenarioId];
  }
  const byItem = Object.values(DEMO_SCENARIOS).find((scenario) => scenario.itemId === itemId) || null;
  if (byItem) {
    return byItem;
  }
  // Phase 7 hero demo item: heroDemoService gives it a runtime listing
  // id (bound here via setDemoItemId), so it never matches a scenario's
  // itemId. It takes part in the deterministic failure scenario ONLY
  // while that scenario is active — repair is then a decision-eligible
  // candidate (SCENARIO_FAILURE_REPLAN routeOptions) and fails at
  // execution time with REQUIRED_COMPONENT_UNAVAILABLE. Without an
  // active scenario the hero item is plain/non-demo-scoped: no repair
  // or inventory candidate is fabricated for it (Phase 12 Test B4).
  if (activeScenarioId && DEMO_SCENARIOS[activeScenarioId] && itemId === demoItemId) {
    return DEMO_SCENARIOS[activeScenarioId];
  }
  return null;
}

function isScenarioActive(session, scenario) {
  return Boolean(
    scenario &&
      session &&
      typeof session.itemId === "string" &&
      (session.itemId === scenario.itemId || session.itemId === demoItemId),
  );
}

function getSimulationState() {
  const scenario = activeScenarioId ? DEMO_SCENARIOS[activeScenarioId] : null;
  return {
    ...failureSimulation,
    activeScenarioId,
    targetRoute: "repair",
    demoItemId,
    scenarioItemId: scenario ? scenario.itemId : null,
    component: { label: DEMO_REQUIRED_COMPONENT_LABEL },
    scenarios: listScenarios(),
  };
}

function getRouteOptions(session) {
  const scenario = getScenarioByItemId(session && session.itemId);
  if (!isScenarioActive(session, scenario)) {
    return null;
  }
  return clone(scenario.routeOptions);
}

function getRepairRouteOption(session) {
  const options = getRouteOptions(session);
  if (!options) {
    return null;
  }
  const repair = options.find((option) => option.route === "repair");
  if (!repair) {
    return null;
  }
  return {
    route: repair.route,
    expectedValue: repair.expectedValue || DEMO_REPAIR_SUPPLIER_NET_VALUE,
    source: "demo-repair-supplier",
  };
}

function getRouteAvailability(session) {
  const scenario = getScenarioByItemId(session && session.itemId);
  if (!isScenarioActive(session, scenario)) {
    return null;
  }

  const override = availabilityOverrides.get(scenario.id) || {};
  const policyOverride = policyOverrides.get(scenario.id) || {};
  const availability = { ...(scenario.availability || {}), ...override };
  const policy = { ...(scenario.policy || {}), ...policyOverride };

  return (session.availableOptions || scenario.routeOptions || []).map((option) => {
    const route = option.route;
    const available = availability[route] !== false && policy[route] !== false;
    let reason = null;
    if (policy[route] === false) {
      reason = `POLICY_BLOCKED_${String(route).toUpperCase()}`;
    } else if (availability[route] === false) {
      reason = `UNAVAILABLE_${String(route).toUpperCase()}`;
    }
    return { route, available, reason };
  });
}

function setRouteAvailability(scenarioId, route, available) {
  if (!DEMO_SCENARIOS[scenarioId]) {
    const error = new Error(`Unknown demo scenario: ${scenarioId}`);
    error.status = 404;
    throw error;
  }
  const value = Boolean(available);
  const existingAvailability = availabilityOverrides.get(scenarioId) || {};
  const existingPolicy = policyOverrides.get(scenarioId) || {};
  // A constraint-switch scenario can gate a route on supply availability
  // AND on policy at once (SCENARIO_CONSTRAINT_SWITCH blocks repair via
  // both). The override must lift BOTH gates together, otherwise
  // getRouteAvailability keeps reporting the route as blocked by policy
  // and the demonstration route selection cannot actually change.
  availabilityOverrides.set(scenarioId, { ...existingAvailability, [route]: value });
  policyOverrides.set(scenarioId, { ...existingPolicy, [route]: value });
  return getScenario(scenarioId);
}

function getExecutionFailure({ route, session }) {
  const scenario = getScenarioByItemId(session && session.itemId);
  if (!isScenarioActive(session, scenario)) {
    return null;
  }

  const code = scenario.failures && scenario.failures[route];
  if (!code) {
    return null;
  }

  if (code === REQUIRED_COMPONENT_UNAVAILABLE) {
    return {
      success: false,
      errorCode: REQUIRED_COMPONENT_UNAVAILABLE,
      route,
      reason: `Required repair component is unavailable: ${DEMO_REQUIRED_COMPONENT_LABEL} (out of stock at execution time).`,
      source: "demo-environment-repair-supply",
    };
  }

  return {
    success: false,
    errorCode: code,
    route,
    reason: `Demo environment blocked route ${route}: ${code}`,
    source: "demo-environment",
  };
}

function isDemoDataRandomFree() {
  const serialized = JSON.stringify({ DEMO_SCENARIOS, DEMO_ITEMS, DEMO_CUSTOMERS, DEMO_CASES });
  return !/Math\.random|randomUUID|uuidv4|Date\.now/.test(serialized);
}

module.exports = {
  setDemoItemId,
  enableRequiredComponentUnavailable,
  reset,
  getSimulationState,
  getRepairRouteOption,
  getRouteOptions,
  getRouteAvailability,
  getExecutionFailure,
  REQUIRED_COMPONENT_UNAVAILABLE,
  setActiveScenario,
  getScenario,
  listScenarios,
  getScenarioByItemId,
  setRouteAvailability,
  isDemoDataRandomFree,
};
