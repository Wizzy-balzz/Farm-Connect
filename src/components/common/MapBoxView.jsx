import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin } from "../icons/Icons.jsx";
import { formatCurrency } from "../../utils/formatters.js";

// Custom Leaflet DivIcon for farm listings
const createFarmMarkerIcon = (title, price, currency) => {
  const priceDisplay =
    price !== undefined && price !== null
      ? `<span style="background: rgba(0,0,0,0.25); padding: 1px 6px; border-radius: 10px; font-size: 10px; margin-left: 4px;">${formatCurrency(price, currency)}</span>`
      : "";

  return L.divIcon({
    className: "fc-farm-osm-pin",
    html: `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%); cursor: pointer; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.35));">
        <div style="
          background: #1b5e20;
          color: #ffffff;
          padding: 5px 9px;
          border-radius: 18px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11.5px;
          font-weight: 700;
          border: 2px solid #ffffff;
          white-space: nowrap;
          line-height: 1;
        ">
          <span style="font-size: 12px;">🌱</span>
          <span style="max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${title || "Farm"}</span>
          ${priceDisplay}
        </div>
        <div style="width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 7px solid #1b5e20; margin-top: -1px;"></div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    popupAnchor: [0, -32]
  });
};

// Map controller to automatically fit bounds to markers or center on single marker
function MapBoundsController({ validMarkers, defaultCenter }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    // Small delay to allow container size to settle
    const timer = setTimeout(() => {
      map.invalidateSize();

      if (validMarkers.length === 0) {
        if (defaultCenter && !isNaN(defaultCenter[0]) && !isNaN(defaultCenter[1])) {
          map.setView(defaultCenter, 5);
        }
        return;
      }

      // If single marker, center on it directly
      if (validMarkers.length === 1) {
        map.setView([validMarkers[0].lat, validMarkers[0].lng], 13, { animate: true });
        return;
      }

      const first = validMarkers[0];
      const allIdentical = validMarkers.every(
        (m) => Math.abs(m.lat - first.lat) < 0.0001 && Math.abs(m.lng - first.lng) < 0.0001
      );
      if (allIdentical) {
        map.setView([first.lat, first.lng], 13, { animate: true });
        return;
      }

      // Multiple markers across different coordinates: fit bounds to show all
      try {
        const bounds = L.latLngBounds(validMarkers.map((m) => [m.lat, m.lng]));
        map.fitBounds(bounds, {
          padding: [50, 50],
          maxZoom: 14,
          animate: true
        });
      } catch (err) {
        console.error("Leaflet fitBounds error:", err);
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [validMarkers, defaultCenter, map]);

  return null;
}

export function MapBoxView({
  markers = [],
  center,
  height = "400px",
  onSelectMarker
}) {
  const [selectedMarker, setSelectedMarker] = useState(null);

  // Validate and parse marker coordinates gracefully
  const validMarkers = useMemo(() => {
    if (!Array.isArray(markers)) return [];
    return markers
      .map((m, idx) => {
        const lat = parseFloat(m.lat ?? m.latitude);
        const lng = parseFloat(m.lng ?? m.longitude);
        if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          return null;
        }
        return {
          ...m,
          id: m.id || `m-${idx}`,
          lat,
          lng
        };
      })
      .filter(Boolean);
  }, [markers]);

  // Center coordinate determination (fallback: All-India center)
  const defaultCenter = useMemo(() => {
    const cLat = parseFloat(center?.lat ?? center?.latitude);
    const cLng = parseFloat(center?.lng ?? center?.longitude);
    if (!isNaN(cLat) && !isNaN(cLng) && cLat >= -90 && cLat <= 90 && cLng >= -180 && cLng <= 180) {
      return [cLat, cLng];
    }
    if (validMarkers.length > 0) {
      return [validMarkers[0].lat, validMarkers[0].lng];
    }
    return [20.5937, 78.9629];
  }, [center, validMarkers]);

  const handleMarkerClick = (m) => {
    setSelectedMarker(m);
    onSelectMarker?.(m);
  };

  return (
    <div
      className="fc-osm-map-container"
      style={{
        position: "relative",
        width: "100%",
        height,
        borderRadius: "var(--radius-lg, 12px)",
        overflow: "hidden",
        border: "1px solid var(--border, #e2e8f0)",
        background: "#e5e7eb",
        boxShadow: "var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.1))"
      }}
    >
      {/* Real OpenStreetMap Leaflet Container */}
      <MapContainer
        center={defaultCenter}
        zoom={validMarkers.length === 1 ? 13 : 5}
        scrollWheelZoom={true}
        zoomControl={true}
        style={{ width: "100%", height: "100%", zIndex: 1 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        <MapBoundsController validMarkers={validMarkers} defaultCenter={defaultCenter} />

        {validMarkers.map((m) => {
          const locationStr =
            m.location ||
            [m.city, m.district, m.region, m.countryCode].filter(Boolean).join(", ");

          return (
            <Marker
              key={m.id}
              position={[m.lat, m.lng]}
              icon={createFarmMarkerIcon(m.title || m.name, m.price, m.currency)}
              eventHandlers={{
                click: () => handleMarkerClick(m)
              }}
            >
              <Popup minWidth={240} maxWidth={320} className="fc-map-custom-popup">
                <div style={{ padding: "4px 2px", color: "#1e293b", fontFamily: "var(--font-sans, system-ui, sans-serif)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                    <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#0f172a" }}>
                      {m.title || m.name || "Farm Listing"}
                    </h4>
                  </div>

                  {m.farmerName && (
                    <div style={{ fontSize: "12px", color: "#475569", marginBottom: "4px", display: "flex", alignItems: "center", gap: "5px" }}>
                      <span>👨‍🌾</span>
                      <span>{m.farmerName}</span>
                    </div>
                  )}

                  {locationStr && (
                    <div style={{ fontSize: "11.5px", color: "#64748b", marginBottom: "8px", display: "flex", alignItems: "center", gap: "5px" }}>
                      <span>📍</span>
                      <span>{locationStr}</span>
                    </div>
                  )}

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px", paddingTop: "8px", borderTop: "1px solid #e2e8f0" }}>
                    {m.price !== undefined && m.price !== null && (
                      <div style={{ fontSize: "14px", fontWeight: 800, color: "#166534" }}>
                        {formatCurrency(m.price, m.currency)}
                        <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 400 }}> /{m.unit || "unit"}</span>
                      </div>
                    )}

                    {onSelectMarker && (
                      <button
                        type="button"
                        className="fc-btn fc-btn-primary fc-btn-sm"
                        style={{
                          background: "#16a34a",
                          color: "#ffffff",
                          padding: "5px 12px",
                          fontSize: "12px",
                          fontWeight: 700,
                          borderRadius: "6px",
                          border: "none",
                          cursor: "pointer",
                          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                          marginLeft: "auto"
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectMarker(m);
                        }}
                      >
                        View Harvest →
                      </button>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Locations Count Badge */}
      <div
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          zIndex: 400,
          background: "rgba(255, 255, 255, 0.94)",
          color: "#0f172a",
          padding: "5px 12px",
          borderRadius: "20px",
          fontSize: "12px",
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: "6px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          backdropFilter: "blur(4px)",
          border: "1px solid rgba(0,0,0,0.08)"
        }}
      >
        <MapPin size={13} style={{ color: "var(--brand, #16a34a)" }} />
        <span>
          {validMarkers.length} {validMarkers.length === 1 ? "Farm Location" : "Farm Locations"}
        </span>
      </div>

      {/* Graceful notice if no valid coordinates found */}
      {markers.length > 0 && validMarkers.length === 0 && (
        <div
          style={{
            position: "absolute",
            bottom: 16,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 400,
            background: "rgba(15, 23, 42, 0.9)",
            color: "#ffffff",
            padding: "8px 16px",
            borderRadius: "8px",
            fontSize: "12px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.25)"
          }}
        >
          No valid geographic coordinates available for the selected listings.
        </div>
      )}
    </div>
  );
}

export default MapBoxView;
