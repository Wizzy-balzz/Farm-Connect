import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Custom SVG Icons for Source, Destination, and Transit checkpoints
const createCustomIcon = (color, label, emoji) => {
  return L.divIcon({
    className: "fc-route-pin",
    html: `
      <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; width: 32px; height: 32px; border-radius: 50%; background: ${color}; opacity: 0.25; animation: pulse 2s infinite;"></div>
        <div style="position: relative; width: 28px; height: 28px; border-radius: 50%; background: ${color}; border: 2px solid #ffffff; display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 8px rgba(0,0,0,0.3); color: #ffffff; font-size: 13px;">
          ${emoji}
        </div>
        <div style="position: absolute; bottom: -18px; white-space: nowrap; background: rgba(0,0,0,0.75); color: #fff; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 4px; pointer-events: none;">
          ${label}
        </div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18]
  });
};

const sourceIcon = createCustomIcon("#2d7a4c", "Source", "🌱");
const destIcon = createCustomIcon("#d32f2f", "Destination", "📍");
const transitIcon = createCustomIcon("#e65100", "Checkpoint", "🚚");

function BoundsController({ points }) {
  const map = useMap();

  useEffect(() => {
    const validPoints = points.filter(
      (p) => p && typeof p.lat === "number" && !isNaN(p.lat) && typeof p.lng === "number" && !isNaN(p.lng)
    );

    if (validPoints.length === 0) return;

    if (validPoints.length === 1) {
      map.setView([validPoints[0].lat, validPoints[0].lng], 11, { animate: true });
      return;
    }

    try {
      const bounds = L.latLngBounds(validPoints.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [45, 45], maxZoom: 14, animate: true });
    } catch {
      /* ignore fit bounds error */
    }
  }, [points, map]);

  return null;
}

export function OsmRouteMap({
  source = {},
  destination = {},
  latestLocation = {},
  height = "360px"
}) {
  const srcLat = parseFloat(source.latitude ?? source.lat);
  const srcLng = parseFloat(source.longitude ?? source.lng);

  const dstLat = parseFloat(destination.latitude ?? destination.lat);
  const dstLng = parseFloat(destination.longitude ?? destination.lng);

  const curLat = parseFloat(latestLocation.latitude ?? latestLocation.lat);
  const curLng = parseFloat(latestLocation.longitude ?? latestLocation.lng);

  const hasSource = !isNaN(srcLat) && !isNaN(srcLng);
  const hasDest = !isNaN(dstLat) && !isNaN(dstLng);
  const hasCurrent = !isNaN(curLat) && !isNaN(curLng);

  // Default fallback center: Geographic center of India
  const center = useMemo(() => {
    if (hasCurrent) return [curLat, curLng];
    if (hasSource) return [srcLat, srcLng];
    if (hasDest) return [dstLat, dstLng];
    return [20.5937, 78.9629];
  }, [hasCurrent, hasSource, hasDest, curLat, curLng, srcLat, srcLng, dstLat, dstLng]);

  // Points for bounds fitting
  const allPoints = useMemo(() => {
    const pts = [];
    if (hasSource) pts.push({ lat: srcLat, lng: srcLng });
    if (hasDest) pts.push({ lat: dstLat, lng: dstLng });
    if (hasCurrent && (Math.abs(curLat - srcLat) > 0.001 || Math.abs(curLng - srcLng) > 0.001)) {
      pts.push({ lat: curLat, lng: curLng });
    }
    return pts;
  }, [hasSource, hasDest, hasCurrent, srcLat, srcLng, dstLat, dstLng, curLat, curLng]);

  // Route path polyline
  const polylinePositions = useMemo(() => {
    const list = [];
    if (hasSource) list.push([srcLat, srcLng]);
    if (hasCurrent && (Math.abs(curLat - srcLat) > 0.001 || Math.abs(curLng - srcLng) > 0.001)) {
      list.push([curLat, curLng]);
    }
    if (hasDest) list.push([dstLat, dstLng]);
    return list;
  }, [hasSource, hasDest, hasCurrent, srcLat, srcLng, curLat, curLng, dstLat, dstLng]);

  return (
    <div
      style={{
        height,
        width: "100%",
        borderRadius: "var(--radius-md)",
        overflow: "hidden",
        border: "1px solid var(--border)",
        position: "relative",
        boxShadow: "var(--shadow-sm)"
      }}
    >
      <MapContainer
        center={center}
        zoom={6}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        {/* Source Farmer Point */}
        {hasSource && (
          <Marker position={[srcLat, srcLng]} icon={sourceIcon}>
            <Popup>
              <div style={{ fontSize: "12px", minWidth: "150px" }}>
                <strong style={{ color: "#2d7a4c", display: "block" }}>🌱 Origin Farm Hub</strong>
                <div>{source.name || "Grower Base"}</div>
                <div style={{ color: "#666", fontSize: "11px", marginTop: "2px" }}>
                  {source.address || `${source.city || ""}, ${source.region || ""}`}
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Destination Delivery Point */}
        {hasDest && (
          <Marker position={[dstLat, dstLng]} icon={destIcon}>
            <Popup>
              <div style={{ fontSize: "12px", minWidth: "150px" }}>
                <strong style={{ color: "#d32f2f", display: "block" }}>📍 Delivery Destination</strong>
                <div>{destination.name || destination.vendorName || "Kitchen Base"}</div>
                <div style={{ color: "#666", fontSize: "11px", marginTop: "2px" }}>
                  {destination.address || `${destination.city || ""}, ${destination.region || ""}`}
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Latest Transit Checkpoint (if distinct from source and destination) */}
        {hasCurrent && (
          <Marker position={[curLat, curLng]} icon={transitIcon}>
            <Popup>
              <div style={{ fontSize: "12px", minWidth: "160px" }}>
                <strong style={{ color: "#e65100", display: "block" }}>🚚 Latest Known Location</strong>
                <div>{latestLocation.location || "Transit Hub"}</div>
                <div style={{ fontWeight: 600, fontSize: "11px", color: "var(--brand)" }}>
                  Status: {latestLocation.status}
                </div>
                {latestLocation.timestamp && (
                  <div style={{ color: "#888", fontSize: "10px", marginTop: "2px" }}>
                    Logged: {new Date(latestLocation.timestamp).toLocaleString("en-IN")}
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        )}

        {/* Driving Transit Polyline */}
        {polylinePositions.length >= 2 && (
          <Polyline
            positions={polylinePositions}
            pathOptions={{
              color: "var(--brand, #2d7a4c)",
              weight: 4,
              opacity: 0.85,
              dashArray: "6, 8"
            }}
          />
        )}

        <BoundsController points={allPoints} />
      </MapContainer>

      {/* Map Legend Overlay */}
      <div
        style={{
          position: "absolute",
          top: "10px",
          right: "10px",
          background: "rgba(255, 255, 255, 0.94)",
          padding: "6px 10px",
          borderRadius: "6px",
          fontSize: "11px",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          zIndex: 400,
          boxShadow: "0 2px 6px rgba(0,0,0,0.2)"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#2d7a4c" }}></span>
          <span>Source (Farmer Hub)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#e65100" }}></span>
          <span>Latest Transit Location</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#d32f2f" }}></span>
          <span>Destination (Delivery Hub)</span>
        </div>
      </div>
    </div>
  );
}

export default OsmRouteMap;
