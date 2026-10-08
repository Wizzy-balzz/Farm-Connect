import { apiFetch } from "./api.js";

export async function fetchCrops(params = {}) {
  const queryParams = new URLSearchParams();
  if (params.q) queryParams.append("q", params.q);
  if (params.category) queryParams.append("category", params.category);
  if (params.season) queryParams.append("season", params.season);
  if (params.region) queryParams.append("region", params.region);

  const url = `/api/farming-guide/crops${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
  return apiFetch(url);
}

export async function fetchCropDetail(cropId) {
  return apiFetch(`/api/farming-guide/crops/${cropId}`);
}

export async function checkSoilCompatibility(payload) {
  return apiFetch("/api/farming-guide/soil-compatibility", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function fetchCropCalendar(cropId) {
  return apiFetch(`/api/farming-guide/crops/${cropId}/calendar`);
}

export async function getRotationRecommendations(payload) {
  return apiFetch("/api/farming-guide/rotation/recommend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function fetchSeedSowingGuide(cropId) {
  return apiFetch(`/api/farming-guide/crops/${cropId}/seed-sowing`);
}

export async function fetchIrrigationGuide(cropId) {
  return apiFetch(`/api/farming-guide/crops/${cropId}/irrigation`);
}

export async function fetchNutrientGuide(cropId) {
  return apiFetch(`/api/farming-guide/crops/${cropId}/nutrients`);
}

export async function fetchPestGuide(cropId) {
  return apiFetch(`/api/farming-guide/crops/${cropId}/pests`);
}

export async function fetchHarvestGuide(cropId) {
  return apiFetch(`/api/farming-guide/crops/${cropId}/harvest`);
}

export async function fetchPostHarvestGuide(cropId) {
  return apiFetch(`/api/farming-guide/crops/${cropId}/post-harvest`);
}

// Farm Diary APIs
export async function fetchDiaryRecords() {
  return apiFetch("/api/farm-diary/records");
}

export async function createDiaryRecord(payload) {
  return apiFetch("/api/farm-diary/records", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function deleteDiaryRecord(id) {
  return apiFetch(`/api/farm-diary/records/${id}`, {
    method: "DELETE"
  });
}

// Farm Economics APIs
export async function calculateEconomics(payload) {
  return apiFetch("/api/farming-guide/economics/calculate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

// Signature Farm Planner APIs
export async function getPlannerRecommendations(payload) {
  return apiFetch("/api/farm-planner/recommend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}
