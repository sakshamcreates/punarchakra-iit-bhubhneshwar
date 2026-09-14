import apiClient from "./apiClient";

const ML_CATEGORY_MAP = {
  Mobile: "phone",
  Television: "television",
  "Washing Machine": "washing_machine",
  Microwave: "microwave",
  Battery: "battery",
  PCB: "pcb",
  Keyboard: "keyboard",
  Mouse: "mouse",
  Printer: "printer",
  Player: "player",
};

function normalizeDisplayCondition(value) {
  const normalized =
    String(value || "")
      .trim()
      .toLowerCase();

  if (normalized === "excellent") {
    return "excellent";
  }

  if (normalized === "good") {
    return "good";
  }

  if (
    normalized === "fair" ||
    normalized === "minor" ||
    normalized === "moderate" ||
    normalized === "cracked"
  ) {
    return "fair";
  }

  if (
    normalized === "poor" ||
    normalized === "severe" ||
    normalized === "non-functional" ||
    normalized === "unresponsive"
  ) {
    return "poor";
  }

  return undefined;
}

function normalizeBatteryCondition(value) {
  const normalized =
    String(value || "")
      .trim()
      .toLowerCase();

  if (
    normalized === "excellent" ||
    normalized === "high"
  ) {
    return "excellent";
  }

  if (
    normalized === "good" ||
    normalized === "medium"
  ) {
    return "good";
  }

  if (
    normalized === "fair" ||
    normalized === "weak" ||
    normalized === "low"
  ) {
    return "fair";
  }

  if (
    normalized === "poor" ||
    normalized === "needs replacement"
  ) {
    return "poor";
  }

  return undefined;
}

function normalizeCondition(condition = {}) {
  const result = {};

  const power =
    String(condition.powersOn || "")
      .trim()
      .toLowerCase();

  if (power === "yes") {
    result.powersOn = true;
  }

  if (power === "no") {
    result.powersOn = false;
  }

  const displayCondition =
    normalizeDisplayCondition(
      condition.displayCondition ||
      condition.screenCondition ||
      condition.physicalDamage
    );

  if (displayCondition) {
    result.displayCondition =
      displayCondition;
  }

  const batteryCondition =
    normalizeBatteryCondition(
      condition.batteryCondition ||
      condition.batteryHealth ||
      condition.capacity
    );

  if (batteryCondition) {
    result.batteryCondition =
      batteryCondition;
  }

  const charger =
    String(
      condition.chargerIncluded || ""
    )
      .trim()
      .toLowerCase();

  if (charger === "yes") {
    result.chargerAvailable = true;
  }

  if (charger === "no") {
    result.chargerAvailable = false;
  }

  if (condition.storage) {
    result.storage = condition.storage;
  }

  if (condition.ram) {
    result.ram = condition.ram;
  }

  result.photosHint = true;

  return result;
}

function appendIfPresent(
  formData,
  key,
  value
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return;
  }

  formData.append(key, String(value));
}

/*
 * Used by Step 2.
 *
 * Frontend
 *   -> Node /api/ml/classify
 *   -> FastAPI
 *   -> MobileNet
 */
export async function classifyItemImage(
  file
) {
  if (!file) {
    throw new Error(
      "Upload an image before running AI detection."
    );
  }

  const formData = new FormData();

  formData.append(
    "image",
    file
  );

  const response =
    await apiClient.post(
      "/ml/classify",
      formData
    );

  /*
   * Node responds:
   *
   * {
   *   success: true,
   *   data: {
   *     success: true,
   *     data: {
   *       material,
   *       confidence,
   *       ...
   *     }
   *   }
   * }
   */

  const fastApiResponse =
    response?.data || response;

  const result =
    fastApiResponse?.data ||
    fastApiResponse;

  const rawCategory =
    result?.material || null;

  const confidence =
    typeof result?.confidence ===
    "number"
      ? result.confidence
      : null;

  return {
    ...result,

    rawCategory,

    category:
      ML_CATEGORY_MAP[
        rawCategory
      ] || null,

    confidencePercent:
      confidence !== null
        ? Math.round(
            confidence * 100
          )
        : 0,
  };
}

/*
 * Full evaluation.
 *
 * Frontend
 *   -> Node /api/ai/evaluate
 *   -> MobileNet
 *   -> optional Random Forest
 *   -> Task C
 */
export async function evaluateItem(
  payload
) {
  const formData = new FormData();

  if (payload.image) {
    formData.append(
      "image",
      payload.image
    );
  }

  appendIfPresent(
    formData,
    "category",
    payload.category
  );

  appendIfPresent(
    formData,
    "brand",
    payload.brand
  );

  appendIfPresent(
    formData,
    "model",
    payload.model
  );

  appendIfPresent(
    formData,
    "location",
    payload.location
  );

  appendIfPresent(
    formData,
    "userPreference",
    payload.userPreference
  );

  formData.append(
    "condition",
    JSON.stringify(
      normalizeCondition(
        payload.condition || {}
      )
    )
  );

  /*
   * These are optional.
   * Random Forest will run only when all
   * required market fields exist.
   */
  appendIfPresent(
    formData,
    "material",
    payload.material
  );

  appendIfPresent(
    formData,
    "historical_price",
    payload.historical_price
  );

  appendIfPresent(
    formData,
    "month",
    payload.month
  );

  appendIfPresent(
    formData,
    "demand",
    payload.demand
  );

  appendIfPresent(
    formData,
    "supply",
    payload.supply
  );

  const response =
    await apiClient.post(
      "/ai/evaluate",
      formData
    );

  return response?.data || response;
}