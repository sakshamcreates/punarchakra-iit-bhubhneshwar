import apiClient from "./apiClient";

export async function findMatches(data) {
  const response = await apiClient.post(
    "/matching/find",
    data
  );

  return response?.data || response;
}   