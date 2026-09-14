import { businessOverview, csrMetrics, procurementMockSuppliers } from "../data/businessMockData";

export function getBusinessOverview() {
  return Promise.resolve({ ...businessOverview });
}

export function getCSRMetrics() {
  return Promise.resolve({ ...csrMetrics });
}

export function uploadAssetBatch(file) {
  // Simulate upload delay and return a summary
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ success: true, uploaded: 500 });
    }, 900);
  });
}

export function getAssetClassification() {
  return Promise.resolve(businessOverview.classifications.map((c) => ({ ...c })));
}

export function getSellingStrategy() {
  // Simulate a computed strategy
  return Promise.resolve({
    strategy: businessOverview.classifications,
    expectedRecovery: businessOverview.expectedRecovery,
  });
}

export function searchProcurement(request) {
  // request: { query, quantity, location }
  // For demo, return the mock suppliers but pretend it's async
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(procurementMockSuppliers.map((s) => ({ ...s })));
    }, 600);
  });
}
