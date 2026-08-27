import { useState, useEffect, useCallback } from "react";
import {
  fetchCountries,
  fetchRegions,
  fetchDistricts,
  fetchPlaces,
  searchLocations,
  reverseGeocodeLocation
} from "../../services/locationService.js";
import { Search, MapPin, Globe } from "../icons/Icons.jsx";
import { Button } from "./Button.jsx";

export function GlobalLocationSelector({
  value = {},
  onChange,
  showAddressFields = false,
  allowSearchMode = true,
  disabled = false
}) {
  const [countries, setCountries] = useState([]);
  const [regions, setRegions] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [places, setPlaces] = useState([]);

  const [loadingRegions, setLoadingRegions] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingPlaces, setLoadingPlaces] = useState(false);

  const [mode, setMode] = useState("dropdown"); // 'dropdown' | 'search'
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);

  // Selected values & Country normalization
  const rawCountryCode = value.countryCode || "IN";
  const region = value.region || "";
  const district = value.district || "";
  const city = value.city || "";
  const address = value.address || "";
  const postalCode = value.postalCode || "";

  // Get active country metadata safely
  const currentCountry = countries.find((c) => c.code === rawCountryCode || c.code3 === rawCountryCode || c.name.toLowerCase() === rawCountryCode.toLowerCase()) || {
    code: "IN",
    name: "India",
    flag: "🇮🇳",
    adminTerm: "State",
    districtTerm: "District",
    currency: "INR"
  };
  const countryCode = currentCountry.code;

  // Auto-synchronize canonical countryCode and metadata if parent initialized empty
  useEffect(() => {
    if (!value.countryCode && onChange) {
      onChange({
        ...value,
        countryCode: "IN",
        countryName: "India",
        currency: "INR"
      });
    }
  }, [value.countryCode]);

  // 1. Initial Load Countries
  useEffect(() => {
    let mounted = true;
    fetchCountries().then((data) => {
      if (mounted) setCountries(data);
    });
    return () => { mounted = false; };
  }, []);

  // 2. Load Regions when country changes
  useEffect(() => {
    let mounted = true;
    if (!countryCode) {
      setRegions([]);
      return;
    }
    setLoadingRegions(true);
    fetchRegions(countryCode).then((data) => {
      if (mounted) {
        setRegions(data);
        setLoadingRegions(false);
      }
    });
    return () => { mounted = false; };
  }, [countryCode]);

  // 3. Load Districts when region changes
  useEffect(() => {
    let mounted = true;
    if (!countryCode || !region) {
      setDistricts([]);
      return;
    }
    const regObj = regions.find((r) => r.name === region || r.code === region);
    const regCode = regObj ? regObj.code : region;

    setLoadingDistricts(true);
    fetchDistricts(countryCode, regCode).then((data) => {
      if (mounted) {
        setDistricts(data);
        setLoadingDistricts(false);
      }
    });
    return () => { mounted = false; };
  }, [countryCode, region, regions]);

  // 4. Load Places when district changes
  useEffect(() => {
    let mounted = true;
    if (!countryCode || !region || !district) {
      setPlaces([]);
      return;
    }
    const regObj = regions.find((r) => r.name === region || r.code === region);
    const regCode = regObj ? regObj.code : region;
    const distObj = districts.find((d) => d.name === district || d.code === district);
    const distCode = distObj ? distObj.code : district;

    setLoadingPlaces(true);
    fetchPlaces(countryCode, regCode, distCode).then((data) => {
      if (mounted) {
        setPlaces(data);
        setLoadingPlaces(false);
      }
    });
    return () => { mounted = false; };
  }, [countryCode, region, district, regions, districts]);

  // Handle Country Change
  const handleCountryChange = (e) => {
    const code = e.target.value;
    const cObj = countries.find((c) => c.code === code);
    onChange?.({
      ...value,
      countryCode: code,
      countryName: cObj ? cObj.name : code,
      currency: cObj ? cObj.currency : "INR",
      region: "",
      district: "",
      city: ""
    });
  };

  // Handle Region Change
  const handleRegionChange = (e) => {
    const regName = e.target.value;
    onChange?.({
      ...value,
      region: regName,
      district: "",
      city: ""
    });
  };

  // Handle District Change
  const handleDistrictChange = (e) => {
    const distName = e.target.value;
    onChange?.({
      ...value,
      district: distName,
      city: ""
    });
  };

  // Handle City Change
  const handleCityChange = (e) => {
    const cityName = e.target.value;
    const pObj = places.find((p) => p.name === cityName);
    onChange?.({
      ...value,
      city: cityName,
      lat: pObj && pObj.lat ? pObj.lat : value.lat,
      lng: pObj && pObj.lng ? pObj.lng : value.lng
    });
  };

  // Handle Free-form Search Query
  const handleSearchInput = useCallback((q) => {
    setSearchQuery(q);
    if (q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    searchLocations(q, countryCode).then((res) => {
      setSearchResults(res);
      setSearching(false);
    });
  }, [countryCode]);

  // Handle Selecting a Search Suggestion
  const handleSelectSuggestion = (item) => {
    const cObj = countries.find((c) => c.code === item.countryCode);
    onChange?.({
      ...value,
      countryCode: item.countryCode || countryCode,
      countryName: item.countryName || (cObj ? cObj.name : "India"),
      currency: cObj ? cObj.currency : "INR",
      region: item.regionName || region,
      district: item.districtName || district,
      city: item.placeName || city,
      lat: item.latitude,
      lng: item.longitude,
      formattedAddress: item.formattedAddress
    });
    setSearchQuery("");
    setSearchResults([]);
    setMode("dropdown");
  };

  // Handle Device Geolocation ("Near Me" Detection)
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const geoResult = await reverseGeocodeLocation(latitude, longitude);
        setLocating(false);
        if (geoResult) {
          const cObj = countries.find((c) => c.code === geoResult.countryCode);
          onChange?.({
            ...value,
            countryCode: geoResult.countryCode,
            countryName: geoResult.countryName,
            currency: cObj ? cObj.currency : "INR",
            region: geoResult.regionName,
            district: geoResult.districtName,
            city: geoResult.placeName,
            lat: latitude,
            lng: longitude,
            formattedAddress: geoResult.formattedAddress
          });
        }
      },
      (err) => {
        setLocating(false);
        alert(`Location access notice: ${err.message}. Please select your location manually.`);
      },
      { timeout: 10000 }
    );
  };

  return (
    <div className="fc-location-selector" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {/* Mode Switch & Near Me Bar */}
      {allowSearchMode && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              type="button"
              className={`fc-btn fc-btn-sm ${mode === "dropdown" ? "fc-btn-primary" : "fc-btn-ghost"}`}
              onClick={() => setMode("dropdown")}
              disabled={disabled}
            >
              <Globe size={14} /> Cascading Select
            </button>
            <button
              type="button"
              className={`fc-btn fc-btn-sm ${mode === "search" ? "fc-btn-primary" : "fc-btn-ghost"}`}
              onClick={() => setMode("search")}
              disabled={disabled}
            >
              <Search size={14} /> Search Place
            </button>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDetectLocation}
            disabled={disabled || locating}
          >
            <MapPin size={14} /> {locating ? "Detecting..." : "Detect Location"}
          </Button>
        </div>
      )}

      {/* SEARCH MODE */}
      {mode === "search" && allowSearchMode && (
        <div style={{ position: "relative" }}>
          <div className="fc-searchbar" style={{ width: "100%" }}>
            <Search size={16} className="fc-searchbar-icon" />
            <input
              type="text"
              className="fc-input"
              placeholder="Type city, district, state, or postal address..."
              value={searchQuery}
              onChange={(e) => handleSearchInput(e.target.value)}
              disabled={disabled}
              style={{ width: "100%" }}
            />
          </div>

          {searching && (
            <div className="fc-soft" style={{ fontSize: "12px", marginTop: "4px" }}>
              Searching location database...
            </div>
          )}

          {searchResults.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                boxShadow: "var(--shadow-lg)",
                zIndex: 50,
                marginTop: "4px",
                maxHeight: "220px",
                overflowY: "auto"
              }}
            >
              {searchResults.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleSelectSuggestion(item)}
                  style={{
                    padding: "10px 14px",
                    cursor: "pointer",
                    borderBottom: "1px solid var(--border-light)",
                    fontSize: "var(--text-sm)",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px"
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-soft)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <MapPin size={14} style={{ color: "var(--brand)", flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 600 }}>{item.placeName}</div>
                    <div className="fc-muted" style={{ fontSize: "11.5px" }}>{item.formattedAddress}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* DROPDOWN CASCADE MODE */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
        {/* Country Selector */}
        <div>
          <label className="fc-label" style={{ fontSize: "12px", marginBottom: "4px", display: "block" }}>
            Country
          </label>
          <select
            className="fc-select"
            value={countryCode}
            onChange={handleCountryChange}
            disabled={disabled}
            style={{ width: "100%" }}
          >
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.name} ({c.code})
              </option>
            ))}
          </select>
        </div>

        {/* Region Selector */}
        <div>
          <label className="fc-label" style={{ fontSize: "12px", marginBottom: "4px", display: "block" }}>
            {currentCountry.adminTerm || "State / Region"}
          </label>
          <select
            className="fc-select"
            value={regions.some((r) => r.name === region) ? region : (regions.find((r) => r.code === region)?.name || region)}
            onChange={handleRegionChange}
            disabled={disabled || loadingRegions}
            style={{ width: "100%" }}
          >
            <option value="">{loadingRegions ? `Loading ${currentCountry.adminTerm || "regions"}...` : `-- Select ${currentCountry.adminTerm || "Region"} --`}</option>
            {regions.map((r) => (
              <option key={r.code || r.name} value={r.name}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        {/* District Selector (If region has districts) */}
        {districts.length > 0 && (
          <div>
            <label className="fc-label" style={{ fontSize: "12px", marginBottom: "4px", display: "block" }}>
              {currentCountry.districtTerm || "District / County"}
            </label>
            <select
              className="fc-select"
              value={district}
              onChange={handleDistrictChange}
              disabled={disabled || loadingDistricts}
              style={{ width: "100%" }}
            >
              <option value="">-- Select {currentCountry.districtTerm || "District"} --</option>
              {districts.map((d) => (
                <option key={d.code || d.name} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* City / Place Selector */}
        <div>
          <label className="fc-label" style={{ fontSize: "12px", marginBottom: "4px", display: "block" }}>
            City / Municipality / Place
          </label>
          {places.length > 0 ? (
            <select
              className="fc-select"
              value={city}
              onChange={handleCityChange}
              disabled={disabled || loadingPlaces}
              style={{ width: "100%" }}
            >
              <option value="">-- Select City --</option>
              {places.map((p) => (
                <option key={p.code || p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              className="fc-input"
              placeholder="Enter city or town name"
              value={city}
              onChange={(e) => onChange?.({ ...value, city: e.target.value })}
              disabled={disabled}
              style={{ width: "100%" }}
            />
          )}
        </div>
      </div>

      {/* Detailed Address & Postal Code Fields if requested */}
      {showAddressFields && (
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px", marginTop: "4px" }}>
          <div>
            <label className="fc-label" style={{ fontSize: "12px", marginBottom: "4px", display: "block" }}>
              Street / Building Address
            </label>
            <input
              type="text"
              className="fc-input"
              placeholder="e.g. Plot 14, Green Valley Estate Road"
              value={address}
              onChange={(e) => onChange?.({ ...value, address: e.target.value })}
              disabled={disabled}
              style={{ width: "100%" }}
            />
          </div>

          <div>
            <label className="fc-label" style={{ fontSize: "12px", marginBottom: "4px", display: "block" }}>
              Postal / ZIP Code
            </label>
            <input
              type="text"
              className="fc-input"
              placeholder="e.g. 628501"
              value={postalCode}
              onChange={(e) => onChange?.({ ...value, postalCode: e.target.value })}
              disabled={disabled}
              style={{ width: "100%" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
