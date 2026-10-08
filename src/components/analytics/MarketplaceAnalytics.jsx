import { memo } from "react";
import { Badge } from "../common/Badge.jsx";

/**
 * FarmConnect Phase 10 — Marketplace Aggregate Analytics Component
 * Displays public market benchmarks, price ranges, median benchmark, and commodity velocity.
 */
function MarketplaceAnalyticsBase({ data = {}, currency = "₹" }) {
  const {
    metrics = {},
    fastMoving = [],
    slowMoving = [],
    commoditySales = []
  } = data;

  const priceStats = metrics.priceStats || { min: 0, max: 0, avg: 0, median: 0 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Overview Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "12px"
        }}
      >
        <div
          style={{
            padding: "16px",
            background: "var(--bg-soft)",
            borderRadius: "8px",
            border: "1px solid var(--border)"
          }}
        >
          <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>
            Active Marketplace Listings
          </div>
          <div style={{ fontSize: "22px", fontWeight: 700, marginTop: "4px" }}>
            {metrics.totalListings || 0}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
            Across all categories
          </div>
        </div>

        <div
          style={{
            padding: "16px",
            background: "var(--bg-soft)",
            borderRadius: "8px",
            border: "1px solid var(--border)"
          }}
        >
          <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>
            Total Traded Volume
          </div>
          <div style={{ fontSize: "22px", fontWeight: 700, marginTop: "4px" }}>
            {(metrics.totalQuantityTraded || 0).toLocaleString("en-IN")} units
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
            Completed & in-flight orders
          </div>
        </div>

        <div
          style={{
            padding: "16px",
            background: "var(--bg-soft)",
            borderRadius: "8px",
            border: "1px solid var(--border)"
          }}
        >
          <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>
            Gross Traded Value (GMV)
          </div>
          <div style={{ fontSize: "22px", fontWeight: 700, marginTop: "4px", color: "var(--brand)" }}>
            {currency}
            {(metrics.totalMarketplaceGmv || 0).toLocaleString("en-IN")}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
            Gross platform transaction sum
          </div>
        </div>

        <div
          style={{
            padding: "16px",
            background: "var(--bg-soft)",
            borderRadius: "8px",
            border: "1px solid var(--border)"
          }}
        >
          <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>
            Median Price Benchmark
          </div>
          <div style={{ fontSize: "22px", fontWeight: 700, marginTop: "4px" }}>
            {currency}
            {priceStats.median}/unit
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
            Range: {currency}{priceStats.min} - {currency}{priceStats.max} (Avg: {currency}{priceStats.avg})
          </div>
        </div>
      </div>

      {/* Commodity Trade Volume Breakdown */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "16px"
        }}
      >
        {/* Fast Moving Commodities */}
        <div
          style={{
            padding: "16px",
            background: "var(--bg-card, #fff)",
            border: "1px solid var(--border)",
            borderRadius: "8px"
          }}
        >
          <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
            🚀 Fast-Moving Commodities
          </h4>
          {fastMoving.length === 0 ? (
            <div style={{ fontSize: "12px", color: "var(--text-muted)", padding: "12px 0" }}>
              Insufficient order history to calculate velocity.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {fastMoving.map((c) => (
                <div
                  key={c.commodity}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 10px",
                    background: "var(--bg-soft)",
                    borderRadius: "6px",
                    fontSize: "13px"
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{c.commodity}</span>
                  <Badge variant="success">
                    {c.quantityTraded} units ({c.orderCount} orders)
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Commodity Distribution Table */}
        <div
          style={{
            padding: "16px",
            background: "var(--bg-card, #fff)",
            border: "1px solid var(--border)",
            borderRadius: "8px"
          }}
        >
          <h4 style={{ margin: "0 0 12px 0", fontSize: "14px" }}>
            Top Traded Commodities
          </h4>
          {commoditySales.length === 0 ? (
            <div style={{ fontSize: "12px", color: "var(--text-muted)", padding: "12px 0" }}>
              No commodity transaction data in this period.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {commoditySales.slice(0, 5).map((c) => (
                <div
                  key={c.cropName}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 10px",
                    background: "var(--bg-soft)",
                    borderRadius: "6px",
                    fontSize: "13px"
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 600 }}>{c.cropName}</span>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", marginLeft: "6px" }}>
                      ({c.category})
                    </span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 600, color: "var(--brand)" }}>
                      {currency}{parseFloat(c.volumeAmount).toLocaleString("en-IN")}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      {c.totalSold} units
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const MarketplaceAnalytics = memo(MarketplaceAnalyticsBase);
export default MarketplaceAnalytics;
