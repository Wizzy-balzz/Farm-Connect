import { memo } from "react";

/**
 * Reusable SectionHeader Component
 * title: string
 * description?: string
 * eyebrow?: string
 * action?: ReactNode
 */
function SectionHeaderBase({
  title,
  description,
  eyebrow,
  action,
  className = "",
  style = {},
}) {
  return (
    <div
      className={`fc-page-head ${className}`}
      style={{ marginBottom: description ? 24 : 18, ...style }}
    >
      <div>
        {eyebrow && (
          <span
            style={{
              fontSize: "11px",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--brand)",
              marginBottom: "4px",
              display: "inline-block",
            }}
          >
            {eyebrow}
          </span>
        )}
        <h1 className="fc-h1" style={{ margin: 0 }}>
          {title}
        </h1>
        {description && (
          <p className="fc-muted" style={{ marginTop: "6px", marginBottom: 0 }}>
            {description}
          </p>
        )}
      </div>
      {action && <div className="fc-flex-gap-12 fc-flex-wrap">{action}</div>}
    </div>
  );
}

export const SectionHeader = memo(SectionHeaderBase);
export default SectionHeader;
