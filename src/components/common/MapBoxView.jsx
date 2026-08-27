import { useState, useMemo } from "react";
import { MapPin, ShieldCheck, Star } from "../icons/Icons.jsx";
import { formatCurrency } from "../../utils/formatters.js";
import { isMapServiceAvailable } from "../../services/mapProvider.js";

export function MapBoxView({
  markers = [],
  center = { lat: 19.9975, lng: 73.7898 },
  height = "400px",
  onSelectMarker
}) {
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [zoom, setZoom] = useState(1);

  const hasMapService = isMapServiceAvailable();

  // Normalize marker lat/lng positions relative to center for SVG map rendering fallback
  const mappedMarkers = useMemo(() => {
    return markers.map((m) => {
      const lat = m.lat || center.lat || 19.9975;
      const lng = m.lng || center.lng || 73.7898;
      return {
        ...m,
        lat,
        lng
      };
    });
  }, [markers, center]);

  const handleMarkerClick = (m) => {
    setSelectedMarker(m);
    onSelectMarker?.(m);
  };

  return (
    <div
      className="fc-mapbox-container"
      style={{
        position: "relative",
        width: "100%",
        height,
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        border: "1px solid var(--border)",
        background: "var(--surface)",
        boxShadow: "var(--shadow-sm)"
      }}
    >
      {/* MAP CANVAS / BACKGROUND */}
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #1b3d2b 0%, #0d281a 100%)",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        {/* SVG Topographic Grid & Agricultural Pins */}
        <svg
          width="100%"
          height="100%"
          style={{ position: "absolute", inset: 0, opacity: 0.15 }}
        >
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#22c55e" strokeWidth="0.8" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Informational Header Notice */}
        {!hasMapService && (
          <div
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              right: 12,
              zIndex: 10,
              background: "rgba(10, 25, 16, 0.85)",
              color: "rgba(255,255,255,0.9)",
              padding: "8px 14px",
              borderRadius: "var(--radius-md)",
              fontSize: "12px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              backdropFilter: "blur(4px)",
              border: "1px solid rgba(255,255,255,0.12)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <MapPin size={14} style={{ color: "var(--brand-bright)" }} />
              <span>
                Interactive Farm & Listing Map ({mappedMarkers.length} Locations)
              </span>
            </div>
            <span style={{ fontSize: "11px", opacity: 0.75 }}>
              Mapbox Integration Ready
            </span>
          </div>
        )}

        {/* RENDER PINS ON MAP */}
        <div style={{ position: "absolute", inset: 0 }}>
          {mappedMarkers.map((m, idx) => {
            // Calculate mock relative percentage position on map canvas for demo visualization
            const leftPct = 15 + ((idx * 23 + (m.lng || 0) * 10) % 70);
            const topPct = 20 + ((idx * 19 + (m.lat || 0) * 10) % 60);

            const isSelected = selectedMarker?.id === m.id;

            return (
              <div
                key={m.id || idx}
                onClick={() => handleMarkerClick(m)}
                style={{
                  position: "absolute",
                  left: `${leftPct}%`,
                  top: `${topPct}%`,
                  transform: "translate(-50%, -100%)",
                  cursor: "pointer",
                  zIndex: isSelected ? 20 : 5,
                  transition: "transform 0.2s ease"
                }}
              >
                {/* Marker Icon Pin */}
                <div
                  style={{
                    background: isSelected ? "var(--accent)" : "var(--brand)",
                    color: "#ffffff",
                    padding: "6px 10px",
                    borderRadius: "20px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                    border: "2px solid #ffffff",
                    fontSize: "12px",
                    fontWeight: 700
                  }}
                >
                  <MapPin size={14} />
                  <span>{m.title || m.name || "Farm Listing"}</span>
                  {m.price && (
                    <span style={{ background: "rgba(0,0,0,0.25)", padding: "2px 6px", borderRadius: "10px", fontSize: "11px" }}>
                      {formatCurrency(m.price, m.currency)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* SELECTED POPUP PREVIEW CARD */}
        {selectedMarker && (
          <div
            style={{
              position: "absolute",
              bottom: 16,
              left: 16,
              right: 16,
              maxWidth: "360px",
              zIndex: 30,
              background: "var(--surface)",
              color: "var(--text)",
              padding: "14px 18px",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-xl)",
              border: "1px solid var(--border)",
              animation: "fadeIn 0.2s ease"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
              <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 800 }}>{selectedMarker.title || selectedMarker.name}</h4>
              <button
                onClick={() => setSelectedMarker(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "16px" }}
              >
                ×
              </button>
            </div>

            {selectedMarker.farmerName && (
              <div className="fc-muted" style={{ fontSize: "12.5px", marginBottom: "4px" }}>
                👨‍🌾 {selectedMarker.farmerName}
              </div>
            )}

            {(selectedMarker.city || selectedMarker.region) && (
              <div className="fc-muted" style={{ fontSize: "12px", marginBottom: "8px" }}>
                📍 {[selectedMarker.city, selectedMarker.district, selectedMarker.region, selectedMarker.countryCode].filter(Boolean).join(", ")}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px" }}>
              {selectedMarker.price && (
                <div style={{ fontSize: "16px", fontWeight: 800, color: "var(--brand)" }}>
                  {formatCurrency(selectedMarker.price, selectedMarker.currency)}
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}> /{selectedMarker.unit || "unit"}</span>
                </div>
              )}

              <button
                type="button"
                className="fc-btn fc-btn-primary fc-btn-sm"
                onClick={() => onSelectMarker?.(selectedMarker)}
              >
                View Harvest →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
