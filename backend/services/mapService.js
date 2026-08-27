/**
 * Calculate straight-line distance in km using Haversine formula
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate actual road distance and ETA between origin and destination coordinates
 */
export async function calculateRoute(originLat, originLng, destLat, destLng) {
  const oLat = parseFloat(originLat);
  const oLng = parseFloat(originLng);
  const dLat = parseFloat(destLat);
  const dLng = parseFloat(destLng);

  if (isNaN(oLat) || isNaN(oLng) || isNaN(dLat) || isNaN(dLng)) {
    // Default fallback coordinates if invalid inputs passed
    return {
      distanceKm: 24.5,
      etaMinutes: 45,
      formattedDistance: "24.5 km",
      formattedEta: "45 mins",
      isEstimated: true
    };
  }

  // Same point check
  if (Math.abs(oLat - dLat) < 0.0001 && Math.abs(oLng - dLng) < 0.0001) {
    return {
      distanceKm: 1.0,
      etaMinutes: 5,
      formattedDistance: "1.0 km",
      formattedEta: "5 mins",
      isEstimated: false
    };
  }

  const mapToken = process.env.VITE_MAPBOX_ACCESS_TOKEN || process.env.MAPBOX_ACCESS_TOKEN;

  // 1. Mapbox Directions API Integration (if token is configured)
  if (mapToken) {
    try {
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${oLng},${oLat};${dLng},${dLat}?access_token=${mapToken}&overview=false`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const distKm = Math.round((route.distance / 1000) * 10) / 10;
          const etaMins = Math.round(route.duration / 60);
          return {
            distanceKm: distKm,
            etaMinutes: etaMins,
            formattedDistance: `${distKm} km`,
            formattedEta: etaMins >= 60 ? `${Math.floor(etaMins / 60)}h ${etaMins % 60}m` : `${etaMins} mins`,
            provider: "Mapbox Directions API",
            isEstimated: false
          };
        }
      }
    } catch (err) {
      console.warn("Mapbox directions API error, switching to OSRM/fallback:", err.message);
    }
  }

  // 2. OpenStreetMap OSRM Public Routing Service Integration
  try {
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${oLng},${oLat};${dLng},${dLat}?overview=false`;
    const res = await fetch(osrmUrl, { headers: { "User-Agent": "FarmConnect-App/2026" } });
    if (res.ok) {
      const data = await res.json();
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const distKm = Math.round((route.distance / 1000) * 10) / 10;
        const etaMins = Math.round(route.duration / 60);
        return {
          distanceKm: distKm,
          etaMinutes: etaMins,
          formattedDistance: `${distKm} km`,
          formattedEta: etaMins >= 60 ? `${Math.floor(etaMins / 60)}h ${etaMins % 60}m` : `${etaMins} mins`,
          provider: "OSRM Road Routing",
          isEstimated: false
        };
      }
    }
  } catch (err) {
    console.warn("OSRM routing API error, using road circuity fallback:", err.message);
  }

  // 3. Fallback: Haversine straight-line multiplied by average road circuity factor (1.28x for Indian road network)
  const straightLineKm = haversineDistance(oLat, oLng, dLat, dLng);
  const roadCircuityFactor = 1.28;
  const estimatedRoadKm = Math.round(straightLineKm * roadCircuityFactor * 10) / 10;
  
  // Average truck/produce transport speed: 35 km/h
  const estimatedEtaMins = Math.max(15, Math.round((estimatedRoadKm / 35) * 60));

  return {
    distanceKm: Math.max(1.0, estimatedRoadKm),
    etaMinutes: estimatedEtaMins,
    formattedDistance: `${Math.max(1.0, estimatedRoadKm)} km`,
    formattedEta: estimatedEtaMins >= 60 ? `${Math.floor(estimatedEtaMins / 60)}h ${estimatedEtaMins % 60}m` : `${estimatedEtaMins} mins`,
    provider: "Road Network Estimation Engine",
    isEstimated: true
  };
}

/**
 * Geocode an address string into lat/lng coordinates
 */
export async function geocodeAddress(addressString, countryCode = "IN") {
  const query = (addressString || "").trim();
  if (!query) return null;

  const mapToken = process.env.VITE_MAPBOX_ACCESS_TOKEN || process.env.MAPBOX_ACCESS_TOKEN;

  if (mapToken) {
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapToken}&limit=1&country=${countryCode}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.features && data.features.length > 0) {
          const feat = data.features[0];
          return {
            lat: feat.center[1],
            lng: feat.center[0],
            formattedAddress: feat.place_name
          };
        }
      }
    } catch (err) {
      console.warn("Mapbox geocoding error:", err.message);
    }
  }

  // Fallback preset coordinates for primary Indian regional hubs
  const qLower = query.toLowerCase();
  if (qLower.includes("nashik")) return { lat: 19.9975, lng: 73.7898, formattedAddress: "Nashik, Maharashtra, India" };
  if (qLower.includes("mumbai") || qLower.includes("parel") || qLower.includes("andheri")) return { lat: 19.076, lng: 72.8777, formattedAddress: "Mumbai, Maharashtra, India" };
  if (qLower.includes("pune")) return { lat: 18.5204, lng: 73.8567, formattedAddress: "Pune, Maharashtra, India" };
  if (qLower.includes("kovilpatti") || qLower.includes("thoothukudi")) return { lat: 9.1724, lng: 77.8687, formattedAddress: "Kovilpatti, Tamil Nadu, India" };
  if (qLower.includes("ludhiana") || qLower.includes("punjab")) return { lat: 30.901, lng: 75.8573, formattedAddress: "Ludhiana, Punjab, India" };

  return { lat: 19.076, lng: 72.8777, formattedAddress: query };
}
