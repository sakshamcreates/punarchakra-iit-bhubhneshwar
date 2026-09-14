const { randomUUID } = require("crypto");

const pickups = [
  {
    id: randomUUID(),
    seller: { id: "seller-demo-1", name: "Aditya" },
    kabadiwala: null,
    location: "Delhi",
    material: "Broken Laptop",
    estimated_value: 1100,
    quantity: 1,
    status: "available",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: randomUUID(),
    seller: { id: "seller-demo-2", name: "Demo Seller" },
    kabadiwala: null,
    location: "Noida",
    material: "Batteries",
    estimated_value: 1400,
    quantity: 8,
    status: "available",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: randomUUID(),
    seller: { id: "seller-demo-3", name: "Business Demo" },
    kabadiwala: null,
    location: "Gurgaon",
    material: "Mixed Metal",
    estimated_value: 850,
    quantity: 12,
    status: "available",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

function clonePickup(pickup) {
  return {
    ...pickup,
    seller: pickup.seller ? { ...pickup.seller } : null,
    kabadiwala: pickup.kabadiwala ? { ...pickup.kabadiwala } : null
  };
}

function getAllPickups() {
  return pickups.map(clonePickup);
}

function getPickupById(id) {
  const pickup = pickups.find((item) => item.id === id);
  return pickup ? clonePickup(pickup) : null;
}

function createPickup(data) {
  const now = new Date().toISOString();

  const pickup = {
    id: data.id || randomUUID(),
    seller: data.seller,
    kabadiwala: null,
    location: data.location,
    material: data.material,
    estimated_value: Number(data.estimated_value),
    quantity: Number(data.quantity || 1),
    status: "available",
    created_at: now,
    updated_at: now
  };

  pickups.push(pickup);
  return clonePickup(pickup);
}

function updatePickup(id, updates) {
  const index = pickups.findIndex((item) => item.id === id);

  if (index === -1) {
    return null;
  }

  pickups[index] = {
    ...pickups[index],
    ...updates,
    updated_at: new Date().toISOString()
  };

  return clonePickup(pickups[index]);
}

function getKabadiwalaPickups(kabadiwalaId) {
  return pickups
    .filter((pickup) => pickup.kabadiwala?.id === kabadiwalaId)
    .map(clonePickup);
}

function getSellerPickups(sellerId) {
  return pickups
    .filter((pickup) => pickup.seller?.id === sellerId)
    .map(clonePickup);
}

function removeWhere(predicate) {
  let removed = 0;
  for (let index = pickups.length - 1; index >= 0; index -= 1) {
    if (predicate(pickups[index])) {
      pickups.splice(index, 1);
      removed += 1;
    }
  }
  return removed;
}

module.exports = {
  getAllPickups,
  getPickupById,
  createPickup,
  updatePickup,
  getKabadiwalaPickups,
  getSellerPickups,
  removeWhere
};
