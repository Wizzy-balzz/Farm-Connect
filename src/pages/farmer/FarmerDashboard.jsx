import { useState, useEffect, useMemo, memo } from "react";
import { useNavigate } from "react-router-dom";
import {
  StatCard,
  Button,
  Card,
  Badge,
  Avatar,
  EmptyState,
} from "../../components/common/index.js";
import { OnboardingModal } from "../../components/common/OnboardingModal.jsx";
import { BarChart } from "../../components/charts/BarChart.jsx";
import { DonutChart } from "../../components/charts/DonutChart.jsx";
import { LineChart } from "../../components/charts/LineChart.jsx";
import { apiFetch } from "../../services/api.js";
import {
  TrendingUp,
  Package,
  ClipboardList,
  AlertTriangle,
  Plus,
  Check,
  Sprout
} from "../../components/icons/Icons.jsx";
import { formatCurrency, formatDate } from "../../utils/formatters.js";
import { useData } from "../../hooks/useData.js";
import { useAuth } from "../../hooks/useAuth.js";
import { useLanguage } from "../../hooks/useLanguage.js";
import { useNotifications } from "../../hooks/useNotifications.js";

function FarmerDashboardBase() {
  const { t, lang } = useLanguage();
  const { farmerProfile } = useAuth();
  const { products, orders } = useData();
  const { notifications } = useNotifications();
  const navigate = useNavigate();

  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [copilotInsights, setCopilotInsights] = useState([]);

  useEffect(() => {
    apiFetch("/api/ai/farmer-copilot")
      .then((data) => {
        if (data && data.insights) setCopilotInsights(data.insights);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    try {
      const shown = localStorage.getItem("fc_onboarding_done");
      if (!shown) {
        setOnboardingOpen(true);
        localStorage.setItem("fc_onboarding_done", "true");
      }
    } catch {
      /* noop */
    }
  }, []);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  // Time-based greeting (Morning / Afternoon / Evening)
  const greetingTime = useMemo(() => {
    const hour = now.getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }, [now]);

  const { user } = useAuth();
  const currentFarmerId = farmerProfile?.id || user?.id;

  const myProducts = useMemo(
    () => products.filter((p) => p.farmerId && currentFarmerId && String(p.farmerId) === String(currentFarmerId)),
    [products, currentFarmerId]
  );
  const myOrders = useMemo(
    () => orders.filter((o) => o.farmerId && currentFarmerId && String(o.farmerId) === String(currentFarmerId)),
    [orders, currentFarmerId]
  );

  const revenue = useMemo(
    () =>
      myOrders
        .filter((o) => o.status === "Delivered" || o.status === "Accepted")
        .reduce((s, o) => s + o.amount, 0),
    [myOrders]
  );
  const productsSold = useMemo(
    () =>
      myOrders
        .filter((o) => o.status === "Delivered")
        .reduce((s, o) => s + o.qty, 0),
    [myOrders]
  );
  const pendingCount = useMemo(
    () => myOrders.filter((o) => o.status === "Pending").length,
    [myOrders]
  );

  // Sales trend by month
  const monthlySales = useMemo(() => {
    const buckets = {};
    myOrders.forEach((o) => {
      if (!o.createdAt) return;
      const month = new Date(o.createdAt).toLocaleDateString("en-IN", {
        month: "short",
      });
      buckets[month] = (buckets[month] || 0) + o.amount;
    });
    return Object.entries(buckets).map(([label, value]) => ({ label, value }));
  }, [myOrders]);

  // Product categories distribution
  const categoryDist = useMemo(() => {
    const buckets = {};
    myProducts.forEach((p) => {
      buckets[p.category] = (buckets[p.category] || 0) + 1;
    });
    return Object.entries(buckets).map(([label, value]) => ({ label, value }));
  }, [myProducts]);

  // Cumulative revenue trend
  const revenueTrend = useMemo(() => {
    const sorted = [...myOrders].sort(
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
  }, [myOrders]);

  // Status breakdown
  const ordersByStatus = useMemo(() => {
    const buckets = { Pending: 0, Accepted: 0, Delivered: 0, Rejected: 0, InTransit: 0 };
    myOrders.forEach((o) => {
      const statusKey = o.status.replace(/\s+/g, "");
      buckets[statusKey] = (buckets[statusKey] || 0) + 1;
    });
    return Object.entries(buckets).map(([label, value]) => ({ label, value }));
  }, [myOrders]);

  const recentOrders = useMemo(() => myOrders.slice(0, 5), [myOrders]);

  // Category-wide pricing averages
  const categoryAverages = useMemo(() => {
    const sums = {};
    const counts = {};
    products.forEach((p) => {
      sums[p.category] = (sums[p.category] || 0) + p.price;
      counts[p.category] = (counts[p.category] || 0) + 1;
    });
    const avgs = {};
    Object.keys(sums).forEach((cat) => {
      avgs[cat] = sums[cat] / counts[cat];
    });
    return avgs;
  }, [products]);

  // Real-time pricing advice for my products
  const pricingAdvice = useMemo(() => {
    return myProducts
      .map((p) => {
        const avg = categoryAverages[p.category];
        if (!avg) return null;
        const difference = p.price - avg;
        const percentage = Math.round((Math.abs(difference) / avg) * 100);

        if (difference > 5) {
          return {
            productId: p.id,
            productName: p.name,
            status: "high",
            text: `Listed ₹${p.price} (${percentage}% higher than market avg ₹${avg.toFixed(1)}). B2B purchase volume might slow down. Consider adding wholesale pricing tiers.`,
          };
        } else if (difference < -5) {
          return {
            productId: p.id,
            productName: p.name,
            status: "low",
            text: `Listed ₹${p.price} (${percentage}% lower than market avg ₹${avg.toFixed(1)}). You have margin headroom to raise prices or enforce a higher MOQ.`,
          };
        } else {
          return {
            productId: p.id,
            productName: p.name,
            status: "optimal",
            text: `Listed ₹${p.price} is perfectly aligned with category market average (₹${avg.toFixed(1)}).`,
          };
        }
      })
      .filter(Boolean)
      .slice(0, 3);
  }, [myProducts, categoryAverages]);

  // Platform order volumes (B2B Demand Analysis)
  const categoryDemand = useMemo(() => {
    const totals = {};
    let grandTotal = 0;
    orders.forEach((o) => {
      const prod = products.find((p) => p.id === o.productId);
      if (prod) {
        totals[prod.category] = (totals[prod.category] || 0) + o.qty;
        grandTotal += o.qty;
      }
    });

    return Object.entries(totals)
      .map(([cat, qty]) => {
        const share = grandTotal > 0 ? Math.round((qty / grandTotal) * 100) : 0;
        return { category: cat, qty, share };
      })
      .sort((a, b) => b.qty - a.qty);
  }, [orders, products]);

  // Low stock warnings based on MOQ triggers
  const lowStockWarnings = useMemo(() => {
    return myProducts.filter((p) => p.stock <= (p.moq || 10) * 1.5).slice(0, 3);
  }, [myProducts]);

  return (
    <div className="fc-page-transition">
      {/* Hero Greeting Area */}
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
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
              <Avatar name={farmerProfile.name} size="md" role="farmer" verified />
              <div>
                <span style={{ fontSize: "11.5px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", opacity: 0.9 }}>
                  FARM OVERVIEW
                </span>
                <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "26px", fontWeight: 800, margin: 0, lineHeight: 1.2 }}>
                  {greetingTime}, {farmerProfile.name}!
                </h1>
              </div>
            </div>
            <p style={{ margin: "6px 0 0 0", opacity: 0.9, fontSize: "13.5px", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span>Here's how your farm business is performing at <strong>{farmerProfile.farmName || "Green Valley Farms"}</strong> ({farmerProfile.region || "Maharashtra"}).</span>
               <span style={{ background: "rgba(255,255,255,0.2)", padding: "2px 8px", borderRadius: "999px", fontSize: "11px", fontWeight: 700 }}>
                <Check size={11} style={{ display: "inline", marginRight: 3 }} /> Verified Farmer
              </span>
            </p>
          </div>

          <Button
            variant="accent"
            size="md"
            onClick={() => navigate("/farmer/products/add")}
            style={{ fontWeight: 700, boxShadow: "var(--shadow-sm)" }}
          >
            <Plus size={15} /> List New Harvest
          </Button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="fc-stat-grid" style={{ marginBottom: "24px" }}>
        <StatCard
          label={t("revenue")}
          value={formatCurrency(revenue)}
          icon={<TrendingUp size={20} />}
          color="var(--brand)"
          bg="var(--brand-light)"
          trend={{ direction: "up", text: "+14% vs last month" }}
        />
        <StatCard
          label={t("productsSold")}
          value={`${productsSold} units`}
          icon={<Package size={20} />}
          color="var(--accent)"
          bg="var(--accent-light)"
        />
        <StatCard
          label={t("ordersReceived")}
          value={myOrders.length}
          icon={<ClipboardList size={20} />}
          color="var(--info)"
          bg="var(--info-light)"
        />
        <StatCard
          label={t("pendingApprovals")}
          value={pendingCount}
          icon={<AlertTriangle size={20} />}
          color="var(--danger)"
          bg="var(--danger-light)"
          trend={pendingCount > 0 ? { direction: "down", text: "Requires action" } : undefined}
        />
      </div>

      {/* 🌱 FarmConnect AI Copilot Insights Card */}
      {copilotInsights.length > 0 && (
        <Card style={{ padding: "20px", marginBottom: "24px", background: "var(--brand-light)", borderColor: "var(--brand)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
            <Sprout size={20} color="var(--brand)" />
            <h3 className="fc-h3" style={{ margin: 0, color: "var(--brand-dark)" }}>
              🌱 FarmConnect AI Insights
            </h3>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "12px" }}>
            {copilotInsights.map((ins) => (
              <div
                key={ins.id}
                style={{
                  background: "var(--surface)",
                  padding: "14px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between"
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: "13.5px", marginBottom: "4px" }}>{ins.title}</div>
                  <p className="fc-soft" style={{ fontSize: "12px", margin: "0 0 12px 0", lineHeight: 1.4 }}>{ins.description}</p>
                </div>
                {ins.actionLabel && (
                  <Button size="sm" variant="outline" onClick={() => navigate(ins.actionPath)} style={{ alignSelf: "flex-start", fontWeight: 700 }}>
                    {ins.actionLabel} →
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* B2B Marketplace Intelligence Layer */}
      <div className="fc-panel" style={{ marginBottom: "24px", padding: "22px" }}>
        <div style={{ marginBottom: 18 }}>
          <h3 className="fc-h3" style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
            <span>📊 Farm Business Insights</span>
          </h3>
          <p className="fc-muted" style={{ fontSize: "13px", marginTop: "4px", margin: 0 }}>
            Insights computed from current marketplace activity and your farm's performance.
          </p>
        </div>

        <div className="fc-grid-2" style={{ gap: "20px" }}>
          {/* Pricing & Stock Advisors */}
          <div>
            <h4 style={{ fontSize: "13.5px", fontWeight: 700, marginBottom: "12px", color: "var(--text)" }}>
              Pricing & Stock Advisors
            </h4>

            {lowStockWarnings.map((p) => (
              <div
                key={p.id}
                style={{
                  borderLeft: "4px solid var(--danger)",
                  background: "var(--danger-light)",
                  padding: "12px 14px",
                  borderRadius: "var(--radius-sm)",
                  marginBottom: 10,
                }}
              >
                <strong style={{ color: "var(--danger)", fontSize: "12.5px" }}>
                  ⚠️ Low Inventory: {p.name}
                </strong>
                <p className="fc-muted" style={{ fontSize: "12px", margin: "4px 0 0 0" }}>
                  Stock level is {p.stock} {p.unit} (MOQ trigger is {p.moq} {p.unit}). List fresh harvest lots to avoid trade disruptions.
                </p>
              </div>
            ))}

            {pricingAdvice.map((advice) => (
              <div
                key={advice.productId}
                style={{
                  borderLeft: `4px solid ${
                    advice.status === "high"
                      ? "var(--danger)"
                      : advice.status === "low"
                      ? "var(--accent)"
                      : "var(--brand)"
                  }`,
                  background:
                    advice.status === "high"
                      ? "var(--danger-light)"
                      : advice.status === "low"
                      ? "var(--accent-light)"
                      : "var(--brand-light)",
                  padding: "12px 14px",
                  borderRadius: "var(--radius-sm)",
                  marginBottom: 10,
                }}
              >
                <strong
                  style={{
                    fontSize: "12.5px",
                    color:
                      advice.status === "high"
                        ? "var(--danger)"
                        : advice.status === "low"
                        ? "var(--accent)"
                        : "var(--brand)",
                  }}
                >
                  💡 Pricing Guide: {advice.productName}
                </strong>
                <p className="fc-muted" style={{ fontSize: "12px", margin: "4px 0 0 0" }}>
                  {advice.text}
                </p>
              </div>
            ))}

            {pricingAdvice.length === 0 && lowStockWarnings.length === 0 && (
              <p className="fc-soft" style={{ fontStyle: "italic", fontSize: 12.5 }}>
                All produce listings optimal. No advisory flags raised.
              </p>
            )}
          </div>

          {/* Real Platform Category Demand Ratios */}
          <div style={{ background: "var(--bg-soft)", padding: "18px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
            <h4 style={{ fontSize: "13.5px", fontWeight: 700, marginBottom: "12px", color: "var(--text)" }}>
              B2B Procurement Ratios (By Categories)
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {categoryDemand.length === 0 ? (
                <p className="fc-soft" style={{ fontStyle: "italic", fontSize: 12, textAlign: "center", marginTop: 20 }}>
                  No transaction data available yet.
                </p>
              ) : (
                categoryDemand.map((demand) => (
                  <div key={demand.category}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px", fontWeight: 600 }}>
                      <span>{demand.category}</span>
                      <strong>{demand.qty} units ({demand.share}%)</strong>
                    </div>
                    <div style={{ width: "100%", height: "8px", background: "var(--border)", borderRadius: "4px", overflow: "hidden" }}>
                      <div style={{ width: `${demand.share}%`, height: "100%", background: "var(--brand)", borderRadius: "4px" }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="fc-grid-2" style={{ marginBottom: "24px" }}>
        <Card style={{ padding: "20px" }}>
          <h3 className="fc-h3" style={{ marginBottom: 16 }}>{t("revenueOverview")}</h3>
          {revenueTrend.length ? (
            <LineChart data={revenueTrend} color="var(--brand)" chartId="revenue" />
          ) : (
            <p className="fc-muted" style={{ fontStyle: "italic", fontSize: 13 }}>No revenue data recorded yet.</p>
          )}
        </Card>

        <Card style={{ padding: "20px" }}>
          <h3 className="fc-h3" style={{ marginBottom: 16 }}>{t("ordersOverview")}</h3>
          {myOrders.length ? (
            <BarChart data={ordersByStatus} color="var(--info)" />
          ) : (
            <p className="fc-muted" style={{ fontStyle: "italic", fontSize: 13 }}>No order records available.</p>
          )}
        </Card>
      </div>

      <div className="fc-grid-2" style={{ marginBottom: "24px" }}>
        <Card style={{ padding: "20px" }}>
          <h3 className="fc-h3" style={{ marginBottom: 16 }}>{t("monthlySales")}</h3>
          {monthlySales.length ? (
            <BarChart data={monthlySales} color="var(--brand)" />
          ) : (
            <p className="fc-muted" style={{ fontStyle: "italic", fontSize: 13 }}>No sales data recorded yet.</p>
          )}
        </Card>

        <Card style={{ padding: "20px" }}>
          <h3 className="fc-h3" style={{ marginBottom: 16 }}>{t("categoryDistribution")}</h3>
          {categoryDist.length ? (
            <DonutChart data={categoryDist} />
          ) : (
            <p className="fc-muted" style={{ fontStyle: "italic", fontSize: 13 }}>No products listed yet.</p>
          )}
        </Card>
      </div>

      {/* Recent Orders & Activity Log */}
      <div className="fc-grid-2" style={{ marginBottom: "24px" }}>
        <Card style={{ padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 className="fc-h3" style={{ margin: 0 }}>{t("incomingOrders")}</h3>
            <button className="fc-link-btn" onClick={() => navigate("/farmer/orders")} style={{ fontSize: "12px" }}>
              View All Orders →
            </button>
          </div>
          <div className="fc-table-wrap">
            <table className="fc-table">
              <thead>
                <tr>
                  <th>{t("orderId")}</th>
                  <th>{t("vendorName")}</th>
                  <th>{t("amount")}</th>
                  <th>{t("status")}</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => (
                  <tr key={o.itemId || o.id}>
                    <td><strong>{o.id}</strong></td>
                    <td>{o.vendorName}</td>
                    <td>{formatCurrency(o.amount)}</td>
                    <td>
                      <span className={`fc-status-badge fc-status-${o.status.replace(/\s+/g, "").toLowerCase()}`}>
                        {o.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {recentOrders.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", padding: "20px" }} className="fc-soft">
                      No incoming orders yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card style={{ padding: "20px" }}>
          <h3 className="fc-h3" style={{ marginBottom: 16 }}>{t("recentActivity")}</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {notifications.slice(0, 5).map((n) => (
              <div key={n.id} className="fc-notif-item" style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                <span className="fc-notif-dot" />
                <div>
                  <div style={{ fontSize: "13px", color: "var(--text)" }}>{n.text}</div>
                  <div className="fc-soft" style={{ fontSize: "11px", marginTop: 3 }}>{formatDate(n.createdAt)}</div>
                </div>
              </div>
            ))}
            {notifications.length === 0 && (
              <p className="fc-soft" style={{ fontStyle: "italic", textAlign: "center", padding: "20px 0" }}>
                No recent activity logs recorded.
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Floating / Bottom Quick Actions Bar */}
      <Card style={{ padding: "18px 24px", background: "var(--surface)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ fontSize: "13px", fontWeight: 700 }}>⚡ Quick Actions</div>
          <div className="fc-flex-gap-12" style={{ flexWrap: "wrap" }}>
            <Button variant="outline" size="sm" onClick={() => setOnboardingOpen(true)}>
              ✨ Setup Onboarding
            </Button>
            <Button variant="primary" size="sm" onClick={() => navigate("/farmer/products/add")}>
              + Add New Crop Listing
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/farmer/products")}>
              📦 Manage Inventory ({myProducts.length})
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/farmer/orders")}>
              📋 View Orders ({myOrders.length})
            </Button>
          </div>
        </div>
      </Card>

      <OnboardingModal open={onboardingOpen} onClose={() => setOnboardingOpen(false)} />
    </div>
  );
}

export const FarmerDashboard = memo(FarmerDashboardBase);
export default FarmerDashboard;
