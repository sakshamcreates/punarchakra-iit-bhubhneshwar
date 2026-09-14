export const businessOverview = {
  totalAssets: 500,
  expectedRecovery: 1840000,
  classifications: [
    { id: 'c1', category: 'Working', count: 280, percentage: 56 },
    { id: 'c2', category: 'Repairable', count: 110, percentage: 22 },
    { id: 'c3', category: 'Part Harvest', count: 60, percentage: 12 },
    { id: 'c4', category: 'Recycle', count: 30, percentage: 6 },
    { id: 'c5', category: 'Donation', count: 20, percentage: 4 },
  ],
};

export const csrMetrics = {
  devicesDonated: 120,
  studentsImpacted: 480,
  ewasteDivertedTonnes: 1.8,
  co2AvoidedTonnes: 14.2,
};

export const procurementMockSuppliers = [
  { id: 's1', name: 'Supplier A', type: 'Supplier', availableQuantity: 120, location: 'Delhi' },
  { id: 's2', name: 'Supplier B', type: 'Supplier', availableQuantity: 85, location: 'Gurgaon' },
  { id: 's3', name: 'Kabadiwala C', type: 'Kabadiwala', availableQuantity: 40, location: 'Noida' },
  { id: 's4', name: 'Repair Shop D', type: 'Repair Shop', availableQuantity: 150, location: 'Faridabad' },
  { id: 's5', name: 'Supplier E', type: 'Supplier', availableQuantity: 105, location: 'Delhi NCR' },
];
