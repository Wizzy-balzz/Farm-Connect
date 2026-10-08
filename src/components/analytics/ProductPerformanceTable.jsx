import { memo } from "react";
import { Badge } from "../common/Badge.jsx";

/**
 * FarmConnect Phase 10 — Product Performance Table
 * Tabular breakdown of sales, units sold, realized price, and inventory velocity.
 */
function ProductPerformanceTableBase({ products = [], currency = "₹" }) {
  if (!products || products.length === 0) {
    return (
      <div
        style={{
          padding: "24px",
          textAlign: "center",
          color: "var(--text-muted)",
          fontSize: "13px"
        }}
      >
        No product performance records found for this time period.
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "13px",
          textAlign: "left"
        }}
      >
        <thead>
          <tr
            style={{
              borderBottom: "1px solid var(--border)",
              color: "var(--text-muted)",
              fontSize: "12px",
              textTransform: "uppercase"
            }}
          >
            <th style={{ padding: "10px 12px" }}>Product</th>
            <th style={{ padding: "10px 12px" }}>Category</th>
            <th style={{ padding: "10px 12px" }}>Quantity Sold</th>
            <th style={{ padding: "10px 12px" }}>Est. Gross Revenue</th>
            <th style={{ padding: "10px 12px" }}>Avg Realized Price</th>
            <th style={{ padding: "10px 12px" }}>Orders</th>
            <th style={{ padding: "10px 12px" }}>Velocity</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p, idx) => {
            const velocityVariant =
              p.velocity === "Fast"
                ? "success"
                : p.velocity === "Moderate"
                ? "info"
                : "neutral";

            return (
              <tr
                key={p.productId || p.name || idx}
                style={{
                  borderBottom: "1px solid var(--border)",
                  transition: "background 0.15s ease"
                }}
              >
                <td style={{ padding: "12px", fontWeight: 600 }}>{p.name}</td>
                <td style={{ padding: "12px", color: "var(--text-muted)" }}>
                  {p.category}
                </td>
                <td style={{ padding: "12px" }}>
                  <span style={{ fontWeight: 600 }}>
                    {p.totalSold ?? p.quantitySold ?? 0}
                  </span>{" "}
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    {p.unit || "kg"}
                  </span>
                </td>
                <td style={{ padding: "12px", fontWeight: 700, color: "var(--brand)" }}>
                  {currency}
                  {(p.grossRevenue ?? p.grossSales ?? 0).toLocaleString("en-IN")}
                </td>
                <td style={{ padding: "12px" }}>
                  {currency}
                  {(p.realizedAvgPrice ?? p.avgPrice ?? 0).toLocaleString("en-IN")}/
                  {p.unit || "kg"}
                </td>
                <td style={{ padding: "12px" }}>
                  {p.orderCount ?? p.ordersCount ?? 0}
                </td>
                <td style={{ padding: "12px" }}>
                  <Badge variant={velocityVariant}>
                    {p.velocity || (p.totalSold > 30 ? "Fast" : "Moderate")}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export const ProductPerformanceTable = memo(ProductPerformanceTableBase);
export default ProductPerformanceTable;
