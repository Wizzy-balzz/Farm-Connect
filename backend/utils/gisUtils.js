/**
 * FarmConnect GIS & Geodesic Utility Functions
 * Implements standard spherical geometry calculation (WGS84) & GeoJSON validation
 */

const WGS84_RADIUS_METERS = 6378137;
const SQ_METERS_PER_ACRE = 4046.8564224;
const SQ_METERS_PER_HECTARE = 10000;

/**
 * Validates a GeoJSON Polygon object according to RFC 7946 specifications
 * @param {object|string} geojson - The GeoJSON object or JSON string to validate
 * @returns {{ valid: boolean, error: string|null, parsed?: object }}
 */
export function validateGeoJsonPolygon(geojson) {
  if (!geojson) {
    return { valid: false, error: "GeoJSON geometry is required." };
  }

  let obj = geojson;
  if (typeof geojson === "string") {
    try {
      obj = JSON.parse(geojson);
    } catch {
      return { valid: false, error: "Invalid GeoJSON string: failed to parse JSON." };
    }
  }

  if (typeof obj !== "object" || obj === null) {
    return { valid: false, error: "GeoJSON must be a non-null object." };
  }

  if (obj.type !== "Polygon") {
    return { valid: false, error: `Invalid GeoJSON type '${obj.type}'. Only 'Polygon' is supported.` };
  }

  if (!Array.isArray(obj.coordinates) || obj.coordinates.length === 0) {
    return { valid: false, error: "Polygon must contain an array of coordinate rings." };
  }

  const ring = obj.coordinates[0];
  if (!Array.isArray(ring) || ring.length < 4) {
    return { valid: false, error: "Polygon exterior ring must have at least 4 coordinate pairs (3 vertices + closing)." };
  }

  if (ring.length > 500) {
    return { valid: false, error: "Polygon has too many coordinates (maximum 500 points allowed)." };
  }

  for (let i = 0; i < ring.length; i++) {
    const pt = ring[i];
    if (!Array.isArray(pt) || pt.length < 2) {
      return { valid: false, error: `Coordinate at index ${i} is not a valid [lng, lat] pair.` };
    }

    const lng = Number(pt[0]);
    const lat = Number(pt[1]);

    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      return { valid: false, error: `Coordinate at index ${i} contains non-finite or NaN values.` };
    }

    if (lng < -180 || lng > 180) {
      return { valid: false, error: `Longitude ${lng} at index ${i} is out of bounds (-180 to 180).` };
    }

    if (lat < -90 || lat > 90) {
      return { valid: false, error: `Latitude ${lat} at index ${i} is out of bounds (-90 to 90).` };
    }
  }

  // Ensure polygon is closed: first and last coordinates must match
  const first = ring[0];
  const last = ring[ring.length - 1];
  const diffLng = Math.abs(first[0] - last[0]);
  const diffLat = Math.abs(first[1] - last[1]);

  if (diffLng > 1e-6 || diffLat > 1e-6) {
    return { valid: false, error: "Polygon ring must be closed (first and last coordinates must be identical)." };
  }

  return { valid: true, error: null, parsed: obj };
}

/**
 * Calculates accurate geodesic area of a polygon exterior ring on a WGS84 sphere
 * Uses Chamberlain-Duquette / Gauss spherical polygon algorithm
 * @param {Array<[number, number]>} ring - Array of [lng, lat] coordinate pairs
 * @returns {{ areaSqm: number, areaAcres: number, areaHectares: number }}
 */
export function calculateGeodesicArea(ring) {
  if (!Array.isArray(ring) || ring.length < 4) {
    return { areaSqm: 0, areaAcres: 0, areaHectares: 0 };
  }

  let total = 0;
  const len = ring.length;

  for (let i = 0; i < len - 1; i++) {
    const p1 = ring[i];
    const p2 = ring[i + 1];

    const lam1 = (p1[0] * Math.PI) / 180;
    const lam2 = (p2[0] * Math.PI) / 180;
    const phi1 = (p1[1] * Math.PI) / 180;
    const phi2 = (p2[1] * Math.PI) / 180;

    total += (lam2 - lam1) * (2 + Math.sin(phi1) + Math.sin(phi2));
  }

  const areaSqm = Math.abs((total * WGS84_RADIUS_METERS * WGS84_RADIUS_METERS) / 2.0);
  const areaAcres = Math.round((areaSqm / SQ_METERS_PER_ACRE) * 100) / 100;
  const areaHectares = Math.round((areaSqm / SQ_METERS_PER_HECTARE) * 100) / 100;

  return {
    areaSqm: Math.round(areaSqm * 10) / 10,
    areaAcres,
    areaHectares
  };
}

/**
 * Computes geographic centroid of a polygon ring
 * @param {Array<[number, number]>} ring - Array of [lng, lat] coordinate pairs
 * @returns {{ lat: number, lng: number }}
 */
export function calculateCentroid(ring) {
  if (!Array.isArray(ring) || ring.length < 4) {
    return { lat: 0, lng: 0 };
  }

  let sumLat = 0;
  let sumLng = 0;
  const count = ring.length - 1; // exclude redundant closing vertex

  for (let i = 0; i < count; i++) {
    sumLng += ring[i][0];
    sumLat += ring[i][1];
  }

  return {
    lat: Math.round((sumLat / count) * 10000000) / 10000000,
    lng: Math.round((sumLng / count) * 10000000) / 10000000
  };
}
