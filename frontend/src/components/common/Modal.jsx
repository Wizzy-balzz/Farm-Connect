import { useEffect, useCallback, memo } from "react";
import { X } from "../icons/Icons.jsx";

function ModalBase({ open, onClose, title, children, footer, width }) {
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

  return (
    <div
      className="fc-modal-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      role="presentation"
    >
      <div
        className="fc-modal"
        style={width ? { maxWidth: width } : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "fc-modal-title" : undefined}
      >
        <div className="fc-modal-head">
          {title && <h3 id="fc-modal-title" className="fc-h3" style={{ margin: 0 }}>{title}</h3>}
          <button className="fc-icon-btn" onClick={onClose} aria-label="Close modal">
            <X size={17} />
          </button>
        </div>
        <div className="fc-modal-body">{children}</div>
        {footer && <div className="fc-modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export const Modal = memo(ModalBase);
export default Modal;

