import { memo, forwardRef } from "react";

/**
 * Reusable Select component
 * options: Array<{ value: string|number, label: string }> | Array<string>
 * error: boolean | string
 */
const SelectBase = forwardRef(function SelectBase(
  { options = [], error, className = "", style = {}, children, ...rest },
  ref
) {
  const hasError = Boolean(error);
  const selectClasses = [
    "fc-select",
    hasError ? "fc-select-error" : "",
    className,
  ].filter(Boolean).join(" ");

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <select ref={ref} className={selectClasses} style={style} {...rest}>
        {children
          ? children
          : options.map((opt) => {
              const value = typeof opt === "object" ? opt.value : opt;
              const label = typeof opt === "object" ? opt.label : opt;
              return (
                <option key={value} value={value}>
                  {label}
                </option>
              );
            })}
      </select>
    </div>
  );
});

export const Select = memo(SelectBase);
export default Select;
