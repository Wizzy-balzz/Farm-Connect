import { memo } from "react";
import { Package } from "../icons/Icons.jsx";

function EmptyStateBase({ icon, title, description, action, className = "", style = {} }) {
  return (
    <div className={`fc-empty-state fc-fade-in ${className}`} style={style}>
      <div className="fc-empty-icon">{icon || <Package size={26} />}</div>
      <h4 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "var(--text)" }}>{title}</h4>
      {description && <p className="fc-muted" style={{ fontSize: "13px", marginTop: "4px", maxWidth: "360px", margin: "4px auto 0" }}>{description}</p>}
      {action && <div style={{ marginTop: "12px" }}>{action}</div>}
    </div>
  );
}
export const EmptyState = memo(EmptyStateBase);
export default EmptyState;

