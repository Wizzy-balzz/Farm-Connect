import { memo, useMemo, useState } from "react";

/**
 * FarmConnect Phase 10 — Sales Trend Chart
 * Dependency-free SVG chart for sales revenue and order volume trends over time.
 */
function SalesTrendChartBase({ data = [], height = 240, currency = "₹" }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const { points, bars, maxSales, maxQty, xLabels } = useMemo(() => {
    if (!data || data.length === 0) {
      return { points: "", bars: [], maxSales: 1, maxQty: 1, xLabels: [] };
    }

    const maxSales = Math.max(...data.map((d) => d.sales || 0), 10);
    const maxQty = Math.max(...data.map((d) => d.quantity || 0), 1);
    const paddingX = 40;
    const paddingY = 30;
    const chartWidth = Math.max(data.length * 60, 400);
    const chartHeight = height - paddingY * 2;

    const stepX = (chartWidth - paddingX * 2) / Math.max(data.length - 1, 1);

    const pointsArr = data.map((d, i) => {
      const x = paddingX + i * stepX;
      const y = height - paddingY - ((d.sales || 0) / maxSales) * chartHeight;
      return `${x},${y}`;
    });

    const barsArr = data.map((d, i) => {
      const x = paddingX + i * stepX - 12;
      const barH = ((d.quantity || 0) / maxQty) * (chartHeight * 0.45);
      const y = height - paddingY - barH;
      return { x, y, barH, d, i };
    });

    const xLabels = data.map((d, i) => ({
      x: paddingX + i * stepX,
      label: d.date ? d.date.substring(5) : `#${i + 1}`,
      fullDate: d.date
    }));

    return {
      points: pointsArr.join(" "),
      bars: barsArr,
      maxSales,
      maxQty,
      xLabels,
      chartWidth
    };
  }, [data, height]);

  if (!data || data.length === 0) {
    return (
      <div
        style={{
          height,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-soft)",
          borderRadius: "8px",
          color: "var(--text-muted)",
          fontSize: "13px"
        }}
      >
        <span>📊 No sales activity recorded in this period.</span>
        <span style={{ fontSize: "11px", marginTop: "4px" }}>
          Orders placed will automatically chart here.
        </span>
      </div>
    );
  }

  const chartWidth = Math.max(data.length * 60, 400);

  return (
    <div style={{ position: "relative", width: "100%", overflowX: "auto" }}>
      <svg
        viewBox={`0 0 ${chartWidth} ${height}`}
        style={{ width: "100%", height, minWidth: "360px", overflow: "visible" }}
      >
        <defs>
          <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
          const y = height - 30 - pct * (height - 60);
          return (
            <g key={idx}>
              <line
                x1="30"
                y1={y}
                x2={chartWidth - 20}
                y2={y}
                stroke="var(--border)"
                strokeDasharray="4 4"
                opacity="0.6"
              />
              <text
                x="25"
                y={y + 3}
                fontSize="9.5"
                fill="var(--text-muted)"
                textAnchor="end"
              >
                {currency}
                {Math.round(maxSales * pct)}
              </text>
            </g>
          );
        })}

        {/* Volume Bars (light secondary accent) */}
        {bars.map(({ x, y, barH, i }) => (
          <rect
            key={`bar-${i}`}
            x={x}
            y={y}
            width="24"
            height={barH}
            rx="4"
            fill="var(--accent, #6366f1)"
            opacity={hoveredIdx === i ? 0.8 : 0.35}
            style={{ transition: "all 0.2s ease" }}
          />
        ))}

        {/* Sales Line */}
        {points && (
          <polyline
            fill="none"
            stroke="var(--brand)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points}
          />
        )}

        {/* Points & Interactive Tooltips */}
        {xLabels.map((pt, i) => {
          const item = data[i];
          const y = height - 30 - ((item?.sales || 0) / maxSales) * (height - 60);
          const isHovered = hoveredIdx === i;

          return (
            <g
              key={`pt-${i}`}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{ cursor: "pointer" }}
            >
              <circle
                cx={pt.x}
                cy={y}
                r={isHovered ? 6 : 4}
                fill="var(--bg-card, #fff)"
                stroke="var(--brand)"
                strokeWidth={isHovered ? 3 : 2}
              />
              <text
                x={pt.x}
                y={height - 10}
                fontSize="10"
                fill="var(--text-muted)"
                textAnchor="middle"
              >
                {pt.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Hover Info Tooltip Badge */}
      {hoveredIdx !== null && data[hoveredIdx] && (
        <div
          style={{
            position: "absolute",
            top: 10,
            right: 14,
            background: "var(--bg-card, #fff)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            padding: "6px 12px",
            fontSize: "12px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            display: "flex",
            gap: "12px",
            alignItems: "center"
          }}
        >
          <span style={{ color: "var(--text-muted)" }}>{data[hoveredIdx].date}</span>
          <span style={{ fontWeight: 700, color: "var(--brand)" }}>
            {currency}
            {data[hoveredIdx].sales?.toLocaleString("en-IN")}
          </span>
          <span style={{ color: "var(--accent, #6366f1)" }}>
            {data[hoveredIdx].quantity} units ({data[hoveredIdx].orders} orders)
          </span>
        </div>
      )}
    </div>
  );
}

export const SalesTrendChart = memo(SalesTrendChartBase);
export default SalesTrendChart;
