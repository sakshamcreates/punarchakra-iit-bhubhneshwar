import apiClient from "./apiClient";

/*
 * Phase 10: frontend service layer for the existing /api/agent backend
 * (agentRoutes.js -> agentController.js -> agentOrchestrator /
 * agentStateService). This file owns zero agent logic of its own — it
 * only calls the real endpoints and unwraps { success, data } the same
 * way listingService.js already does for /listings.
 */

function unwrap(response) {
  return response && typeof response === "object" && "data" in response
    ? response.data
    : response;
}

// Starts a brand-new agent session for itemId, or resumes the existing
// active one — mirrors agentStateService.getOrCreateSession exactly.
export async function resolveItem(itemId, goal) {
  const response = await apiClient.post(`/agent/resolve/${itemId}`, goal ? { goal } : undefined);
  return unwrap(response);
}

export async function getState(sessionId) {
  const response = await apiClient.get(`/agent/state/${sessionId}`);
  return unwrap(response);
}

export async function getTimeline(sessionId) {
  const response = await apiClient.get(`/agent/timeline/${sessionId}`);
  return unwrap(response);
}

export async function listTools() {
  const response = await apiClient.get("/agent/tools");
  return unwrap(response);
}

// Advances the session exactly one stage, per agentOrchestrator's
// STATUS_TO_TOOL / DECIDING / OBSERVING / REPLANNING handling. `input`
// is only required when the current stage is IDLE (needs an image) —
// every other stage reads what it needs from the session itself.
export async function advance(sessionId, input) {
  try {
    const response = await apiClient.post(`/agent/advance/${sessionId}`, input || {});
    return unwrap(response);
  } catch (err) {
    // Phase 17 integration fix: agentController.advance intentionally
    // responds with a non-2xx status (e.g. 409) when
    // agentOrchestrator.advanceSession itself reports an { error }
    // (e.g. EXECUTING with no decided route) — see the controller's
    // `if (outcome.error) { return res.status(...).json({ ..., data:
    // outcome }) }` branch. apiClient throws on any non-ok response, so
    // without this, the caller-side `if (outcome.error)` handling in
    // AgentResolutionPage (which reads outcome.session/outcome.error)
    // was unreachable — a real orchestrator failure fell through to a
    // generic thrown Error instead, losing the session snapshot for
    // that turn. Recover the same structured outcome the 200 path
    // already returns, from the error body the backend already sends,
    // rather than changing the backend response shape or adding a new
    // endpoint.
    if (err && err.body && typeof err.body === "object" && "data" in err.body) {
      return err.body.data;
    }
    throw err;
  }
}

export async function callTool(sessionId, toolName, input) {
  const response = await apiClient.post(`/agent/tool/${sessionId}/${toolName}`, input || {});
  return unwrap(response);
}

// --------------------------------------------------------------
// Demo-scoped control surface (agentController's Phase 10 endpoints).
// These exist purely so the UI can drive the deterministic hero demo
// through the SAME backend a test harness would use — no agent logic
// lives here either.
// --------------------------------------------------------------

export async function getDemo() {
  const response = await apiClient.get("/agent/demo");
  return unwrap(response);
}

export async function resetDemo(scenarioId) {
  const response = await apiClient.post("/agent/demo/reset", scenarioId ? { scenarioId } : undefined);
  return unwrap(response);
}

export async function listDemoScenarios() {
  const response = await apiClient.get("/agent/demo/scenarios");
  return unwrap(response);
}

export async function activateDemoScenario(scenarioId) {
  const response = await apiClient.post(`/agent/demo/scenarios/${scenarioId}`);
  return unwrap(response);
}

export async function enableDemoFailure() {
  const response = await apiClient.post("/agent/demo/enable-failure");
  return unwrap(response);
}

export async function getDemoImage() {
  const response = await apiClient.get("/agent/demo/image");
  return unwrap(response);
}

export default {
  resolveItem,
  getState,
  getTimeline,
  listTools,
  advance,
  callTool,
  getDemo,
  resetDemo,
  listDemoScenarios,
  activateDemoScenario,
  enableDemoFailure,
  getDemoImage,
};
