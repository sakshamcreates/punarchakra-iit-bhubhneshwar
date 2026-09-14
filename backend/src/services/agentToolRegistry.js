/*
 * Generic agent tool registry.
 *
 * This file has zero Punarchakra domain logic on purpose — it only
 * knows how to hold named tools and call them. The real tool
 * implementations (inspect_item, calculate_valuation, ...) live in
 * agentTools.js and register themselves here. This split means the
 * eventual orchestrator/agent loop (Phase 3+) only ever depends on
 * this generic interface, never on individual services directly.
 */

const tools = new Map();

function createError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

// definition: { name, description, handler: async (input, context) => output }
function registerTool(definition) {
  if (!definition || typeof definition.name !== 'string' || !definition.name) {
    throw createError('Tool definition requires a name');
  }

  if (typeof definition.handler !== 'function') {
    throw createError(`Tool "${definition.name}" requires a handler function`);
  }

  tools.set(definition.name, {
    name: definition.name,
    description: definition.description || '',
    handler: definition.handler
  });
}

function getTool(name) {
  return tools.get(name) || null;
}

function listTools() {
  return Array.from(tools.values()).map(({ name, description }) => ({ name, description }));
}

// Calls a tool by name. Never invents a result: on failure it lets the
// handler's error propagate (or throws a NOT_FOUND) instead of
// returning fabricated output — required by "Do NOT implement fake
// tool outputs" / "Do NOT make the LLM invent tool results."
async function callTool(name, input, context) {
  const tool = getTool(name);

  if (!tool) {
    throw createError(`Unknown tool: ${name}`, 404);
  }

  return tool.handler(input, context);
}

module.exports = {
  registerTool,
  getTool,
  listTools,
  callTool
};
