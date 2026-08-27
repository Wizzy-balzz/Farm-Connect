import { memo, useMemo } from "react";

const PALETTE = ["#1f6d3c", "#c17f3e", "#2c6fa8", "#8a5cae", "#c0392b", "#3fae6f"];

function DonutChartBase({ data, size = 180, thickness = 26 }) {
  const { segments, total } = useMemo(() => {
    const total = data.reduce((s, d) => s + d.value, 0) || 1;
    const radius = size / 2;
    const circumference = 2 * Math.PI * (radius - thickness / 2);
    const segments = data.reduce((acc, d, i) => {
      const prevOffset = acc.length ? acc[acc.length - 1].offset + acc[acc.length - 1].length : 0;
      const length = (d.value / total) * circumference;
      acc.push({ ...d, length, offset: prevOffset, color: PALETTE[i % PALETTE.length] });
      return acc;
    }, []);
    return { segments, total };
  }, [data, size, thickness]);

  const radius = size / 2;
  const circumference = 2 * Math.PI * (radius - thickness / 2);

  return (
    <div className="fc-flex-gap-12" style={{ alignItems: "center", flexWrap: "wrap" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`translate(${radius},${radius}) rotate(-90)`}>
          <circle r={radius - thickness / 2} fill="none" stroke="var(--bg-soft)" strokeWidth={thickness} />
          {segments.map((s) => (
            <circle
              key={s.label}
              r={radius - thickness / 2}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness}
              strokeDasharray={`${s.length} ${circumference - s.length}`}
              strokeDashoffset={-s.offset}
              strokeLinecap="butt"
            />
          ))}
        </g>
        <text x="50%" y="47%" textAnchor="middle" fontSize="20" fontWeight="800" fill="var(--text)">{total}</text>
        <text x="50%" y="60%" textAnchor="middle" fontSize="10" fill="var(--text-soft)">total</text>
      </svg>
      <div className="fc-chart-legend" style={{ flexDirection: "column", marginTop: 0 }}>
        {segments.map((s) => (
          <div className="fc-legend-item" key={s.label}>
            <span className="fc-legend-dot" style={{ background: s.color }} />
            {s.label} · {s.value}
          </div>
        ))}
      </div>
    </div>
  );
}

export const DonutChart = memo(DonutChartBase);
export default DonutChart;
