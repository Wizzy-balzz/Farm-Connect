import { apiFetch } from "./api.js";

/**
 * Fetch verified order tracking timeline, source/destination coordinates, and OSRM route
 */
export async function fetchOrderTracking(orderId) {
  if (!orderId) throw new Error("Order ID is required.");
  return await apiFetch(`/api/orders/${encodeURIComponent(orderId)}/tracking`);
}

/**
 * Record a new authoritative checkpoint tracking event (Admin or authorized grower)
 */
export async function addTrackingEvent(orderId, { status, location, latitude, longitude, description }) {
  if (!orderId) throw new Error("Order ID is required.");
  return await apiFetch(`/api/orders/${encodeURIComponent(orderId)}/tracking`, {
    method: "POST",
    body: JSON.stringify({
      status,
      location,
      latitude: latitude !== undefined && latitude !== null && latitude !== "" ? parseFloat(latitude) : null,
      longitude: longitude !== undefined && longitude !== null && longitude !== "" ? parseFloat(longitude) : null,
      description
    })
  });
}
