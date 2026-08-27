import { memo } from "react";
import { TrendingUp, TrendingDown } from "../icons/Icons.jsx";

function StatCardBase({ label, value, icon, color = "var(--brand)", bg = "var(--brand-light)", trend, className = "", style = {} }) {
  return (
    <div className={`fc-stat-card fc-slide-up ${className}`} style={style}>
      <div className="fc-stat-top">
        <div>
          <div className="fc-stat-label">{label}</div>
          <div className="fc-stat-value" style={{ fontFamily: "var(--font-heading)" }}>{value}</div>
        </div>
        <div className="fc-stat-icon" style={{ background: bg, color }}>
          {icon}
        </div>
      </div>
      {trend && (
        <div className={`fc-stat-trend ${trend.direction === "down" ? "down" : "up"}`}>
          {trend.direction === "down" ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
          <span>{trend.text}</span>
        </div>
      )}
    </div>
  );
}

export const StatCard = memo(StatCardBase);
export default StatCard;

