import { apiFetch } from "./api.js";

/**
 * Fetch filter drop-down options (crops, categories, processing methods)
 */
export async function getValueAdditionFilters() {
  const res = await apiFetch("/api/value-addition/filters");
  return res.data;
}

/**
 * Fetch value-added products list with optional filters & search
 */
export async function getValueAdditionProducts(filters = {}) {
  const params = new URLSearchParams();
  if (filters.search) params.append("search", filters.search);
  if (filters.crop && filters.crop !== "All") params.append("crop", filters.crop);
  if (filters.category && filters.category !== "All") params.append("category", filters.category);
  if (filters.method && filters.method !== "All") params.append("method", filters.method);

  const queryString = params.toString();
  const endpoint = `/api/value-addition/products${queryString ? `?${queryString}` : ""}`;

  const res = await apiFetch(endpoint);
  return res.data;
}

/**
 * Fetch detailed single product guide details
 */
export async function getValueAdditionProductDetail(id) {
  const res = await apiFetch(`/api/value-addition/products/${id}`);
  return res.data;
}

/**
 * Perform Value Addition Financial Calculation via backend
 */
export async function calculateValueAddition(payload) {
  const res = await apiFetch("/api/value-addition/calculate", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  return res.data;
}

/**
 * Fetch equipment listing with optional filters & search
 */
export async function getValueAdditionEquipment(filters = {}) {
  const params = new URLSearchParams();
  if (filters.search) params.append("search", filters.search);
  if (filters.crop && filters.crop !== "All") params.append("crop", filters.crop);
  if (filters.category && filters.category !== "All") params.append("category", filters.category);
  if (filters.method && filters.method !== "All") params.append("method", filters.method);

  const queryString = params.toString();
  const endpoint = `/api/value-addition/equipment${queryString ? `?${queryString}` : ""}`;

  const res = await apiFetch(endpoint);
  return res.data;
}

/**
 * Fetch detailed equipment item details by ID
 */
export async function getValueAdditionEquipmentDetail(id) {
  const res = await apiFetch(`/api/value-addition/equipment/${id}`);
  return res.data;
}

/**
 * Save a new farmer processing project
 */
export async function saveValueAdditionProject(payload) {
  const res = await apiFetch("/api/value-addition/projects", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  return res.data;
}

/**
 * Fetch all saved processing projects for the current farmer
 */
export async function getValueAdditionProjects() {
  const res = await apiFetch("/api/value-addition/projects");
  return res.data;
}

/**
 * Fetch single saved processing project by ID
 */
export async function getValueAdditionProject(id) {
  const res = await apiFetch(`/api/value-addition/projects/${id}`);
  return res.data;
}

/**
 * Delete a saved processing project by ID
 */
export async function deleteValueAdditionProject(id) {
  const res = await apiFetch(`/api/value-addition/projects/${id}`, {
    method: "DELETE"
  });
  return res.data;
}

/**
 * Fetch government schemes mapped to a specific value-added product
 */
export async function getValueAdditionProductSchemes(productId) {
  const res = await apiFetch(`/api/value-addition/products/${productId}/schemes`);
  return res.data;
}

/**
 * Fetch all supported government schemes with optional filters
 */
export async function getValueAdditionSchemes(filters = {}) {
  const params = new URLSearchParams();
  if (filters.search) params.append("search", filters.search);
  if (filters.crop && filters.crop !== "All") params.append("crop", filters.crop);

  const queryString = params.toString();
  const endpoint = `/api/value-addition/schemes${queryString ? `?${queryString}` : ""}`;

  const res = await apiFetch(endpoint);
  return res;
}


