export const compatiblePartDevices = [
  { id: "device-dell-5420", label: "Dell Latitude 5420" },
  { id: "device-apple-mbp-2020", label: "Apple MacBook Pro 13\" (2020)" },
  { id: "device-hp-elitebook", label: "HP EliteBook 840 G5" }
];

export const compatiblePartsByDevice = {
  "Dell Latitude 5420": [
    {
      id: "part-ssd-512",
      partName: "512 GB SSD",
      compatibilityScore: 98,
      availableQuantity: 34,
      estimatedPriceRange: "₹4,800 - ₹5,200"
    },
    {
      id: "part-battery-5420",
      partName: "Battery",
      compatibilityScore: 92,
      availableQuantity: 12,
      estimatedPriceRange: "₹2,200 - ₹2,600"
    },
    {
      id: "part-display-5420",
      partName: "Display",
      compatibilityScore: 89,
      availableQuantity: 6,
      estimatedPriceRange: "₹6,100 - ₹6,700"
    },
    {
      id: "part-ram-16gb",
      partName: "16 GB RAM",
      compatibilityScore: 94,
      availableQuantity: 48,
      estimatedPriceRange: "₹1,900 - ₹2,200"
    }
  ],
  "Apple MacBook Pro 13\" (2020)": [
    {
      id: "part-ssd-mbp",
      partName: "512 GB SSD",
      compatibilityScore: 96,
      availableQuantity: 18,
      estimatedPriceRange: "₹8,200 - ₹8,900"
    },
    {
      id: "part-battery-mbp",
      partName: "Battery",
      compatibilityScore: 90,
      availableQuantity: 9,
      estimatedPriceRange: "₹5,400 - ₹5,900"
    }
  ],
  "HP EliteBook 840 G5": [
    {
      id: "part-ssd-hp",
      partName: "512 GB SSD",
      compatibilityScore: 95,
      availableQuantity: 22,
      estimatedPriceRange: "₹4,300 - ₹4,700"
    },
    {
      id: "part-ram-hp",
      partName: "16 GB RAM",
      compatibilityScore: 91,
      availableQuantity: 28,
      estimatedPriceRange: "₹1,850 - ₹2,050"
    }
  ]
};

export const recyclerDemand = [
  { id: "demand-copper", material: "Copper", demandTonnes: 5 },
  { id: "demand-pcb", material: "PCB", demandTonnes: 3 },
  { id: "demand-battery", material: "Battery", demandTonnes: 8 },
  { id: "demand-plastic", material: "Plastic", demandTonnes: 12 }
];

export const aggregatedMaterialSupply = [
  {
    id: "supply-copper",
    material: "Copper",
    demandTonnes: 5,
    availableTonnes: 4.2,
    sources: [
      { source: "Kabadiwalas", tonnes: 1.8 },
      { source: "Businesses", tonnes: 1.4 },
      { source: "Repair Shops", tonnes: 0.6 },
      { source: "Consumers", tonnes: 0.4 }
    ]
  },
  {
    id: "supply-pcb",
    material: "PCB",
    demandTonnes: 3,
    availableTonnes: 2.7,
    sources: [
      { source: "Kabadiwalas", tonnes: 1.0 },
      { source: "Businesses", tonnes: 0.7 },
      { source: "Repair Shops", tonnes: 0.5 },
      { source: "Consumers", tonnes: 0.5 }
    ]
  },
  {
    id: "supply-battery",
    material: "Battery",
    demandTonnes: 8,
    availableTonnes: 7.1,
    sources: [
      { source: "Kabadiwalas", tonnes: 2.6 },
      { source: "Businesses", tonnes: 2.2 },
      { source: "Repair Shops", tonnes: 1.4 },
      { source: "Consumers", tonnes: 1.0 }
    ]
  },
  {
    id: "supply-plastic",
    material: "Plastic",
    demandTonnes: 12,
    availableTonnes: 10.5,
    sources: [
      { source: "Kabadiwalas", tonnes: 3.7 },
      { source: "Businesses", tonnes: 3.1 },
      { source: "Repair Shops", tonnes: 2.1 },
      { source: "Consumers", tonnes: 1.6 }
    ]
  }
];
