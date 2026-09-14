/**
 * Local, frontend-only mock data for the Sell Item / Device Upload flow.
 *
 * IMPORTANT: This file intentionally contains no network calls. It exists so
 * the redesigned upload → understanding → condition → valuation → resolution
 * journey can be fully previewed and tested before it is wired to the real
 * ML/valuation backend. Nothing here talks to /api/*.
 */

export const deviceCategories = [
  { id: "phone", label: "Phone" },
  { id: "laptop", label: "Laptop" },
  { id: "battery", label: "Battery" },
  { id: "television", label: "Television" },
  { id: "washing_machine", label: "Washing Machine" },
  { id: "microwave", label: "Microwave" },
  { id: "pcb", label: "PCB" },
  { id: "keyboard", label: "Keyboard" },
  { id: "mouse", label: "Mouse" },
  { id: "printer", label: "Printer" },
  { id: "player", label: "Media Player" },
  { id: "ssd", label: "SSD" },
  { id: "ram", label: "RAM" },
  { id: "gpu", label: "GPU" },
];

// A small local "recognition catalog" used to simulate device understanding.
// In the connected build this is replaced by the MobileNet classifier.
const recognitionCatalog = {
  laptop: [
    { brand: "Dell", series: "XPS 13", year: "2021" },
    { brand: "Lenovo", series: "ThinkPad X1", year: "2020" },
    { brand: "HP", series: "Spectre x360", year: "2022" },
    { brand: "Apple", series: "MacBook Air", year: "2019" },
  ],
  phone: [
    { brand: "Apple", series: "iPhone 12", year: "2020" },
    { brand: "Samsung", series: "Galaxy S21", year: "2021" },
    { brand: "OnePlus", series: "9R", year: "2021" },
    { brand: "Xiaomi", series: "Redmi Note 11", year: "2022" },
  ],
  battery: [
    { brand: "Generic", series: "Li-ion pack", year: "—" },
    { brand: "APC", series: "UPS battery", year: "—" },
  ],
  television: [
    { brand: "Samsung", series: "Crystal 4K UHD", year: "2020" },
    { brand: "LG", series: "OLED CX", year: "2021" },
  ],
  washing_machine: [{ brand: "LG", series: "Front Load 7kg", year: "2018" }],
  microwave: [{ brand: "IFB", series: "Convection 25L", year: "2019" }],
  pcb: [{ brand: "Generic", series: "Mainboard assembly", year: "—" }],
  keyboard: [{ brand: "Logitech", series: "K380", year: "2020" }],
  mouse: [{ brand: "Logitech", series: "M185", year: "2019" }],
  printer: [{ brand: "HP", series: "DeskJet 2331", year: "2021" }],
  player: [{ brand: "Sony", series: "Walkman NW", year: "2017" }],
  ssd: [{ brand: "Samsung", series: "870 EVO 500GB", year: "2021" }],
  ram: [{ brand: "Corsair", series: "Vengeance 16GB", year: "2020" }],
  gpu: [{ brand: "NVIDIA", series: "RTX 3060", year: "2021" }],
};

const categoryLabels = deviceCategories.reduce((acc, c) => {
  acc[c.id] = c.label;
  return acc;
}, {});

export const conditionQuestionSets = {
  laptop: [
    { key: "powersOn", label: "Does it power on?", options: ["Yes", "No", "Sometimes"] },
    { key: "displayCondition", label: "Display condition", options: ["Excellent", "Good", "Cracked", "Non-functional"] },
    { key: "batteryCondition", label: "Battery condition", options: ["Good", "Fair", "Weak", "Needs replacement"] },
    { key: "ram", label: "RAM", options: ["4 GB", "8 GB", "16 GB", "32 GB"] },
    { key: "storage", label: "Storage", options: ["128 GB", "256 GB", "512 GB", "1 TB"] },
    { key: "chargerIncluded", label: "Charger included?", options: ["Yes", "No", "Partially"] },
    { key: "physicalDamage", label: "Physical damage?", options: ["None", "Minor", "Moderate", "Severe"] },
  ],
  phone: [
    { key: "powersOn", label: "Does it power on?", options: ["Yes", "No", "Sometimes"] },
    { key: "screenCondition", label: "Screen condition", options: ["Excellent", "Good", "Cracked", "Unresponsive"] },
    { key: "batteryHealth", label: "Battery health", options: ["Excellent", "Good", "Fair", "Poor"] },
    { key: "cameraWorking", label: "Camera working?", options: ["Yes", "No", "Partially"] },
    { key: "storage", label: "Storage", options: ["64 GB", "128 GB", "256 GB", "512 GB"] },
    { key: "networkLocked", label: "Network locked?", options: ["No", "Yes", "Unknown"] },
    { key: "physicalDamage", label: "Physical damage?", options: ["None", "Minor", "Moderate", "Severe"] },
  ],
  battery: [
    { key: "batteryType", label: "Battery type", options: ["Li-ion", "Li-polymer", "Lead-acid", "Other"] },
    { key: "capacity", label: "Capacity", options: ["High", "Medium", "Low", "Unknown"] },
    { key: "swollen", label: "Shows swelling?", options: ["No", "Slightly", "Yes"] },
    { key: "chargerIncluded", label: "Charger included?", options: ["Yes", "No", "Partially"] },
    { key: "physicalDamage", label: "Physical damage?", options: ["None", "Minor", "Moderate", "Severe"] },
  ],
};

export const genericConditionQuestions = [
  { key: "powersOn", label: "Does it work / power on?", options: ["Yes", "No", "Sometimes"] },
  { key: "physicalDamage", label: "Physical condition", options: ["None", "Minor", "Moderate", "Severe"] },
];

export function getConditionQuestions(category) {
  return conditionQuestionSets[category] || genericConditionQuestions;
}

// Deterministic pseudo-random helper so repeated runs for the same image name
// feel stable rather than jumping around on every re-render.
function seededIndex(seed, length) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return length > 0 ? hash % length : 0;
}

/**
 * Simulates the device-recognition step. Frontend-only: picks a plausible
 * entry from the local catalog based on the selected category and the
 * uploaded file name, and returns a confidence score.
 */
export function mockClassifyDevice({ category, seedName = "device" }) {
  const options = recognitionCatalog[category] || recognitionCatalog.laptop;
  const pick = options[seededIndex(String(seedName), options.length)];
  const confidence = 82 + (seededIndex(String(seedName) + "c", 14));

  return {
    category,
    categoryLabel: categoryLabels[category] || "Device",
    brand: pick.brand,
    series: pick.series,
    year: pick.year,
    confidence: Math.min(confidence, 96),
  };
}

const BASE_VALUE_BY_CATEGORY = {
  phone: 14500,
  laptop: 26000,
  battery: 1200,
  television: 18500,
  washing_machine: 9500,
  microwave: 3200,
  pcb: 900,
  keyboard: 700,
  mouse: 350,
  printer: 2100,
  player: 1500,
  ssd: 2600,
  ram: 1800,
  gpu: 21000,
};

const CONDITION_MULTIPLIER = {
  none: 1, yes: 1, excellent: 1, good: 0.92, high: 1,
  minor: 0.8, fair: 0.78, sometimes: 0.7, medium: 0.75, weak: 0.6,
  moderate: 0.55, cracked: 0.5, partially: 0.6, poor: 0.45, low: 0.5,
  severe: 0.32, no: 0.3, "non-functional": 0.2, unresponsive: 0.25,
  "needs replacement": 0.4, unknown: 0.65, slightly: 0.55,
};

function conditionScore(condition) {
  const values = Object.values(condition || {}).filter(Boolean);
  if (!values.length) return 0.75;

  const scored = values.map((value) => {
    const key = String(value).trim().toLowerCase();
    return CONDITION_MULTIPLIER[key] ?? 0.75;
  });

  return scored.reduce((sum, v) => sum + v, 0) / scored.length;
}

/**
 * Produces a locally computed, realistic-looking valuation + recovery-route
 * comparison from the category and condition answers. This is a stand-in for
 * the connected Random Forest + rules valuation service and never leaves the
 * browser.
 */
export function mockEvaluateDevice({ category, device, condition }) {
  const base = BASE_VALUE_BY_CATEGORY[category] || 4000;
  const score = conditionScore(condition);

  const wholeValue = Math.round((base * score) / 50) * 50;
  const partsValue = Math.round((wholeValue * 0.62) / 50) * 50;
  const auctionMin = Math.round((wholeValue * 0.7) / 50) * 50;
  const auctionMax = Math.round((wholeValue * 1.08) / 50) * 50;
  const scrapValue = Math.round((base * 0.06) / 10) * 10;

  let route = "whole";
  let reason =
    "The device is in strong enough condition that a direct resale keeps the most value in circulation.";

  if (score < 0.4) {
    route = "scrap";
    reason =
      "Condition signals suggest limited resale or repair demand, so scrap recovery protects the most value.";
  } else if (score < 0.58) {
    route = "parts";
    reason =
      "Component-level demand is stronger than whole-device resale at this condition level.";
  } else if (score < 0.72) {
    route = "auction";
    reason =
      "Demand for this device is inconsistent enough that price discovery through auction is likely to recover more value.";
  }

  const conditionLabel = score >= 0.85 ? "Excellent" : score >= 0.68 ? "Good" : score >= 0.45 ? "Fair" : "Poor";

  const componentsByCategory = {
    laptop: [
      { name: "Display panel", estimatedValue: Math.round(wholeValue * 0.22) },
      { name: "Battery", estimatedValue: Math.round(wholeValue * 0.08) },
      { name: "RAM + storage", estimatedValue: Math.round(wholeValue * 0.18) },
      { name: "Chassis + keyboard", estimatedValue: Math.round(wholeValue * 0.09) },
    ],
    phone: [
      { name: "Display assembly", estimatedValue: Math.round(wholeValue * 0.28) },
      { name: "Battery", estimatedValue: Math.round(wholeValue * 0.06) },
      { name: "Camera module", estimatedValue: Math.round(wholeValue * 0.12) },
      { name: "Chassis + board", estimatedValue: Math.round(wholeValue * 0.1) },
    ],
  };

  const components =
    componentsByCategory[category] || [
      { name: "Primary components", estimatedValue: Math.round(partsValue * 0.7) },
      { name: "Casing + accessories", estimatedValue: Math.round(partsValue * 0.3) },
    ];

  return {
    confidence: device?.confidence || 88,
    recommendation: { route, reason },
    valuation: { wholeValue, partsValue, auctionMin, auctionMax, scrapValue },
    detectedItem: {
      category: categoryLabels[category] || category,
      brand: device?.brand || "",
      model: device?.series || "",
    },
    condition: { label: conditionLabel, score },
    marketSignals: {
      location: "Delhi",
      demand: score >= 0.7 ? "high" : score >= 0.5 ? "medium" : "low",
    },
    components,
  };
}

export const resolutionPathCopy = {
  whole: {
    name: "Resell whole device",
    tag: "Fast exit",
    description: "Listed as a complete, working device for a direct buyer match.",
  },
  parts: {
    name: "Sell components",
    tag: "Component recovery",
    description: "Broken down into in-demand parts and listed separately.",
  },
  auction: {
    name: "Auction",
    tag: "Price discovery",
    description: "Opened to competitive bidding to find the strongest price.",
  },
  scrap: {
    name: "Scrap recovery",
    tag: "Same-day route",
    description: "Routed to a scrap partner for material-level recovery.",
  },
  donate: {
    name: "Donate",
    tag: "Social impact",
    description: "Passed on for reuse through a partner impact program.",
  },
};

export function buildResolutionPaths(evaluation) {
  const { valuation, recommendation } = evaluation;
  const order = ["whole", "parts", "auction", "scrap", "donate"];

  return order.map((route) => {
    const copy = resolutionPathCopy[route];
    let value = null;

    if (route === "whole") value = valuation.wholeValue;
    else if (route === "parts") value = valuation.partsValue;
    else if (route === "auction") {
      value = `${Number(valuation.auctionMin).toLocaleString("en-IN")}–${Number(
        valuation.auctionMax
      ).toLocaleString("en-IN")}`;
    } else if (route === "scrap") value = valuation.scrapValue;

    return {
      route,
      ...copy,
      value,
      recommended: route === recommendation.route,
    };
  });
}
