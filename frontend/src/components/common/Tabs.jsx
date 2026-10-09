import { memo } from "react";

/**
 * Reusable Tabs component
 * tabs: Array<{ id: string, label: string, icon?: ReactNode, badge?: string|number }>
 * variant: 'chip' | 'underline'
 */
function TabsBase({
  tabs = [],
  activeTab,
  onChange,
  variant = "chip",
  className = "",
  style = {},
}) {
  return (
    <div
      className={`fc-flex-gap-8 fc-flex-wrap ${className}`}
      style={{
        borderBottom: variant === "underline" ? "1px solid var(--border)" : "none",
        paddingBottom: variant === "underline" ? "4px" : "0",
        ...style
      }}
      role="tablist"
    >
      {tabs.map((t) => {
        const isActive = activeTab === t.id;
        if (variant === "underline") {
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange?.(t.id)}
              style={{
                border: "none",
                background: "transparent",
                borderBottom: isActive ? "2px solid var(--brand)" : "2px solid transparent",
                color: isActive ? "var(--brand)" : "var(--text-muted)",
                fontWeight: isActive ? 700 : 600,
                fontSize: "13px",
                padding: "8px 14px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                transition: "all 0.15s ease"
              }}
            >
              {t.icon}
              <span>{t.label}</span>
              {t.badge !== undefined && (
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    background: isActive ? "var(--brand-light)" : "var(--bg-soft)",
                    color: isActive ? "var(--brand)" : "var(--text-soft)",
                    padding: "1px 6px",
                    borderRadius: "999px"
                  }}
                >
                  {t.badge}
                </span>
              )}
            </button>
          );
        }

        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={isActive}
            className={`fc-radio-chip ${isActive ? "active" : ""}`}
            onClick={() => onChange?.(t.id)}
            style={{ borderRadius: "var(--radius-sm)", padding: "7px 14px" }}
          >
            {t.icon}
            <span>{t.label}</span>
            {t.badge !== undefined && (
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  background: "rgba(0,0,0,0.06)",
                  padding: "1px 6px",
                  borderRadius: "999px",
                  marginLeft: "4px"
                }}
              >
                {t.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export const Tabs = memo(TabsBase);
export default Tabs;
