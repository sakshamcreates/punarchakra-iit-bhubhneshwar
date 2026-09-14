# Frontend ↔ Backend Integration Contract

The goal is to make the frontend work now with mocks, while allowing the backend to replace only service internals later.

## Kabadiwala

Suggested frontend service functions:

```js
getKabadiwalaOverview()
getNearbyPickups()
acceptPickup(pickupId)
getRoutePlan()
getInventory()
```

Possible future API mapping:

```text
GET  /api/partner/overview
GET  /api/partner/pickups
POST /api/partner/pickups/:id/accept
GET  /api/partner/routes/today
GET  /api/partner/inventory
```

Pickup shape:

```js
{
  id: "pickup_101",
  title: "Broken Laptop",
  category: "electronics",
  distanceKm: 2.1,
  estimatedValueMin: 800,
  estimatedValueMax: 1200,
  weightKg: 2.4,
  area: "Lajpat Nagar",
  status: "available"
}
```

Inventory shape:

```js
{
  id: "material_copper",
  material: "Copper",
  quantity: 42,
  unit: "kg",
  estimatedValue: 26700,
  demandTrend: 18
}
```

## Business

Suggested frontend service functions:

```js
getBusinessOverview()
uploadAssetBatch(file, type)
getAssetClassification(batchId)
getSellingStrategy(batchId)
getCSRMetrics()
searchProcurement(request)
```

Possible future API mapping:

```text
GET  /api/business/overview
POST /api/business/assets/upload
GET  /api/business/assets/:batchId/classification
GET  /api/business/assets/:batchId/strategy
GET  /api/business/csr
POST /api/business/procurement/search
```

Procurement request:

```js
{
  query: "laptop SSD",
  quantity: 500,
  location: "Delhi NCR"
}
```

Procurement response:

```js
{
  requestedQuantity: 500,
  matchedQuantity: 500,
  matches: [
    {
      id: "supplier_a",
      name: "Supplier A",
      type: "supplier",
      availableQuantity: 120,
      location: "Delhi"
    }
  ]
}
```

## Key rule

Pages/components should never care whether data came from:

- hard-coded demo mock
- REST API
- database
- WebSocket
- ERP connector

They call the service layer and render the returned object.

That is the boundary that keeps frontend work reusable.
