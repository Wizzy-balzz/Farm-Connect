/* eslint-disable react-refresh/only-export-components */
import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Check,
  Truck as TruckIcon,
  ClipboardList,
  X,
  RefreshCw,
  Plus
} from "../../components/icons/Icons.jsx";
import { EmptyState } from "../../components/common/EmptyState.jsx";
import { Button } from "../../components/common/Button.jsx";
import { Badge } from "../../components/common/Badge.jsx";
import { Card } from "../../components/common/Card.jsx";
import { Modal } from "../../components/common/Modal.jsx";
import { OsmRouteMap } from "../../components/common/OsmRouteMap.jsx";
import { formatCurrency, formatDate } from "../../utils/formatters.js";
import { useData } from "../../hooks/useData.js";
import { useAuth } from "../../hooks/useAuth.js";
import { useLanguage } from "../../hooks/useLanguage.js";
import { useNotifications } from "../../hooks/useNotifications.js";
import { fetchOrderTracking, addTrackingEvent } from "../../services/trackingService.js";
import { apiFetch } from "../../services/api.js";
import { getOrderStatusLabel, getUnitLabel } from "../../utils/controlledVocabulary.js";

// Standard 8-stage transit timeline
export const ORDER_TRACKING_STAGES = [
  "Order Placed",
  "Order Confirmed",
  "Packed",
  "Dispatched",
  "In Transit",
  "Reached Destination Hub",
  "Out for Delivery",
  "Delivered"
];

// Stage descriptions for customer transparency
const STAGE_DESCRIPTIONS = {
  "Order Placed": "Order received and validated on FarmConnect platform.",
  "Order Confirmed": "Grower accepted order and scheduled harvest lot.",
  "Packed": "Produce harvested, quality inspected, and packaged in temperature-controlled crates.",
  "Dispatched": "Shipment picked up from farm gate and en route to regional consolidation center.",
  "In Transit": "Consolidated inter-state cargo travelling along national highway corridor.",
  "Reached Destination Hub": "Shipment checked in at destination urban fulfillment hub.",
  "Out for Delivery": "Dispatched with local delivery team to commercial kitchen / warehouse destination.",
  "Delivered": "Shipment safely received, verified, and signed off at destination."
};

/**
 * Standardize status to match tracking stages
 */
function normalizeStageIndex(status) {
  if (!status) return 0;
  const s = status.toLowerCase();
  if (s === "pending" || s === "order placed") return 0;
  if (s === "accepted" || s === "confirmed" || s === "order confirmed") return 1;
  if (s === "preparing" || s === "packed") return 2;
  if (s === "ready for pickup" || s === "picked up" || s === "dispatched") return 3;
  if (s === "in transit") return 4;
  if (s === "reached destination hub" || s === "hub") return 5;
  if (s === "out for delivery") return 6;
  if (s === "delivered") return 7;
  return 0;
}

/**
 * Interactive 8-Stage Progress Stepper
 */
function TrackingStepper({ currentStatus }) {
  const { lang } = useLanguage();
  if (currentStatus === "Cancelled" || currentStatus === "Rejected") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          background: "var(--danger-light)",
          border: "1px solid var(--danger)",
          color: "var(--danger)",
          padding: "12px 16px",
          borderRadius: "var(--radius-sm)",
          fontSize: "13px",
          fontWeight: 600,
          margin: "16px 0"
        }}
      >
        <X size={18} />
        <span>Order Cancelled / Rejected</span>
      </div>
    );
  }

  const currentIdx = normalizeStageIndex(currentStatus);

  return (
    <div style={{ margin: "24px 0" }}>
      {/* Visual Stepper Progress Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          position: "relative",
          marginBottom: 16,
          padding: "0 10px",
          overflowX: "auto"
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "14px",
            left: "25px",
            right: "25px",
            height: "3px",
            background: "var(--border)",
            zIndex: 1
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "14px",
            left: "25px",
            width: `${Math.min(96, (currentIdx / (ORDER_TRACKING_STAGES.length - 1)) * 92)}%`,
            height: "3px",
            background: "var(--brand)",
            transition: "width 0.5s ease",
            zIndex: 1
          }}
        />

        {ORDER_TRACKING_STAGES.map((stage, idx) => {
          const isDone = idx < currentIdx;
          const isActive = idx === currentIdx;
          const isUpcoming = idx > currentIdx;

          return (
            <div
              key={stage}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                position: "relative",
                zIndex: 2,
                minWidth: "70px",
                padding: "0 4px"
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: isDone ? "var(--brand)" : isActive ? "var(--accent)" : "var(--bg-elevated)",
                  border: `2px solid ${isDone ? "var(--brand)" : isActive ? "var(--accent)" : "var(--border)"}`,
                  color: isDone || isActive ? "#fff" : "var(--text-soft)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: isActive ? "0 0 10px rgba(193,127,62,0.4)" : "none",
                  transition: "background-color 0.3s ease"
                }}
              >
                {isDone ? <Check size={14} /> : isActive ? <RefreshCw size={12} className="animate-spin" /> : <ClipboardList size={11} />}
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? "var(--accent)" : isUpcoming ? "var(--text-soft)" : "var(--text)",
                  marginTop: 6,
                  textAlign: "center",
                  lineHeight: 1.2
                }}
              >
                {getOrderStatusLabel(stage, lang)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Active Stage Detail Banner */}
      <div style={{ background: "var(--bg-soft)", padding: "12px 16px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <strong style={{ fontSize: 13, color: "var(--brand-dark)" }}>
            Current Stage: {getOrderStatusLabel(currentStatus, lang)}
          </strong>
          <span className="fc-soft" style={{ fontSize: 11 }}>
            Stage {currentIdx + 1} of {ORDER_TRACKING_STAGES.length}
          </span>
        </div>
        <p className="fc-soft" style={{ margin: "4px 0 0 0", fontSize: 12 }}>
          {STAGE_DESCRIPTIONS[currentStatus] || STAGE_DESCRIPTIONS[ORDER_TRACKING_STAGES[currentIdx]] || "Produce logistics shipment moving along verified Indian transport corridor."}
        </p>
      </div>
    </div>
  );
}

/**
 * Admin / Manager Tracking Event Update Modal
 */
function AdminTrackingModal({ isOpen, onClose, orderId, onSaved }) {
  const { notifySuccess, notifyError } = useNotifications();
  const [status, setStatus] = useState("In Transit");
  const [location, setLocation] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!location.trim()) {
      notifyError("Checkpoint location name is required.");
      return;
    }

    setSaving(true);
    try {
      await addTrackingEvent(orderId, {
        status,
        location: location.trim(),
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        description: description.trim()
      });
      notifySuccess(`Tracking event '${status}' recorded successfully.`);
      onSaved?.();
      onClose();
    } catch (err) {
      notifyError(err.message || "Failed to add tracking event.");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Add Tracking Checkpoint (${orderId})`}>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label className="fc-label" style={{ fontSize: 12, marginBottom: 4, display: "block" }}>
            Tracking Stage / Status
          </label>
          <select
            className="fc-select"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{ width: "100%" }}
          >
            {ORDER_TRACKING_STAGES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>

        <div>
          <label className="fc-label" style={{ fontSize: 12, marginBottom: 4, display: "block" }}>
            Checkpoint Location (City, Transit Hub, State) *
          </label>
          <input
            type="text"
            className="fc-input"
            placeholder="e.g. Pune Central Distribution Hub, Maharashtra"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            required
            style={{ width: "100%" }}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label className="fc-label" style={{ fontSize: 12, marginBottom: 4, display: "block" }}>
              Latitude (Optional)
            </label>
            <input
              type="number"
              step="any"
              className="fc-input"
              placeholder="e.g. 18.5204"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              style={{ width: "100%" }}
            />
          </div>
          <div>
            <label className="fc-label" style={{ fontSize: 12, marginBottom: 4, display: "block" }}>
              Longitude (Optional)
            </label>
            <input
              type="number"
              step="any"
              className="fc-input"
              placeholder="e.g. 73.8567"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              style={{ width: "100%" }}
            />
          </div>
        </div>

        <div>
          <label className="fc-label" style={{ fontSize: 12, marginBottom: 4, display: "block" }}>
            Checkpoint Description / Transit Notes
          </label>
          <textarea
            className="fc-input"
            rows={2}
            placeholder="e.g. Inspected produce temperature; passed regional customs."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Saving..." : "Save Tracking Event"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function OrderTrackingBase() {
  const { t, lang } = useLanguage();
  const { orders } = useData();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const { orderId } = useParams();

  // Active tracking state for detailed view
  const [trackingData, setTrackingData] = useState(null);
  const [loadingTracking, setLoadingTracking] = useState(false);
  const [trackingError, setTrackingError] = useState("");
  const [adminModalOpen, setAdminModalOpen] = useState(false);

  // Determine authorized user orders (vendors see their orders, farmers see orders containing their products)
  const myOrders = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === "admin") return orders;
    if (currentUser.role === "vendor") {
      return orders.filter(
        (o) => o.vendorId === currentUser.id || o.vendorName === currentUser.name
      );
    }
    if (currentUser.role === "farmer") {
      return orders.filter(
        (o) => o.farmerId === currentUser.id || o.items?.some?.((i) => i.farmerId === currentUser.id)
      );
    }
    return orders;
  }, [orders, currentUser]);

  // Selected Order ID (from URL parameter or default to first order)
  const activeOrderId = useMemo(() => {
    if (orderId) return orderId;
    return myOrders[0]?.id || null;
  }, [orderId, myOrders]);

  // Load detailed tracking information from authoritative backend
  const loadTracking = useCallback(async (id) => {
    if (!id) return;
    setLoadingTracking(true);
    setTrackingError("");

    try {
      const data = await fetchOrderTracking(id);
      if (data && data.success) {
        setTrackingData(data);
      } else {
        setTrackingError(data?.error?.message || "Could not load tracking information.");
      }
    } catch (err) {
      setTrackingError(err.message || "Failed to load tracking data.");
    } finally {
      setLoadingTracking(false);
    }
  }, []);

  useEffect(() => {
    if (activeOrderId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadTracking(activeOrderId);
    }
  }, [activeOrderId, loadTracking]);

  // Real-Time Event Stream Listener for live tracking updates
  useEffect(() => {
    if (!activeOrderId) return;

    let eventSource = null;
    try {
      eventSource = new EventSource("/api/realtime/stream", { withCredentials: true });
      eventSource.addEventListener("order_tracking_update", (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.orderId === activeOrderId) {
            loadTracking(activeOrderId);
          }
        } catch { /* ignore parsing errors */ }
      });
      eventSource.addEventListener("order_status_change", (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.orderId === activeOrderId) {
            loadTracking(activeOrderId);
          }
        } catch { /* ignore parsing errors */ }
      });
    } catch { /* ignore connection errors */ }

    return () => {
      if (eventSource) eventSource.close();
    };
  }, [activeOrderId, loadTracking]);

  if (!currentUser) {
    return (
      <div className="fc-page-transition" style={{ padding: "40px 0" }}>
        <h1 className="fc-h1 fc-mb-24">{t("orderTracking")}</h1>
        <p className="fc-muted">Please log in to track your FarmConnect orders.</p>
      </div>
    );
  }

  if (myOrders.length === 0 && !activeOrderId) {
    return (
      <div className="fc-page-transition" style={{ padding: "40px 0" }}>
        <h1 className="fc-h1 fc-mb-24">{t("orderTracking")}</h1>
        <EmptyState
          icon={<TruckIcon size={28} />}
          title="No Orders Found to Track"
          description="Place an order in the marketplace to monitor direct B2B transit stages and checkpoints across India."
          action={
            <Button variant="primary" onClick={() => navigate("/vendor/marketplace")}>
              {t("browseMarketplace")}
            </Button>
          }
        />
      </div>
    );
  }

  const order = trackingData?.order;
  const source = trackingData?.source || {};
  const destination = trackingData?.destination || {};
  const latestLocation = trackingData?.latestLocation || {};
  const route = trackingData?.route || {};
  const events = trackingData?.events || [];
  const items = trackingData?.items || [];

  return (
    <div className="fc-page-transition" style={{ paddingBottom: "40px" }}>
      {/* Header and selector */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 className="fc-h1" style={{ margin: 0 }}>
            {t("orderTracking")} {order?.id ? `• ${order.id}` : ""}
          </h1>
          <p className="fc-muted" style={{ margin: "4px 0 0 0", fontSize: 13 }}>
            Monitor real FarmConnect transit events, highway checkpoints, and OSRM route calculations across India.
          </p>
        </div>

        {/* Order Selector Dropdown if multiple orders exist */}
        {myOrders.length > 1 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="fc-label" style={{ fontSize: 12, margin: 0 }}>Switch Order:</span>
            <select
              className="fc-select"
              value={activeOrderId || ""}
              onChange={(e) => navigate(`/vendor/tracking/${e.target.value}`)}
              style={{ fontSize: 13, minWidth: "160px" }}
            >
              {myOrders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.id} ({o.status})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Loading & Error States */}
      {loadingTracking && (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-soft)" }}>
          <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 12px auto", display: "block" }} />
          Loading authoritative shipment tracking & route data...
        </div>
      )}

      {trackingError && !loadingTracking && (
        <Card style={{ padding: 24, textAlign: "center", marginBottom: 20 }}>
          <div style={{ color: "var(--danger)", marginBottom: 12, fontWeight: 600 }}>
            ⚠️ {trackingError}
          </div>
          <Button variant="outline" size="sm" onClick={() => loadTracking(activeOrderId)}>
            Retry
          </Button>
        </Card>
      )}

      {/* Detailed Tracking Overview */}
      {trackingData && !loadingTracking && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Top Panel: Status, ETA, and Quick Stats */}
          <div className="fc-panel" style={{ padding: "20px 24px", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h3 className="fc-h3" style={{ margin: 0, fontSize: 18 }}>Order {order.id}</h3>
                  <Badge variant={order.status === "Delivered" ? "success" : "info"}>
                    {getOrderStatusLabel(order.status, lang)}
                  </Badge>
                </div>
                <div className="fc-soft" style={{ fontSize: 12, marginTop: 4 }}>
                  Placed on {formatDate(order.createdAt)} • Buyer: <strong>{order.vendorName}</strong>
                </div>
              </div>

              {/* Action Buttons: Refresh + Admin Event Post */}
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => loadTracking(activeOrderId)}
                  title="Refresh Tracking"
                >
                  <RefreshCw size={13} /> Refresh
                </Button>

                {currentUser.role === "admin" && (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => setAdminModalOpen(true)}
                  >
                    <Plus size={13} /> Update Checkpoint
                  </Button>
                )}
              </div>
            </div>

            {/* Stepper Progress Timeline */}
            <TrackingStepper currentStatus={order.status} />

            {/* Route & Transit Metrics Cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 12,
                marginTop: 18,
                paddingTop: 18,
                borderTop: "1px solid var(--border)"
              }}
            >
              <div style={{ background: "var(--bg-soft)", padding: "10px 14px", borderRadius: 8 }}>
                <span className="fc-muted" style={{ fontSize: 11, display: "block" }}>OSRM Road Distance</span>
                <strong style={{ fontSize: 15, color: "var(--brand-dark)" }}>
                  {route.formattedDistance || `${route.distanceKm} km`}
                </strong>
                <div className="fc-soft" style={{ fontSize: 11, marginTop: 2 }}>{route.provider || "OpenStreetMap OSRM"}</div>
              </div>

              <div style={{ background: "var(--bg-soft)", padding: "10px 14px", borderRadius: 8 }}>
                <span className="fc-muted" style={{ fontSize: 11, display: "block" }}>Estimated Transit Time</span>
                <strong style={{ fontSize: 15 }}>
                  {route.formattedEta || `${route.etaMinutes} mins`}
                </strong>
                <div className="fc-soft" style={{ fontSize: 11, marginTop: 2 }}>Based on real road network</div>
              </div>

              <div style={{ background: "var(--bg-soft)", padding: "10px 14px", borderRadius: 8 }}>
                <span className="fc-muted" style={{ fontSize: 11, display: "block" }}>Estimated Delivery</span>
                <strong style={{ fontSize: 15, color: "var(--accent)" }}>
                  {order.status === "Delivered" ? "Delivered" : route.estimatedDeliveryDate || "In Schedule"}
                </strong>
                <div className="fc-soft" style={{ fontSize: 11, marginTop: 2 }}>Subject to highway clearance</div>
              </div>

              <div style={{ background: "var(--bg-soft)", padding: "10px 14px", borderRadius: 8 }}>
                <span className="fc-muted" style={{ fontSize: 11, display: "block" }}>Bill Total & Payment</span>
                <strong style={{ fontSize: 15 }}>
                  {formatCurrency(order.totalAmount, order.currency)}
                </strong>
                <div className="fc-soft" style={{ fontSize: 11, marginTop: 2 }}>{order.paymentMethod?.toUpperCase()} • {order.paymentStatus}</div>
              </div>
            </div>
          </div>

          {/* Interactive OpenStreetMap Route Visualization */}
          <div className="fc-panel" style={{ padding: "20px 24px", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <h3 className="fc-h3" style={{ margin: 0, fontSize: 16 }}>🗺️ Live Transit Corridor Map</h3>
                <p className="fc-soft" style={{ fontSize: 12, margin: "2px 0 0 0" }}>
                  Interactive OpenStreetMap showing source farm, destination hub, and verified checkpoints.
                </p>
              </div>
              <span className="fc-badge fc-badge-info" style={{ fontSize: 11 }}>
                OpenStreetMap + Leaflet
              </span>
            </div>

            <OsmRouteMap
              source={source}
              destination={destination}
              latestLocation={latestLocation}
              height="380px"
            />

            {/* Source & Destination Location Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
              {/* Source Card */}
              <div style={{ background: "var(--bg-soft)", padding: 14, borderRadius: 8, border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#2d7a4c" }}></span>
                  <strong style={{ fontSize: 13, color: "var(--brand-dark)" }}>Origin (Farmer Location)</strong>
                </div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{source.name}</div>
                <div className="fc-soft" style={{ fontSize: 12, marginTop: 2 }}>{source.address}</div>
                {source.latitude && (
                  <div style={{ fontSize: 11, color: "var(--text-soft)", marginTop: 4, fontFamily: "monospace" }}>
                    Coordinates: {source.latitude?.toFixed(4)}°, {source.longitude?.toFixed(4)}°
                  </div>
                )}
              </div>

              {/* Destination Card */}
              <div style={{ background: "var(--bg-soft)", padding: 14, borderRadius: 8, border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#d32f2f" }}></span>
                  <strong style={{ fontSize: 13, color: "#d32f2f" }}>Destination (Delivery Hub)</strong>
                </div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{destination.name}</div>
                <div className="fc-soft" style={{ fontSize: 12, marginTop: 2 }}>{destination.address}</div>
                {destination.latitude && (
                  <div style={{ fontSize: 11, color: "var(--text-soft)", marginTop: 4, fontFamily: "monospace" }}>
                    Coordinates: {destination.latitude?.toFixed(4)}°, {destination.longitude?.toFixed(4)}°
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Shipment Items Breakdown & Historical Event Log Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 20 }}>
            {/* Historical Checkpoint Events Log */}
            <div className="fc-panel" style={{ padding: "20px 24px", border: "1px solid var(--border)" }}>
              <h3 className="fc-h3" style={{ fontSize: 16, marginBottom: 14 }}>
                📋 Verified Tracking Event Log
              </h3>
              {events.length === 0 ? (
                <p className="fc-soft" style={{ fontSize: 12 }}>No checkpoint events recorded yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {events.map((ev, idx) => (
                    <div
                      key={ev.id || idx}
                      style={{
                        display: "flex",
                        gap: 12,
                        position: "relative",
                        paddingBottom: idx === events.length - 1 ? 0 : 12,
                        borderBottom: idx === events.length - 1 ? "none" : "1px solid var(--border-light)"
                      }}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          background: idx === events.length - 1 ? "var(--brand)" : "var(--bg-elevated)",
                          color: idx === events.length - 1 ? "#fff" : "var(--brand)",
                          border: "1px solid var(--brand)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          fontSize: 12
                        }}
                      >
                        {idx + 1}
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
                          <strong style={{ fontSize: 13 }}>{getOrderStatusLabel(ev.status, lang)}</strong>
                          <span className="fc-soft" style={{ fontSize: 11 }}>
                            {formatDate(ev.timestamp)}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--brand-dark)", marginTop: 2 }}>
                          📍 {ev.location}
                        </div>
                        {ev.description && (
                          <div className="fc-soft" style={{ fontSize: 11, marginTop: 2 }}>
                            {ev.description}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Produce Items in Consignment */}
            <div className="fc-panel" style={{ padding: "20px 24px", border: "1px solid var(--border)" }}>
              <h3 className="fc-h3" style={{ fontSize: 16, marginBottom: 14 }}>
                📦 Produce Consignment Items
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {items.map((it) => (
                  <div
                    key={it.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      background: "var(--bg-soft)",
                      padding: "10px 12px",
                      borderRadius: 6,
                      fontSize: 12
                    }}
                  >
                    <div>
                      <strong>{it.productName}</strong>
                      <div className="fc-soft" style={{ fontSize: 11 }}>
                        {it.qty} {getUnitLabel(it.unit, lang)} × {formatCurrency(it.unitPrice)}/{getUnitLabel(it.unit, lang)}
                      </div>
                    </div>
                    <strong style={{ fontSize: 13, color: "var(--brand)" }}>
                      {formatCurrency(it.amount)}
                    </strong>
                  </div>
                ))}
              </div>

              {/* Chat with Counterpart Action */}
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                <Button
                  variant="outline"
                  size="sm"
                  style={{ width: "100%", fontWeight: 600 }}
                  onClick={async () => {
                    const farmerId = items[0]?.farmerId || source.farmerId;
                    const vendorId = order?.vendorId;
                    if (!farmerId && !vendorId) return;
                    try {
                      const res = await apiFetch("/api/conversations", {
                        method: "POST",
                        body: JSON.stringify({
                          farmerId: farmerId || (currentUser?.role === "farmer" ? currentUser.id : undefined),
                          vendorId: vendorId || (currentUser?.role === "vendor" ? currentUser.id : undefined),
                          orderId: order?.id
                        })
                      });
                      if (res?.conversation) {
                        navigate(`/chat/${res.conversation.id}`);
                      }
                    } catch { /* ignore chat navigation errors */ }
                  }}
                >
                  💬 Chat with Partner Regarding Shipment
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Checkpoint Modal */}
      {currentUser.role === "admin" && (
        <AdminTrackingModal
          isOpen={adminModalOpen}
          onClose={() => setAdminModalOpen(false)}
          orderId={activeOrderId}
          onSaved={() => loadTracking(activeOrderId)}
        />
      )}
    </div>
  );
}

export const OrderTracking = memo(OrderTrackingBase);
export default OrderTracking;
