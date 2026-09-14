const path = require("path");

/*
 * Punarchakra — Autonomous E-Waste Resolution Agent
 * Phase 7: Hero Demo Scenario — deterministic demo data
 *
 * This module holds ONLY static, hand-picked constants describing the
 * hackathon hero-demo item (a damaged electronic PCB) and where its
 * demo inspection photo lives on disk. It contains no logic, no
 * randomness, and no valuation/scoring math of its own — every number
 * a route decision depends on (wholeValue, partsValue, scrapValue,
 * repairCost, auction range) is still produced entirely by the real
 * aiDecisionService.evaluate(), exactly as it already is for every
 * other listing. This file only supplies the deterministic INPUTS
 * (category, condition, location, ...) that get fed into that
 * existing engine, so the same engine produces the same outputs every
 * time this scenario runs.
 *
 * Nothing here is real customer data — seller id, description and
 * image URL are all synthetic placeholders in the same style already
 * used by the seed listings in listingRepository.js.
 */

// Fields accepted by listingRepository.create(). Kept in the same
// shape as the pre-existing seed listings (category/subcategory split,
// example.com placeholder image, etc.) so the demo item is completely
// ordinary from the rest of the system's point of view — it is only
// "the hero demo item" because heroDemoService remembers its id, not
// because the listing itself is special-cased anywhere.
const DEMO_ITEM_SEED = Object.freeze({
  seller_id: "demo_seller_pcb_001",
  category: "electronics",
  subcategory: "pcb",
  brand: "Generic",
  model: "Motherboard-X1",
  condition: "poor",
  description:
    "Hero-demo item: a printed circuit board / motherboard recovered from " +
    "e-waste intake, visibly damaged (burn marks, failed capacitors). Used " +
    "to exercise the full agent resolution pipeline end-to-end.",
  images: ["https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/PCB_design_and_realisation_smt_and_through_hole.jpg/320px-PCB_design_and_realisation_smt_and_through_hole.jpg"],
  price: 0,
  location: "Bangalore",
  sale_type: "fixed",
  status: "active",
});


// Real, already-included training image for the exact ML class this
// scenario targets ("PCB" — see ml-service/artifacts/class_names.json).
// Pointing the demo at this file lets inspect_item run the REAL
// classification pipeline (mlService.classifyEWaste -> FastAPI
// /scrap/classify -> ONNX MobileNetV3) instead of a fabricated
// classifier result. If the ml-service process isn't running (or this
// repo checkout doesn't have the ml-service data folder), callers
// should say so plainly rather than pretending inspection ran for
// real — see testphase7.js.
const DEMO_INSPECTION_IMAGE_PATH = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "ml-service",
  "data",
  "scrap",
  "train",
  "PCB",
  "pcb_0.jpg",
);

// --------------------------------------------------------------
// Phase 8: deterministic failure-demo constants (CONSUMED)
// --------------------------------------------------------------
/*
 * Phase 8 (deterministic failure simulation) makes the hero story real:
 * repair is attempted first, a required component turns out to be
 * unavailable during execution, and the agent observes the resulting
 * `REQUIRED_COMPONENT_UNAVAILABLE` failure. The demo environment
 * (services/demoEnvironmentService.js) consumes the two constants
 * below — they are the DETERMINISTIC environment inputs that drive the
 * scenario, never random/time/probabilistic values.
 *
 * The label names the component the environment reports as out of stock
 * when the repair execution attempt happens (the scenario turns it
 * unavailable AT EXECUTION TIME only — at decision time repair is still
 * a viable candidate, so the agent genuinely chooses it first).
 */
const DEMO_REQUIRED_COMPONENT_LABEL = "Replacement PCB fuse / capacitor set";

/*
 * The simulated repair supplier's net quote for the hero item —
 * repaired-sale value minus repair cost as reported by the demo
 * environment's third-party repair provider. Repair quotes come from
 * external providers, not from the valuation engine, so supplying one
 * here mimics a real environment input the decision layer would consume.
 * It is set comfortably above every route the valuation engine computes
 * for the deterministic hero item (parts ≈ 1599, whole ≈ 997, ...), so
 * the REAL, unmodified decision policy selects "repair" by ranking on
 * this value — the route is never hardcoded by the test harness.
 */
const DEMO_REPAIR_SUPPLIER_NET_VALUE = 12000;

/*
 * Phase 8 narrative context. What was a Phase 7 "preview — descriptive
 * only" note is now a real, executed scenario: the constants above are
 * read by demoEnvironmentService (which the agent's decision + execution
 * layers consult), so this comment records the story the numbers stand
 * for rather than the only thing describing it.
 */
const DEMO_PHASE8_PREVIEW_NOTES = Object.freeze({
  narrative:
    "Repair is attempted first, a required component turns out to be " +
    "unavailable, the agent observes the failure, replans, and falls " +
    "back to parts recovery.",
  requiredComponentLabel: DEMO_REQUIRED_COMPONENT_LABEL,
  status: "implemented in Phase 8 (deterministic failure simulation) + Phase 9 " +
    "(autonomous replanning: repair excluded, parts recovery selected and executed).",
});

module.exports = {
  DEMO_ITEM_SEED,
  DEMO_INSPECTION_IMAGE_PATH,
  DEMO_REQUIRED_COMPONENT_LABEL,
  DEMO_REPAIR_SUPPLIER_NET_VALUE,
  DEMO_PHASE8_PREVIEW_NOTES,
};
