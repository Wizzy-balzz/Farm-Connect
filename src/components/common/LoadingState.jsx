import { memo } from "react";
import { RefreshCw } from "../icons/Icons.jsx";

/**
 * Reusable LoadingState component
 * text: string
 * fullPage: boolean
 */
function LoadingStateBase({
  text = "Loading data...",
  fullPage = false,
  className = "",
  style = {},
}) {
  const content = (
    <div
      className={`fc-fade-in ${className}`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
        gap: "12px",
        color: "var(--text-muted)",
        ...style,
      }}
    >
      <div
        style={{
          width: "36px",
          height: "36px",
          borderRadius: "50%",
          background: "var(--brand-light)",
          color: "var(--brand)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <RefreshCw size={20} style={{ animation: "spin 1s linear infinite" }} />
      </div>
      <span style={{ fontSize: "13px", fontWeight: 600 }}>{text}</span>
    </div>
  );

  if (fullPage) {
    return (
      <div
        style={{
          minHeight: "60vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {content}
      </div>
    );
  }

  return content;
}

export const LoadingState = memo(LoadingStateBase);
export default LoadingState;
