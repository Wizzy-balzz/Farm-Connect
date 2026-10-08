import { useState, useMemo, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Check,
  X,
  Truck as TruckIcon,
  ClipboardList,
  RefreshCw,
  Search as SearchIcon,
} from "../../components/icons/Icons.jsx";
import {
  Button,
  Card,
  Badge,
  Avatar,
  SearchBox,
  StatCard,
  Skeleton,
  TableRowSkeleton,
  EmptyState,
} from "../../components/common/index.js";
import { formatCurrency, formatDate } from "../../utils/formatters.js";
import { useData } from "../../hooks/useData.js";
import { useAuth } from "../../hooks/useAuth.js";
import { useLanguage } from "../../hooks/useLanguage.js";
import { useNotifications } from "../../hooks/useNotifications.js";
import {
  getOrderStatusLabel,
  getCategoryLabel,
  getUnitLabel,
  getGradeLabel,
} from "../../utils/controlledVocabulary.js";

const STATUS_FILTERS = [
  "All",
  "Pending",
  "Accepted",
  "Preparing",
  "Ready for Pickup",
  "Picked Up",
  "In Transit",
  "Out for Delivery",
  "Delivered",
  "Cancelled",
];

const STAGE_PROGRESSION = {
  Pending: { next: "Accepted", label: "Accept Order" },
  Accepted: { next: "Preparing", label: "Start Preparing" },
  Preparing: { next: "Ready for Pickup", label: "Ready for Pickup" },
  "Ready for Pickup": { next: "Picked Up", label: "Mark Picked Up" },
  "Picked Up": { next: "In Transit", label: "Depart (In Transit)" },
  "In Transit": { next: "Out for Delivery", label: "Out for Delivery" },
  "Out for Delivery": { next: "Delivered", label: "Complete Delivery" },
};

const CATEGORY_FALLBACKS = {
  Vegetables: "https://images.unsplash.com/photo-1566385101042-1a0aa0c1268c?auto=format&fit=crop&w=200&q=80",
  Grains: "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=200&q=80",
  Fruits: "https://images.unsplash.com/photo-1619546813926-a78fa6372cd2?auto=format&fit=crop&w=200&q=80",
  Spices: "https://images.unsplash.com/photo-1596790011568-d0f948b8ec66?auto=format&fit=crop&w=200&q=80",
  Dairy: "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=200&q=80",
};

function getStatusBadgeVariant(status) {
  switch (status) {
    case "Pending":
      return "warning";
    case "Accepted":
    case "Confirmed":
      return "info";
    case "Preparing":
    case "Ready for Pickup":
    case "Picked Up":
    case "In Transit":
    case "Out for Delivery":
      return "info";
    case "Delivered":
      return "success";
    case "Cancelled":
    case "Rejected":
      return "danger";
    default:
      return "neutral";
  }
}

function FarmerOrdersBase() {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const { farmerProfile, user } = useAuth();
  const { orders, products, updateOrderStatus, loading } = useData();
  const { notifySuccess, notifyError } = useNotifications();

  const [statusFilter, setStatusFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const currentFarmerId = farmerProfile?.id || user?.id;

  const myOrders = useMemo(
    () => orders.filter((o) => o.farmerId && currentFarmerId && String(o.farmerId) === String(currentFarmerId)),
    [orders, currentFarmerId]
  );

  const getProduct = useCallback(
    (id) => products.find((p) => p.id === id),
    [products]
  );

  const filtered = useMemo(() => {
    let result = myOrders;
    if (statusFilter !== "All") {
      result = result.filter((o) => o.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((o) => {
        const prod = getProduct(o.productId);
        const prodName = prod?.name?.toLowerCase() || "";
        const buyer = o.vendorName?.toLowerCase() || "";
        const orderId = String(o.id).toLowerCase();
        const address = o.deliveryAddress?.toLowerCase() || "";
        return (
          orderId.includes(q) ||
          prodName.includes(q) ||
          buyer.includes(q) ||
          address.includes(q)
        );
      });
    }
    return result;
  }, [myOrders, statusFilter, searchQuery, getProduct]);

  const revenue = useMemo(() => {
    const delivered = myOrders.filter((o) => o.status === "Delivered" || o.status === "Accepted");
    const totalEarned = delivered.reduce((s, o) => s + (o.amount || 0), 0);
    const thisMonth = delivered
      .filter(
        (o) =>
          o.createdAt &&
          new Date(o.createdAt).getMonth() === new Date().getMonth()
      )
      .reduce((s, o) => s + (o.amount || 0), 0);
    const avg = delivered.length ? Math.round(totalEarned / delivered.length) : 0;
    return { totalEarned, thisMonth, avg };
  }, [myOrders]);

  const handleAdvanceStatus = useCallback(
    (order, nextStatus) => {
      updateOrderStatus(order.id, nextStatus);
      notifySuccess(`Order advanced to status: ${nextStatus}`);
    },
    [updateOrderStatus, notifySuccess]
  );

  const handleReject = useCallback(
    (order) => {
      updateOrderStatus(order.id, "Cancelled");
      notifyError("Order marked as Cancelled");
    },
    [updateOrderStatus, notifyError]
  );

  const clearSearchAndFilters = () => {
    setStatusFilter("All");
    setSearchQuery("");
  };

  return (
    <div className="fc-page-transition">
      {/* Header Banner */}
      <div className="fc-page-head">
        <div>
          <h1 className="fc-h1">{t("incomingOrders")}</h1>
          <p className="fc-muted" style={{ marginTop: 4 }}>
            {myOrders.length} B2B transactions cataloged for {farmerProfile.farmName || farmerProfile.name}
          </p>
        </div>
      </div>

      {/* Metrics Summary */}
      <div className="fc-stat-grid" style={{ marginBottom: 24 }}>
        <StatCard
          label={t("totalEarned")}
          value={formatCurrency(revenue.totalEarned)}
          icon={<TruckIcon size={20} />}
          color="var(--brand)"
          bg="var(--brand-light)"
        />
        <StatCard
          label={t("thisMonth")}
          value={formatCurrency(revenue.thisMonth)}
          icon={<ClipboardList size={20} />}
          color="var(--accent)"
          bg="var(--accent-light)"
        />
        <StatCard
          label={t("avgOrderValue")}
          value={formatCurrency(revenue.avg)}
          icon={<Check size={20} />}
          color="var(--info)"
          bg="var(--info-light)"
        />
      </div>

      {/* Search Bar & Filter Chips */}
      <Card style={{ padding: "18px", marginBottom: "20px" }}>
        <div style={{ display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap", marginBottom: "14px" }}>
          <div style={{ flex: 1, minWidth: "260px" }}>
            <SearchBox
              value={searchQuery}
              onChange={(val) => setSearchQuery(val)}
              placeholder="Search order ID, buyer, produce, or address..."
            />
          </div>
          <div className="fc-soft" style={{ fontSize: "12.5px", fontWeight: 600 }}>
            Showing {filtered.length} of {myOrders.length} orders
          </div>
        </div>

        {/* Scrollable Status Chips */}
        <div style={{ overflowX: "auto", paddingBottom: "4px" }}>
          <div className="fc-flex-gap-8 fc-flex-wrap">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                className={`fc-radio-chip ${statusFilter === s ? "active" : ""}`}
                onClick={() => setStatusFilter(s)}
                style={{ fontSize: "12px", padding: "6px 14px" }}
              >
                {s === "All" ? t("all") : getOrderStatusLabel(s, lang)}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Orders Table Container */}
      <Card style={{ padding: "20px" }}>
        {loading ? (
          <div className="fc-table-wrap">
            <table className="fc-table">
              <thead>
                <tr>
                  <th>{t("orderId")}</th>
                  <th>Vendor</th>
                  <th>Produce Lot</th>
                  <th>{t("qty")}</th>
                  <th>{t("amount")}</th>
                  <th>{t("date")}</th>
                  <th>{t("status")}</th>
                  <th>Action Control</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 4 }).map((_, i) => (
                  <TableRowSkeleton key={i} cols={8} />
                ))}
              </tbody>
            </table>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<SearchIcon size={28} />}
            title="No orders match your search or status filter"
            description="Try clearing search queries or selecting a different status filter."
            action={
              <Button variant="outline" onClick={clearSearchAndFilters}>
                Clear Search & Filters
              </Button>
            }
          />
        ) : (
          <div className="fc-table-wrap">
            <table className="fc-table">
              <thead>
                <tr>
                  <th>{t("orderId")}</th>
                  <th>Buyer</th>
                  <th>Produce Lot</th>
                  <th>{t("qty")}</th>
                  <th>{t("amount")}</th>
                  <th>{t("date")}</th>
                  <th>{t("status")}</th>
                  <th>Action Pipeline</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => {
                  const step = STAGE_PROGRESSION[o.status];
                  const prod = getProduct(o.productId);
                  const prodImg = prod?.imageUrl || CATEGORY_FALLBACKS[prod?.category] || CATEGORY_FALLBACKS.Vegetables;
                  const badgeVariant = getStatusBadgeVariant(o.status);

                  return (
                    <tr key={o.itemId || o.id}>
                      <td>
                        <strong style={{ fontFamily: "var(--font-heading)" }}>{o.id}</strong>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Avatar name={o.vendorName || "Vendor"} size="sm" role="vendor" />
                          <div>
                            <strong style={{ fontSize: 13 }}>{o.vendorName}</strong>
                            <div className="fc-soft" style={{ fontSize: 10.5 }}>
                              {o.deliveryAddress || "Standard B2B Delivery"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <img
                            src={prodImg}
                            alt={prod?.name || "Produce"}
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: "var(--radius-sm)",
                              objectFit: "cover",
                            }}
                          />
                          <div>
                            <strong style={{ fontSize: 13 }}>{prod?.name || "Crop Lot"}</strong>
                            <div className="fc-soft" style={{ fontSize: 10.5 }}>
                              Grade {getGradeLabel(prod?.grade, lang)} • {getCategoryLabel(prod?.category, lang)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <strong>{o.qty}</strong> {getUnitLabel(prod?.unit, lang)}
                      </td>
                      <td>
                        <strong style={{ fontFamily: "var(--font-heading)", color: "var(--brand)" }}>
                          {formatCurrency(o.amount)}
                        </strong>
                      </td>
                      <td>{formatDate(o.createdAt)}</td>
                      <td>
                        <Badge variant={badgeVariant}>{getOrderStatusLabel(o.status, lang)}</Badge>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/farmer/tracking/${o.id}`)}
                            style={{ fontSize: 11, padding: "5px 8px" }}
                            title="Track delivery on OpenStreetMap"
                          >
                            <TruckIcon size={11} /> Track
                          </Button>
                          {step && (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => handleAdvanceStatus(o, step.next)}
                              style={{ fontSize: 11, padding: "5px 10px" }}
                            >
                              <RefreshCw size={11} /> {step.label}
                            </Button>
                          )}
                          {o.status === "Pending" && (
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => handleReject(o)}
                              style={{ fontSize: 11, padding: "5px 10px" }}
                            >
                              <X size={11} /> Reject
                            </Button>
                          )}
                          {o.status === "Delivered" && (
                            <span style={{ color: "var(--brand)", fontSize: 12, fontWeight: 700 }}>
                              ✓ Delivered
                            </span>
                          )}
                          {o.status === "Cancelled" && (
                            <span style={{ color: "var(--danger)", fontSize: 12, fontWeight: 700 }}>
                              𐄂 Cancelled
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

export const FarmerOrders = memo(FarmerOrdersBase);
export default FarmerOrders;
