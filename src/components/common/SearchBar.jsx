import { useRef, useEffect, forwardRef, memo } from "react";
import { Search, X } from "../icons/Icons.jsx";

/**
 * SearchBar / SearchBox Component
 * Pressing "/" anywhere on the page focuses the input unless already typing in a form field.
 */
function SearchBarBase({ value, onChange, placeholder = "Search...", onFocus, onBlur, className = "", style = {} }, forwardedRef) {
  const localRef = useRef(null);
  const inputRef = forwardedRef || localRef;

  useEffect(() => {
    function onKeyDown(e) {
      const activeTag = document.activeElement?.tagName;
      const isTyping = activeTag === "INPUT" || activeTag === "TEXTAREA";
      if (e.key === "/" && !isTyping) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [inputRef]);

  return (
    <div className={`fc-searchbar ${className}`} style={style}>
      <Search size={15} style={{ flexShrink: 0, color: "var(--text-soft)" }} />
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={onFocus}
        onBlur={onBlur}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "2px",
            color: "var(--text-soft)",
            display: "flex",
            alignItems: "center"
          }}
        >
          <X size={13} />
        </button>
      ) : (
        <span className="fc-kbd">/</span>
      )}
    </div>
  );
}

export const SearchBar = memo(forwardRef(SearchBarBase));
export const SearchBox = SearchBar;
export default SearchBar;

