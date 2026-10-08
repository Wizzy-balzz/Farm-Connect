import { useState, useEffect, useMemo, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  Polygon,
  Polyline,
  Marker,
  Popup,
  useMap,
  useMapEvents
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Card, CardHeader, CardBody, Badge, Button } from "../common/index.js";
import { calculatePolygonArea, calculatePolygonCenter } from "../../utils/gisUtils.js";
import { apiFetch } from "../../services/api.js";
import { useNotifications } from "../../hooks/useNotifications.js";
import { useLanguage } from "../../hooks/useLanguage.js";

// Custom vertex pin icon for interactive boundary editing & drawing
const createVertexIcon = (index, isFirst = false, isDraggable = false) => {
  const bg = isFirst ? "#e65100" : isDraggable ? "#1b5e20" : "#2e7d32";
  return L.divIcon({
    className: "fc-boundary-vertex-pin",
    html: `
      <div style="
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background: ${bg};
        color: #ffffff;
        border: 2px solid #ffffff;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        font-weight: 800;
        cursor: ${isDraggable ? "grab" : "pointer"};
      ">
        ${index + 1}
      </div>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  });
};

// Map controller to smoothly pan/zoom to parcel bounds or center
function MapViewController({ center, polygonCoords }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    const timer = setTimeout(() => {
      map.invalidateSize();
      if (polygonCoords && polygonCoords.length >= 3) {
        try {
          const bounds = L.latLngBounds(polygonCoords);
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 17, animate: true });
        } catch {
          map.setView(center, 15);
        }
      } else if (center && !isNaN(center[0]) && !isNaN(center[1])) {
        map.setView(center, 15, { animate: true });
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [map, center, polygonCoords]);

  return null;
}

// Map event handler for capturing polygon drawing clicks
function DrawingHandler({ isDrawing, onAddPoint }) {
  useMapEvents({
    click(e) {
      if (!isDrawing) return;
      onAddPoint([e.latlng.lat, e.latlng.lng]);
    }
  });
  return null;
}

export function FarmBoundaryMap({
  farmerCoordinates = null,
  farmName = "My Farm",
  onParcelUpdated = null
}) {
  const { lang } = useLanguage();
  const { notifySuccess, notifyError } = useNotifications();

  // Mode: 'view' | 'drawing' | 'editing'
  const [mode, setMode] = useState("view");
  const [parcel, setParcel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Active vertices during drawing or editing: Array of [lat, lng]
  const [activePoints, setActivePoints] = useState([]);

  // Compute map center from farmer profile or fallback
  const mapCenter = useMemo(() => {
    const lat = parseFloat(farmerCoordinates?.lat ?? farmerCoordinates?.latitude);
    const lng = parseFloat(farmerCoordinates?.lng ?? farmerCoordinates?.longitude);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && lat !== 0) {
      return [lat, lng];
    }
    return [20.5937, 78.9629]; // Geographic Center of India
  }, [farmerCoordinates]);

  // Load existing farm parcel from backend
  useEffect(() => {
    let isMounted = true;
    apiFetch("/api/farm/parcels")
      .then((res) => {
        if (!isMounted) return;
        if (res && res.success && Array.isArray(res.parcels) && res.parcels.length > 0) {
          const savedParcel = res.parcels[0];
          setParcel(savedParcel);

          // Convert GeoJSON [[lng, lat]] to Leaflet [[lat, lng]]
          const coords = savedParcel.geometry_geojson?.coordinates?.[0] || [];
          const leafletCoords = coords
            .slice(0, coords.length - 1)
            .map((pt) => [pt[1], pt[0]]);
          setActivePoints(leafletCoords);
        } else {
          setParcel(null);
          setActivePoints([]);
        }
      })
      .catch((err) => {
        console.warn("Failed to load farm parcel:", err.message);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Real-time geodesic area calculation
  const calculatedArea = useMemo(() => {
    if (activePoints.length < 3) {
      return { areaAcres: 0, areaHectares: 0, areaSqm: 0 };
    }
    return calculatePolygonArea(activePoints);
  }, [activePoints]);

  // Handler for adding a point while drawing
  const handleAddPoint = useCallback((latlng) => {
    setActivePoints((prev) => [...prev, latlng]);
  }, []);

  // Undo last vertex during drawing
  const handleUndoPoint = () => {
    setActivePoints((prev) => prev.slice(0, prev.length - 1));
  };

  // Start fresh drawing
  const handleStartDrawing = () => {
    setActivePoints([]);
    setMode("drawing");
  };

  // Cancel drawing / editing and revert to saved parcel
  const handleCancel = () => {
    if (parcel) {
      const coords = parcel.geometry_geojson?.coordinates?.[0] || [];
      const leafletCoords = coords
        .slice(0, coords.length - 1)
        .map((pt) => [pt[1], pt[0]]);
      setActivePoints(leafletCoords);
      setMode("view");
    } else {
      setActivePoints([]);
      setMode("view");
    }
  };

  // Drag-end handler for vertex editing
  const handleVertexDragEnd = (index, e) => {
    const { lat, lng } = e.target.getLatLng();
    setActivePoints((prev) => {
      const updated = [...prev];
      updated[index] = [lat, lng];
      return updated;
    });
  };

  // Delete a single vertex during editing (if > 3 vertices remain)
  const handleDeleteVertex = (index) => {
    if (activePoints.length <= 3) {
      notifyError(lang === "ta" ? "குறைந்தபட்சம் 3 புள்ளிகள் தேவை." : "A polygon boundary requires at least 3 points.");
      return;
    }
    setActivePoints((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Save polygon to backend API
  const handleSaveParcel = async () => {
    if (activePoints.length < 3) {
      notifyError(lang === "ta" ? "குறைந்தபட்சம் 3 புள்ளிகளை வரைந்து எல்லையை முடிக்கவும்." : "Please draw at least 3 points to define your farm boundary.");
      return;
    }

    setSaving(true);
    try {
      // Build closed GeoJSON ring [[lng, lat], ...]
      const ring = activePoints.map((pt) => [pt[1], pt[0]]);
      ring.push([ring[0][0], ring[0][1]]); // close polygon

      const geojsonPayload = {
        type: "Polygon",
        coordinates: [ring]
      };

      let res;
      if (parcel && parcel.id) {
        // Update existing parcel
        res = await apiFetch(`/api/farm/parcels/${parcel.id}`, {
          method: "PUT",
          body: JSON.stringify({
            name: `${farmName} Boundary`,
            geometry_geojson: geojsonPayload
          })
        });
      } else {
        // Create new parcel
        res = await apiFetch("/api/farm/parcels", {
          method: "POST",
          body: JSON.stringify({
            name: `${farmName} Boundary`,
            geometry_geojson: geojsonPayload
          })
        });
      }

      if (res && res.success && res.parcel) {
        setParcel(res.parcel);
        setMode("view");
        notifySuccess(
          lang === "ta"
            ? "பண்ணை எல்லை வெற்றிகரமாக சேமிக்கப்பட்டது!"
            : "User-demarcated farm boundary saved successfully!"
        );
        onParcelUpdated?.(res.parcel);
      } else {
        throw new Error(res?.error?.message || "Failed to save boundary.");
      }
    } catch (err) {
      console.error("Save farm boundary error:", err);
      notifyError(err.message || "Failed to save farm boundary.");
    } finally {
      setSaving(false);
    }
  };

  // Delete existing parcel from backend
  const handleDeleteParcel = async () => {
    if (!parcel || !parcel.id) return;
    const confirmMsg =
      lang === "ta"
        ? "சேமிக்கப்பட்ட பண்ணை எல்லையை நீக்க விரும்புகிறீர்களா?"
        : "Are you sure you want to delete this user-demarcated farm boundary?";
    if (!window.confirm(confirmMsg)) return;

    setSaving(true);
    try {
      const res = await apiFetch(`/api/farm/parcels/${parcel.id}`, {
        method: "DELETE"
      });
      if (res && res.success) {
        setParcel(null);
        setActivePoints([]);
        setMode("view");
        notifySuccess(
          lang === "ta"
            ? "பண்ணை எல்லை நீக்கப்பட்டது."
            : "Farm boundary deleted successfully."
        );
        onParcelUpdated?.(null);
      } else {
        throw new Error(res?.error?.message || "Failed to delete boundary.");
      }
    } catch (err) {
      console.error("Delete farm boundary error:", err);
      notifyError(err.message || "Failed to delete farm boundary.");
    } finally {
      setSaving(false);
    }
  };

  const centerPoint = useMemo(() => {
    if (activePoints.length >= 3) {
      return calculatePolygonCenter(activePoints);
    }
    return mapCenter;
  }, [activePoints, mapCenter]);

  return (
    <Card style={{ padding: "22px", marginBottom: "24px" }}>
      <CardHeader style={{ marginBottom: "14px", padding: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <h3 className="fc-h3" style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                <span>📐</span>
                <span>
                  {lang === "ta" ? "பயனர் வரைந்த பண்ணை எல்லை (GIS)" : "User-Demarcated Farm Boundary"}
                </span>
              </h3>
              <Badge variant="warning" style={{ fontSize: "10.5px", fontWeight: 700, textTransform: "uppercase" }}>
                {lang === "ta" ? "தகவல் நோக்கத்திற்கு மட்டுமே" : "Informational Only"}
              </Badge>
            </div>
            <p className="fc-muted" style={{ fontSize: "12.5px", margin: "4px 0 0 0" }}>
              {lang === "ta"
                ? "தகவல் நோக்கத்திற்கு மட்டுமே — இது உத்தியோகபூர்வ பட்டா/கிராம நிலப்பதிவு எல்லை அல்ல."
                : "Informational only — not an official cadastral or government revenue boundary."}
            </p>
          </div>

          {/* Action Toolbar */}
          <div className="fc-flex-gap-8" style={{ flexWrap: "wrap" }}>
            {mode === "view" && (
              <>
                {parcel ? (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setMode("editing")}>
                      ✏️ {lang === "ta" ? "எல்லையை திருத்து" : "Edit Vertices"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleStartDrawing}>
                      🔄 {lang === "ta" ? "மறுவரைவு" : "Redraw"}
                    </Button>
                    <Button variant="danger" size="sm" onClick={handleDeleteParcel} disabled={saving}>
                      🗑️ {lang === "ta" ? "நீக்கு" : "Delete"}
                    </Button>
                  </>
                ) : (
                  <Button variant="primary" size="sm" onClick={handleStartDrawing}>
                    ✏️ {lang === "ta" ? "பண்ணை எல்லை வரைக" : "Draw Farm Boundary"}
                  </Button>
                )}
              </>
            )}

            {mode === "drawing" && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUndoPoint}
                  disabled={activePoints.length === 0}
                >
                  ↩️ {lang === "ta" ? "முன்செய்" : "Undo Point"}
                </Button>
                <Button variant="outline" size="sm" onClick={handleCancel}>
                  ✕ {lang === "ta" ? "ரத்து" : "Cancel"}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveParcel}
                  disabled={activePoints.length < 3 || saving}
                >
                  {saving ? (lang === "ta" ? "சேமிக்கிறது..." : "Saving...") : `💾 ${lang === "ta" ? "எல்லையை சேமி" : "Save Boundary"}`}
                </Button>
              </>
            )}

            {mode === "editing" && (
              <>
                <Button variant="outline" size="sm" onClick={handleCancel}>
                  ✕ {lang === "ta" ? "ரத்து" : "Cancel"}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveParcel}
                  disabled={activePoints.length < 3 || saving}
                >
                  {saving ? (lang === "ta" ? "சேமிக்கிறது..." : "Saving...") : `💾 ${lang === "ta" ? "மாற்றங்களை சேமி" : "Save Changes"}`}
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>

      <CardBody style={{ padding: 0 }}>
        {/* Real-Time Geodesic Area & Status Banner */}
        <div
          style={{
            background: "var(--bg-soft, #f8fafc)",
            border: "1px solid var(--border, #e2e8f0)",
            padding: "10px 14px",
            borderRadius: "var(--radius-sm, 6px)",
            marginBottom: "12px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "8px",
            fontSize: "12.5px"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
            <div>
              <span className="fc-soft" style={{ fontSize: "11px", display: "block" }}>
                {lang === "ta" ? "கணக்கிடப்பட்ட பரப்பளவு:" : "CALCULATED AREA:"}
              </span>
              <strong style={{ fontSize: "14px", color: "var(--brand, #1b5e20)" }}>
                {calculatedArea.areaAcres > 0 ? `${calculatedArea.areaAcres} Acres` : "—"}
              </strong>
            </div>

            <div>
              <span className="fc-soft" style={{ fontSize: "11px", display: "block" }}>
                {lang === "ta" ? "ஹெக்டேர் சமமானவை:" : "HECTARES EQUIVALENT:"}
              </span>
              <strong style={{ fontSize: "13px", color: "var(--text, #1e293b)" }}>
                {calculatedArea.areaHectares > 0 ? `${calculatedArea.areaHectares} Hectares (${calculatedArea.areaSqm.toLocaleString()} m²)` : "—"}
              </strong>
            </div>

            <div>
              <span className="fc-soft" style={{ fontSize: "11px", display: "block" }}>
                {lang === "ta" ? "புள்ளிகள் எண்ணிக்கை:" : "VERTICES:"}
              </span>
              <strong>{activePoints.length} Points</strong>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {mode === "drawing" && (
              <Badge variant="info" style={{ fontSize: "11px" }}>
                🖱️ {lang === "ta" ? "வரைபடத்தில் கிளிக் செய்து புள்ளிகளை சேர்க்கவும்" : "Click map to add boundary points"}
              </Badge>
            )}
            {mode === "editing" && (
              <Badge variant="warning" style={{ fontSize: "11px" }}>
                ✋ {lang === "ta" ? "புள்ளிகளை நகர்த்தி எல்லை மாற்றலாம்" : "Drag pins to adjust boundary"}
              </Badge>
            )}
            {mode === "view" && parcel && (
              <Badge variant="success" style={{ fontSize: "11px" }}>
                ✓ {lang === "ta" ? "சேமிக்கப்பட்டது" : "Saved in Database"}
              </Badge>
            )}
          </div>
        </div>

        {/* Interactive Leaflet Map Container */}
        <div
          className="fc-osm-map-container"
          style={{
            position: "relative",
            width: "100%",
            height: "420px",
            borderRadius: "var(--radius-md, 8px)",
            overflow: "hidden",
            border: "1px solid var(--border, #e2e8f0)",
            background: "#e2e8f0"
          }}
        >
          <MapContainer
            center={centerPoint}
            zoom={15}
            scrollWheelZoom={true}
            zoomControl={true}
            style={{ width: "100%", height: "100%", zIndex: 1 }}
          >
            {/* Base OpenStreetMap Tile Layer */}
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
            />

            <MapViewController center={mapCenter} polygonCoords={activePoints} />

            <DrawingHandler
              isDrawing={mode === "drawing"}
              onAddPoint={handleAddPoint}
            />

            {/* Farm Center Pin (Reference Location) */}
            {mapCenter && !isNaN(mapCenter[0]) && activePoints.length === 0 && (
              <Marker position={mapCenter}>
                <Popup>
                  <strong>{farmName}</strong>
                  <br />
                  {lang === "ta" ? "பதிவு செய்யப்பட்ட பண்ணை மையம்" : "Registered Farm Location Center"}
                </Popup>
              </Marker>
            )}

            {/* Incomplete boundary polyline (while drawing with < 3 points) */}
            {mode === "drawing" && activePoints.length > 0 && activePoints.length < 3 && (
              <Polyline
                positions={activePoints}
                pathOptions={{ color: "#e65100", weight: 3, dashArray: "6, 6" }}
              />
            )}

            {/* Completed or actively drawn polygon */}
            {activePoints.length >= 3 && (
              <Polygon
                positions={activePoints}
                pathOptions={{
                  color: mode === "editing" ? "#e65100" : "#1b5e20",
                  fillColor: mode === "editing" ? "#ff9800" : "#2e7d32",
                  fillOpacity: 0.35,
                  weight: mode === "editing" ? 3 : 2.5
                }}
              >
                <Popup>
                  <div style={{ fontSize: "12px", minWidth: "180px" }}>
                    <strong style={{ color: "var(--brand, #1b5e20)", fontSize: "13px" }}>
                      {farmName} Boundary
                    </strong>
                    <div style={{ marginTop: "4px" }}>
                      Area: <strong>{calculatedArea.areaAcres} Acres</strong>
                    </div>
                    <div>
                      Equivalent: <strong>{calculatedArea.areaHectares} Ha</strong>
                    </div>
                    <div style={{ marginTop: "6px", fontSize: "10.5px", color: "#64748b" }}>
                      USER-DEMARCATED • NON-CADASTRAL
                    </div>
                  </div>
                </Popup>
              </Polygon>
            )}

            {/* Vertex markers for editing or during drawing */}
            {(mode === "editing" || mode === "drawing") &&
              activePoints.map((pt, idx) => (
                <Marker
                  key={`vertex-${idx}`}
                  position={pt}
                  icon={createVertexIcon(idx, idx === 0, mode === "editing")}
                  draggable={mode === "editing"}
                  eventHandlers={{
                    dragend: (e) => handleVertexDragEnd(idx, e),
                    click: () => {
                      if (mode === "editing") {
                        if (window.confirm(lang === "ta" ? `புள்ளி ${idx + 1}-ஐ நீக்கவா?` : `Remove vertex ${idx + 1}?`)) {
                          handleDeleteVertex(idx);
                        }
                      }
                    }
                  }}
                />
              ))}
          </MapContainer>

          {/* Empty state overlay inside map when no boundary exists and not drawing */}
          {mode === "view" && !parcel && !loading && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(15, 23, 42, 0.45)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                padding: "20px",
                textAlign: "center",
                zIndex: 400
              }}
            >
              <span style={{ fontSize: "36px", marginBottom: "8px" }}>📐</span>
              <h4 style={{ fontSize: "17px", fontWeight: 700, margin: "0 0 6px 0" }}>
                {lang === "ta" ? "பண்ணை எல்லை இன்னும் வரையப்படவில்லை" : "No Farm Boundary Added Yet"}
              </h4>
              <p style={{ fontSize: "13px", maxWidth: "420px", opacity: 0.9, margin: "0 0 16px 0" }}>
                {lang === "ta"
                  ? "உங்கள் பயிர் நிலத்தின் எல்லையை ஊடாடும் வரைபடத்தில் வரையத் தொடங்கவும். இது பரப்பளவு மற்றும் பயிர் மேலாண்மைக்கு உதவும்."
                  : "Demarcate your farm field boundary on the interactive map to calculate parcel acreage and track cultivation zones."}
              </p>
              <Button variant="primary" size="md" onClick={handleStartDrawing} style={{ fontWeight: 700 }}>
                ✏️ {lang === "ta" ? "பண்ணை எல்லை வரைக" : "Draw Farm Boundary"}
              </Button>
            </div>
          )}
        </div>

        {/* Legal Trust Notice Banner */}
        <div
          style={{
            marginTop: "12px",
            background: "rgba(234, 179, 8, 0.08)",
            border: "1px solid rgba(234, 179, 8, 0.35)",
            padding: "10px 14px",
            borderRadius: "var(--radius-sm, 6px)",
            fontSize: "11.5px",
            color: "var(--text-soft, #475569)",
            display: "flex",
            alignItems: "center",
            gap: "10px"
          }}
        >
          <span style={{ fontSize: "16px", flexShrink: 0 }}>ℹ️</span>
          <div>
            <strong>
              {lang === "ta" ? "சட்டப்பூர்வ அறிவிப்பு:" : "Legal Notice & Data Trust Boundary:"}{" "}
            </strong>
            <span>
              {lang === "ta"
                ? "இந்த வரைபடம் பயனர் வரையறுத்த எல்லை ஆகும். இது அரசு கிராம சர்வே அல்லது அதிகாரப்பூர்வ பட்டா எல்லை ஆவணங்களுக்கு சமமானதல்ல."
                : "This boundary is farmer-demarcated for agricultural planning and marketplace lot estimation. It does not constitute official cadastral land records or legal title demarcation."}
            </span>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

export default FarmBoundaryMap;
