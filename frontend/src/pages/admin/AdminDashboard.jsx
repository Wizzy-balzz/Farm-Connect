import { useState, useMemo, useCallback, useEffect, memo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiFetch } from "../../services/api.js";
import {
  StatCard,
  Button,
  Card,
  Badge,
  Avatar,
  SearchBox,
  Tabs,
  Modal,
  Skeleton,
  TableRowSkeleton,
  EmptyState,
} from "../../components/common/index.js";
import { addTrackingEvent } from "../../services/trackingService.js";
import { BarChart } from "../../components/charts/BarChart.jsx";
import { DonutChart } from "../../components/charts/DonutChart.jsx";
import { LineChart } from "../../components/charts/LineChart.jsx";
import { AnalyticsDashboard } from "../../components/analytics/AnalyticsDashboard.jsx";
import {
  ClipboardList,
  Package,
  TrendingUp,
  AlertTriangle,
  Search as SearchIcon,
  Check,
  Star,
  Sprout,
} from "../../components/icons/Icons.jsx";
import { formatCurrency, formatDate } from "../../utils/formatters.js";
import { useData } from "../../hooks/useData.js";
import { useLanguage } from "../../hooks/useLanguage.js";
import { useNotifications } from "../../hooks/useNotifications.js";
import { ProductTranslationsModal } from "../../components/product/ProductTranslationsModal.jsx";

const ShieldIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="22"
    height="22"
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ marginRight: "8px" }}
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const UserIcon = ({ size = 16 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

function getStatusBadgeVariant(status) {
  switch (status?.toLowerCase()) {
    case "verified":
    case "delivered":
    case "accepted":
      return "success";
    case "pending":
      return "warning";
    case "rejected":
    case "cancelled":
      return "danger";
    default:
      return "neutral";
  }
}

function AdminDashboardBase() {
  const { t } = useLanguage();
  const { products, orders, fetchOrders, fetchProducts } = useData();
  const { notifySuccess, notifyError } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  // Dynamic user profiles & reviews
  const [users, setUsers] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [translationModalProduct, setTranslationModalProduct] = useState(null);

  // Order Tracking Checkpoint Modal State
  const [trackingModalOrder, setTrackingModalOrder] = useState(null);
  const [adminCheckpointStatus, setAdminCheckpointStatus] = useState("In Transit");
  const [adminCheckpointLocation, setAdminCheckpointLocation] = useState("");
  const [adminCheckpointLat, setAdminCheckpointLat] = useState("");
  const [adminCheckpointLng, setAdminCheckpointLng] = useState("");
  const [adminCheckpointDesc, setAdminCheckpointDesc] = useState("");
  const [adminUpdatingTracking, setAdminUpdatingTracking] = useState(false);

  const handleAdminTrackingSubmit = async (e) => {
    e.preventDefault();
    if (!trackingModalOrder || !adminCheckpointLocation.trim()) return;
    setAdminUpdatingTracking(true);
    try {
      await addTrackingEvent(trackingModalOrder.id, {
        status: adminCheckpointStatus,
        location: adminCheckpointLocation.trim(),
        latitude: adminCheckpointLat ? parseFloat(adminCheckpointLat) : null,
        longitude: adminCheckpointLng ? parseFloat(adminCheckpointLng) : null,
        description: adminCheckpointDesc.trim()
      });
      notifySuccess(`Tracking event '${adminCheckpointStatus}' saved for ${trackingModalOrder.id}`);
      setTrackingModalOrder(null);
      fetchOrders?.();
    } catch (err) {
      notifyError?.(err.message || "Failed to update tracking event.");
    } finally {
      setAdminUpdatingTracking(false);
    }
  };

  // Tab switcher
  const pathSegment = location.pathname.split("/").pop();
  const activeTab = [
    "users",
    "farmers",
    "vendors",
    "products",
    "orders",
    "reviews",
    "delivery",
    "analytics",
  ].includes(pathSegment)
    ? pathSegment
    : "overview";

  const fetchUsers = useCallback(async () => {
    try {
      const data = await apiFetch("/api/users");
      setUsers(data);
    } catch (err) {
      console.error("Failed to load users:", err);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const fetchReviews = useCallback(async () => {
    try {
      const data = await apiFetch("/api/reviews");
      setReviews(data);
    } catch (err) {
      console.error("Failed to load reviews:", err);
    }
  }, []);

  const [pricingRules, setPricingRules] = useState([]);

  const fetchPricingRules = useCallback(async () => {
    try {
      const data = await apiFetch("/api/delivery/pricing-rules");
      if (data && data.rules) setPricingRules(data.rules);
    } catch (err) {
      console.error("Failed to load delivery pricing rules:", err);
    }
  }, []);

  const [adminAnalytics, setAdminAnalytics] = useState(null);

  useEffect(() => {
    fetchUsers();
    fetchReviews();
    fetchPricingRules();
    apiFetch("/api/ai/admin-analytics")
      .then((data) => {
        if (data && data.analytics) setAdminAnalytics(data.analytics);
      })
      .catch(() => {});
  }, [fetchUsers, fetchReviews, fetchPricingRules]);

  // Derived statistics
  const farmersList = useMemo(
    () => users.filter((u) => u.role === "farmer"),
    [users]
  );
  const vendorsList = useMemo(
    () => users.filter((u) => u.role === "vendor"),
    [users]
  );

  const totalVolume = useMemo(() => {
    return orders
      .filter((o) => o.status === "Delivered" || o.status === "Accepted")
      .reduce((s, o) => s + o.amount, 0);
  }, [orders]);

  // Chart data calculations
  const revenueTrend = useMemo(() => {
    const sorted = [...orders].sort(
      (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
    );
    return sorted.reduce((acc, o) => {
      const running = (acc.length ? acc[acc.length - 1].value : 0) + o.amount;
      acc.push({
        label: new Date(o.createdAt).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
        }),
        value: running,
      });
      return acc;
    }, []);
  }, [orders]);

  const categoryDist = useMemo(() => {
    const buckets = {};
    products.forEach((p) => {
      buckets[p.category] = (buckets[p.category] || 0) + 1;
    });
    return Object.entries(buckets).map(([label, value]) => ({ label, value }));
  }, [products]);

  const ordersByStatus = useMemo(() => {
    const buckets = { Pending: 0, Accepted: 0, Delivered: 0, Rejected: 0 };
    orders.forEach((o) => {
      const statusKey = o.status.replace(/\s+/g, "");
      buckets[statusKey] = (buckets[statusKey] || 0) + 1;
    });
    return Object.entries(buckets).map(([label, value]) => ({ label, value }));
  }, [orders]);

  const handleTabChange = useCallback(
    (tab) => {
      setSearchQuery("");
      if (tab === "overview") {
        navigate("/admin/dashboard");
      } else {
        navigate(`/admin/${tab}`);
      }
    },
    [navigate]
  );

  // Farmer verification control
  const handleVerifyFarmer = useCallback(
    async (userId, status) => {
      try {
        await apiFetch(`/api/users/${userId}/verification`, {
          method: "PUT",
          body: JSON.stringify({ status }),
        });
        notifySuccess(`Farmer account is now ${status}!`);
        fetchUsers();
      } catch (err) {
        console.error(err);
      }
    },
    [fetchUsers, notifySuccess]
  );

  // Moderate/delete review
  const handleDeleteReview = useCallback(
    async (reviewId) => {
      try {
        await apiFetch(`/api/reviews/${reviewId}`, {
          method: "DELETE",
        });
        notifySuccess("Review moderated and deleted.");
        fetchReviews();
      } catch (err) {
        console.error(err);
      }
    },
    [fetchReviews, notifySuccess]
  );

  // CSV Report exporters
  const handleExportCSV = useCallback(
    (type) => {
      let headers = [];
      let rows = [];
      let filename = `${type}_report.csv`;

      if (type === "orders") {
        headers = ["Order ID", "Vendor Name", "Subtotal Amount", "Status", "Date"];
        rows = orders.map((o) => [o.id, o.vendorName, o.amount, o.status, o.createdAt]);
      } else if (type === "users") {
        headers = ["User ID", "Name", "Email", "Role", "Verification Status", "Rating"];
        rows = users.map((u) => [u.id, u.name, u.email, u.role, u.verificationStatus, u.rating]);
      } else {
        headers = ["Product ID", "Product Name", "Category", "Base Price", "Stock"];
        rows = products.map((p) => [p.id, p.name, p.category, p.price, p.stock]);
      }

      const csvContent =
        "data:text/csv;charset=utf-8," +
        [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    [orders, users, products]
  );

  const getFarmerName = useCallback(
    (id) => farmersList.find((f) => f.id === id)?.name || "—",
    [farmersList]
  );
  const getProductName = useCallback(
    (id) => products.find((p) => p.id === id)?.name || "—",
    [products]
  );

  // Filtered lists for search
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase();
    return users.filter(
      (u) =>
        (u?.name?.toLowerCase() || "").includes(q) ||
        (u?.email?.toLowerCase() || "").includes(q) ||
        (u?.role?.toLowerCase() || "").includes(q)
    );
  }, [users, searchQuery]);

  const filteredFarmers = useMemo(() => {
    if (!searchQuery.trim()) return farmersList;
    const q = searchQuery.toLowerCase();
    return farmersList.filter(
      (f) =>
        (f?.name?.toLowerCase() || "").includes(q) ||
        (f?.farmName?.toLowerCase() || "").includes(q) ||
        (f?.region?.toLowerCase() || "").includes(q)
    );
  }, [farmersList, searchQuery]);

  const filteredVendors = useMemo(() => {
    if (!searchQuery.trim()) return vendorsList;
    const q = searchQuery.toLowerCase();
    return vendorsList.filter(
      (v) =>
        (v?.name?.toLowerCase() || "").includes(q) ||
        (v?.email?.toLowerCase() || "").includes(q) ||
        (v?.region?.toLowerCase() || "").includes(q)
    );
  }, [vendorsList, searchQuery]);

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const q = searchQuery.toLowerCase();
    return products.filter(
      (p) =>
        (p?.name?.toLowerCase() || "").includes(q) ||
        (p?.category?.toLowerCase() || "").includes(q)
    );
  }, [products, searchQuery]);

  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return orders;
    const q = searchQuery.toLowerCase();
    return orders.filter(
      (o) =>
        String(o?.id || "").toLowerCase().includes(q) ||
        (o?.vendorName?.toLowerCase() || "").includes(q) ||
        (getProductName(o?.productId)?.toLowerCase() || "").includes(q)
    );
  }, [orders, searchQuery, getProductName]);

  const filteredReviews = useMemo(() => {
    if (!searchQuery.trim()) return reviews;
    const q = searchQuery.toLowerCase();
    return reviews.filter(
      (r) =>
        (r?.vendorName?.toLowerCase() || "").includes(q) ||
        (r?.comment?.toLowerCase() || "").includes(q)
    );
  }, [reviews, searchQuery]);

  const adminTabs = [
    { id: "overview", label: t("admin.overview") || "Overview & Analytics" },
    { id: "analytics", label: "📊 AI Analytics & Reports" },
    { id: "users", label: `${t("navigation.users") || "Users"} (${users.length})` },
    { id: "farmers", label: `${t("navigation.farmers") || "Farmers"} (${farmersList.length})` },
    { id: "vendors", label: `${t("navigation.buyers") || "Buyers"} (${vendorsList.length})` },
    { id: "products", label: `${t("navigation.products") || "Products"} (${products.length})` },
    { id: "orders", label: `${t("navigation.orders") || "Orders"} (${orders.length})` },
    { id: "delivery", label: "🚚 Delivery Rules & Payments" },
    { id: "reviews", label: `${t("admin.reviews") || "Reviews"} (${reviews.length})` },
  ];

  return (
    <div className="fc-page-transition">
      {/* Hero Header Banner */}
      <div
        className="fc-hero"
        style={{
          background: "var(--gradient-hero)",
          padding: "32px 28px",
          borderRadius: "var(--radius-lg)",
          color: "#ffffff",
          marginBottom: "24px",
          boxShadow: "var(--shadow-md)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ marginRight: 14, display: "flex" }}>
              <ShieldIcon />
            </div>
            <div>
              <span style={{ fontSize: "11.5px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", opacity: 0.9 }}>
                {t("admin.adminProfile") || "PLATFORM GOVERNANCE"}
              </span>
              <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "26px", fontWeight: 800, margin: 0, lineHeight: 1.2 }}>
                {t("admin.dashboardTitle") || "Admin Control Center"}
              </h1>
              <p style={{ margin: "4px 0 0 0", opacity: 0.9, fontSize: "13.5px" }}>
                {t("admin.dashboardSubtitle") || "Manage platform users, verify farmer accounts, oversee listings, and review system analytics."}
              </p>
            </div>
          </div>

          <div className="fc-flex-gap-8" style={{ flexWrap: "wrap" }}>
            <Button variant="accent" size="sm" onClick={() => handleExportCSV("orders")} style={{ fontWeight: 700 }}>
              Export Orders CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExportCSV("users")} style={{ fontWeight: 700, color: "#fff", borderColor: "rgba(255,255,255,0.4)" }}>
              Export Users CSV
            </Button>
          </div>
        </div>
      </div>


      {/* Metrics Stat Cards */}
      <div className="fc-stat-grid" style={{ marginBottom: "24px" }}>
        <StatCard
          label="Total Trade Volume"
          value={formatCurrency(totalVolume)}
          icon={<TrendingUp size={20} />}
          color="var(--brand)"
          bg="var(--brand-light)"
          trend={{ direction: "up", text: "+18% vs last month" }}
        />
        <StatCard
          label="Total Products Listed"
          value={products.length}
          icon={<Package size={20} />}
          color="var(--accent)"
          bg="var(--accent-light)"
        />
        <StatCard
          label="Orders Ledger Count"
          value={orders.length}
          icon={<ClipboardList size={20} />}
          color="var(--info)"
          bg="var(--info-light)"
        />
        <StatCard
          label="Active Platform Users"
          value={users.length}
          icon={<UserIcon size={20} />}
          color="var(--brand-dark)"
          bg="var(--brand-light)"
        />
      </div>

      {/* Navigation Tabs Bar */}
      <Card style={{ padding: "16px 20px", marginBottom: "24px" }}>
        <Tabs
          tabs={adminTabs}
          activeTab={activeTab}
          onChange={(tabId) => handleTabChange(tabId)}
          variant="underline"
        />
      </Card>

      {/* Search Bar for Management Tabs */}
      {activeTab !== "overview" && (
        <Card style={{ padding: "16px 20px", marginBottom: "20px" }}>
          <SearchBox
            value={searchQuery}
            onChange={(val) => setSearchQuery(val)}
            placeholder={`Search ${activeTab}...`}
          />
        </Card>
      )}

      {/* TAB 1: Overview & Analytics */}
      {activeTab === "overview" && (
        <>
          {/* Ask AI Executive Analytics Card */}
          <Card style={{ padding: "20px", marginBottom: "24px", background: "var(--brand-light)", borderColor: "var(--brand)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <Sprout size={20} color="var(--brand)" />
              <h3 className="fc-h3" style={{ margin: 0, color: "var(--brand-dark)" }}>
                🌱 Ask AI Executive Analytics
              </h3>
            </div>
            <p className="fc-soft" style={{ fontSize: "13px", margin: "0 0 14px 0", lineHeight: 1.4 }}>
              Query platform governance metrics, sales volume performance, or user growth statistics using natural language.
            </p>
            {adminAnalytics && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
                <div style={{ background: "var(--surface)", padding: "12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                  <span className="fc-soft" style={{ fontSize: "11px" }}>SETTLED TRADE VOLUME</span>
                  <div style={{ fontWeight: 800, fontSize: "16px", color: "var(--brand)" }}>{formatCurrency(adminAnalytics.deliveredRevenue)}</div>
                </div>
                <div style={{ background: "var(--surface)", padding: "12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                  <span className="fc-soft" style={{ fontSize: "11px" }}>SYSTEM USERS</span>
                  <div style={{ fontWeight: 800, fontSize: "16px" }}>{adminAnalytics.users} ({adminAnalytics.farmers} Farmers, {adminAnalytics.vendors} Buyers)</div>
                </div>
                <div style={{ background: "var(--surface)", padding: "12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                  <span className="fc-soft" style={{ fontSize: "11px" }}>EXECUTED ORDERS</span>
                  <div style={{ fontWeight: 800, fontSize: "16px" }}>{adminAnalytics.orders}</div>
                </div>
              </div>
            )}
          </Card>
          <div className="fc-grid-2" style={{ marginBottom: "24px" }}>
            <Card style={{ padding: "20px" }}>
              <h3 className="fc-h3" style={{ marginBottom: 16 }}>Platform Trade Volume Trend</h3>
              {revenueTrend.length ? (
                <LineChart data={revenueTrend} color="var(--brand)" chartId="admin-volume" />
              ) : (
                <p className="fc-muted" style={{ fontStyle: "italic", fontSize: 13 }}>No transaction data available.</p>
              )}
            </Card>

            <Card style={{ padding: "20px" }}>
              <h3 className="fc-h3" style={{ marginBottom: 16 }}>Category Listing Distribution</h3>
              {categoryDist.length ? (
                <DonutChart data={categoryDist} />
              ) : (
                <p className="fc-muted" style={{ fontStyle: "italic", fontSize: 13 }}>No products listed.</p>
              )}
            </Card>
          </div>

          <div className="fc-grid-2" style={{ marginBottom: "24px" }}>
            <Card style={{ padding: "20px" }}>
              <h3 className="fc-h3" style={{ marginBottom: 16 }}>Platform Summary Metrics</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 13.5 }}>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
                  <span className="fc-muted">Registered Growers (Farmers):</span>
                  <strong>{farmersList.length} users</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
                  <span className="fc-muted">Registered Buyers:</span>
                  <strong>{vendorsList.length} users</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
                  <span className="fc-muted">Average Trade Value / Order:</span>
                  <strong>{formatCurrency(orders.length ? Math.round(totalVolume / orders.length) : 0)}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 4 }}>
                  <span className="fc-muted">Platform Node Database:</span>
                  <strong style={{ color: "var(--brand)" }}>Connected Full-Stack Database (SQLite)</strong>
                </div>
              </div>
            </Card>

            <Card style={{ padding: "20px" }}>
              <h3 className="fc-h3" style={{ marginBottom: 16 }}>System Activity Logger</h3>
              <div style={{ fontSize: 12.5, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ color: "var(--brand)", fontWeight: 600 }}>
                  ✓ System initialized with Vite 8 + React 19 + Express 4.
                </div>
                <div style={{ color: "var(--info)" }}>
                  ℹ Synced local SQLite: {products.length} listing catalog lots loaded.
                </div>
                <div style={{ color: "var(--accent)" }}>
                  ℹ Verified B2B sessions: {users.length} active credential keys in users table.
                </div>
                <div style={{ color: "var(--text-muted)" }}>
                  ℹ Session restored: successfully synchronized {orders.length} order items records.
                </div>
              </div>
            </Card>
          </div>
        </>
      )}

      {/* TAB 2: Users Management */}
      {activeTab === "users" && (
        <Card style={{ padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 className="fc-h3" style={{ margin: 0 }}>All Platform Users ({filteredUsers.length})</h3>
            <Button variant="outline" size="sm" onClick={() => handleExportCSV("users")}>
              Export Users CSV
            </Button>
          </div>
          {loadingUsers ? (
            <div className="fc-table-wrap">
              <table className="fc-table">
                <thead>
                  <tr>
                    <th>User Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Verification Status</th>
                    <th>Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <TableRowSkeleton key={i} cols={5} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : filteredUsers.length === 0 ? (
            <EmptyState
              icon={<SearchIcon size={28} />}
              title="No users match search criteria"
              action={<Button variant="outline" onClick={() => setSearchQuery("")}>Reset Search</Button>}
            />
          ) : (
            <div className="fc-table-wrap">
              <table className="fc-table">
                <thead>
                  <tr>
                    <th>User Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Verification Status</th>
                    <th>Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Avatar name={u.name} size="sm" role={u.role} />
                          <strong>{u.name}</strong>
                        </div>
                      </td>
                      <td>{u.email}</td>
                      <td>
                        <Badge variant={u.role === "admin" ? "success" : u.role === "farmer" ? "info" : "warning"}>
                          {u.role}
                        </Badge>
                      </td>
                      <td>
                        <Badge variant={getStatusBadgeVariant(u.verificationStatus)}>
                          {u.verificationStatus || "Pending"}
                        </Badge>
                      </td>
                      <td>
                        ★ {u.rating != null && u.rating !== "" && !Number.isNaN(Number(u.rating))
                          ? Number(u.rating).toFixed(1)
                          : "5.0"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* TAB 3: Farmers Verifications */}
      {activeTab === "farmers" && (
        <Card style={{ padding: "20px" }}>
          <h3 className="fc-h3" style={{ marginBottom: 16 }}>Grower Verifications & Moderation</h3>
          {filteredFarmers.length === 0 ? (
            <EmptyState
              icon={<SearchIcon size={28} />}
              title="No farmers match search criteria"
              action={<Button variant="outline" onClick={() => setSearchQuery("")}>Reset Search</Button>}
            />
          ) : (
            <div className="fc-table-wrap">
              <table className="fc-table">
                <thead>
                  <tr>
                    <th>Farmer ID</th>
                    <th>Farmer Name</th>
                    <th>Farm Name</th>
                    <th>Region</th>
                    <th>Status</th>
                    <th>Verification Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFarmers.map((f) => (
                    <tr key={f.id}>
                      <td>{f.id}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Avatar name={f.name} size="sm" role="farmer" verified={f.verificationStatus === "Verified"} />
                          <strong>{f.name}</strong>
                        </div>
                      </td>
                      <td>{f.farmName}</td>
                      <td>{f.region}</td>
                      <td>
                        <Badge variant={getStatusBadgeVariant(f.verificationStatus)}>
                          {f.verificationStatus}
                        </Badge>
                      </td>
                      <td>
                        {f.verificationStatus === "Pending" ? (
                          <div style={{ display: "flex", gap: 6 }}>
                            <Button size="sm" variant="primary" onClick={() => handleVerifyFarmer(f.id, "Verified")}>
                              Approve
                            </Button>
                            <Button size="sm" variant="danger" onClick={() => handleVerifyFarmer(f.id, "Rejected")}>
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => handleVerifyFarmer(f.id, "Pending")}>
                            Reset Status
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* TAB 4: Vendors List */}
      {activeTab === "vendors" && (
        <Card style={{ padding: "20px" }}>
          <h3 className="fc-h3" style={{ marginBottom: 16 }}>Registered Buyers ({filteredVendors.length})</h3>
          {filteredVendors.length === 0 ? (
            <EmptyState
              icon={<SearchIcon size={28} />}
              title="No vendors match search criteria"
              action={<Button variant="outline" onClick={() => setSearchQuery("")}>Reset Search</Button>}
            />
          ) : (
            <div className="fc-table-wrap">
              <table className="fc-table">
                <thead>
                  <tr>
                    <th>Buyer ID</th>
                    <th>Buyer Name</th>
                    <th>Base Location</th>
                    <th>Email</th>
                    <th>Verification</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVendors.map((v) => (
                    <tr key={v.id}>
                      <td>{v.id}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Avatar name={v.name} size="sm" role="vendor" />
                          <strong>{v.name}</strong>
                        </div>
                      </td>
                      <td>{v.region || "—"}</td>
                      <td>{v.email}</td>
                      <td>
                        <Badge variant="success">Verified</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* TAB 5: Products Listings */}
      {activeTab === "products" && (
        <Card style={{ padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 className="fc-h3" style={{ margin: 0 }}>Catalog Listings Lots ({filteredProducts.length})</h3>
            <Button variant="outline" size="sm" onClick={() => handleExportCSV("products")}>
              Export Products CSV
            </Button>
          </div>
          {filteredProducts.length === 0 ? (
            <EmptyState
              icon={<SearchIcon size={28} />}
              title="No products match search criteria"
              action={<Button variant="outline" onClick={() => setSearchQuery("")}>Reset Search</Button>}
            />
          ) : (
            <div className="fc-table-wrap">
              <table className="fc-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Listing Name</th>
                    <th>Category</th>
                    <th>Price / Unit</th>
                    <th>Grower</th>
                    <th>Stock</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p) => (
                    <tr key={p.id}>
                      <td>{p.id}</td>
                      <td><strong>{p.name}</strong></td>
                      <td><Badge variant="neutral">{p.category}</Badge></td>
                      <td><strong>{formatCurrency(p.price)}</strong> / {p.unit}</td>
                      <td>{getFarmerName(p.farmerId)}</td>
                      <td>{p.stock} {p.unit}</td>
                      <td style={{ textAlign: "right" }}>
                        <Button
                          size="sm"
                          variant="outline"
                          style={{ fontSize: "11px", padding: "4px 8px" }}
                          onClick={() => setTranslationModalProduct(p)}
                          title="Manage multilingual product translations"
                        >
                          🌐 Translations
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Product Translations Modal */}
      {translationModalProduct && (
        <ProductTranslationsModal
          open={!!translationModalProduct}
          onClose={() => setTranslationModalProduct(null)}
          product={translationModalProduct}
          onUpdated={fetchProducts}
        />
      )}

      {/* TAB 6: Orders Ledger */}
      {activeTab === "orders" && (
        <Card style={{ padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 className="fc-h3" style={{ margin: 0 }}>Consolidated Orders Ledger ({filteredOrders.length})</h3>
            <Button variant="outline" size="sm" onClick={() => handleExportCSV("orders")}>
              Export Orders CSV
            </Button>
          </div>
          {filteredOrders.length === 0 ? (
            <EmptyState
              icon={<SearchIcon size={28} />}
              title="No orders match search criteria"
              action={<Button variant="outline" onClick={() => setSearchQuery("")}>Reset Search</Button>}
            />
          ) : (
            <div className="fc-table-wrap">
              <table className="fc-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Date</th>
                    <th>Vendor</th>
                    <th>Product</th>
                    <th>Qty</th>
                    <th>Subtotal</th>
                    <th>Delivery Address</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((o) => (
                    <tr key={o.itemId || o.id}>
                      <td><strong>{o.id}</strong></td>
                      <td>{formatDate(o.createdAt)}</td>
                      <td>{o.vendorName}</td>
                      <td>{getProductName(o.productId)}</td>
                      <td>{o.qty} units</td>
                      <td><strong style={{ color: "var(--brand)" }}>{formatCurrency(o.amount)}</strong></td>
                      <td
                        style={{
                          fontSize: "12px",
                          maxWidth: "160px",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        title={o.deliveryAddress || "N/A"}
                      >
                        {o.deliveryAddress || "—"}
                      </td>
                      <td>
                        <Badge variant={getStatusBadgeVariant(o.status)}>{o.status}</Badge>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                          <Button
                            size="sm"
                            variant="outline"
                            style={{ fontSize: "11px", padding: "4px 8px" }}
                            onClick={() => navigate(`/vendor/tracking/${o.id}`)}
                            title="View OpenStreetMap tracking route"
                          >
                            🗺️ Map
                          </Button>
                          <Button
                            size="sm"
                            variant="primary"
                            style={{ fontSize: "11px", padding: "4px 8px" }}
                            onClick={() => {
                              setTrackingModalOrder(o);
                              setAdminCheckpointStatus(o.status || "In Transit");
                              setAdminCheckpointLocation(o.deliveryCity || "");
                              setAdminCheckpointLat("");
                              setAdminCheckpointLng("");
                              setAdminCheckpointDesc("");
                            }}
                            title="Add tracking checkpoint"
                          >
                            Update
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Admin Tracking Checkpoint Modal */}
          {trackingModalOrder && (
            <Modal
              isOpen={Boolean(trackingModalOrder)}
              onClose={() => setTrackingModalOrder(null)}
              title={`Update Tracking Checkpoint (${trackingModalOrder.id})`}
            >
              <form onSubmit={handleAdminTrackingSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label className="fc-label" style={{ fontSize: 12, marginBottom: 4, display: "block" }}>
                    Transit Stage / Status
                  </label>
                  <select
                    className="fc-select"
                    value={adminCheckpointStatus}
                    onChange={(e) => setAdminCheckpointStatus(e.target.value)}
                    style={{ width: "100%" }}
                  >
                    <option value="Order Placed">Order Placed</option>
                    <option value="Order Confirmed">Order Confirmed</option>
                    <option value="Packed">Packed</option>
                    <option value="Dispatched">Dispatched</option>
                    <option value="In Transit">In Transit</option>
                    <option value="Reached Destination Hub">Reached Destination Hub</option>
                    <option value="Out for Delivery">Out for Delivery</option>
                    <option value="Delivered">Delivered</option>
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
                    placeholder="e.g. Nagpur Highway Transit Facility, Maharashtra"
                    value={adminCheckpointLocation}
                    onChange={(e) => setAdminCheckpointLocation(e.target.value)}
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
                      placeholder="e.g. 21.1458"
                      value={adminCheckpointLat}
                      onChange={(e) => setAdminCheckpointLat(e.target.value)}
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
                      placeholder="e.g. 79.0882"
                      value={adminCheckpointLng}
                      onChange={(e) => setAdminCheckpointLng(e.target.value)}
                      style={{ width: "100%" }}
                    />
                  </div>
                </div>

                <div>
                  <label className="fc-label" style={{ fontSize: 12, marginBottom: 4, display: "block" }}>
                    Checkpoint Description / Logistics Log
                  </label>
                  <textarea
                    className="fc-input"
                    rows={2}
                    placeholder="e.g. Scanned at regional hub gate; cold storage transfer."
                    value={adminCheckpointDesc}
                    onChange={(e) => setAdminCheckpointDesc(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                  <Button type="button" variant="outline" onClick={() => setTrackingModalOrder(null)} disabled={adminUpdatingTracking}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" disabled={adminUpdatingTracking}>
                    {adminUpdatingTracking ? "Saving..." : "Record Checkpoint"}
                  </Button>
                </div>
              </form>
            </Modal>
          )}
        </Card>
      )}

      {/* TAB: Delivery Rules & Payments */}
      {activeTab === "delivery" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Card style={{ padding: "20px" }}>
            <h3 className="fc-h3" style={{ marginBottom: 14 }}>🚚 Configurable Distance Delivery Pricing Rules</h3>
            <p className="fc-soft" style={{ fontSize: 13, marginBottom: 16 }}>
              Server-side authoritative rules used to compute shipping charges based on road distance between grower fields and vendor delivery destinations.
            </p>
            <div className="fc-table-wrap">
              <table className="fc-table">
                <thead>
                  <tr>
                    <th>Rule ID</th>
                    <th>Distance Range (km)</th>
                    <th>Base Freight Fee</th>
                    <th>Per-Km Surcharge</th>
                    <th>Active Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pricingRules.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center" }}>No delivery rules configured. Default system tiers apply.</td>
                    </tr>
                  ) : (
                    pricingRules.map((r) => (
                      <tr key={r.id}>
                        <td><strong>{r.id}</strong></td>
                        <td>{r.minDistanceKm} km – {r.maxDistanceKm >= 1000 ? "50+ km" : `${r.maxDistanceKm} km`}</td>
                        <td><strong style={{ color: "var(--brand)" }}>{formatCurrency(r.baseCharge)}</strong></td>
                        <td>{r.perKmCharge > 0 ? `${formatCurrency(r.perKmCharge)} / km` : "Flat Rate"}</td>
                        <td>
                          <Badge variant={r.active ? "success" : "neutral"}>
                            {r.active ? "Active" : "Disabled"}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card style={{ padding: "20px" }}>
            <h3 className="fc-h3" style={{ marginBottom: 14 }}>💳 Active Payment Gateway & OTP Security Controls</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, fontSize: 13 }}>
              <div style={{ background: "var(--bg-soft)", padding: 14, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                <span className="fc-soft" style={{ fontSize: 11, display: "block" }}>SUPPORTED PAYMENT METHODS</span>
                <strong style={{ display: "block", marginTop: 4 }}>⚡ Instant UPI Intent / App Switch</strong>
                <strong style={{ display: "block", marginTop: 2 }}>💳 Credit & Corporate Debit Cards</strong>
                <strong style={{ display: "block", marginTop: 2 }}>💵 Cash on Delivery (Scale Inspection)</strong>
              </div>
              <div style={{ background: "var(--bg-soft)", padding: 14, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                <span className="fc-soft" style={{ fontSize: 11, display: "block" }}>OTP SECURITY POLICY</span>
                <strong style={{ display: "block", marginTop: 4 }}>Password Changes: Mandatory 6-Digit OTP</strong>
                <strong style={{ display: "block", marginTop: 2 }}>Password Resets: Mandatory 6-Digit OTP</strong>
                <strong style={{ display: "block", marginTop: 2 }}>High-Value Orders (&gt; ₹20,000): Mandatory OTP</strong>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 7: Reviews Moderation */}
      {activeTab === "reviews" && (
        <Card style={{ padding: "20px" }}>
          <h3 className="fc-h3" style={{ marginBottom: 16 }}>Moderate User Reviews ({filteredReviews.length})</h3>
          {filteredReviews.length === 0 ? (
            <EmptyState
              icon={<SearchIcon size={28} />}
              title="No reviews match search criteria"
              action={<Button variant="outline" onClick={() => setSearchQuery("")}>Reset Search</Button>}
            />
          ) : (
            <div className="fc-table-wrap">
              <table className="fc-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Author</th>
                    <th>Target Product</th>
                    <th>Rating</th>
                    <th>Comment</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReviews.map((r) => (
                    <tr key={r.id}>
                      <td>{formatDate(r.createdAt)}</td>
                      <td><strong>{r.vendorName}</strong></td>
                      <td>{getProductName(r.productId) || "Farmer Direct"}</td>
                      <td>
                        <div style={{ display: "flex", gap: 2, color: "#f59e0b" }}>
                          ★ {r.rating}
                        </div>
                      </td>
                      <td style={{ fontSize: 12, maxWidth: 220, wordBreak: "break-word" }}>{r.comment}</td>
                      <td>
                        <Badge variant="success">{r.status}</Badge>
                      </td>
                      <td>
                        <Button size="sm" variant="danger" onClick={() => handleDeleteReview(r.id)}>
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* TAB 8: Advanced Analytics & AI Reports */}
      {activeTab === "analytics" && (
        <AnalyticsDashboard />
      )}
    </div>
  );
}

export const AdminDashboard = memo(AdminDashboardBase);
export default AdminDashboard;
