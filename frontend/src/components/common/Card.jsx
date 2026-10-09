import { memo } from "react";

/**
 * Reusable Card component
 * hoverable: boolean (adds smooth elevation on hover)
 * padded: boolean (adds 20px padding)
 */
function CardBase({
  children,
  hoverable = false,
  padded = true,
  className = "",
  style = {},
  onClick,
  ...rest
}) {
  const classes = [
    "fc-card",
    hoverable ? "fc-card-hoverable" : "",
    padded ? "fc-card-pad" : "",
    className,
  ].filter(Boolean).join(" ");

  return (
    <div
      className={classes}
      style={style}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, className = "", style = {} }) {
  return (
    <div className={`fc-panel-head ${className}`} style={{ marginBottom: subtitle ? 12 : 16, ...style }}>
      <div>
        {title && <h3 className="fc-h3" style={{ margin: 0 }}>{title}</h3>}
        {subtitle && <p className="fc-muted" style={{ fontSize: "12.5px", marginTop: 2 }}>{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export function CardBody({ children, className = "", style = {} }) {
  return <div className={className} style={style}>{children}</div>;
}

export function CardFooter({ children, className = "", style = {} }) {
  return (
    <div
      className={className}
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        paddingTop: "14px",
        marginTop: "16px",
        borderTop: "1px solid var(--border)",
        ...style
      }}
    >
      {children}
    </div>
  );
}

export const Card = memo(CardBase);
export default Card;
