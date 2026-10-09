/**
 * FarmConnect Client-Side GIS & Geodesic Utility Functions
 * Implements real-time geodesic area calculation (WGS84) & centroid computation
 */

const WGS84_RADIUS_METERS = 6378137;
const SQ_METERS_PER_ACRE = 4046.8564224;
const SQ_METERS_PER_HECTARE = 10000;

/**
 * Calculates geodesic area of a polygon from Leaflet [lat, lng] array
 * @param {Array<[number, number]>} latLngs - Array of [lat, lng] or objects with {lat, lng}
 * @returns {{ areaSqm: number, areaAcres: number, areaHectares: number }}
 */
export function calculatePolygonArea(latLngs) {
  if (!Array.isArray(latLngs) || latLngs.length < 3) {
    return { areaSqm: 0, areaAcres: 0, areaHectares: 0 };
  }

  // Normalize to [[lng, lat]]
  const ring = latLngs.map((pt) => {
    if (Array.isArray(pt)) return [pt[1], pt[0]]; // [lat, lng] -> [lng, lat]
    return [pt.lng ?? pt.longitude, pt.lat ?? pt.latitude];
  });

  // Ensure closed ring
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (Math.abs(first[0] - last[0]) > 1e-7 || Math.abs(first[1] - last[1]) > 1e-7) {
    ring.push([first[0], first[1]]);
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
 * Computes geographic centroid of a polygon vertex list
 * @param {Array<[number, number]>} latLngs - Array of [lat, lng]
 * @returns {[number, number]} [lat, lng]
 */
export function calculatePolygonCenter(latLngs) {
  if (!Array.isArray(latLngs) || latLngs.length === 0) {
    return [20.5937, 78.9629];
  }

  let sumLat = 0;
  let sumLng = 0;
  const count = latLngs.length;

  for (let i = 0; i < count; i++) {
    const pt = latLngs[i];
    const lat = Array.isArray(pt) ? pt[0] : (pt.lat ?? pt.latitude);
    const lng = Array.isArray(pt) ? pt[1] : (pt.lng ?? pt.longitude);
    sumLat += lat;
    sumLng += lng;
  }

  return [sumLat / count, sumLng / count];
}
