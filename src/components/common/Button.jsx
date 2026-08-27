import { useRef, memo } from "react";
import { RefreshCw } from "../icons/Icons.jsx";

/**
 * Reusable AgriTech Button Component
 * variant: primary | accent | outline | danger | ghost | secondary
 * size: sm | md | lg
 */
function ButtonBase({
  variant = "primary",
  size = "md",
  full = false,
  icon = false,
  loading = false,
  leftIcon = null,
  rightIcon = null,
  disabled = false,
  children,
  className = "",
  onClick,
  ...rest
}) {
  const ref = useRef(null);

  const handleClick = (e) => {
    if (disabled || loading) return;
    const btn = ref.current;
    if (btn) {
      const circle = document.createElement("span");
      const diameter = Math.max(btn.clientWidth, btn.clientHeight);
      const rect = btn.getBoundingClientRect();
      circle.style.width = circle.style.height = `${diameter}px`;
      circle.style.left = `${e.clientX - rect.left - diameter / 2}px`;
      circle.style.top = `${e.clientY - rect.top - diameter / 2}px`;
      circle.className = "fc-ripple-circle";
      btn.appendChild(circle);
      setTimeout(() => circle.remove(), 550);
    }
    onClick?.(e);
  };

  const sizeClass = size === "sm" ? "fc-btn-sm" : size === "lg" ? "fc-btn-lg" : "";

  const classes = [
    "fc-btn fc-ripple",
    `fc-btn-${variant}`,
    sizeClass,
    full ? "fc-btn-full" : "",
    icon ? "fc-btn-icon" : "",
    loading ? "fc-btn-loading" : "",
    className,
  ].filter(Boolean).join(" ");

  return (
    <button
      ref={ref}
      className={classes}
      onClick={handleClick}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <>
          <RefreshCw size={size === "sm" ? 12 : 14} style={{ animation: "spin 1s linear infinite" }} />
          <span>{children}</span>
        </>
      ) : (
        <>
          {leftIcon}
          {children}
          {rightIcon}
        </>
      )}
    </button>
  );
}

export const Button = memo(ButtonBase);
export default Button;

