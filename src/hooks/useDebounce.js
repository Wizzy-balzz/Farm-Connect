import { useState, useEffect } from "react";

/**
 * Custom Hook: useDebounce
 * Returns a debounced copy of `value` that only updates after
 * `delay` ms of no changes. Used for the marketplace / product search boxes.
 */
export function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export default useDebounce;
