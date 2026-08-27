import { memo, useEffect } from "react";
import { CheckCircle, XCircle, X } from "../icons/Icons.jsx";
import { useNotifications } from "../../hooks/useNotifications.js";

const ToastItem = memo(function ToastItem({ toast, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 3200);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div className={`fc-toast fc-toast-${toast.variant}`}>
      <span className={`fc-toast-icon ${toast.variant}`}>
        {toast.variant === "success" ? <CheckCircle size={18} /> : <XCircle size={18} />}
      </span>
      <span>{toast.text}</span>
      <button className="fc-toast-close" onClick={() => onDismiss(toast.id)}><X size={14} /></button>
    </div>
  );
});

function ToastStackBase() {
  const { toasts, dismissToast } = useNotifications();
  if (toasts.length === 0) return null;
  return (
    <div className="fc-toast-stack">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={dismissToast} />
      ))}
    </div>
  );
}

export const ToastStack = memo(ToastStackBase);
export const Toast = ToastStack;
export default ToastStack;
