/**
 * FarmConnect Global Location Frontend Service
 * Centralized API wrapper communicating with FarmConnect backend location service
 */

export async function fetchCountries() {
  try {
    const res = await fetch("/api/locations/countries");
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn("Failed to fetch countries:", err.message);
  }
  return [
    { code: "IN", name: "India", flag: "🇮🇳", currency: "INR", symbol: "₹", adminTerm: "State", districtTerm: "District" },
    { code: "US", name: "United States", flag: "🇺🇸", currency: "USD", symbol: "$", adminTerm: "State", districtTerm: "County" },
    { code: "CA", name: "Canada", flag: "🇨🇦", currency: "CAD", symbol: "CA$", adminTerm: "Province", districtTerm: "District" },
    { code: "GB", name: "United Kingdom", flag: "🇬🇧", currency: "GBP", symbol: "£", adminTerm: "Country", districtTerm: "County" },
    { code: "AU", name: "Australia", flag: "🇦🇺", currency: "AUD", symbol: "A$", adminTerm: "State", districtTerm: "LGA" }
  ];
}

const FALLBACK_REGIONS = {
  IN: [
    { code: "MH", name: "Maharashtra", adminTerm: "State" },
    { code: "PB", name: "Punjab", adminTerm: "State" },
    { code: "TN", name: "Tamil Nadu", adminTerm: "State" },
    { code: "KA", name: "Karnataka", adminTerm: "State" },
    { code: "GJ", name: "Gujarat", adminTerm: "State" },
    { code: "KL", name: "Kerala", adminTerm: "State" },
    { code: "UP", name: "Uttar Pradesh", adminTerm: "State" },
    { code: "DL", name: "Delhi (NCT)", adminTerm: "Union Territory" }
  ],
  US: [
    { code: "CA", name: "California", adminTerm: "State" },
    { code: "NY", name: "New York", adminTerm: "State" },
    { code: "TX", name: "Texas", adminTerm: "State" },
    { code: "FL", name: "Florida", adminTerm: "State" }
  ]
};

const FALLBACK_DISTRICTS = {
  MH: [
    { code: "NSK", name: "Nashik" },
    { code: "MUM", name: "Mumbai" },
    { code: "PUN", name: "Pune" },
    { code: "RAT", name: "Ratnagiri" }
  ],
  TN: [
    { code: "CHE", name: "Chennai" },
    { code: "CBE", name: "Coimbatore" },
    { code: "MDU", name: "Madurai" }
  ]
};

export async function fetchRegions(countryCode) {
  if (!countryCode) return [];
  const normalized = (countryCode || "IN").toUpperCase();
  try {
    const res = await fetch(`/api/locations/regions/${encodeURIComponent(normalized)}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch (err) {
    console.warn(`Failed to fetch regions for ${countryCode}:`, err.message);
  }
  return FALLBACK_REGIONS[normalized] || FALLBACK_REGIONS.IN;
}

export async function fetchDistricts(countryCode, regionCode) {
  if (!countryCode || !regionCode) return [];
  try {
    const res = await fetch(`/api/locations/districts/${encodeURIComponent(countryCode)}/${encodeURIComponent(regionCode)}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch (err) {
    console.warn(`Failed to fetch districts for ${countryCode}-${regionCode}:`, err.message);
  }
  const regKey = (regionCode || "").toUpperCase();
  return FALLBACK_DISTRICTS[regKey] || [
    { code: "CENTRAL", name: "Central Region / District" },
    { code: "NORTH", name: "Northern District" },
    { code: "SOUTH", name: "Southern District" }
  ];
}


export async function fetchPlaces(countryCode, regionCode, districtCode) {
  if (!countryCode || !regionCode || !districtCode) return [];
  try {
    const res = await fetch(`/api/locations/places/${encodeURIComponent(countryCode)}/${encodeURIComponent(regionCode)}/${encodeURIComponent(districtCode)}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn(`Failed to fetch places for ${countryCode}-${regionCode}-${districtCode}:`, err.message);
  }
  return [];
}

/**
 * Standardize location object into reusable FarmConnect format
 */
export function normalizeLocation(loc = {}) {
  const latitude = parseFloat(loc.latitude ?? loc.lat ?? 0);
  const longitude = parseFloat(loc.longitude ?? loc.lng ?? 0);

  return {
    latitude: isNaN(latitude) ? null : latitude,
    longitude: isNaN(longitude) ? null : longitude,
    lat: isNaN(latitude) ? null : latitude, // Alias for backward compatibility
    lng: isNaN(longitude) ? null : longitude, // Alias for backward compatibility
    address: loc.address || loc.formattedAddress || "",
    city: loc.city || loc.placeName || "",
    district: loc.district || "",
    state: loc.state || loc.region || "",
    region: loc.region || loc.state || "", // Alias for existing components
    pincode: loc.pincode || loc.postalCode || "",
    postalCode: loc.postalCode || loc.pincode || "",
    country: loc.country || loc.countryName || "India",
    countryCode: (loc.countryCode || "IN").toUpperCase(),
    countryName: loc.countryName || loc.country || "India",
    placeName: loc.placeName || loc.city || "",
    formattedAddress: loc.formattedAddress || loc.address || ""
  };
}

export async function searchLocations(query, countryCode = "") {
  if (!query || query.trim().length < 2) return [];
  try {
    const res = await fetch(`/api/locations/search?q=${encodeURIComponent(query)}&countryCode=${encodeURIComponent(countryCode)}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        return data.map(normalizeLocation);
      }
    }
  } catch (err) {
    console.warn("Location search failed:", err.message);
  }
  return [];
}

export async function reverseGeocodeLocation(lat, lng) {
  if (lat === undefined || lat === null || lng === undefined || lng === null) return null;
  try {
    const res = await fetch(`/api/locations/reverse-geocode?lat=${lat}&lng=${lng}`);
    if (res.ok) {
      const data = await res.json();
      return normalizeLocation(data);
    }
  } catch (err) {
    console.warn("Reverse geocode failed:", err.message);
  }
  return null;
}

