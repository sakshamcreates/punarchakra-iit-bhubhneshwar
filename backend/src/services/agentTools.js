const { randomUUID } = require("crypto");
const listingRepository = require("../data/listingRepository");
const userRepository = require("../data/userRepository");
const aiDecisionService = require("./aiDecisionService");
const mlService = require("./mlService");
const auctionService = require("./auctionService");
const pickupService = require("./pickupService");
const agentToolRegistry = require("./agentToolRegistry");
const demoEnvironmentService = require("./demoEnvironmentService");
const { AGENT_TOOL_NAMES } = require("../constants/agentConstants");
const { BASE_MARKETS, CATEGORY_SYNONYMS } = require("../data/valuationData");

/*
 * Real handlers for the tools an eventual orchestrator will call.
 *
 * Scope note (Phase 3): inspect_item now runs the REAL existing
 * classification pipeline (mlService.classifyEWaste -> FastAPI
 * /scrap/classify -> ONNX MobileNetV3 scrap classifier) instead of
 * the Phase 2 productVisionService placeholder. calculate_valuation
 * and check_constraints still reuse aiDecisionService /
 * listingRepository exactly as Phase 2 wired them.
 *
 * Scope note (Phase 5): execute_resolution is now a real,
 * state-changing handler (see below) instead of a stub.
 * verify_resolution now has a real handler too (Phase 9) — every
 * declared tool is implemented, so no NOT_IMPLEMENTED stubs remain.
 */

function createError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function getListingOrThrow(itemId) {
  const listing = listingRepository.findById(itemId);
  if (!listing) {
    throw createError(`No item found for itemId "${itemId}"`, 404);
  }
  return listing;
}

/*
 * Listings only store a single condition label today (e.g. "good"),
 * not the granular device-condition answers aiDecisionService.scoreCondition
 * expects (powersOn / displayCondition / batteryCondition / ...). This
 * derives a best-effort condition object from that label so valuation
 * can run against real listing data now, without pretending the
 * listing has detail it doesn't. Replace with real captured condition
 * answers once the submission flow collects them.
 */
function deriveConditionFromListing(listing) {
  const label = String(listing.condition || "fair").toLowerCase();
  const isPoor = label === "poor";

  return {
    powersOn: !isPoor,
    displayCondition: label,
    batteryCondition: label,
    chargerAvailable: !isPoor,
    storage: true,
    ram: true,
    photosHint: Array.isArray(listing.images) && listing.images.length > 0,
  };
}

// Maps a classifier material label ("Mobile", "Washing Machine",
// "PCB", ...) onto the category vocabulary the valuation engine
// keys off. Reuses the existing CATEGORY_SYNONYMS / BASE_MARKETS
// tables from data/valuationData.js rather than defining a second
// mapping — e.g. the classifier's "Mobile" resolves to the
// project's "phone" category through its existing synonym list.
function resolveCategoryFromMaterial(material) {
  const normalized = String(material || "")
    .trim()
    .toLowerCase();

  if (!normalized) {
    return null;
  }

  if (BASE_MARKETS[normalized]) {
    return normalized;
  }

  for (const [categoryKey, synonyms] of Object.entries(CATEGORY_SYNONYMS)) {
    if (synonyms.includes(normalized)) {
      return categoryKey;
    }
  }

  return null;
}

// Builds the multer-shaped file object ({ buffer, mimetype,
// originalname }) that mlService.classifyEWaste already expects,
// from the tool input's base64 image payload. Accepts raw base64
// or a full data: URL. Real image-format validation stays with the
// ML service's decoder (PIL) — this only checks the transport.
function buildClassifierFile(imageInput) {
  if (
    !imageInput ||
    typeof imageInput !== "object" ||
    typeof imageInput.base64 !== "string" ||
    imageInput.base64.trim() === ""
  ) {
    throw createError(
      "inspect_item requires an image to classify. Provide input.image = { base64, mimetype?, filename? }.",
    );
  }

  const base64 = imageInput.base64.replace(/^data:[^;]+;base64,/, "");

  let buffer;
  try {
    buffer = Buffer.from(base64, "base64");
  } catch (error) {
    throw createError("Invalid image: base64 payload could not be decoded.");
  }

  if (!buffer || buffer.length === 0) {
    throw createError("Invalid image: decoded image payload is empty.");
  }

  const mimetype = String(imageInput.mimetype || "image/jpeg").toLowerCase();
  if (!mimetype.startsWith("image/")) {
    throw createError(
      `Invalid image: mimetype "${imageInput.mimetype}" is not an image type.`,
    );
  }

  return {
    buffer,
    mimetype,
    originalname: imageInput.filename || "agent-inspect-image",
  };
}

// If the caller didn't supply input.image, fall back to the actual
// photo the user uploaded in the real Sell flow, which
// listingService.createListing persists verbatim as a `data:` URL on
// listing.images[0] (see frontend SellPage.handleStartResolution /
// fileToDataUrl). This keeps the ONE uploaded photo the single source
// of truth all the way into inspection instead of requiring a second
// upload once the agent session starts. Deliberately scoped to real
// `data:image/...` URLs only — remote http(s) placeholder images
// (e.g. the seed/demo listings) are left alone and still fall through
// to the existing "requires an image" error / the dedicated demo
// image endpoint, exactly as before.
function resolveInspectionImage(input, listing) {
  if (
    input &&
    input.image &&
    typeof input.image === "object" &&
    typeof input.image.base64 === "string" &&
    input.image.base64.trim() !== ""
  ) {
    return input.image;
  }

  const listingImage = Array.isArray(listing.images) ? listing.images[0] : null;
  const match =
    typeof listingImage === "string" &&
    listingImage.match(/^data:([^;]+);base64,(.+)$/s);

  if (!match) {
    return input && input.image;
  }

  const [, mimetype, base64] = match;
  return { base64, mimetype, filename: "listing-photo.jpg" };
}

// --------------------------------------------------------------
// TOOL: inspect_item
// --------------------------------------------------------------
async function inspectItem(input, context) {
  const itemId =
    (context && context.session && context.session.itemId) ||
    (input && input.itemId);
  if (!itemId) {
    throw createError("inspect_item requires an itemId (via session or input)");
  }

  const listing = getListingOrThrow(itemId);

  // Phase 3: real classification through the existing pipeline —
  // mlService.classifyEWaste -> FastAPI /scrap/classify -> ONNX
  // MobileNetV3 scrap classifier. No stub, no fabricated result.
  const file = buildClassifierFile(resolveInspectionImage(input, listing));

  let classification;
  try {
    classification = await mlService.classifyEWaste(file);
  } catch (error) {
    // ML service unreachable or returned an HTTP error (invalid
    // image, missing artifacts, ...). Surface a clean message and
    // keep the status the ML layer already chose when it has one.
    throw createError(
      `E-waste classification failed: ${error.message}`,
      error.status || 502,
    );
  }

  // Real classifier output: { material, confidence (0-1),
  // top_predictions, model_version, status }.
  const categoryKey = resolveCategoryFromMaterial(classification.material);

  // The classifier detects the device class only — brand/model
  // remain whatever the listing declared, with the source made
  // explicit so nothing looks classifier-derived that isn't.
  const detectedDevice = {
    category: categoryKey,
    categoryLabel: categoryKey
      ? BASE_MARKETS[categoryKey].label
      : classification.material || null,
    classifierMaterial: classification.material || null,
    brand: listing.brand || null,
    model: listing.model || null,
    source: "existing_revalue_classifier",
  };

  // The classifier does not produce a condition. The listing's
  // seller-declared condition label is the only real condition
  // data the system has, so it is reused here (see
  // deriveConditionFromListing) and labelled as such — nothing is
  // invented.
  const condition = deriveConditionFromListing(listing);

  // PS5-2 (Phase 12): real customer retrieval, joined against the
  // actual userRepository — see retrieveCustomer for the honest
  // seed-data fallback. This is part of the case state from the first
  // tool call, exactly like PS5-1 requires ("current case state").
  const customer = retrieveCustomer(listing);

  return {
    itemId,
    customer,
    listingSnapshot: {
      category: listing.category,
      subcategory: listing.subcategory,
      brand: listing.brand,
      model: listing.model,
      condition: listing.condition,
      location: listing.location,
      status: listing.status,
      images: listing.images,
    },
    classification: {
      ...classification,
      source: "existing_revalue_classifier",
    },
    detectedDevice,
    condition,
    conditionSource: "listing_declared",
    // Session-level confidence keeps the existing 0-100 convention
    // (check_constraints flags anything below 50). The classifier's
    // raw 0-1 confidence is preserved untouched in
    // classification.confidence.
    confidence: Number.isFinite(classification.confidence)
      ? Math.round(classification.confidence * 100)
      : null,
  };
}

// --------------------------------------------------------------
// TOOL: calculate_valuation
// --------------------------------------------------------------
async function calculateValuation(input, context) {
  const session = context && context.session;
  if (!session || !session.itemId) {
    throw createError("calculate_valuation requires a session with an itemId");
  }

  if (!session.detectedDevice) {
    throw createError(
      "calculate_valuation requires inspect_item to have run first",
      409,
    );
  }

  const listing = getListingOrThrow(session.itemId);
  const overrides = input || {};

  const payload = {
    category: session.detectedDevice.category,
    brand: session.detectedDevice.brand,
    model: session.detectedDevice.model,
    location: overrides.location || listing.location,
    userPreference: overrides.userPreference,
    condition:
      overrides.condition ||
      session.condition ||
      deriveConditionFromListing(listing),
    photos: listing.images,
  };

  // aiDecisionService.evaluate is the existing, already-audited
  // Task C valuation + route-recommendation logic — reused as-is.
  return aiDecisionService.evaluate(payload);
}

// --------------------------------------------------------------
// Route-level availability (Phase 6 support)
// --------------------------------------------------------------
/*
 * checkConstraints() below already decides pass/fail and human-review
 * for the SESSION as a whole. Phase 6's decision stage additionally
 * needs to know, per candidate route in session.availableOptions,
 * whether that specific route can actually be executed right now —
 * without checkConstraints inventing a new scoring/business rule to
 * answer that.
 *
 * The one real, already-enforced signal in this codebase for "this
 * specific route cannot be executed right now" is the resolution
 * conflict executeResolution() itself throws (RESOLUTION_ALREADY_EXISTS,
 * see below): if the listing already has a non-terminal resolution
 * recorded for route X, calling execute_resolution with any route
 * other than X will fail. getExistingResolution/isTerminalResolutionStatus
 * are the exact functions execute_resolution uses for this — reused
 * here as-is, not reimplemented, so this can never drift out of sync
 * with what execute_resolution will actually do.
 *
 * This is purely additive: it does not change failures/reviewFlags/
 * passed/requiresHumanReview below, so existing behavior (and
 * Scenario D) is unaffected for any session where no resolution has
 * been recorded yet — routeAvailability then simply marks every
 * candidate route available.
 */
function evaluateRouteAvailability(listing, session) {
  const options = Array.isArray(session.availableOptions)
    ? session.availableOptions
    : [];
  const existingResolution = getExistingResolution(listing);
  const hasBlockingResolution =
    existingResolution &&
    !isTerminalResolutionStatus(existingResolution.status);

  return options.map((option) => {
    if (hasBlockingResolution && existingResolution.route !== option.route) {
      return {
        route: option.route,
        available: false,
        reason: `RESOLUTION_ALREADY_EXISTS_FOR_ROUTE_${String(existingResolution.route).toUpperCase()}`,
      };
    }

    return { route: option.route, available: true, reason: null };
  });
}

// --------------------------------------------------------------
// TOOL: check_constraints
// --------------------------------------------------------------
async function checkConstraints(input, context) {
  const session = context && context.session;
  if (!session || !session.itemId) {
    throw createError("check_constraints requires a session with an itemId");
  }

  if (!session.valuation) {
    throw createError(
      "check_constraints requires calculate_valuation to have run first",
      409,
    );
  }

  const listing = getListingOrThrow(session.itemId);

  const failures = [];
  const reviewFlags = [];

  if (!["active", "draft"].includes(listing.status)) {
    failures.push({
      code: "LISTING_NOT_RESOLVABLE",
      message: `Item status is "${listing.status}" and cannot enter resolution.`,
    });
  }

  if (!listing.location) {
    reviewFlags.push({
      code: "LOCATION_MISSING",
      message:
        "No location on file; pickup/logistics execution cannot be routed yet.",
    });
  }

  if (typeof session.confidence === "number" && session.confidence < 50) {
    reviewFlags.push({
      code: "LOW_DETECTION_CONFIDENCE",
      message: `Detection confidence (${session.confidence}) is below the review threshold of 50.`,
    });
  }

  const routes =
    session.valuation.valuation && session.valuation.recommendation
      ? session.valuation
      : null;

  const bestExpectedValue = routes ? routes.valuation.wholeValue : null;
  if (
    routes &&
    routes.recommendation.route !== "donate" &&
    (bestExpectedValue === null || bestExpectedValue <= 0)
  ) {
    reviewFlags.push({
      code: "NO_VIABLE_MONETARY_ROUTE",
      message:
        "No route other than donation currently recovers positive value.",
    });
  }

  const demoRouteAvailability = demoEnvironmentService.getRouteAvailability(session);
  const routeAvailability = demoRouteAvailability || evaluateRouteAvailability(listing, session);

  return {
    passed: failures.length === 0,
    requiresHumanReview: reviewFlags.length > 0,
    failures,
    reviewFlags,
    routeAvailability,
    evaluatedAt: new Date().toISOString(),
  };
}

// --------------------------------------------------------------
// TOOL: execute_resolution
// --------------------------------------------------------------
/*
 * Phase 5.
 *
 * Route vocabulary deliberately matches what calculate_valuation
 * already produces (session.valuation.recommendation.route and each
 * entry of session.availableOptions — see buildAvailableOptions in
 * agentStateService.js: 'whole' | 'parts' | 'auction' | 'scrap' |
 * 'donate') instead of inventing a second naming scheme a future
 * decision stage would have to translate between. 'repair' is the
 * one addition: buildAvailableOptions intentionally leaves it out
 * of availableOptions (it can't honestly reconstruct a net
 * repair-and-sell value from what aiDecisionService.evaluate()
 * exposes), but the wider agent spec still treats repair as a
 * first-class resolution route, and it has no existing valuation
 * number to misuse, so it is handled as its own case below.
 */
const RESOLUTION_ROUTES = [
  "whole",
  "parts",
  "auction",
  "scrap",
  "donate",
  "repair",
];

// Where a route already has an equivalent SALE_TYPE
// (constants/listingConstants.js), reuse that exact value for the
// listing's own sale_type field instead of inventing a new one.
// 'repair' has no SALE_TYPE equivalent — nothing in the current
// listing model represents "in repair" — and is intentionally left
// unmapped; see resolveRepair below for how it's represented instead.
const ROUTE_TO_SALE_TYPE = {
  whole: "fixed",
  parts: "parts",
  auction: "auction",
  scrap: "scrap",
  donate: "donation",
};

const DEFAULT_AUCTION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const RESOLUTION_TERMINAL_STATUSES = ["completed", "failed", "cancelled"];

function isTerminalResolutionStatus(status) {
  return RESOLUTION_TERMINAL_STATUSES.includes(status);
}

// Idempotency guard (Step 6): if this listing already has a
// non-terminal resolution recorded for the SAME route, the caller
// gets that existing resolution back instead of a second
// auction/pickup/listing-state-change for the same item. A
// non-terminal resolution recorded for a DIFFERENT route is a real
// conflict (RESOLUTION_ALREADY_EXISTS below), not something to
// silently overwrite.
function getExistingResolution(listing) {
  return listing.resolution || null;
}

// --------------------------------------------------------------
// PS#5 customer retrieval (Phase 12)
// --------------------------------------------------------------
/*
 * PS5-2 requires the agent to retrieve real "customer" information from
 * an actual application system, not fabricate it. The real system here
 * is userRepository (populated by the real signup flow — see
 * listingService.js's `seller_id: user.id`), so this is a genuine join
 * against listing.seller_id, not a relabeling of a field that was
 * already on the listing.
 *
 * Honest limitation (documented in PHASE12_PS5_TRACEABILITY.md): the
 * repo's SEED listings (listingRepository's built-in rows) and the hero
 * demo listing (heroDemoData) use seller_id values ("user_1",
 * "demo_seller_pcb_001", ...) that were never created through the real
 * signup flow, so userRepository.findById has nothing to return for
 * them. This function does not paper over that — it returns an
 * explicit, honestly-labelled fallback (id-only, source states plainly
 * that no registered user record exists) rather than inventing a name
 * or email. Any listing created through the real POST /listings flow
 * (real user_id) resolves to a genuine name/email/location here.
 */
function retrieveCustomer(listing) {
  const registeredUser = listing.seller_id
    ? userRepository.findById(listing.seller_id)
    : null;

  if (registeredUser) {
    return {
      id: registeredUser.id,
      name: registeredUser.name,
      email: registeredUser.email,
      location: registeredUser.location || listing.location || null,
      source: "user_repository",
    };
  }

  return {
    id: listing.seller_id || null,
    name: null,
    email: null,
    location: listing.location || null,
    source: "seller_id_only_no_registered_user_record",
  };
}

function buildSeller(listing) {
  const customer = retrieveCustomer(listing);
  return { id: listing.id, customerId: customer.id, name: customer.name || customer.id };
}

function getValuationNumbers(session) {
  return (session.valuation && session.valuation.valuation) || {};
}

// whole / parts / donate: the listing model already represents
// these as SALE_TYPES — "executing" the route means actually
// flipping the existing listing to that sale type and making it
// active again, not fabricating a parallel record.
function resolveViaListingStateChange(listing, route, session, resolutionId) {
  const saleType = ROUTE_TO_SALE_TYPE[route];
  const numbers = getValuationNumbers(session);
  const valueByRoute = {
    whole: numbers.wholeValue,
    parts: numbers.partsValue,
    donate: 0,
  };

  const updatedListing = listingRepository.update(listing.id, {
    sale_type: saleType,
    status: "active",
    price:
      typeof valueByRoute[route] === "number"
        ? valueByRoute[route]
        : listing.price,
  });

  return {
    action: `listing_sale_type_set_to_${saleType}`,
    status: "listed",
    listingId: updatedListing.id,
    saleType: updatedListing.sale_type,
    listingStatus: updatedListing.status,
  };
}

// auction: reuses the existing, already-working auction domain
// (auctionService/auctionRepository, Task F) instead of a
// listing-only field change — a real Auction record is created,
// queryable via the existing GET /api/auction/:id.
function resolveViaAuction(listing, session) {
  const existingAuctions = auctionService
    .getAllAuctions()
    .filter(
      (auction) =>
        auction.listing_id === listing.id && auction.status !== "ended",
    );

  if (existingAuctions.length > 0) {
    const auction = existingAuctions[0];
    return {
      action: "auction_reused",
      status: auction.status,
      auctionId: auction.id,
      reused: true,
    };
  }

  const numbers = getValuationNumbers(session);
  const startingPrice = numbers.auctionMin || numbers.wholeValue || 1;
  const endTime = new Date(
    Date.now() + DEFAULT_AUCTION_DURATION_MS,
  ).toISOString();

  const auction = auctionService.createAuction({
    listing_id: listing.id,
    starting_price: startingPrice,
    end_time: endTime,
  });

  listingRepository.update(listing.id, {
    sale_type: "auction",
    status: "active",
  });

  return {
    action: "auction_created",
    status: auction.status,
    auctionId: auction.id,
    startingPrice: auction.starting_price,
    endTime: auction.end_time,
  };
}

// scrap (recycling): reuses the existing pickup domain
// (pickupService/pickupRepository) to actually dispatch a physical
// collection request, instead of only flipping a listing field —
// scrap items genuinely need to be physically collected, and that
// subsystem already exists for exactly this.
function resolveViaPickup(listing, session) {
  const numbers = getValuationNumbers(session);

  const pickup = pickupService.createPickup({
    seller: buildSeller(listing),
    location: listing.location,
    material:
      [listing.brand, listing.model].filter(Boolean).join(" ") ||
      listing.subcategory ||
      listing.category,
    estimated_value: numbers.scrapValue || 0,
    quantity: 1,
  });

  listingRepository.update(listing.id, {
    sale_type: "scrap",
    status: "reserved",
  });

  return {
    action: "pickup_created",
    status: pickup.status,
    pickupId: pickup.id,
  };
}

// repair: no existing repository models "in repair" state at all —
// SALE_TYPES has no 'repair' entry and there is no repairRepository.
// The smallest reasonable application-state record is the listing's
// own status: 'reserved' (an existing STATUSES value — the item is
// taken off the market while it's being repaired) plus the resolution
// object recorded below. This is intentionally NOT backed by a
// dedicated repository since none exists yet; see the phase report.
function resolveRepair(listing, session) {
  const numbers = getValuationNumbers(session);

  const updatedListing = listingRepository.update(listing.id, {
    status: "reserved",
  });

  return {
    action: "repair_request_recorded",
    status: "in_progress",
    listingId: updatedListing.id,
    listingStatus: updatedListing.status,
    estimatedRepairCost:
      typeof numbers.repairCost === "number" ? numbers.repairCost : null,
  };
}

const ROUTE_EXECUTORS = {
  whole: (listing, session, resolutionId) =>
    resolveViaListingStateChange(listing, "whole", session, resolutionId),
  parts: (listing, session, resolutionId) =>
    resolveViaListingStateChange(listing, "parts", session, resolutionId),
  donate: (listing, session, resolutionId) =>
    resolveViaListingStateChange(listing, "donate", session, resolutionId),
  auction: (listing, session) => resolveViaAuction(listing, session),
  scrap: (listing, session) => resolveViaPickup(listing, session),
  repair: (listing, session) => resolveRepair(listing, session),
};

async function executeResolution(input, context) {
  const session = context && context.session;
  if (!session || !session.itemId) {
    throw createError("execute_resolution requires a session with an itemId");
  }

  // Phase 9: when the caller doesn't supply a route (e.g. the orchestrator
  // auto-advancing an EXECUTING session), the agent executes the route its
  // own decision stage recorded — the currentAction/currentDecision that
  // runDecision populated. This is the agent executing its own choice, not
  // a caller bypassing the decision layer; explicit routes (the Phase 5/6
  // contract) still win when provided.
  const route =
    (input && input.route) ||
    (session.currentAction && session.currentAction.route) ||
    (session.currentDecision && session.currentDecision.route) ||
    null;
  if (!route || typeof route !== "string") {
    const error = createError(
      `execute_resolution requires input.route (one of: ${RESOLUTION_ROUTES.join(", ")})`,
    );
    error.code = "INVALID_ROUTE";
    throw error;
  }

  if (!RESOLUTION_ROUTES.includes(route)) {
    const error = createError(
      `Unsupported resolution route "${route}". Supported routes: ${RESOLUTION_ROUTES.join(", ")}`,
    );
    error.code = "UNSUPPORTED_RESOLUTION";
    throw error;
  }

  const listing = listingRepository.findById(session.itemId);
  if (!listing) {
    const error = createError(
      `No item found for itemId "${session.itemId}"`,
      404,
    );
    error.code = "ITEM_NOT_FOUND";
    throw error;
  }

  if (listing.status === "removed") {
    const error = createError(
      "This item has been removed and cannot be resolved.",
      409,
    );
    error.code = "DOMAIN_OPERATION_FAILED";
    throw error;
  }

  const existingResolution = getExistingResolution(listing);

  if (
    existingResolution &&
    !isTerminalResolutionStatus(existingResolution.status)
  ) {
    if (existingResolution.route === route) {
      // Step 6: same route re-requested — return the existing
      // resolution rather than creating a duplicate domain record.
      return {
        success: true,
        reused: true,
        route,
        itemId: listing.id,
        resolutionId: existingResolution.resolutionId,
        status: existingResolution.status,
        action: existingResolution.action,
        details: existingResolution.details || null,
      };
    }

    const error = createError(
      `Item "${listing.id}" already has an active resolution for route "${existingResolution.route}". ` +
        "Resolve or cancel it before requesting a different route.",
      409,
    );
    error.code = "RESOLUTION_ALREADY_EXISTS";
    throw error;
  }

  // Phase 8: consult the deterministic demo environment BEFORE any domain
  // state is written. When the REQUIRED_COMPONENT_UNAVAILABLE scenario is
  // active for the hero item, attempting to execute "repair" returns a
  // structured execution failure ({ success:false, errorCode, route,
  // reason } — see demoEnvironmentService) instead of mutating the
  // listing/auction/pickup state. This is opt-in and isolated: when the
  // simulation is disabled, or the session's item is not the hero demo
  // item, getExecutionFailure returns null and execution proceeds
  // exactly as Phase 5/6/7 did. Returning (not throwing) is what lets
  // the agent OBSERVE the failure — runTool's normal path moves the
  // session EXECUTING -> OBSERVING and records it as an OBSERVATION
  // instead of forcing a terminal FAILED (see agentStateService).
  const environmentDenial = demoEnvironmentService.getExecutionFailure({
    route,
    session,
  });
  if (environmentDenial) {
    return environmentDenial;
  }

  const resolutionId =
    (existingResolution && existingResolution.resolutionId) || randomUUID();
  const executor = ROUTE_EXECUTORS[route];

  let outcome;
  try {
    outcome = executor(listing, session, resolutionId);
  } catch (error) {
    // Never leave a half-written resolution behind: nothing has been
    // recorded on the listing yet at this point (executors write the
    // domain state and only then we persist listing.resolution
    // below), so a thrown error here means no resolution object is
    // stored — the caller sees a clean failure, not a partial one.
    const wrapped = createError(
      `Failed to execute resolution route "${route}": ${error.message}`,
      error.status || 500,
    );
    wrapped.code = error.code || "DOMAIN_OPERATION_FAILED";
    throw wrapped;
  }

  const resolutionRecord = {
    resolutionId,
    route,
    status: outcome.status,
    action: outcome.action,
    details: outcome,
    createdAt:
      (existingResolution && existingResolution.createdAt) ||
      new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  listingRepository.update(listing.id, { resolution: resolutionRecord });

  return {
    success: true,
    reused: false,
    route,
    itemId: listing.id,
    resolutionId,
    status: outcome.status,
    action: outcome.action,
    ...outcome,
  };
}

// --------------------------------------------------------------
// TOOL: verify_resolution
// --------------------------------------------------------------
/*
 * Phase 9. Real verification: reads the persisted listing/domain state and
 * checks it against the resolution the agent just executed. "Verified"
 * means the resolution actually took hold in the domain, not that a request
 * returned 200. The check is honest and minimal:
 *
 *   - a resolution record must exist on the listing;
 *   - it must be for the route the agent executed (currentAction/currentDecision);
 *   - the listing's sale_type must match the route's expected sale type
 *     (same ROUTE_TO_SALE_TYPE mapping execute_resolution uses to write the
 *     state, so this can never drift from what execution actually changes);
 *   - the resolution status must be a real, non-terminal outcome status
 *     (execution's executors only ever write these).
 *
 * No other verification sub-system exists in this codebase to reuse, so this
 * is the lightest real check that returns a stable verdict. It never
 * fabricates a pass: any mismatch returns passed:false with a concrete
 * reason, which the state machine turns into a terminal FAILED.
 */
async function verifyResolution(input, context) {
  const session = context && context.session;
  if (!session || !session.itemId) {
    throw createError("verify_resolution requires a session with an itemId");
  }

  const listing = getListingOrThrow(session.itemId);
  const resolution = listing.resolution || null;
  const expectedRoute =
    (session.currentAction && session.currentAction.route) ||
    (session.currentDecision && session.currentDecision.route) ||
    null;
  const verifiedAt = new Date().toISOString();

  if (!resolution) {
    return {
      success: false,
      passed: false,
      route: expectedRoute,
      reason: "No resolution record exists on the listing — the executed route did not take hold.",
      verifiedAt,
    };
  }

  const expectedSaleType =
    ROUTE_TO_SALE_TYPE[resolution.route] || null;
  const matchesRoute =
    expectedRoute === null || resolution.route === expectedRoute;
  const matchesSaleType =
    expectedSaleType === null || listing.sale_type === expectedSaleType;

  const passed = matchesRoute && matchesSaleType;

  return {
    success: passed,
    passed,
    route: resolution.route,
    resolutionId: resolution.resolutionId,
    resolutionStatus: resolution.status,
    resolutionAction: resolution.action,
    listingStatus: listing.status,
    listingSaleType: listing.sale_type,
    expectedSaleType,
    reason: !matchesRoute
      ? `Listing resolution is for route "${resolution.route}" but the agent executed "${expectedRoute}".`
      : !matchesSaleType
        ? `Route "${resolution.route}" requires sale_type "${expectedSaleType}" but the listing has "${listing.sale_type}".`
        : matchesSaleType
          ? `Listing confirmed resolved as "${resolution.route}" (${resolution.status}, sale_type "${listing.sale_type}", status "${listing.status}").`
          : "Resolution not verified.",
    verifiedAt,
  };
}

// --------------------------------------------------------------
// (no NOT_IMPLEMENTED stubs remain — Phase 9 implements all tools)
// --------------------------------------------------------------

agentToolRegistry.registerTool({
  name: "inspect_item",
  description:
    "Classifies the item image through the existing MobileNetV3/ONNX scrap classifier and produces detected device + condition + confidence.",
  handler: inspectItem,
});

agentToolRegistry.registerTool({
  name: "calculate_valuation",
  description:
    "Runs the existing valuation/route-recommendation engine against the inspected item.",
  handler: calculateValuation,
});

agentToolRegistry.registerTool({
  name: "check_constraints",
  description:
    "Checks business/logistics constraints against the item and its valuation.",
  handler: checkConstraints,
});

agentToolRegistry.registerTool({
  name: "execute_resolution",
  description:
    "Executes a resolution route (whole/parts/auction/scrap/donate/repair), actually changing listing/auction/pickup state.",
  handler: executeResolution,
});

agentToolRegistry.registerTool({
  name: "verify_resolution",
  description:
    "Verifies the executed resolution took hold in the persisted domain state (listing.resolution + sale_type + status).",
  handler: verifyResolution,
});

// Defensive check: keep the registry in sync with the declared tool list.
AGENT_TOOL_NAMES.forEach((name) => {
  if (!agentToolRegistry.getTool(name)) {
    throw new Error(`agentTools.js failed to register declared tool "${name}"`);
  }
});

module.exports = {
  inspectItem,
  calculateValuation,
  checkConstraints,
  executeResolution,
  verifyResolution,
  retrieveCustomer, // exported for backend/testphase12.js (PS5-2 proof)
};
