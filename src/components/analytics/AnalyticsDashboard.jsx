import { useState, useEffect, useCallback, memo } from "react";
import { useAuth } from "../../hooks/useAuth.js";
import { useNotifications } from "../../hooks/useNotifications.js";
import { apiFetch } from "../../services/api.js";
import { Button } from "../common/Button.jsx";
import { Badge } from "../common/Badge.jsx";
import { Card, CardHeader, CardBody } from "../common/Card.jsx";
import { LoadingState } from "../common/LoadingState.jsx";
import SalesTrendChart from "./SalesTrendChart.jsx";
import ProductPerformanceTable from "./ProductPerformanceTable.jsx";
import InventoryAnalytics from "./InventoryAnalytics.jsx";
import MarketplaceAnalytics from "./MarketplaceAnalytics.jsx";
import ReportSummaryCard from "./ReportSummaryCard.jsx";
import PeriodComparison from "./PeriodComparison.jsx";

/**
 * FarmConnect Phase 10 — Advanced Analytics & AI Reports Dashboard
 */
function AnalyticsDashboardBase() {
  const { user } = useAuth();
  const { notifyError, notifySuccess } = useNotifications();

  const [period, setPeriod] = useState("30d");
  const [activeTab, setActiveTab] = useState("overview"); // overview | sales | inventory | marketplace
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Analytics states
  const [farmReport, setFarmReport] = useState(null);
  const [salesData, setSalesData] = useState(null);
  const [inventoryData, setInventoryData] = useState(null);
  const [marketplaceData, setMarketplaceData] = useState(null);
  const [platformData, setPlatformData] = useState(null);

  const isFarmer = user?.role === "farmer";
  const isAdmin = user?.role === "admin";

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Sales and Marketplace (always relevant)
      const salesPromise = (isFarmer || isAdmin)
        ? apiFetch(`/api/ai/analytics/sales?period=${period}`)
        : Promise.resolve(null);

      const marketplacePromise = apiFetch(`/api/ai/analytics/marketplace?period=${period}`);

      const inventoryPromise = (isFarmer || isAdmin)
        ? apiFetch("/api/ai/analytics/inventory")
        : Promise.resolve(null);

      const reportPromise = isFarmer
        ? apiFetch(`/api/ai/analytics/farmer-report?period=${period}`)
        : isAdmin
        ? apiFetch(`/api/ai/analytics/platform?period=${period}`)
        : Promise.resolve(null);

      const [salesRes, marketRes, invRes, repRes] = await Promise.all([
        salesPromise,
        marketplacePromise,
        inventoryPromise,
        reportPromise
      ]);

      if (salesRes && salesRes.success) setSalesData(salesRes);
      if (marketRes && marketRes.success) setMarketplaceData(marketRes);
      if (invRes && invRes.success) setInventoryData(invRes);
      if (repRes && repRes.success) {
        if (isAdmin) setPlatformData(repRes);
        else setFarmReport(repRes);
      }
    } catch (err) {
      console.error("Error loading analytics data:", err);
      notifyError("Failed to load live analytics data.");
    } finally {
      setLoading(false);
    }
  }, [period, isFarmer, isAdmin, notifyError]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAnalytics();
  }, [fetchAnalytics]);

  // CSV Export Handler
  const handleExportCsv = async (type = "sales") => {
    setExporting(true);
    try {
      const response = await fetch(`/api/ai/analytics/export?type=${type}&period=${period}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`
        }
      });

      if (!response.ok) {
        throw new Error("Failed to export analytics CSV.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `farmconnect-${type}-analytics-${period}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      notifySuccess(`Exported ${type} analytics CSV successfully.`);
    } catch (err) {
      console.error("Export error:", err);
      notifyError(err.message || "Failed to download export file.");
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fc-analytics-dashboard animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Top Header & Period Switcher */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px",
          background: "var(--bg-card, #fff)",
          padding: "20px",
          borderRadius: "10px",
          border: "1px solid var(--border)"
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "22px" }}>📊</span>
            <h2 className="fc-h2" style={{ margin: 0 }}>
              {isAdmin ? "Platform Intelligence & Analytics" : "Farm Performance & AI Analytics"}
            </h2>
            <Badge variant="success">Phase 10 Verified</Badge>
          </div>
          <p className="fc-muted" style={{ margin: "4px 0 0 0", fontSize: "13px" }}>
            Real-time deterministic calculations directly grounded in FarmConnect database records.
          </p>
        </div>

        {/* Period Selector & Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {/* Period Pills */}
          <div style={{ display: "flex", background: "var(--bg-soft)", padding: "4px", borderRadius: "8px" }}>
            {[
              { id: "7d", label: "7 Days" },
              { id: "30d", label: "30 Days" },
              { id: "90d", label: "90 Days" },
              { id: "month", label: "This Month" }
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                style={{
                  border: "none",
                  background: period === p.id ? "var(--bg-card, #fff)" : "transparent",
                  color: period === p.id ? "var(--brand)" : "var(--text-muted)",
                  fontWeight: period === p.id ? 700 : 500,
                  padding: "6px 14px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "12px",
                  boxShadow: period === p.id ? "0 2px 4px rgba(0,0,0,0.05)" : "none",
                  transition: "all 0.15s ease"
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Export CSV Button */}
          <Button
            variant="outline"
            size="sm"
            disabled={exporting}
            onClick={() => {
              const exportType = (isAdmin && activeTab === "overview")
                ? "platform"
                : activeTab === "inventory"
                ? "inventory"
                : activeTab === "marketplace"
                ? "marketplace"
                : "sales";
              handleExportCsv(exportType);
            }}
          >
            📥 {exporting ? "Exporting..." : "Export CSV"}
          </Button>

          {/* Print View Button */}
          <Button variant="ghost" size="sm" onClick={handlePrint}>
            🖨️ Print
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid var(--border)",
          gap: "8px"
        }}
      >
        {[
          { id: "overview", label: "Executive Report", icon: "📋" },
          { id: "sales", label: "Sales & Revenue", icon: "📈", hidden: !isFarmer && !isAdmin },
          { id: "inventory", label: "Inventory Health", icon: "📦", hidden: !isFarmer && !isAdmin },
          { id: "marketplace", label: "Marketplace Intelligence", icon: "🌐" }
        ]
          .filter((t) => !t.hidden)
          .map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                border: "none",
                background: "transparent",
                borderBottom: activeTab === tab.id ? "2px solid var(--brand)" : "2px solid transparent",
                color: activeTab === tab.id ? "var(--brand)" : "var(--text-muted)",
                fontWeight: activeTab === tab.id ? 700 : 500,
                padding: "10px 16px",
                cursor: "pointer",
                fontSize: "13.5px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                marginBottom: "-1px",
                transition: "all 0.15s ease"
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <LoadingState text="Synthesizing verified analytics and compiling report..." />
      ) : (
        <div>
          {/* TAB 1: EXECUTIVE REPORT */}
          {activeTab === "overview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Report Summary Card */}
              {isFarmer && farmReport && (
                <>
                  <ReportSummaryCard
                    reportType={farmReport.reportType}
                    period={farmReport.period}
                    facts={farmReport.facts}
                    insights={farmReport.insights}
                    recommendations={farmReport.recommendations}
                    limitations={farmReport.limitations}
                  />

                  {/* Comparisons */}
                  {farmReport.comparisons && (
                    <PeriodComparison
                      comparisons={farmReport.comparisons}
                      periodLabel={farmReport.period?.label}
                    />
                  )}
                </>
              )}

              {isAdmin && platformData && (
                <ReportSummaryCard
                  reportType={platformData.reportType}
                  period={platformData.period}
                  facts={platformData.facts}
                  insights={platformData.insights}
                  recommendations={platformData.recommendations}
                  limitations={platformData.limitations}
                />
              )}

              {/* Vendor view if not farmer or admin */}
              {!isFarmer && !isAdmin && marketplaceData && (
                <ReportSummaryCard
                  reportType="MARKETPLACE"
                  period={marketplaceData.period}
                  facts={marketplaceData.facts}
                  insights={marketplaceData.insights}
                  recommendations={marketplaceData.recommendations}
                  limitations={marketplaceData.limitations}
                />
              )}
            </div>
          )}

          {/* TAB 2: SALES & REVENUE */}
          {activeTab === "sales" && salesData && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {/* KPI Banner */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: "12px"
                }}
              >
                <div style={{ padding: "16px", background: "var(--bg-card, #fff)", border: "1px solid var(--border)", borderRadius: "8px" }}>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>
                    ESTIMATED GROSS REVENUE
                  </div>
                  <div style={{ fontSize: "22px", fontWeight: 700, marginTop: "4px", color: "var(--brand)" }}>
                    ₹{(salesData.metrics?.grossRevenue || 0).toLocaleString("en-IN")}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                    Gross sales before costs
                  </div>
                </div>

                <div style={{ padding: "16px", background: "var(--bg-card, #fff)", border: "1px solid var(--border)", borderRadius: "8px" }}>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>
                    Total Units Sold
                  </div>
                  <div style={{ fontSize: "22px", fontWeight: 700, marginTop: "4px" }}>
                    {salesData.metrics?.totalQuantitySold || 0}
                  </div>
                </div>

                <div style={{ padding: "16px", background: "var(--bg-card, #fff)", border: "1px solid var(--border)", borderRadius: "8px" }}>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>
                    Completed Orders
                  </div>
                  <div style={{ fontSize: "22px", fontWeight: 700, marginTop: "4px" }}>
                    {salesData.metrics?.totalOrders || 0}
                  </div>
                </div>

                <div style={{ padding: "16px", background: "var(--bg-card, #fff)", border: "1px solid var(--border)", borderRadius: "8px" }}>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>
                    Average Selling Price (ASP)
                  </div>
                  <div style={{ fontSize: "22px", fontWeight: 700, marginTop: "4px" }}>
                    ₹{salesData.metrics?.avgSellingPrice || 0}/unit
                  </div>
                </div>
              </div>

              {/* Sales Trend Chart */}
              <Card>
                <CardHeader
                  title="Daily Gross Revenue & Volume Trend"
                  subtitle={`Performance plotted over ${period}`}
                />
                <CardBody>
                  <SalesTrendChart data={salesData.salesTrend || []} />
                </CardBody>
              </Card>

              {/* Product Performance Table */}
              <Card>
                <CardHeader
                  title="Crop & Produce Performance Breakdown"
                  subtitle="Volume, realized price, and order velocity"
                />
                <CardBody>
                  <ProductPerformanceTable products={salesData.topProducts || []} />
                </CardBody>
              </Card>
            </div>
          )}

          {/* TAB 3: INVENTORY HEALTH */}
          {activeTab === "inventory" && inventoryData && (
            <InventoryAnalytics data={inventoryData} />
          )}

          {/* TAB 4: MARKETPLACE INTELLIGENCE */}
          {activeTab === "marketplace" && marketplaceData && (
            <MarketplaceAnalytics data={marketplaceData} />
          )}
        </div>
      )}
    </div>
  );
}

export const AnalyticsDashboard = memo(AnalyticsDashboardBase);
export default AnalyticsDashboard;
