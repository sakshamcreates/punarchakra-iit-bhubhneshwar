const express = require("express");
const agentController = require("../controllers/agentController");

const router = express.Router();

// No auth middleware, matching pickupRoutes.js — this is an
// operational/demo surface, not user-owned listing CRUD.

router.get("/tools", agentController.listTools);

router.post("/resolve/:itemId", agentController.resolveItem);
router.get("/state/:sessionId", agentController.getState);
router.get("/timeline/:sessionId", agentController.getTimeline);

router.post("/tool/:sessionId/:toolName", agentController.callTool);

// Phase 4: orchestrator-driven advance. Runs whichever tool the
// session's current status calls for (see agentOrchestrator), instead
// of the caller having to name the tool explicitly as above.
router.post("/advance/:sessionId", agentController.advance);

// Phase 10: demo-scoped control surface (hero demo / test only — see the
// controller). Kept on this router so the frontend reaches them through the
// existing /api/agent base URL.
router.get("/demo", agentController.getDemo);
router.get("/demo/image", agentController.getDemoImage);
router.get("/demo/scenarios", agentController.listDemoScenarios);
router.post("/demo/scenarios/:scenarioId", agentController.activateDemoScenario);
router.post("/demo/reset", agentController.resetDemo);
router.post("/demo/enable-failure", agentController.enableDemoFailure);

module.exports = router;
