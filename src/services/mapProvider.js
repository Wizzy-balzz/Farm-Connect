/**
 * FarmConnect Map Provider Abstraction
 * Decouples map implementation from specific map vendor (Mapbox / Leaflet / Fallback)
 */

export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || "";

/**
 * Haversine formula to calculate distance between two coordinates in kilometers
 */
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Format distance string nicely (e.g. "4.2 km")
 */
export function formatDistance(distanceKm) {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm} km`;
}

/**
 * Check if Mapbox or map service is configured and available
 */
export function isMapServiceAvailable() {
  return typeof window !== "undefined" && Boolean(MAPBOX_TOKEN);
}

export const MapProvider = {
  isAvailable: isMapServiceAvailable,
  calculateDistance: calculateDistanceKm,
  formatDistance: formatDistance
};
