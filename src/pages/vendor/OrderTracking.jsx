import { useMemo, memo } from "react";
import { Check, Truck as TruckIcon, ClipboardList, X, RefreshCw } from "../../components/icons/Icons.jsx";
import { EmptyState } from "../../components/common/EmptyState.jsx";
import { Button } from "../../components/common/Button.jsx";
import { formatCurrency, formatDate } from "../../utils/formatters.js";
import { useData } from "../../hooks/useData.js";
import { useAuth } from "../../hooks/useAuth.js";
import { useLanguage } from "../../hooks/useLanguage.js";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../../services/api.js";

const ALL_STAGES = [
  "Pending", "Accepted", "Preparing", "Ready for Pickup", 
  "Picked Up", "In Transit", "Out for Delivery", "Delivered"
];

const STAGE_DESCRIPTIONS = {
  "Pending": "Consolidating regional kitchen logs",
  "Accepted": "Grower accepted order details",
  "Preparing": "Harvesting and cold-packaging produce",
  "Ready for Pickup": "Secured at grower's gate",
  "Picked Up": "Transferred to regional delivery agent",
  "In Transit": "En route to urban distribution hub",
  "Out for Delivery": "Dispatched to kitchen base location",
  "Delivered": "B2B delivery complete and verified"
};

function TrackingTimeline({ order, t }) {
  if (order.status === "Cancelled" || order.status === "Rejected") {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        background: "var(--danger-light)",
        border: "1px solid var(--danger)",
        color: "var(--danger)",
        padding: "12px 14px",
        borderRadius: "var(--radius-sm)",
        fontSize: "13px",
        fontWeight: 600,
        marginTop: 12
      }}>
        <X size={18} />
        <span>Order Cancelled / Rejected</span>
      </div>
    );
  }

  const currentIdx = ALL_STAGES.indexOf(order.status);

  return (
    <div style={{ marginTop: 20 }}>
      {/* Visual Stepper Progress Bar (Desktop) */}
      <div className="fc-desktop-only" style={{ display: "flex", justifyContent: "space-between", position: "relative", marginBottom: 28, padding: "0 10px" }}>
        <div style={{
          position: "absolute",
          top: "14px",
          left: "25px",
          right: "25px",
          height: "3px",
          background: "var(--border)",
          zIndex: 1
        }} />
        <div style={{
          position: "absolute",
          top: "14px",
          left: "25px",
          width: `${(currentIdx / (ALL_STAGES.length - 1)) * 92}%`,
          height: "3px",
          background: "var(--brand)",
          transition: "width 0.5s ease",
          zIndex: 1
        }} />

        {ALL_STAGES.map((stage, idx) => {
          const isDone = idx < currentIdx;
          const isActive = idx === currentIdx;
          const isUpcoming = idx > currentIdx;
          
          return (
            <div key={stage} style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "relative", zIndex: 2, width: 60 }}>
              <div style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                background: isDone ? "var(--brand)" : isActive ? "var(--accent)" : "var(--bg-elevated)",
                border: `2px solid ${isDone ? "var(--brand)" : isActive ? "var(--accent)" : "var(--border)"}`,
                color: isDone || isActive ? "#fff" : "var(--text-soft)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: isActive ? "0 0 10px rgba(193,127,62,0.4)" : "none",
                animation: isActive ? "pulse 2s infinite" : "none",
                transition: "background-color 0.3s ease"
              }}>
                {isDone ? <Check size={14} /> : isActive ? <RefreshCw size={13} /> : <ClipboardList size={12} />}
              </div>
              <span style={{
                fontSize: 10,
                fontWeight: isActive ? "bold" : "normal",
                color: isActive ? "var(--accent)" : isUpcoming ? "var(--text-soft)" : "var(--text)",
                marginTop: 8,
                textAlign: "center",
                whiteSpace: "nowrap"
              }}>
                {stage}
              </span>
            </div>
          );
        })}
      </div>

      {/* Detailed Current Status Summary */}
      <div style={{ background: "var(--bg-soft)", padding: 12, borderRadius: 8, marginTop: 10 }}>
        <strong style={{ fontSize: 13, color: "var(--brand-dark)" }}>
          Active Stage: {order.status}
        </strong>
        <p className="fc-soft" style={{ margin: "4px 0 0 0", fontSize: 12 }}>
          {STAGE_DESCRIPTIONS[order.status] || "Fulfilling B2B transit specifications."}
        </p>
      </div>
    </div>
  );
}

function OrderTrackingBase() {
  const { t } = useLanguage();
  const { orders, products } = useData();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const { orderId } = useParams();

  // Filter orders related to vendor
  const myOrders = useMemo(() => {
    const vendorOrders = orders.filter((o) => (currentUser?.id && o.vendorId === currentUser.id) || (currentUser?.name && o.vendorName === currentUser.name));
    if (orderId) {
      const specific = vendorOrders.find((o) => o.id === orderId);
      return specific ? [specific] : [];
    }
    // Return all vendor orders sorted by date
    return vendorOrders;
  }, [orders, currentUser, orderId]);

  const productName = (id) => products.find((p) => p.id === id)?.name || "—";

  if (myOrders.length === 0) {
    return (
      <div className="fc-page-transition">
        <h1 className="fc-h1 fc-mb-24">{t("orderTracking")}</h1>
        <EmptyState icon={<TruckIcon size={26} />} title={t("noOrdersYet")}
          action={<Button variant="primary" onClick={() => navigate("/vendor/marketplace")}>{t("browseMarketplace")}</Button>} />
      </div>
    );
  }

  // Group items by order ID for B2B presentation
  const groupedOrders = useMemo(() => {
    const groups = {};
    myOrders.forEach(o => {
      if (!groups[o.id]) {
        groups[o.id] = {
          id: o.id,
          vendorName: o.vendorName,
          deliveryAddress: o.deliveryAddress,
          paymentMethod: o.paymentMethod,
          totalAmount: o.totalAmount,
          status: o.status,
          createdAt: o.createdAt,
          items: []
        };
      }
      groups[o.id].items.push(o);
    });
    return Object.values(groups).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [myOrders]);

  return (
    <div className="fc-page-transition">
      <h1 className="fc-h1 fc-mb-8">{t("orderTracking")}</h1>
      <p className="fc-muted fc-mb-24">Monitor B2B cold-chain transit stages and farm-consolidated delivery status.</p>

      {groupedOrders.map((o) => (
        <div className="fc-panel" key={o.id} style={{ marginBottom: 24, border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
          {/* Group Header */}
          <div className="fc-panel-head" style={{ borderBottom: "1px solid var(--border)", paddingBottom: 16 }}>
            <div>
              <h3 className="fc-h3" style={{ fontSize: 16 }}>Group Order: {o.id}</h3>
              <p className="fc-soft fc-mt-8" style={{ fontSize: 12 }}>
                Placed on {formatDate(o.createdAt)} • Bill Total: <strong>{formatCurrency(o.totalAmount, o.currency)}</strong>
              </p>
            </div>
            <span className={`fc-status-badge fc-status-${o.status.replace(/\s+/g, "").toLowerCase()}`} style={{ fontWeight: "bold", fontSize: 12 }}>
              {o.status}
            </span>
          </div>

          {/* Stepper Timeline */}
          <TrackingTimeline order={o} t={t} />

          {/* Items breakdown list */}
          <div style={{ marginTop: 20 }}>
            <h4 style={{ fontSize: 13, fontWeight: "bold", marginBottom: 8 }}>Consolidated Items in Shipment</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {o.items.map((item, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", background: "var(--bg-soft)", padding: "10px 12px", borderRadius: 6, fontSize: 12 }}>
                  <span>
                    <strong>{productName(item.productId)}</strong> × {item.qty} units
                  </span>
                  <span>{formatCurrency(item.amount, o.currency)}</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Metadata & Actions */}
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", fontSize: "13px" }}>
            <div style={{ display: "flex", gap: "24px" }}>
              <div>
                <span className="fc-muted" style={{ display: "block", marginBottom: 4, fontSize: 11 }}>{t("shippingAddress")}</span>
                <strong>{o.deliveryAddress || "N/A"}</strong>
              </div>
              <div>
                <span className="fc-muted" style={{ display: "block", marginBottom: 4, fontSize: 11 }}>{t("paymentMethodLabel")}</span>
                <strong style={{ textTransform: "uppercase" }}>{o.paymentMethod || "COD"}</strong>
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                const farmerId = o.items[0]?.farmerId;
                if (!farmerId) return;
                try {
                  const res = await apiFetch("/api/conversations", {
                    method: "POST",
                    body: JSON.stringify({ farmerId, orderId: o.id })
                  });
                  if (res && res.conversation) {
                    navigate(`/chat/${res.conversation.id}`);
                  }
                } catch {
                  /* ignore */
                }
              }}
              style={{ fontWeight: 700 }}
            >
              💬 Chat with Farmer
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

export const OrderTracking = memo(OrderTrackingBase);
export default OrderTracking;
