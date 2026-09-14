import apiClient from "./apiClient";


export async function getAuctions() {
  const response =
    await apiClient.get(
      "/auction"
    );

  const payload =
    response?.data ||
    response;

  return Array.isArray(payload)
    ? payload
    : [];
}


export async function getAuction(id) {
  const response =
    await apiClient.get(
      `/auction/${id}`
    );

  return (
    response?.data ||
    response
  );
}


export async function createAuction(
  data
) {
  const response =
    await apiClient.post(
      "/auction",
      data
    );

  return (
    response?.data ||
    response
  );
}


export async function placeAuctionBid(
  id,
  {
    amount,
    bidder
  }
) {
  const response =
    await apiClient.post(
      `/auction/${id}/bid`,
      {
        amount,
        bidder
      }
    );

  return (
    response?.data ||
    response
  );
}