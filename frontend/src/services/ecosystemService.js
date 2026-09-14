import {
  compatiblePartDevices,
  compatiblePartsByDevice,
  recyclerDemand,
  aggregatedMaterialSupply
} from "../data/ecosystemMockData.js";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getAvailableDevices() {
  await delay(120);
  return compatiblePartDevices;
}

export async function getCompatibleParts(device) {
  await delay(160);
  return compatiblePartsByDevice[device] ?? [];
}

export async function postPartRequirement(requirement) {
  await delay(220);
  return {
    success: true,
    message: "Requirement posted successfully.",
    requirementId: `req-${Date.now()}`,
    payload: requirement
  };
}

export async function getRecyclerDemand() {
  await delay(150);
  return recyclerDemand;
}

export async function getAggregatedMaterialSupply() {
  await delay(180);
  return aggregatedMaterialSupply;
}
