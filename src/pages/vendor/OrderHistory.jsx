import { useState, useMemo, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ClipboardList,
  Search as SearchIcon,
  Truck as TruckIcon,
  Check,
  ShoppingBag,
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

const STATUS_FILTERS = [
  "All",
  "Pending",
  "Accepted",
  "Preparing",
  "Ready for Pickup",
  "In Transit",
  "Out for Delivery",
  "Delivered",
  "Cancelled",
];

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
    case "Preparing":
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

function OrderHistoryBase() {
  const { t } = useLanguage();
  const { orders, products, loading } = useData();
  const { vendorProfile } = useAuth();
  const navigate = useNavigate();

  const [statusFilter, setStatusFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const myOrders = useMemo(
    () => orders.filter((o) => o.vendorName === vendorProfile.name),
    [orders, vendorProfile.name]
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
        const orderId = String(o.id).toLowerCase();
        const address = o.deliveryAddress?.toLowerCase() || "";
        return orderId.includes(q) || prodName.includes(q) || address.includes(q);
      });
    }
    return result;
  }, [myOrders, statusFilter, searchQuery, getProduct]);

  const stats = useMemo(() => {
    const totalSpent = myOrders.reduce((s, o) => s + o.amount, 0);
    const deliveredCount = myOrders.filter((o) => o.status === "Delivered").length;
    const activeCount = myOrders.filter(
      (o) => o.status !== "Delivered" && o.status !== "Cancelled"
    ).length;
    return { totalSpent, deliveredCount, activeCount };
  }, [myOrders]);

  const clearSearchAndFilters = () => {
    setStatusFilter("All");
    setSearchQuery("");
  };

  return (
    <div className="fc-page-transition">
      {/* Header */}
      <div className="fc-page-head">
        <div>
          <h1 className="fc-h1">{t("orderHistory")}</h1>
          <p className="fc-muted" style={{ marginTop: 4 }}>
            Track and review your B2B wholesale procurement orders
          </p>
        </div>
        <Button variant="primary" onClick={() => navigate("/vendor/marketplace")}>
          <ShoppingBag size={15} /> {t("browseMarketplace")}
        </Button>
      </div>

      {/* Metrics Summary */}
      <div className="fc-stat-grid" style={{ marginBottom: 24 }}>
        <StatCard
          label="Total Procurement Spend"
          value={formatCurrency(stats.totalSpent)}
          icon={<TruckIcon size={20} />}
          color="var(--brand)"
          bg="var(--brand-light)"
        />
        <StatCard
          label="Delivered B2B Orders"
          value={`${stats.deliveredCount} Orders`}
          icon={<Check size={20} />}
          color="var(--accent)"
          bg="var(--accent-light)"
        />
        <StatCard
          label="Active Shipments"
          value={`${stats.activeCount} In Transit`}
          icon={<ClipboardList size={20} />}
          color="var(--info)"
          bg="var(--info-light)"
        />
      </div>

      {/* Search & Status Filters */}
      <Card style={{ padding: "18px", marginBottom: "20px" }}>
        <div style={{ display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap", marginBottom: "14px" }}>
          <div style={{ flex: 1, minWidth: "260px" }}>
            <SearchBox
              value={searchQuery}
              onChange={(val) => setSearchQuery(val)}
              placeholder="Search order ID, produce, or delivery address..."
            />
          </div>
          <div className="fc-soft" style={{ fontSize: "12.5px", fontWeight: 600 }}>
            Showing {filtered.length} of {myOrders.length} orders
          </div>
        </div>

        {/* Scrollable Status Filter Chips */}
        <div style={{ overflowX: "auto", paddingBottom: "4px" }}>
          <div className="fc-flex-gap-8 fc-flex-wrap">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                className={`fc-radio-chip ${statusFilter === s ? "active" : ""}`}
                onClick={() => setStatusFilter(s)}
                style={{ fontSize: "12px", padding: "6px 14px" }}
              >
                {s === "All" ? t("all") : s}
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
                  <th>Produce Lot</th>
                  <th>{t("qty")}</th>
                  <th>{t("amount")}</th>
                  <th>{t("date")}</th>
                  <th>Shipping Address</th>
                  <th>Payment</th>
                  <th>{t("status")}</th>
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
            description="Browse our verified grower marketplace to place new wholesale orders."
            action={
              <div className="fc-flex-gap-8">
                <Button variant="outline" onClick={clearSearchAndFilters}>
                  Clear Filters
                </Button>
                <Button variant="primary" onClick={() => navigate("/vendor/marketplace")}>
                  {t("browseMarketplace")}
                </Button>
              </div>
            }
          />
        ) : (
          <div className="fc-table-wrap">
            <table className="fc-table">
              <thead>
                <tr>
                  <th>{t("orderId")}</th>
                  <th>Produce Lot</th>
                  <th>{t("qty")}</th>
                  <th>{t("amount")}</th>
                  <th>{t("date")}</th>
                  <th>Shipping Address</th>
                  <th>Payment</th>
                  <th>{t("status")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => {
                  const prod = getProduct(o.productId);
                  const prodImg = prod?.imageUrl || CATEGORY_FALLBACKS[prod?.category] || CATEGORY_FALLBACKS.Vegetables;
                  const badgeVariant = getStatusBadgeVariant(o.status);

                  return (
                    <tr key={o.itemId || o.id}>
                      <td>
                        <strong style={{ fontFamily: "var(--font-heading)" }}>{o.id}</strong>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <img
                            src={prodImg}
                            alt={prod?.name || "Produce"}
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: "var(--radius-sm)",
                              objectFit: "cover",
                            }}
                          />
                          <div>
                            <strong style={{ fontSize: 13 }}>{prod?.name || "Crop Lot"}</strong>
                            <div className="fc-soft" style={{ fontSize: 10.5 }}>
                              Grade {prod?.grade || "A"} • {prod?.category || "Produce"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <strong>{o.qty}</strong> {prod?.unit || "units"}
                      </td>
                      <td>
                        <strong style={{ fontFamily: "var(--font-heading)", color: "var(--brand)" }}>
                          {formatCurrency(o.amount, o.currency)}
                        </strong>
                      </td>
                      <td>{formatDate(o.createdAt)}</td>
                      <td
                        style={{
                          fontSize: "12px",
                          maxWidth: "180px",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        title={o.deliveryAddress || "Standard B2B Delivery"}
                      >
                        {o.deliveryAddress || "Standard B2B Delivery"}
                      </td>
                      <td style={{ textTransform: "uppercase", fontSize: "11px", fontWeight: 700 }}>
                        {o.paymentMethod || "COD"}
                      </td>
                      <td>
                        <Badge variant={badgeVariant}>{o.status}</Badge>
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

export const OrderHistory = memo(OrderHistoryBase);
export default OrderHistory;
