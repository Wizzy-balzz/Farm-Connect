import { memo, useMemo } from "react";

function LineChartBase({ data, color = "var(--brand)", height = 220, chartId = "fc-line" }) {
  const { points, path, areaPath } = useMemo(() => {
    const values = data.map((d) => d.value);
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const w = 620;
    const stepX = w / (data.length - 1 || 1);
    const usableH = height - 40;
    const points = data.map((d, i) => {
      const x = i * stepX;
      const y = usableH - ((d.value - min) / (max - min || 1)) * usableH + 10;
      return { x, y, label: d.label, value: d.value };
    });
    const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
    const areaPath = `${path} L${points[points.length - 1]?.x || 0},${usableH + 10} L${points[0]?.x || 0},${usableH + 10} Z`;
    return { points, path, areaPath };
  }, [data, height]);

  const gradId = `grad-${chartId}`;

  return (
    <svg viewBox={`0 0 620 ${height}`} width="100%" height={height} preserveAspectRatio="xMidYMax meet">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />
      <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <animate attributeName="stroke-dasharray" from="0,1000" to="1000,0" dur="0.7s" fill="freeze" />
      </path>
      {points.map((p) => (
        <circle key={p.label} cx={p.x} cy={p.y} r="3.5" fill={color} />
      ))}
      {points.map((p) => (
        <text key={`t-${p.label}`} x={p.x} y={height - 6} textAnchor="middle" fontSize="10.5" fill="var(--text-soft)">
          {p.label}
        </text>
      ))}
    </svg>
  );
}

export const LineChart = memo(LineChartBase);
export default LineChart;
