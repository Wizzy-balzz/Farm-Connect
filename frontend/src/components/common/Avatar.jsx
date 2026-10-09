import { memo } from "react";

/**
 * Reusable Avatar component
 * size: 'sm' (28px) | 'md' (36px) | 'lg' (48px) | 'xl' (64px)
 * verified: boolean (displays green checkmark indicator)
 */
function AvatarBase({
  name = "User",
  src = "",
  size = "md",
  verified = false,
  role = "",
  className = "",
  style = {},
}) {
  const initials = name
    ? name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "U";

  const sizePx = size === "sm" ? 28 : size === "lg" ? 48 : size === "xl" ? 64 : 36;
  const fontSize = size === "sm" ? 11 : size === "lg" ? 18 : size === "xl" ? 24 : 14;

  const roleBg =
    role === "farmer"
      ? "var(--brand-light)"
      : role === "vendor"
      ? "var(--accent-light)"
      : "var(--bg-soft)";

  const roleColor =
    role === "farmer"
      ? "var(--brand)"
      : role === "vendor"
      ? "var(--accent)"
      : "var(--text)";

  return (
    <div
      className={className}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: `${sizePx}px`,
        height: `${sizePx}px`,
        borderRadius: "50%",
        background: roleBg,
        color: roleColor,
        fontWeight: 700,
        fontSize: `${fontSize}px`,
        border: "1.5px solid var(--border)",
        flexShrink: 0,
        overflow: "visible",
        ...style,
      }}
    >
      {src ? (
        <img
          src={src}
          alt={name}
          style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }}
        />
      ) : (
        <span>{initials}</span>
      )}

      {verified && (
        <span
          title="Verified Profile"
          style={{
            position: "absolute",
            bottom: "-2px",
            right: "-2px",
            width: `${Math.max(12, Math.round(sizePx * 0.35))}px`,
            height: `${Math.max(12, Math.round(sizePx * 0.35))}px`,
            background: "var(--brand)",
            color: "#ffffff",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "8px",
            border: "1.5px solid var(--surface)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          ✓
        </span>
      )}
    </div>
  );
}

export const Avatar = memo(AvatarBase);
export default Avatar;
