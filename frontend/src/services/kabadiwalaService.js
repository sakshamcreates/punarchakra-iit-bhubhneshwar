import {
  kabadiwalaOverview,
  kabadiwalaPickups as initialPickups,
  kabadiwalaInventory as initialInventory,
  kabadiwalaRoute as initialRoute,
} from "../data/kabadiwalaMockData";

// Keep mutable copies inside the service so later we can replace with API calls
let pickups = initialPickups.map((p) => ({ ...p }));
let inventory = initialInventory.map((i) => ({ ...i }));
let route = { ...initialRoute, stops: initialRoute.stops.map((s) => ({ ...s })) };

export function getKabadiwalaOverview() {
  return Promise.resolve({ ...kabadiwalaOverview });
}

export function getNearbyPickups() {
  // Return a copy so callers don't accidentally mutate service state
  return Promise.resolve(pickups.map((p) => ({ ...p })));
}

export function getInventory() {
  return Promise.resolve(inventory.map((i) => ({ ...i })));
}

export function getRoutePlan() {
  return Promise.resolve({ ...route, stops: route.stops.map((s) => ({ ...s })) });
}

// Isolated accept pickup function to later become an API call
export function acceptPickup(pickupId) {
  const idx = pickups.findIndex((p) => p.id === pickupId);
  if (idx === -1) return Promise.reject(new Error("Pickup not found"));
  if (pickups[idx].status === "accepted") return Promise.resolve(pickups[idx]);
  pickups[idx] = { ...pickups[idx], status: "accepted" };
  return Promise.resolve({ ...pickups[idx] });
}

export function refreshDataForTests() {
  pickups = initialPickups.map((p) => ({ ...p }));
  inventory = initialInventory.map((i) => ({ ...i }));
  route = { ...initialRoute, stops: initialRoute.stops.map((s) => ({ ...s })) };
}
