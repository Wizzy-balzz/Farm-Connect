import { memo } from "react";

function FormFieldBase({ label, error, hint, required, children, className = "" }) {
  return (
    <div className={`fc-field ${className}`}>
      {label && (
        <label className="fc-label">
          {label}
          {required && <span style={{ color: "var(--danger)", marginLeft: "4px" }}>*</span>}
        </label>
      )}
      {children}
      {hint && !error && <span className="fc-soft" style={{ fontSize: "11.5px", marginTop: "2px" }}>{hint}</span>}
      {error && <span className="fc-error-text" style={{ marginTop: "2px" }}>{error}</span>}
    </div>
  );
}

export const FormField = memo(FormFieldBase);
export default FormField;

