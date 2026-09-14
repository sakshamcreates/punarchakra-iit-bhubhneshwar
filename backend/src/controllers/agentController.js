const fs = require("fs");
const path = require("path");
const agentStateService = require("../services/agentStateService");
const agentOrchestrator = require("../services/agentOrchestrator");
const heroDemoService = require("../services/heroDemoService");
const demoEnvironmentService = require("../services/demoEnvironmentService");

function resolveItem(req, res, next) {
  try {
    const { session, created } = agentStateService.getOrCreateSession(
      req.params.itemId,
      req.body && req.body.goal,
    );

    return res.status(created ? 201 : 200).json({
      success: true,
      message: created
        ? "Agent session started"
        : "Existing agent session returned",
      data: session,
    });
  } catch (error) {
    next(error);
  }
}

function getState(req, res, next) {
  try {
    const session = agentStateService.getState(req.params.sessionId);
    return res.json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
}

function getTimeline(req, res, next) {
  try {
    const events = agentStateService.getTimeline(req.params.sessionId);
    return res.json({ success: true, data: events });
  } catch (error) {
    next(error);
  }
}

function listTools(req, res, next) {
  try {
    const tools = agentStateService.listTools();
    return res.json({ success: true, data: tools });
  } catch (error) {
    next(error);
  }
}

// Manual/test invocation of a single registered tool against a
// session. This exists so the tool registry + state machine +
// event log built in this phase are actually reachable and testable
// over the API before a real orchestrator (Phase 3) calls them
// automatically in sequence.
async function callTool(req, res, next) {
  try {
    const { sessionId, toolName } = req.params;
    const { session, result, error } = await agentStateService.runTool(
      sessionId,
      toolName,
      req.body,
    );

    if (error) {
      return res.status(error.status || 500).json({
        success: false,
        message: error.message,
        data: session,
      });
    }

    return res.json({
      success: true,
      data: { session, result },
    });
  } catch (error) {
    next(error);
  }
}

// Phase 4: minimal entry point into the orchestrator. Given an
// existing session, advances it exactly one stage according to its
// current status (see agentOrchestrator.STATUS_TO_TOOL). This is
// intentionally separate from resolveItem/callTool above — neither
// of those is changed — and does not implement decision/execution/
// verification/replanning; it only automates the "which tool comes
// next" choice that a manual caller of POST /tool/:sessionId/:toolName
// would otherwise have to make itself.
async function advance(req, res, next) {
  try {
    const { sessionId } = req.params;
    const outcome = await agentOrchestrator.advanceSession(sessionId, req.body);

    if (outcome.error) {
      return res.status(outcome.error.status || 500).json({
        success: false,
        message: outcome.error.message,
        data: outcome,
      });
    }

    return res.json({ success: true, data: outcome });
  } catch (error) {
    next(error);
  }
}

// --------------------------------------------------------------
// Phase 10: demo-scoped control surface (hero demo / test only)
// --------------------------------------------------------------
/*
 * These endpoints exist so the Phase 10 frontend can drive the SAME
 * deterministic hero demo the test harnesses drive — reset the hero
 * listing + active sessions, read the demo item id, enable the
 * REQUIRED_COMPONENT_UNAVAILABLE failure scenario, and fetch the demo
 * inspection photo for the real ML pipeline. Every call delegates to the
 * existing heroDemoService / demoEnvironmentService; nothing here
 * implements agent behavior. They are intentionally tiny and clearly
 * isolated from the rest of REST surface.
 */

function getDemo(req, res, next) {
  try {
    heroDemoService.ensureDemoItem();
    heroDemoService.ensureEnterpriseDemoData();
    // ensureEnterpriseDemoData() sets demoEnvironmentService.demoItemId to
    // "item-demo-001" (for the 4 enterprise scenarios). Restore it to the
    // hero item's actual UUID so that getScenarioByItemId() correctly maps
    // the hero item to the active failure scenario (via the
    // `itemId === demoItemId` branch in demoEnvironmentService.js#L83).
    demoEnvironmentService.setDemoItemId(heroDemoService.getDemoItemId());
    return res.json({
      success: true,
      data: {
        demoItemId: heroDemoService.getDemoItemId(),
        simulation: demoEnvironmentService.getSimulationState(),
        scenarios: demoEnvironmentService.listScenarios(),
        hasDemoImage: heroDemoService.hasDemoInspectionImage(),
        demoImagePath: heroDemoService.DEMO_INSPECTION_IMAGE_PATH,
      },
    });
  } catch (error) {
    next(error);
  }
}

function resetDemo(req, res, next) {
  try {
    const scenarioId = req.body && req.body.scenarioId;
    const data = scenarioId
      ? heroDemoService.resetEnterpriseDemo(scenarioId)
      : { listing: heroDemoService.resetDemoItem(), simulation: demoEnvironmentService.getSimulationState() };
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

function enableDemoFailure(req, res, next) {
  try {
    heroDemoService.ensureDemoItem();
    heroDemoService.ensureEnterpriseDemoData();
    // Restore hero item id after ensureEnterpriseDemoData overwrites it
    demoEnvironmentService.setDemoItemId(heroDemoService.getDemoItemId());
    demoEnvironmentService.enableRequiredComponentUnavailable();
    return res.json({
      success: true,
      data: demoEnvironmentService.getSimulationState(),
    });
  } catch (error) {
    next(error);
  }
}

function listDemoScenarios(req, res, next) {
  try {
    heroDemoService.ensureEnterpriseDemoData();
    return res.json({ success: true, data: demoEnvironmentService.listScenarios() });
  } catch (error) {
    next(error);
  }
}

function activateDemoScenario(req, res, next) {
  try {
    const scenarioId = req.params.scenarioId || (req.body && req.body.scenarioId);
    const listing = heroDemoService.resetScenario(scenarioId);
    return res.json({
      success: true,
      data: {
        listing,
        scenario: demoEnvironmentService.getScenario(scenarioId),
        simulation: demoEnvironmentService.getSimulationState(),
      },
    });
  } catch (error) {
    next(error);
  }
}

function getDemoImage(req, res, next) {
  try {
    if (!heroDemoService.hasDemoInspectionImage()) {
      return res.status(404).json({
        success: false,
        message: "Demo inspection image is not present on this deployment.",
      });
    }
    const file = fs.readFileSync(heroDemoService.DEMO_INSPECTION_IMAGE_PATH);
    return res.json({
      success: true,
      data: {
        base64: file.toString("base64"),
        mimetype: "image/jpeg",
        filename: path.basename(heroDemoService.DEMO_INSPECTION_IMAGE_PATH),
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  resolveItem,
  getState,
  getTimeline,
  listTools,
  callTool,
  advance,
  getDemo,
  resetDemo,
  enableDemoFailure,
  listDemoScenarios,
  activateDemoScenario,
  getDemoImage,
};
