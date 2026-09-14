const agentDecisionService = require("./agentDecisionService");
const { MAX_RESOLUTION_ATTEMPTS } = require("../constants/agentConstants");

/*
 * Punarchakra — Autonomous E-Waste Resolution Agent
 * Phase 9: Replanning policy (autonomous recovery after a failed attempt)
 *
 * Pure decision logic, mirroring the shape of agentDecisionService.decide:
 * given a session that has just OBSERVED a failed resolution attempt, this
 * module computes the next resolution route to try — or states plainly that
 * no viable alternative remains.
 *
 * Deliberately NOT a brittle orchestrator special-case like "if repair
 * fails, choose parts". It never sees a route name it didn't read from the
 * session, and it never picks an alternative itself:
 *
 *   1. Reads the session's observed failures (session.observations) and the
 *      previous decision (session.currentDecision) to identify the failed
 *      route + error code + reason.
 *   2. Excludes every failed/blocked route by marking it unavailable in
 *      session.constraints.routeAvailability — the SAME availability signal
 *      agentDecisionService.decide already consumes. No duplicate scoring.
 *   3. Reuses agentDecisionService.decide() unchanged on that updated view,
 *      so the "best remaining viable alternative" is chosen by the existing,
 *      already-audited decision policy (highest expected value among the
 *      still-available candidates), never hardcoded here.
 *   4. Produces a structured replan record (see the section 9.3 field list):
 *      previousDecision, failedRoute, failureReason, errorCode,
 *      excludedRoutes, consideredAlternatives, selectedAlternative,
 *      reason, attempt, timestamp.
 *
 * Loop protection (9.8): each replan adds the just-failed route to the
 * excluded set, and once session.attemptCount reaches MAX_RESOLUTION_ATTEMPTS
 * the policy refuses to propose further routes — the session then routes to
 * HUMAN_REVIEW / a safe terminal state (see agentStateService.runReplan).
 * Failed routes therefore can never be re-selected without a legitimate,
 * recorded reason.
 *
 * This module contains no state of its own and never writes to the
 * repository — agentStateService.runReplan owns the persistence + REPLAN
 * event.
 */

function createError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

// route -> availability entry lookup, same shape as
// agentDecisionService.buildAvailabilityLookup but for the entries list.
function buildEntryLookup(routeAvailability) {
  const lookup = new Map();
  if (Array.isArray(routeAvailability)) {
    routeAvailability.forEach((entry) => {
      if (entry && entry.route) {
        lookup.set(entry.route, entry);
      }
    });
  }
  return lookup;
}

/*
 * Returns:
 *   { viable: true,  updatedConstraints, replanRecord }
 *   { viable: false, updatedConstraints, replanRecord }
 *
 * `updatedConstraints` carries a routeAvailability view in which every
 * failed route is marked unavailable, ready for the next DECIDING run (so
 * agentDecisionService.decide naturally excludes them — the exact reuse the
 * phase requires). `replanRecord` is the structured, persistable record.
 */
function replan(session) {
  if (
    !session ||
    !Array.isArray(session.availableOptions) ||
    session.availableOptions.length === 0
  ) {
    throw createError(
      "replan() requires a session with availableOptions (run calculate_valuation first)",
      409,
    );
  }

  if (!session.constraints) {
    throw createError(
      "replan() requires a session with constraints (run check_constraints first)",
      409,
    );
  }

  const observations = Array.isArray(session.observations)
    ? session.observations
    : [];
  const lastObservation =
    observations.length > 0 ? observations[observations.length - 1] : null;

  const previousDecision = session.currentDecision || null;
  const failedRoute =
    (lastObservation && lastObservation.route) ||
    (previousDecision && previousDecision.route) ||
    null;
  const errorCode = (lastObservation && lastObservation.errorCode) || null;
  const failureReason =
    (lastObservation && lastObservation.reason) ||
    session.failureReason ||
    "resolution attempt failed";
  const attempt = session.attemptCount || 0;

  // ---- Step 2: exclude failed routes via the existing availability signal.
  const existingEntries = Array.isArray(
    session.constraints.routeAvailability,
  )
    ? JSON.parse(JSON.stringify(session.constraints.routeAvailability))
    : [];

  // Every route the agent has already OBSERVED failing is excluded. This is
  // the loop-protection accumulation: replan N+1 sees everything replan N
  // excluded plus the route that just failed at N+1's attempt.
  const blocked = new Map();
  existingEntries.forEach((entry) => {
    if (entry && entry.route && entry.available === false) {
      blocked.set(entry.route, {
        route: entry.route,
        available: false,
        reason: entry.reason || "route constrained",
      });
    }
  });
  observations
    .filter((o) => o.success === false && o.route)
    .forEach((o) => {
      blocked.set(o.route, {
        route: o.route,
        available: false,
        reason: `Execution failed (${o.errorCode || "EXECUTION_FAILURE"}): ${o.reason || "no reason recorded"}`,
      });
    });
  if (failedRoute) {
    blocked.set(failedRoute, {
      route: failedRoute,
      available: false,
      reason: `Execution failed (${errorCode || "EXECUTION_FAILURE"}): ${failureReason}`,
    });
  }

  const entryLookup = buildEntryLookup(existingEntries);
  const routeAvailability = existingEntries.map((entry) => {
    const blocker = blocked.get(entry.route);
    if (blocker) {
      return {
        ...entry,
        available: false,
        reason: blocker.reason || entry.reason || "route blocked",
      };
    }
    // Available entries for routes not failed stay authoritative.
    return { ...entry, available: true, reason: null };
  });
  blocked.forEach((blocker) => {
    if (!entryLookup.has(blocker.route)) {
      routeAvailability.push(blocker);
    }
  });

  // ---- Step 3: reuse the REAL decision policy on this availability view.
  const constraintsView = {
    ...(session.constraints || {}),
    routeAvailability,
  };
  const decision = agentDecisionService.decide({
    ...session,
    constraints: constraintsView,
  });

  const excludedRoutes = [...blocked.keys()];
  const maxedOut = attempt >= MAX_RESOLUTION_ATTEMPTS;
  const timestamp = new Date().toISOString();

  if (!decision.viable || maxedOut) {
    const reason = maxedOut
      ? `Maximum resolution attempts (${attempt}/${MAX_RESOLUTION_ATTEMPTS}) reached — refusing to retry further routes. ` +
        `Excluded routes: ${excludedRoutes.join(", ") || "none"}.`
      : decision.reason;

    return {
      viable: false,
      updatedConstraints: constraintsView,
      replanRecord: {
        previousDecision,
        failedRoute,
        failureReason,
        errorCode,
        excludedRoutes,
        consideredAlternatives: decision.consideredOptions || [],
        selectedAlternative: null,
        viable: false,
        reason,
        attempt,
        timestamp,
      },
    };
  }

  return {
    viable: true,
    updatedConstraints: constraintsView,
    replanRecord: {
      previousDecision,
      failedRoute,
      failureReason,
      errorCode,
      excludedRoutes,
      consideredAlternatives: decision.consideredOptions || [],
      selectedAlternative: {
        route: decision.route,
        expectedValue: decision.selectedValue,
      },
      viable: true,
      reason:
        `Excluded failed route(s): ${excludedRoutes.join(", ")}. Selected ` +
        `"${decision.route}" (${decision.selectedValue}) as the highest-value ` +
        `remaining viable alternative. ${decision.reason}`,
      attempt,
      timestamp,
    },
  };
}

module.exports = {
  replan,
};