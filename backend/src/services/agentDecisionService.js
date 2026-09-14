/*
 * Punarchakra — Autonomous E-Waste Resolution Agent
 * Phase 6: Agent Decision Loop — decision policy
 *
 * Pure decision logic. Given a session that has already been through
 * inspect_item -> calculate_valuation -> check_constraints, this
 * module decides which resolution route (if any) is currently
 * executable.
 *
 * Explicitly out of scope here (see agentStateService.buildAvailableOptions
 * and aiDecisionService.evaluate, which already own this):
 *   - computing monetary values for any route
 *   - deciding which route the valuation engine calls "recommended"
 *   - scoring/ranking logic that duplicates aiDecisionService
 *
 * This module only:
 *   1. Reads session.availableOptions (route + expectedValue), built
 *      by agentStateService from aiDecisionService.evaluate() output.
 *   2. Reads session.constraints.routeAvailability (route + available
 *      + reason), built by agentTools.checkConstraints from real,
 *      already-enforced execution-time constraints (see that file).
 *   3. Excludes options check_constraints has marked unavailable.
 *   4. Picks the highest-expectedValue option that remains.
 *
 * No route name is ever hardcoded into the selection logic — the
 * policy operates on whatever routes/values happen to be present in
 * availableOptions, so it behaves the same whether there are 2 routes
 * or 6, and whichever specific route is blocked.
 */

function createError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

// route -> { available, reason } lookup from
// session.constraints.routeAvailability. A route with no explicit
// entry is treated as available — check_constraints only lists
// exceptions, not a verdict for every route every time. This also
// keeps decide() backward-compatible with any session created before
// routeAvailability existed (falls back to "everything available").
function buildAvailabilityLookup(constraints) {
  const lookup = new Map();
  const entries =
    constraints && Array.isArray(constraints.routeAvailability)
      ? constraints.routeAvailability
      : [];

  entries.forEach((entry) => {
    if (entry && entry.route) {
      lookup.set(entry.route, entry);
    }
  });

  return lookup;
}

// Given a session (currentDecision/previousDecision/decisionHistory
// are read but not required — decide() is safe to call on the first
// decision for a session), returns:
//
//   { viable: true, route, selectedValue, reason, consideredOptions, excludedOptions, decidedAt }
// or
//   { viable: false, route: null, reason, consideredOptions, excludedOptions, decidedAt }
//
// Never throws for "no viable route" — that is a legitimate decision
// outcome, not an error. It only throws if the session is missing the
// upstream data (availableOptions / constraints) decide() needs to run
// at all, which should not happen once the state machine has actually
// reached DECIDING.
function decide(session) {
  if (
    !session ||
    !Array.isArray(session.availableOptions) ||
    session.availableOptions.length === 0
  ) {
    throw createError(
      "decide() requires a session with availableOptions (run calculate_valuation first)",
      409,
    );
  }

  if (!session.constraints) {
    throw createError(
      "decide() requires a session with constraints (run check_constraints first)",
      409,
    );
  }

  const availabilityLookup = buildAvailabilityLookup(session.constraints);

  const consideredOptions = session.availableOptions.map((option) => {
    const availability = availabilityLookup.get(option.route);
    const blocked = Boolean(availability) && availability.available === false;

    return {
      route: option.route,
      expectedValue: option.expectedValue,
      available: !blocked,
      blockReason: blocked ? availability.reason || "BLOCKED" : null,
    };
  });

  const excludedOptions = consideredOptions.filter(
    (option) => !option.available,
  );

  const viableOptions = consideredOptions
    .filter(
      (option) => option.available && typeof option.expectedValue === "number",
    )
    .sort((a, b) => b.expectedValue - a.expectedValue);

  const decidedAt = new Date().toISOString();

  if (viableOptions.length === 0) {
    return {
      viable: false,
      route: null,
      selectedValue: null,
      reason:
        excludedOptions.length > 0
          ? `No currently executable resolution route remains — all ${excludedOptions.length} candidate route(s) are blocked (${excludedOptions
              .map((o) => `${o.route}: ${o.blockReason}`)
              .join("; ")}).`
          : "No currently executable resolution route remains — no candidate routes had a usable expected value.",
      consideredOptions,
      excludedOptions,
      decidedAt,
    };
  }

  const selected = viableOptions[0];
  const runnerUp = viableOptions[1] || null;
  const recommendation = session.valuation && session.valuation.recommendation;
  const engineRecommendedBlocked =
    recommendation &&
    excludedOptions.find((o) => o.route === recommendation.route);

  let reason;
  if (recommendation && recommendation.route === selected.route) {
    reason =
      `Selected "${selected.route}" (expected value ${selected.expectedValue}) — matches the valuation ` +
      `engine's recommended route. Engine reason: ${recommendation.reason}` +
      (excludedOptions.length > 0
        ? ` Excluded: ${excludedOptions.map((o) => `${o.route} (${o.blockReason})`).join(", ")}.`
        : "");
  } else if (engineRecommendedBlocked) {
    reason =
      `Valuation engine recommended "${recommendation.route}" but it is currently unavailable ` +
      `(${engineRecommendedBlocked.blockReason}). Selected "${selected.route}" (expected value ` +
      `${selected.expectedValue}) as the highest-value route still viable` +
      (runnerUp
        ? `, ahead of "${runnerUp.route}" (${runnerUp.expectedValue}).`
        : ".");
  } else {
    reason =
      `Selected "${selected.route}" (expected value ${selected.expectedValue}) as the highest-value ` +
      `currently viable option` +
      (runnerUp
        ? `, ahead of "${runnerUp.route}" (${runnerUp.expectedValue}).`
        : ".") +
      (excludedOptions.length > 0
        ? ` Excluded: ${excludedOptions.map((o) => `${o.route} (${o.blockReason})`).join(", ")}.`
        : "");
  }

  return {
    viable: true,
    route: selected.route,
    selectedValue: selected.expectedValue,
    reason,
    consideredOptions,
    excludedOptions,
    decidedAt,
  };
}

module.exports = {
  decide,
};
