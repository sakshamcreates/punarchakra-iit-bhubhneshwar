const { analyzeProductImages } = require('./productVisionService');
const {
  CATEGORY_SYNONYMS,
  BASE_MARKETS,
  DEMAND_BY_LOCATION,
  LOCATION_MULTIPLIER,
  DEMAND_MULTIPLIER,
  CATEGORY_DEMAND_FLOOR,
  PARTS_BY_CATEGORY,
  SCRAP_BASE,
  REPAIR_BASE,
  ROUTE_LABELS
} = require('../data/valuationData');

const CONDITION_LABELS = [
  { min: 88, label: 'Excellent' },
  { min: 72, label: 'Good' },
  { min: 55, label: 'Fair' },
  { min: 0, label: 'Poor' }
];

const CONDITION_MULTIPLIERS = {
  excellent: 1.08,
  good: 0.96,
  fair: 0.82,
  poor: 0.62
};


const PARTS_RECOVERY_MULTIPLIER = {
  laptop: 1.85,
  phone: 1.72,

  television: 1.28,
  washing_machine: 1.35,
  microwave: 1.22,

  battery: 1.12,
  pcb: 1.4,

  keyboard: 1.08,
  mouse: 1.05,

  printer: 1.3,
  player: 1.15,

  ssd: 1.35,
  ram: 1.28,
  gpu: 1.55
};  
const AUCTION_RANGE_MULTIPLIER = {
  laptop: { min: 1.02, max: 1.38 },
  phone: { min: 1.03, max: 1.42 },

  television: { min: 1.01, max: 1.28 },
  washing_machine: { min: 1.01, max: 1.22 },
  microwave: { min: 1.0, max: 1.18 },

  battery: { min: 1.0, max: 1.18 },
  pcb: { min: 1.01, max: 1.25 },

  keyboard: { min: 1.0, max: 1.15 },
  mouse: { min: 1.0, max: 1.15 },

  printer: { min: 1.01, max: 1.25 },
  player: { min: 1.0, max: 1.16 },

  ssd: { min: 1.01, max: 1.24 },
  ram: { min: 1.01, max: 1.2 },
  gpu: { min: 1.02, max: 1.34 }
};
const DEMAND_RANK = {
  low: 0,
  medium: 1,
  high: 2
};

const VALID_PREFERENCE_VALUES = new Set(['maximum_value', 'fastest_exit', 'social_impact', 'balanced']);

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const titleCase = (value) => {
  const text = String(value || '').trim();
  if (!text) {
    return null;
  }

  return text
    .split(/\s+/)
    .map((part) => {
      if (/^\d+$/.test(part)) {
        return part;
      }

      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(' ');
};

const roundMoney = (value) => Math.max(0, Math.round(Number(value) || 0));

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const createError = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const resolveCategoryKey = (value) => {
  const normalized = normalizeText(value);
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
};

const inferCategoryFromModel = (model) => {
  const normalizedModel = normalizeText(model);
  if (!normalizedModel) {
    return null;
  }

  for (const [categoryKey, market] of Object.entries(BASE_MARKETS)) {
    if (market.models && market.models[normalizedModel]) {
      return categoryKey;
    }
  }

  return null;
};

const detectItem = (payload, visionResult = {}) => {
  const categoryKey =
    resolveCategoryKey(payload.category) ||
    resolveCategoryKey(visionResult.category) ||
    inferCategoryFromModel(payload.model) ||
    inferCategoryFromModel(visionResult.model);

  if (!categoryKey) {
    throw createError('category is required and must map to a supported item type');
  }

  const brand = titleCase(payload.brand || visionResult.brand);
  const model = titleCase(payload.model || visionResult.model);

  return {
    categoryKey,
    category: BASE_MARKETS[categoryKey].label,
    brand,
    model
  };
};

const scoreCondition = (condition = {}, categoryKey) => {
  const normalizedCondition = condition && typeof condition === 'object' ? condition : {};
  let score = 32;

  if (normalizedCondition.powersOn === true) {
    score += 16;
  } else if (normalizedCondition.powersOn === false) {
    score -= 16;
  }

  const displayRating = normalizeText(normalizedCondition.displayCondition);
  if (displayRating === 'excellent') {
    score += 19;
  } else if (displayRating === 'good') {
    score += 15;
  } else if (displayRating === 'fair') {
    score += 7;
  } else if (displayRating === 'poor') {
    score -= 9;
  }

  const batteryRating = normalizeText(normalizedCondition.batteryCondition);
  if (batteryRating === 'excellent') {
    score += 10;
  } else if (batteryRating === 'good') {
    score += 7;
  } else if (batteryRating === 'fair') {
    score += 3;
  } else if (batteryRating === 'poor') {
    score -= 7;
  }

  if (normalizedCondition.chargerAvailable === true) {
    score += 4;
  }

  if (normalizedCondition.storage) {
    score += 5;
  }

  if (normalizedCondition.ram) {
    score += 5;
  }

  if (normalizedCondition.photosHint === true) {
    score += 2;
  }

  if (categoryKey === 'laptop') {
    score += normalizedCondition.chargerAvailable === false ? 0 : 1;
  }

  score = clamp(Math.round(score), 5, 98);

  const label = CONDITION_LABELS.find((entry) => score >= entry.min)?.label || 'Poor';
  const multiplierKey = label.toLowerCase();

  return {
    score,
    label,
    multiplier: CONDITION_MULTIPLIERS[multiplierKey] || CONDITION_MULTIPLIERS.poor
  };
};

const getDemandSignal = (
  categoryKey,
  location,
  externalDemandScore = null
) => {
  const locationKey = normalizeText(location);

  const locationDemand =
    DEMAND_BY_LOCATION[locationKey] || 'medium';

  const categoryDemand =
    CATEGORY_DEMAND_FLOOR[categoryKey] || 'medium';

  const effectiveDemand =
    DEMAND_RANK[locationDemand] >=
    DEMAND_RANK[categoryDemand]
      ? locationDemand
      : categoryDemand;

  const fallbackScores = {
    low: 35,
    medium: 60,
    high: 85
  };

  const parsedExternalScore =
    Number(externalDemandScore);

  const hasExternalScore =
    externalDemandScore !== null &&
    externalDemandScore !== undefined &&
    externalDemandScore !== '' &&
    Number.isFinite(parsedExternalScore);

  const demandScore =
    hasExternalScore
      ? clamp(
          Math.round(parsedExternalScore),
          0,
          100
        )
      : fallbackScores[effectiveDemand] || 60;

  return {
    demand: effectiveDemand,

    demandScore,

    locationMultiplier:
      LOCATION_MULTIPLIER[locationKey] || 1,

    demandMultiplier:
      DEMAND_MULTIPLIER[effectiveDemand] || 1,

    location:
      titleCase(location) || null
  };
};
const getMarketBaseValue = (categoryKey, brand, model) => {
  const market = BASE_MARKETS[categoryKey];
  const normalizedBrand = normalizeText(brand);
  const normalizedModel = normalizeText(model);

  if (normalizedModel && market.models && market.models[normalizedModel]) {
    return market.models[normalizedModel];
  }

  if (normalizedBrand && market.brands && market.brands[normalizedBrand]) {
    return market.brands[normalizedBrand];
  }

  return market.base;
};

const estimateWholeValue = (categoryKey, brand, model, conditionScore, demandContext) => {
  const baseValue = getMarketBaseValue(categoryKey, brand, model);
  const conditionMultiplier = clamp(0.44 + conditionScore / 300, 0.35, 1.05);
  const value = baseValue * conditionMultiplier * demandContext.demandMultiplier * demandContext.locationMultiplier;

  return roundMoney(value);
};

const estimatePartsValue = (categoryKey, conditionLabel, demandContext) => {
  const parts = PARTS_BY_CATEGORY[categoryKey] || [];
  const multiplier = PARTS_RECOVERY_MULTIPLIER[categoryKey] || 1.2;

  const breakdown = parts.map((part) => {
    const partMultiplier = part.conditionFactor[conditionLabel.toLowerCase()] || part.conditionFactor.good || 0.8;
    const estimatedValue = roundMoney(
      part.base * partMultiplier * demandContext.demandMultiplier * demandContext.locationMultiplier
    );

    return {
      name: part.name,
      estimatedValue
    };
  });

  const rawPartsValue = breakdown.reduce((total, part) => total + part.estimatedValue, 0);

  return {
    value: roundMoney(rawPartsValue * multiplier),
    breakdown
  };
};

const estimateRepairCost = (categoryKey, condition) => {
  const baseRepair = REPAIR_BASE[categoryKey] || 1000;
  const batteryRating = normalizeText(condition.batteryCondition);
  const displayRating = normalizeText(condition.displayCondition);

  let defectScore = 0;

  if (condition.powersOn === false) {
    defectScore += 40;
  }

  if (displayRating === 'poor') {
    defectScore += 20;
  } else if (displayRating === 'fair') {
    defectScore += 12;
  } else if (displayRating === 'good') {
    defectScore += 5;
  }

  if (batteryRating === 'poor') {
    defectScore += 16;
  } else if (batteryRating === 'fair') {
    defectScore += 8;
  } else if (batteryRating === 'good') {
    defectScore += 4;
  }

  if (condition.chargerAvailable === false) {
    defectScore += 5;
  }

  if (!condition.storage) {
    defectScore += 10;
  }

  if (!condition.ram) {
    defectScore += 8;
  }

  const multiplier = 0.72 + defectScore / 125;
  return roundMoney(baseRepair * multiplier);
};

const estimateAuctionRange = (categoryKey, wholeValue, demandContext) => {
  const range = AUCTION_RANGE_MULTIPLIER[categoryKey] || { min: 1.01, max: 1.25 };
  const demandLift = demandContext.demand === 'high' ? 0.03 : demandContext.demand === 'medium' ? 0.01 : 0;

  const min = roundMoney(wholeValue * range.min);
  const max = roundMoney(wholeValue * (range.max + demandLift));

  return {
    min: Math.max(min, 0),
    max: Math.max(max, min)
  };
};

const estimateScrapValue = (categoryKey, conditionScore, demandContext) => {
  const baseScrap = SCRAP_BASE[categoryKey] || 500;
  const conditionMultiplier = 0.94 + (100 - conditionScore) / 500;
  const value = baseScrap * conditionMultiplier * demandContext.locationMultiplier;

  return roundMoney(value);
};

const estimateRepairSaleValue = (categoryKey, conditionScore, demandContext) => {
  const recoveredScore = clamp(conditionScore + 14, 0, 100);
  return estimateWholeValue(categoryKey, null, null, recoveredScore, demandContext);
};

const calculateConfidence = ({ detectedItem, condition, demandContext, visionResult, usedModelMatch }) => {
  let confidence = 48;

  if (detectedItem.category) {
    confidence += 15;
  }

  if (detectedItem.brand) {
    confidence += 7;
  }

  if (detectedItem.model) {
    confidence += 10;
  }

  if (condition.score >= 70) {
    confidence += 7;
  }

  if (demandContext.location) {
    confidence += 3;
  }

  if (visionResult && visionResult.confidence) {
    confidence += Math.min(7, Math.round(visionResult.confidence / 20));
  }

  if (usedModelMatch) {
    confidence += 5;
  }

  return clamp(Math.round(confidence), 50, 96);
};

const chooseBestRoute = (routeCandidates, userPreference) => {
  if (userPreference === 'social_impact') {
    const donateRoute = routeCandidates.find((candidate) => candidate.route === 'donate');
    if (donateRoute) {
      return donateRoute;
    }
  }

  if (userPreference === 'fastest_exit') {
    const priority = ['whole', 'auction', 'scrap', 'parts', 'repair_and_sell'];
    for (const routeName of priority) {
      const candidate = routeCandidates.find((item) => item.route === routeName);
      if (candidate) {
        return candidate;
      }
    }
  }

  if (userPreference === 'balanced') {
    const balancedPriority = ['parts', 'whole', 'auction', 'repair_and_sell', 'scrap'];
    for (const routeName of balancedPriority) {
      const candidate = routeCandidates.find((item) => item.route === routeName);
      if (candidate) {
        return candidate;
      }
    }
  }

  return routeCandidates.reduce((best, candidate) => {
    if (!best || candidate.expectedValue > best.expectedValue) {
      return candidate;
    }

    return best;
  }, null);
};

const getRecommendationReason = (bestRoute, runnerUpRoute, marketSignals, conditionLabel) => {
  if (bestRoute.route === 'parts') {
    return 'Component demand provides higher expected recovery than selling the device whole.';
  }

  if (bestRoute.route === 'repair_and_sell') {
    return 'Repairing the item unlocks more resale value than the repair cost consumes.';
  }

  if (bestRoute.route === 'auction') {
    return marketSignals.demand === 'high'
      ? 'High demand makes auction upside strong enough to compete with fixed-price routes.'
      : 'Auction pricing gives the best risk-adjusted upside in the current market.';
  }

  if (bestRoute.route === 'scrap') {
    return 'The item is in poor enough condition that recycling captures the best guaranteed value.';
  }

  if (bestRoute.route === 'whole') {
    return `The ${conditionLabel.toLowerCase()} condition still supports a solid resale value without disassembly.`;
  }

  if (bestRoute.route === 'donate') {
    return 'Donation is selected for social impact rather than cash recovery.';
  }

  if (runnerUpRoute) {
    return `Selected route slightly outperforms ${runnerUpRoute.label} on expected recovery.`;
  }

  return 'Selected route offers the strongest expected recovery for the submitted item.';
};

const validateInput = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw createError('Request body must be a JSON object');
  }

  if (payload.category !== undefined && typeof payload.category !== 'string') {
    throw createError('category must be a string');
  }

  if (!payload.category && !payload.model) {
    throw createError('category is required when model cannot be used to infer the item type');
  }

  if (payload.brand !== undefined && typeof payload.brand !== 'string') {
    throw createError('brand must be a string when provided');
  }

  if (payload.model !== undefined && typeof payload.model !== 'string') {
    throw createError('model must be a string when provided');
  }

  if (payload.location !== undefined && typeof payload.location !== 'string') {
    throw createError('location must be a string when provided');
  }

  if (payload.userPreference !== undefined && typeof payload.userPreference !== 'string') {
    throw createError('userPreference must be a string when provided');
  }

  if (payload.userPreference && !VALID_PREFERENCE_VALUES.has(normalizeText(payload.userPreference))) {
    throw createError(`userPreference must be one of: ${Array.from(VALID_PREFERENCE_VALUES).join(', ')}`);
  }

  if (payload.condition !== undefined && (payload.condition === null || typeof payload.condition !== 'object' || Array.isArray(payload.condition))) {
    throw createError('condition must be an object when provided');
  }

  if (payload.photos !== undefined && !Array.isArray(payload.photos)) {
    throw createError('photos must be an array when provided');
  }
};

const evaluate = (payload = {}) => {
  validateInput(payload);

  const visionResult = analyzeProductImages(Array.isArray(payload.photos) ? payload.photos : []);
  const detectedItem = detectItem(payload, visionResult || {});
  const condition = scoreCondition(payload.condition, detectedItem.categoryKey);
const demandContext =
  getDemandSignal(
    detectedItem.categoryKey,
    payload.location,
    payload.demand_score
  );
  const modelMatch =
    normalizeText(payload.model) &&
    BASE_MARKETS[detectedItem.categoryKey].models &&
    Boolean(BASE_MARKETS[detectedItem.categoryKey].models[normalizeText(payload.model)]);

  const wholeValue = estimateWholeValue(
    detectedItem.categoryKey,
    payload.brand || detectedItem.brand,
    payload.model || detectedItem.model,
    condition.score,
    demandContext
  );

  const partsEstimate = estimatePartsValue(detectedItem.categoryKey, condition.label, demandContext);
  const repairCost = estimateRepairCost(detectedItem.categoryKey, payload.condition || {});
  const repairedSaleValue = estimateRepairSaleValue(detectedItem.categoryKey, condition.score, demandContext);
  const auctionRange = estimateAuctionRange(detectedItem.categoryKey, wholeValue, demandContext);
  const scrapValue = estimateScrapValue(detectedItem.categoryKey, condition.score, demandContext);

  const routeCandidates = [
    {
      route: 'whole',
      label: ROUTE_LABELS.whole,
      expectedValue: wholeValue
    },
    {
      route: 'parts',
      label: ROUTE_LABELS.parts,
      expectedValue: partsEstimate.value
    },
    {
      route: 'repair_and_sell',
      label: ROUTE_LABELS.repair_and_sell,
      expectedValue: Math.max(0, repairedSaleValue - repairCost)
    },
    {
      route: 'auction',
      label: ROUTE_LABELS.auction,
      expectedValue: roundMoney((auctionRange.min + auctionRange.max) / 2)
    },
    {
      route: 'scrap',
      label: ROUTE_LABELS.scrap,
      expectedValue: scrapValue
    },
    {
      route: 'donate',
      label: ROUTE_LABELS.donate,
      expectedValue: 0
    }
  ];

  const recommendedRoute = chooseBestRoute(routeCandidates, normalizeText(payload.userPreference));
  const sortedRoutes = [...routeCandidates].sort((left, right) => right.expectedValue - left.expectedValue);
  const runnerUpRoute = sortedRoutes.find((candidate) => candidate.route !== recommendedRoute.route) || null;
 const marketSignals = {
  demand: demandContext.demand,
  demandScore: demandContext.demandScore,
  location: demandContext.location || null
};

  const conditionLabel = condition.label;
  const recommendationReason = getRecommendationReason(recommendedRoute, runnerUpRoute, marketSignals, conditionLabel);

  return {
    detectedItem: {
      category: detectedItem.category,
      brand: detectedItem.brand,
      model: detectedItem.model
    },
    condition: {
      label: condition.label,
      score: condition.score
    },
    valuation: {
      wholeValue,
      partsValue: partsEstimate.value,
      repairCost,
      auctionMin: auctionRange.min,
      auctionMax: auctionRange.max,
      scrapValue
    },
    recommendation: {
      route: recommendedRoute.route,
      label: recommendedRoute.label,
      reason: recommendationReason
    },
    confidence: calculateConfidence({
      detectedItem,
      condition,
      demandContext,
      visionResult,
      usedModelMatch: modelMatch
    }),
    marketSignals,
    components: partsEstimate.breakdown
  };
};

module.exports = {
  evaluate
};