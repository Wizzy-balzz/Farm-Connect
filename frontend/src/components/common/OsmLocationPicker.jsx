import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { searchLocations, reverseGeocodeLocation, normalizeLocation } from "../../services/locationService.js";
import { MapPin, Search, Navigation, AlertTriangle, Check, RefreshCw } from "../icons/Icons.jsx";
import { Button } from "./Button.jsx";

// Custom high-contrast SVG marker icon to prevent bundler 404 asset issues
const createOsmPinIcon = (color = "#2d7a4c") => {
  return L.divIcon({
    className: "fc-osm-pin",
    html: `
      <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;">
        <svg viewBox="0 0 24 24" width="34" height="34" fill="${color}" stroke="#ffffff" stroke-width="1.8" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.35)); cursor: grab;">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
          <circle cx="12" cy="9" r="2.8" fill="#ffffff"/>
        </svg>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -32]
  });
};

const defaultPinIcon = createOsmPinIcon("#2d7a4c");

/**
 * Controller to handle map clicks and smooth pan animations
 */
function MapClickHandler({ onLocationSelect, markerPos }) {
  const map = useMap();

  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      onLocationSelect(lat, lng);
    }
  });

  useEffect(() => {
    if (markerPos && markerPos[0] && markerPos[1]) {
      map.setView(markerPos, map.getZoom(), { animate: true });
    }
  }, [markerPos, map]);

  return null;
}

export function OsmLocationPicker({
  value = {},
  onChange,
  height = "320px",
  disabled = false,
  showAddressCard = true
}) {
  // Coordinates extraction
  const initialLat = parseFloat(value.latitude ?? value.lat ?? 20.5937);
  const initialLng = parseFloat(value.longitude ?? value.lng ?? 78.9629);

  const [position, setPosition] = useState([
    isNaN(initialLat) ? 20.5937 : initialLat,
    isNaN(initialLng) ? 78.9629 : initialLng
  ]);

  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [permError, setPermError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Sync external changes
  useEffect(() => {
    const lat = parseFloat(value.latitude ?? value.lat);
    const lng = parseFloat(value.longitude ?? value.lng);
    if (!isNaN(lat) && !isNaN(lng) && (Math.abs(lat - position[0]) > 0.0001 || Math.abs(lng - position[1]) > 0.0001)) {
      setPosition([lat, lng]);
    }
  }, [value.latitude, value.lat, value.longitude, value.lng]);

  // Debounced reverse geocoding
  const reverseGeocodeTimer = useRef(null);
  const triggerReverseGeocode = useCallback(
    (lat, lng) => {
      if (reverseGeocodeTimer.current) clearTimeout(reverseGeocodeTimer.current);

      setGeocoding(true);
      reverseGeocodeTimer.current = setTimeout(async () => {
        try {
          const res = await reverseGeocodeLocation(lat, lng);
          if (res) {
            onChange?.(normalizeLocation({
              ...value,
              ...res,
              latitude: lat,
              longitude: lng,
              lat,
              lng
            }));
          }
        } finally {
          setGeocoding(false);
        }
      }, 550);
    },
    [onChange, value]
  );

  // Handle marker drag end
  const handleMarkerDragEnd = useCallback(
    (e) => {
      if (disabled) return;
      const marker = e.target;
      const latlng = marker.getLatLng();
      const newLat = parseFloat(latlng.lat.toFixed(6));
      const newLng = parseFloat(latlng.lng.toFixed(6));

      setPosition([newLat, newLng]);
      triggerReverseGeocode(newLat, newLng);
    },
    [disabled, triggerReverseGeocode]
  );

  // Handle direct map click
  const handleLocationSelect = useCallback(
    (lat, lng) => {
      if (disabled) return;
      const newLat = parseFloat(lat.toFixed(6));
      const newLng = parseFloat(lng.toFixed(6));

      setPosition([newLat, newLng]);
      triggerReverseGeocode(newLat, newLng);
    },
    [disabled, triggerReverseGeocode]
  );

  // HTML5 Browser Geolocation with permission check
  const handleUseCurrentLocation = useCallback(() => {
    if (disabled) return;
    setPermError("");

    if (!navigator.geolocation) {
      setPermError("Geolocation is not supported by your browser. Please select your location on the map.");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const newLat = parseFloat(latitude.toFixed(6));
        const newLng = parseFloat(longitude.toFixed(6));

        setPosition([newLat, newLng]);
        setLocating(false);
        triggerReverseGeocode(newLat, newLng);
      },
      (err) => {
        setLocating(false);
        let msg = "Location permission denied. Please search or pick your location on the map.";
        if (err.code === 2) msg = "Location position unavailable. Please search or pick your location on the map.";
        if (err.code === 3) msg = "Location request timed out. Please try again or use the manual search.";
        setPermError(msg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }, [disabled, triggerReverseGeocode]);

  // Search input handler with debounce
  const searchTimer = useRef(null);
  const handleSearchChange = (query) => {
    setSearchQuery(query);
    if (searchTimer.current) clearTimeout(searchTimer.current);

    if (query.trim().length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const results = await searchLocations(query, value.countryCode || "IN");
        setSearchResults(results);
      } finally {
        setSearching(false);
      }
    }, 450);
  };

  const handleSelectSearchResult = (item) => {
    const lat = item.latitude;
    const lng = item.longitude;
    setPosition([lat, lng]);
    setSearchQuery("");
    setSearchResults([]);
    onChange?.(normalizeLocation({
      ...value,
      ...item,
      latitude: lat,
      longitude: lng,
      lat,
      lng
    }));
  };

  const displayAddress = value.address || value.formattedAddress || value.city || "No address selected yet";

  return (
    <div className="fc-osm-location-picker" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {/* Top Toolbar: Search + Use My Current Location */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
        {/* Search input with suggestions */}
        <div style={{ position: "relative", flex: 1, minWidth: "220px" }}>
          <div className="fc-searchbar" style={{ width: "100%" }}>
            <Search size={15} className="fc-searchbar-icon" />
            <input
              type="text"
              className="fc-input"
              placeholder="Search Indian city, district, town, or PIN code..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              disabled={disabled}
              style={{ width: "100%", fontSize: "13px", paddingLeft: "34px" }}
            />
          </div>

          {searching && (
            <div className="fc-soft" style={{ fontSize: "11px", position: "absolute", right: 10, top: 10 }}>
              Searching OpenStreetMap...
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
                zIndex: 1000,
                marginTop: "4px",
                maxHeight: "220px",
                overflowY: "auto"
              }}
            >
              {searchResults.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleSelectSearchResult(item)}
                  style={{
                    padding: "8px 12px",
                    cursor: "pointer",
                    borderBottom: "1px solid var(--border-light)",
                    fontSize: "12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px"
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-soft)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <MapPin size={13} style={{ color: "var(--brand)", flexShrink: 0 }} />
                  <div>
                    <strong style={{ display: "block" }}>{item.placeName || item.city}</strong>
                    <span className="fc-muted" style={{ fontSize: "11px" }}>{item.formattedAddress}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Use My Current Location Button */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleUseCurrentLocation}
          disabled={disabled || locating}
          style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, fontSize: "12px", whiteSpace: "nowrap" }}
        >
          <Navigation size={14} style={{ color: "var(--brand)" }} />
          {locating ? "Locating..." : "Use My Current Location"}
        </Button>
      </div>

      {/* Permission alert if denied */}
      {permError && (
        <div style={{
          background: "var(--warning-light)",
          border: "1px solid var(--warning)",
          color: "var(--warning-dark)",
          padding: "8px 12px",
          borderRadius: "var(--radius-sm)",
          fontSize: "12px",
          display: "flex",
          alignItems: "center",
          gap: 8
        }}>
          <AlertTriangle size={15} style={{ flexShrink: 0 }} />
          <span>{permError}</span>
        </div>
      )}

      {/* Interactive Leaflet Map */}
      <div
        style={{
          height,
          width: "100%",
          borderRadius: "var(--radius-md)",
          overflow: "hidden",
          border: "1px solid var(--border)",
          position: "relative",
          zIndex: 1
        }}
      >
        <MapContainer
          center={position}
          zoom={position[0] === 20.5937 ? 5 : 13}
          scrollWheelZoom={true}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
          <Marker
            position={position}
            draggable={!disabled}
            icon={defaultPinIcon}
            eventHandlers={{
              dragend: handleMarkerDragEnd
            }}
          />
          <MapClickHandler onLocationSelect={handleLocationSelect} markerPos={position} />
        </MapContainer>

        {/* Live Drag Hint & Status Overlay */}
        <div
          style={{
            position: "absolute",
            bottom: "8px",
            left: "8px",
            background: "rgba(255, 255, 255, 0.92)",
            padding: "4px 8px",
            borderRadius: "4px",
            fontSize: "11px",
            color: "var(--text-soft)",
            display: "flex",
            alignItems: "center",
            gap: "5px",
            zIndex: 400,
            boxShadow: "0 2px 5px rgba(0,0,0,0.15)"
          }}
        >
          {geocoding ? (
            <>
              <RefreshCw size={11} className="animate-spin" /> Reverse geocoding address...
            </>
          ) : (
            <>
              <MapPin size={11} style={{ color: "var(--brand)" }} /> Drag marker or click map to refine
            </>
          )}
        </div>
      </div>

      {/* Selected Coordinates & Address Card */}
      {showAddressCard && (
        <div
          style={{
            background: "var(--bg-soft)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            padding: "10px 14px",
            fontSize: "12px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "8px"
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontWeight: 600, color: "var(--brand-dark)" }}>
              📍 {value.city ? `${value.city}${value.district ? `, ${value.district}` : ""}${value.state ? `, ${value.state}` : ""}` : "Selected Coordinates"}
            </span>
            <span className="fc-soft" style={{ fontSize: "11px", maxWidth: "420px", wordBreak: "break-word" }}>
              {displayAddress}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                fontFamily: "monospace",
                fontSize: "11px",
                background: "var(--bg-elevated)",
                padding: "3px 8px",
                borderRadius: "4px",
                border: "1px solid var(--border)"
              }}
            >
              {position[0]?.toFixed(4)}°, {position[1]?.toFixed(4)}°
            </span>
            <span className="fc-badge fc-badge-success" style={{ fontSize: "10px", padding: "2px 6px" }}>
              <Check size={10} /> Verified
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default OsmLocationPicker;
