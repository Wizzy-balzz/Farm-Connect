import { memo, useEffect } from "react";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "../icons/Icons.jsx";
import { useNotifications } from "../../hooks/useNotifications.js";

const ToastItem = memo(function ToastItem({ toast, onDismiss }) {
  const variant = toast.variant || "info";

  useEffect(() => {
    // Keep error messages visible longer (5000ms) so user can read them comfortably; others 3600ms
    const duration = variant === "error" ? 5000 : 3600;
    const timer = setTimeout(() => onDismiss(toast.id), duration);
    return () => clearTimeout(timer);
  }, [toast.id, variant, onDismiss]);

  const renderIcon = () => {
    switch (variant) {
      case "success":
        return <CheckCircle size={18} />;
      case "warning":
        return <AlertTriangle size={18} />;
      case "info":
        return <Info size={18} />;
      case "error":
      default:
        return <XCircle size={18} />;
    }
  };

  return (
    <div
      className={`fc-toast fc-toast-${variant}`}
      role="alert"
      aria-live={variant === "error" ? "assertive" : "polite"}
    >
      <span className={`fc-toast-icon ${variant}`} aria-hidden="true">
        {renderIcon()}
      </span>
      <div className="fc-toast-content">
        <span className="fc-toast-message">{toast.text}</span>
      </div>
      <button
        type="button"
        className="fc-toast-close"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
      >
        <X size={15} />
      </button>
    </div>
  );
});

function ToastStackBase() {
  const { toasts, dismissToast } = useNotifications();
  if (!toasts || toasts.length === 0) return null;
  return (
    <div className="fc-toast-stack" role="region" aria-label="Notifications">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={dismissToast} />
      ))}
    </div>
  );
}

export const ToastStack = memo(ToastStackBase);
export const Toast = ToastStack;
export default ToastStack;

