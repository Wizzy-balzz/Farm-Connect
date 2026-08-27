import { memo } from "react";
import { AlertTriangle } from "../icons/Icons.jsx";
import { Button } from "./Button.jsx";

/**
 * Reusable ErrorState component
 * title: string
 * message: string
 * onRetry: function
 */
function ErrorStateBase({
  title = "Something went wrong",
  message = "Failed to load data. Please check your network connection and try again.",
  onRetry,
  className = "",
  style = {},
}) {
  return (
    <div
      className={`fc-fade-in ${className}`}
      style={{
        background: "var(--danger-light)",
        border: "1px solid var(--danger-border)",
        borderRadius: "var(--radius-md)",
        padding: "24px",
        textAlign: "center",
        color: "var(--text)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "10px",
        margin: "16px 0",
        ...style,
      }}
    >
      <div
        style={{
          width: "40px",
          height: "40px",
          borderRadius: "50%",
          background: "rgba(220, 38, 38, 0.15)",
          color: "var(--danger)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <AlertTriangle size={22} />
      </div>
      <h4 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "var(--danger)" }}>
        {title}
      </h4>
      <p className="fc-muted" style={{ fontSize: "13px", margin: 0, maxWidth: "420px" }}>
        {message}
      </p>
      {onRetry && (
        <Button variant="danger" size="sm" onClick={onRetry} style={{ marginTop: "6px" }}>
          Try Again
        </Button>
      )}
    </div>
  );
}

export const ErrorState = memo(ErrorStateBase);
export default ErrorState;
