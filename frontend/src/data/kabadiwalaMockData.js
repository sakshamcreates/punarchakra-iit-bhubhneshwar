export const kabadiwalaOverview = {
  todaysEarnings: 3420,
  availablePickups: 8,
  inventoryValue: 28700,
  suggestedMaterial: {
    material: "Copper",
    note: "High Demand",
  },
};

export const kabadiwalaPickups = [
  {
    id: "p1",
    item: "Broken Laptop",
    estimatedValue: "₹800–₹1,200",
    distanceKm: 2.1,
    weightKg: 3,
    area: "Sector 18",
    status: "available",
    lat: null,
    lng: null,
  },
  {
    id: "p2",
    item: "12kg Mixed Metal",
    estimatedValue: "₹600",
    distanceKm: 1.4,
    weightKg: 12,
    area: "Old Town",
    status: "available",
    lat: null,
    lng: null,
  },
  {
    id: "p3",
    item: "Batteries",
    estimatedValue: "₹1,400",
    distanceKm: 3.2,
    weightKg: 5,
    area: "Industrial Park",
    status: "available",
    lat: null,
    lng: null,
  },
];

export const kabadiwalaInventory = [
  { id: "i1", material: "Copper", quantity: 42, unit: "kg", estimatedValue: 22000, demandTrend: "+18%" },
  { id: "i2", material: "Aluminium", quantity: 31, unit: "kg", estimatedValue: 4300, demandTrend: "-5%" },
  { id: "i3", material: "Laptops", quantity: 8, unit: "pcs", estimatedValue: 32000, demandTrend: "+2%" },
  { id: "i4", material: "Batteries", quantity: 22, unit: "pcs", estimatedValue: 5600, demandTrend: "+7%" },
  { id: "i5", material: "PCB", quantity: 18, unit: "kg", estimatedValue: 4500, demandTrend: "+10%" },
];

export const kabadiwalaRoute = {
  stops: [
    { id: "r1", name: "Pickup 1", type: "pickup", refId: "p2" },
    { id: "r2", name: "Pickup 2", type: "pickup", refId: "p1" },
    { id: "r3", name: "Pickup 3", type: "pickup", refId: "p3" },
    { id: "r4", name: "Warehouse", type: "warehouse" },
  ],
  totalDistanceKm: 12.4,
  estimatedFuelCost: 110,
};
