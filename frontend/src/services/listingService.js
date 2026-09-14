import apiClient from "./apiClient";

function normalizeListing(apiListing) {
  if (!apiListing) return null;

  const price = Number(apiListing.price || 0);
  const saleType = apiListing.sale_type || "fixed";
  const listingType = apiListing.subcategory || "whole";

  return {
    id: apiListing.id,
    title: `${apiListing.brand || "Device"} ${apiListing.model || "Listing"}`.trim(),
    category: apiListing.category || "laptop",
    type: listingType === "component" || apiListing.subcategory === "component" ? "component" : "whole",
    saleType,
    condition: apiListing.condition || "Good",
    conditionScore: 7,
    price,
    currentBid: saleType === "auction" ? price : null,
    location: apiListing.location || "Delhi",
    distanceKm: 10,
    seller: apiListing.seller_id || "Punarchakra Seller",
    sellerVerified: true,
    sellerRating: 4.6,
    specifications: {
      brand: apiListing.brand,
      model: apiListing.model,
      description: apiListing.description
    },
    images: Array.isArray(apiListing.images) && apiListing.images.length > 0 ? apiListing.images : ["https://via.placeholder.com/400?text=Listing"],
    description: apiListing.description,
    sale_type: saleType,
    status: apiListing.status,
    createdAt: apiListing.createdAt,
    updatedAt: apiListing.updatedAt
  };
}

export async function getListings(filters = {}) {
  const response = await apiClient.get("/listings", { params: filters });
  const payload = response?.data || response;
  const list = Array.isArray(payload) ? payload : payload?.data || [];
  return list.map(normalizeListing).filter(Boolean);
}

export async function getListing(id) {
  const response = await apiClient.get(`/listings/${id}`);
  const payload = response?.data || response;
  return normalizeListing(payload);
}

export async function createListing(data) {
  const response = await apiClient.post("/listings", data);
  const payload = response?.data || response;
  return normalizeListing(payload);
}

export async function updateListing(id, data) {
  const response = await apiClient.put(`/listings/${id}`, data);
  const payload = response?.data || response;
  return normalizeListing(payload);
}

export async function deleteListing(id) {
  return apiClient.delete(`/listings/${id}`);
}
