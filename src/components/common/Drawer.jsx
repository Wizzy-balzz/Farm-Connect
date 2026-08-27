import { useEffect, useCallback, memo } from "react";
import { X } from "../icons/Icons.jsx";

/**
 * Reusable Slide-over Drawer Component
 * position: 'right' | 'left'
 * width: number | string (e.g. 420 or '450px')
 */
function DrawerBase({
  open,
  onClose,
  title,
  children,
  footer,
  position = "right",
  width = 420,
}) {
  const handleKey = useCallback((e) => {
    if (e.key === "Escape") onClose?.();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [open, handleKey]);

  if (!open) return null;

  const animationClass = position === "right" ? "fc-slide-right" : "fc-slide-left";

  return (
    <div
      className="fc-modal-overlay"
      style={{ justifyContent: position === "right" ? "flex-end" : "flex-start", padding: 0 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      role="presentation"
    >
      <div
        className={`${animationClass}`}
        style={{
          width: typeof width === "number" ? `${width}px` : width,
          maxWidth: "90vw",
          height: "100vh",
          background: "var(--surface)",
          borderLeft: position === "right" ? "1px solid var(--border)" : undefined,
          borderRight: position === "left" ? "1px solid var(--border)" : undefined,
          boxShadow: "var(--shadow-lg)",
          display: "flex",
          flexDirection: "column",
          zIndex: 160
        }}
        role="dialog"
        aria-modal="true"
      >
        <div className="fc-modal-head">
          {title && <h3 className="fc-h3" style={{ margin: 0 }}>{title}</h3>}
          <button className="fc-icon-btn" onClick={onClose} aria-label="Close panel">
            <X size={17} />
          </button>
        </div>
        <div className="fc-modal-body" style={{ flex: 1, overflowY: "auto" }}>
          {children}
        </div>
        {footer && <div className="fc-modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export const Drawer = memo(DrawerBase);
export default Drawer;
