const fs = require("fs");
const path = require("path");
const listingRepository = require("../data/listingRepository");
const agentRepository = require("../data/agentRepository");
const auctionRepository = require("../data/auctionRepository");
const pickupRepository = require("../data/pickupRepository");
const demoEnvironmentService = require("./demoEnvironmentService");
const {
  DEMO_ITEM_SEED,
  DEMO_INSPECTION_IMAGE_PATH,
} = require("../data/heroDemoData");
const { DEMO_ITEMS, DEMO_SCENARIOS } = require("../data/demo/demoData");

let demoItemId = null;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function cloneHeroSeed() {
  return {
    ...DEMO_ITEM_SEED,
    images: [...DEMO_ITEM_SEED.images],
  };
}

function createOrReplaceDemoListing(seed) {
  const existing = listingRepository.findById(seed.id);
  if (existing) {
    return listingRepository.update(seed.id, {
      ...clone(seed),
      resolution: undefined,
    });
  }
  return listingRepository.create(clone(seed));
}

function ensureDemoItem() {
  if (demoItemId) {
    const existing = listingRepository.findById(demoItemId);
    if (existing) {
      demoEnvironmentService.setDemoItemId(existing.id);
      return existing;
    }
    demoItemId = null;
  }

  const created = listingRepository.create(cloneHeroSeed());
  demoItemId = created.id;
  demoEnvironmentService.setDemoItemId(created.id);

  return created;
}

function getDemoItemId() {
  return demoItemId;
}

function clearDomainRecordsForItem(itemId) {
  const removedAuctions = auctionRepository.removeWhere
    ? auctionRepository.removeWhere((auction) => auction.listing_id === itemId)
    : 0;
  const removedPickups = pickupRepository.removeWhere
    ? pickupRepository.removeWhere((pickup) => pickup.seller && pickup.seller.id === itemId)
    : 0;
  return { removedAuctions, removedPickups };
}

function resetDemoItem() {
  const item = ensureDemoItem();

  agentRepository.deleteSessionsForItem(item.id);
  demoEnvironmentService.reset();
  clearDomainRecordsForItem(item.id);

  const seed = cloneHeroSeed();
  const restored = listingRepository.update(item.id, {
    seller_id: seed.seller_id,
    category: seed.category,
    subcategory: seed.subcategory,
    brand: seed.brand,
    model: seed.model,
    condition: seed.condition,
    description: seed.description,
    images: seed.images,
    price: seed.price,
    location: seed.location,
    sale_type: seed.sale_type,
    status: seed.status,
    resolution: undefined,
  });

  return restored;
}

function ensureEnterpriseDemoData() {
  Object.values(DEMO_ITEMS).forEach((item) => {
    createOrReplaceDemoListing(item);
  });
  demoEnvironmentService.setDemoItemId("item-demo-001");
  return Object.values(DEMO_ITEMS).map((item) => listingRepository.findById(item.id));
}

function resetEnterpriseDemo(scenarioId = null) {
  Object.values(DEMO_ITEMS).forEach((item) => {
    agentRepository.deleteSessionsForItem(item.id);
    clearDomainRecordsForItem(item.id);
    createOrReplaceDemoListing(item);
  });
  demoEnvironmentService.reset();
  demoEnvironmentService.setDemoItemId("item-demo-001");
  if (scenarioId) {
    demoEnvironmentService.setActiveScenario(scenarioId);
  }
  return {
    listings: ensureEnterpriseDemoData(),
    simulation: demoEnvironmentService.getSimulationState(),
    scenarios: demoEnvironmentService.listScenarios(),
  };
}

function resetScenario(scenarioId) {
  const scenario = DEMO_SCENARIOS[scenarioId];
  if (!scenario) {
    const error = new Error(`Unknown demo scenario: ${scenarioId}`);
    error.status = 404;
    throw error;
  }
  resetEnterpriseDemo(scenarioId);
  return listingRepository.findById(scenario.itemId);
}

function hasDemoInspectionImage() {
  try {
    return fs.existsSync(DEMO_INSPECTION_IMAGE_PATH);
  } catch (error) {
    return false;
  }
}

module.exports = {
  ensureDemoItem,
  getDemoItemId,
  resetDemoItem,
  hasDemoInspectionImage,
  DEMO_INSPECTION_IMAGE_PATH,
  ensureEnterpriseDemoData,
  resetEnterpriseDemo,
  resetScenario,
};
