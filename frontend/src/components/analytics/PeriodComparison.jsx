import { memo } from "react";
import { Badge } from "../common/Badge.jsx";

/**
 * FarmConnect Phase 10 — Period Comparison Component
 * Visual comparison cards with percentage change or honest insufficient-data disclosure.
 */
function PeriodComparisonBase({ comparisons = [], periodLabel = "Previous Period" }) {
  if (!comparisons || comparisons.length === 0) {
    return null;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <h4 style={{ margin: "0 0 4px 0", fontSize: "14px", color: "var(--text-muted)", textTransform: "uppercase" }}>
        Period Comparison ({periodLabel})
      </h4>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "12px"
        }}
      >
        {comparisons.map((c, i) => {
          const isPositive = c.percentageChange > 0;
          const isNegative = c.percentageChange < 0;

          return (
            <div
              key={c.metric || i}
              style={{
                padding: "14px",
                background: "var(--bg-card, #fff)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: "8px"
              }}
            >
              <div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  {c.metric}
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "4px" }}>
                  <span style={{ fontSize: "18px", fontWeight: 700 }}>
                    {typeof c.current === "number" ? c.current.toLocaleString("en-IN") : c.current}
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    {c.unit}
                  </span>
                </div>
              </div>

              {c.comparisonAvailable ? (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px" }}>
                  <Badge variant={isPositive ? "success" : isNegative ? "danger" : "neutral"}>
                    {isPositive ? "▲ +" : isNegative ? "▼ " : ""}{c.percentageChange}%
                  </Badge>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    prev: {c.previous?.toLocaleString("en-IN")} {c.unit}
                  </span>
                </div>
              ) : (
                <div
                  style={{
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    background: "var(--bg-soft)",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    fontStyle: "italic"
                  }}
                >
                  {c.message || "Previous-period comparison unavailable."}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const PeriodComparison = memo(PeriodComparisonBase);
export default PeriodComparison;
