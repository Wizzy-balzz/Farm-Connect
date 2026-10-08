import { memo } from "react";
import { Badge } from "../common/Badge.jsx";

/**
 * FarmConnect Phase 10 — Inventory Analytics Component
 * Detailed warehouse stock, low-stock warnings, slow-moving items, and category concentration.
 */
function InventoryAnalyticsBase({ data = {}, currency = "₹" }) {
  const {
    metrics = {},
    lowStockItems = [],
    slowMovingProducts = [],
    categoryBreakdown = []
  } = data;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Metric Highlights */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "12px"
        }}
      >
        <div
          style={{
            padding: "14px",
            background: "var(--bg-soft)",
            borderRadius: "8px",
            border: "1px solid var(--border)"
          }}
        >
          <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>
            Total Stock Units
          </div>
          <div style={{ fontSize: "20px", fontWeight: 700, marginTop: "4px" }}>
            {metrics.totalStockUnits?.toLocaleString("en-IN") || 0}
          </div>
        </div>

        <div
          style={{
            padding: "14px",
            background: "var(--bg-soft)",
            borderRadius: "8px",
            border: "1px solid var(--border)"
          }}
        >
          <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>
            Est. Inventory Value
          </div>
          <div style={{ fontSize: "20px", fontWeight: 700, marginTop: "4px", color: "var(--brand)" }}>
            {currency}
            {metrics.totalInventoryValue?.toLocaleString("en-IN") || 0}
          </div>
        </div>

        <div
          style={{
            padding: "14px",
            background: metrics.lowStockCount > 0 ? "rgba(239, 68, 68, 0.08)" : "var(--bg-soft)",
            borderRadius: "8px",
            border: metrics.lowStockCount > 0 ? "1px solid rgba(239, 68, 68, 0.3)" : "1px solid var(--border)"
          }}
        >
          <div style={{ fontSize: "11px", color: metrics.lowStockCount > 0 ? "#dc2626" : "var(--text-muted)", textTransform: "uppercase" }}>
            Low-Stock Warnings
          </div>
          <div style={{ fontSize: "20px", fontWeight: 700, marginTop: "4px", color: metrics.lowStockCount > 0 ? "#dc2626" : "inherit" }}>
            {metrics.lowStockCount || 0} item(s)
          </div>
        </div>

        <div
          style={{
            padding: "14px",
            background: metrics.slowMovingCount > 0 ? "rgba(245, 158, 11, 0.08)" : "var(--bg-soft)",
            borderRadius: "8px",
            border: metrics.slowMovingCount > 0 ? "1px solid rgba(245, 158, 11, 0.3)" : "1px solid var(--border)"
          }}
        >
          <div style={{ fontSize: "11px", color: metrics.slowMovingCount > 0 ? "#d97706" : "var(--text-muted)", textTransform: "uppercase" }}>
            Slow-Moving Items
          </div>
          <div style={{ fontSize: "20px", fontWeight: 700, marginTop: "4px", color: metrics.slowMovingCount > 0 ? "#d97706" : "inherit" }}>
            {metrics.slowMovingCount || 0} item(s)
          </div>
        </div>
      </div>

      {/* Category Concentration */}
      {categoryBreakdown.length > 0 && (
        <div
          style={{
            padding: "16px",
            background: "var(--bg-card, #fff)",
            border: "1px solid var(--border)",
            borderRadius: "8px"
          }}
        >
          <h4 style={{ margin: "0 0 12px 0", fontSize: "14px" }}>
            Produce Category Concentration
          </h4>
          <div
            style={{
              display: "flex",
              height: "12px",
              borderRadius: "6px",
              overflow: "hidden",
              marginBottom: "12px"
            }}
          >
            {categoryBreakdown.map((c, i) => {
              const colors = ["var(--brand)", "#6366f1", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899"];
              return (
                <div
                  key={c.category}
                  style={{
                    width: `${c.stockPct}%`,
                    background: colors[i % colors.length]
                  }}
                  title={`${c.category}: ${c.stockPct}%`}
                />
              );
            })}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", fontSize: "12px" }}>
            {categoryBreakdown.map((c, i) => {
              const colors = ["var(--brand)", "#6366f1", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899"];
              return (
                <div key={c.category} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: colors[i % colors.length]
                    }}
                  />
                  <span>{c.category}:</span>
                  <span style={{ fontWeight: 600 }}>{c.stockPct}%</span>
                  <span style={{ color: "var(--text-muted)" }}>({c.stock} units)</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Low Stock Items Section */}
      {lowStockItems.length > 0 && (
        <div
          style={{
            padding: "16px",
            background: "var(--bg-card, #fff)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
            borderRadius: "8px"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <span style={{ color: "#dc2626", fontWeight: 700 }}>⚠️ Low Stock Produce</span>
            <Badge variant="danger">{lowStockItems.length} at or below MOQ</Badge>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" }}>
            {lowStockItems.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: "10px 12px",
                  background: "var(--bg-soft)",
                  borderRadius: "6px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: "13px" }}>{item.name}</div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    MOQ: {item.moq} {item.unit}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700, color: "#dc2626", fontSize: "14px" }}>
                    {item.stock} {item.unit}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Slow-Moving Stock Section */}
      {slowMovingProducts.length > 0 && (
        <div
          style={{
            padding: "16px",
            background: "var(--bg-card, #fff)",
            border: "1px solid rgba(245, 158, 11, 0.2)",
            borderRadius: "8px"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <span style={{ color: "#d97706", fontWeight: 700 }}>⏳ Slow-Moving Inventory</span>
            <Badge variant="warning">{slowMovingProducts.length} items with 0 sales in 30d</Badge>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" }}>
            {slowMovingProducts.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: "10px 12px",
                  background: "var(--bg-soft)",
                  borderRadius: "6px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: "13px" }}>{item.name}</div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    {item.category} • Listed at {currency}{item.price}/{item.unit}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 600, fontSize: "13px" }}>
                    {item.stockQty || item.stock} {item.unit}
                  </div>
                  <div style={{ fontSize: "11px", color: "#d97706" }}>0 sold in 30d</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export const InventoryAnalytics = memo(InventoryAnalyticsBase);
export default InventoryAnalytics;
