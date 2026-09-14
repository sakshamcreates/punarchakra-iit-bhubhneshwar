import apiClient from "./apiClient";


export async function getNearbyPickups(
  location,
  limit = 8
) {
  const response = await apiClient.get(
    "/pickups/nearby",
    {
      params: {
        location,
        limit
      }
    }
  );

  return response?.data || response || [];
}


export async function getKabadiwalaPickups(
  kabadiwalaId
) {
  const response = await apiClient.get(
    `/pickups/kabadiwala/${kabadiwalaId}`
  );

  return response?.data || response || [];
}


export async function getKabadiwalaStats(
  kabadiwalaId,
  location
) {
  const response = await apiClient.get(
    `/pickups/kabadiwala/${kabadiwalaId}/stats`,
    {
      params: {
        location
      }
    }
  );

  return response?.data || response;
}


export async function getRoutePlan(
  kabadiwalaId,
  location
) {
  const response = await apiClient.get(
    `/pickups/kabadiwala/${kabadiwalaId}/route`,
    {
      params: {
        location
      }
    }
  );

  return response?.data || response;
}


export async function acceptPickup(
  pickupId,
  kabadiwala
) {
  const response = await apiClient.post(
    `/pickups/${pickupId}/accept`,
    {
      kabadiwala
    }
  );

  return response?.data || response;
}


export async function advancePickup(
  pickupId
) {
  const response = await apiClient.post(
    `/pickups/${pickupId}/advance`,
    {}
  );

  return response?.data || response;
}


export async function updatePickupStatus(
  pickupId,
  status
) {
  const response = await apiClient.put(
    `/pickups/${pickupId}/status`,
    {
      status
    }
  );

  return response?.data || response;
}


export async function createPickup(
  data
) {
  const response = await apiClient.post(
    "/pickups",
    data
  );

  return response?.data || response;
}