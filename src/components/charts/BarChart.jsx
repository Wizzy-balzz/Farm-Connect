import { memo, useMemo } from "react";

/**
 * Lightweight dependency-free bar chart (SVG). Demonstrates useMemo
 * for expensive geometry calculation and React.memo to avoid re-render
 * when parent state (e.g. notification dropdown) changes but data doesn't.
 */
function BarChartBase({ data, color = "var(--brand)", height = 220 }) {
  const { bars, max } = useMemo(() => {
    const max = Math.max(...data.map((d) => d.value), 1);
    return { bars: data, max };
  }, [data]);

  return (
    <div>
      <svg viewBox={`0 0 ${bars.length * 60} ${height}`} width="100%" height={height} preserveAspectRatio="xMidYMax meet">
        {bars.map((d, i) => {
          const barHeight = (d.value / max) * (height - 46);
          const x = i * 60 + 14;
          return (
            <g key={d.label}>
              <rect
                x={x} y={height - 30 - barHeight} width="32" height={barHeight}
                rx="6" fill={color} opacity={0.9}
              >
                <animate attributeName="height" from="0" to={barHeight} dur="0.5s" fill="freeze" />
                <animate attributeName="y" from={height - 30} to={height - 30 - barHeight} dur="0.5s" fill="freeze" />
              </rect>
              <text x={x + 16} y={height - 10} textAnchor="middle" fontSize="10.5" fill="var(--text-soft)">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export const BarChart = memo(BarChartBase);
export default BarChart;
