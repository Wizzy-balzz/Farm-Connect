import { memo, forwardRef } from "react";

/**
 * Reusable Input component
 * error: boolean | string
 * icon: ReactNode (left icon)
 */
const InputBase = forwardRef(function InputBase(
  { error, icon, className = "", style = {}, ...rest },
  ref
) {
  const hasError = Boolean(error);
  const inputClasses = [
    "fc-input",
    hasError ? "fc-input-error" : "",
    className,
  ].filter(Boolean).join(" ");

  if (icon) {
    return (
      <div style={{ position: "relative", width: "100%" }}>
        <div
          style={{
            position: "absolute",
            left: "12px",
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--text-soft)",
            display: "flex",
            alignItems: "center",
            pointerEvents: "none",
          }}
        >
          {icon}
        </div>
        <input
          ref={ref}
          className={inputClasses}
          style={{ paddingLeft: "38px", ...style }}
          {...rest}
        />
      </div>
    );
  }

  return <input ref={ref} className={inputClasses} style={style} {...rest} />;
});

export const Input = memo(InputBase);
export default Input;
