import { memo } from "react";
import { gradeColor } from "../product/gradeColor.js";

/**
 * Reusable Badge component
 * variant: success | warning | danger | info | neutral | organic | grade
 */
function BadgeBase({
  variant = "neutral",
  grade = "A",
  children,
  className = "",
  style = {},
  icon = null,
}) {
  if (variant === "grade") {
    const bg = gradeColor(grade);
    return (
      <span
        className={`fc-tag-grade ${className}`}
        style={{ background: bg, ...style }}
      >
        Grade {grade}
      </span>
    );
  }

  if (variant === "organic") {
    return (
      <span
        className={`fc-status-badge ${className}`}
        style={{
          background: "var(--brand)",
          color: "#ffffff",
          fontSize: "10px",
          fontWeight: 700,
          padding: "2px 8px",
          ...style
        }}
      >
        🌿 ORGANIC
      </span>
    );
  }

  const variantClassMap = {
    success: "fc-status-delivered",
    warning: "fc-status-pending",
    danger: "fc-status-rejected",
    info: "fc-status-accepted",
    neutral: "",
  };

  const variantClass = variantClassMap[variant] || "";

  return (
    <span
      className={`fc-status-badge ${variantClass} ${className}`}
      style={variant === "neutral" ? { background: "var(--bg-soft)", color: "var(--text-muted)", ...style } : style}
    >
      {icon}
      {children}
    </span>
  );
}

export const Badge = memo(BadgeBase);
export default Badge;
