import { useState, memo } from "react";

/**
 * Reusable Tooltip Component
 * position: 'top' | 'bottom' | 'left' | 'right'
 */
function TooltipBase({ content, position = "top", children, className = "" }) {
  const [visible, setVisible] = useState(false);

  if (!content) return children;

  const positionStyles = {
    top: { bottom: "100%", left: "50%", transform: "translateX(-50%)", marginBottom: "6px" },
    bottom: { top: "100%", left: "50%", transform: "translateX(-50%)", marginTop: "6px" },
    left: { right: "100%", top: "50%", transform: "translateY(-50%)", marginRight: "6px" },
    right: { left: "100%", top: "50%", transform: "translateY(-50%)", marginLeft: "6px" },
  };

  return (
    <div
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
      className={className}
    >
      {children}
      {visible && (
        <div
          className="fc-fade-in"
          style={{
            position: "absolute",
            ...positionStyles[position],
            background: "var(--text)",
            color: "var(--bg)",
            fontSize: "11px",
            fontWeight: 600,
            padding: "4px 8px",
            borderRadius: "4px",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            zIndex: 120,
            boxShadow: "var(--shadow-md)",
          }}
          role="tooltip"
        >
          {content}
        </div>
      )}
    </div>
  );
}

export const Tooltip = memo(TooltipBase);
export default Tooltip;
