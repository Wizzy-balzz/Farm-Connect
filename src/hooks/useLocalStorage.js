import { useState, useEffect, useRef } from "react";

/**
 * Custom Hook: useLocalStorage
 * Behaves like useState but persists the value to localStorage
 * and re-hydrates it on mount. Safe against SSR / private-mode errors.
 */
export function useLocalStorage(key, initialValue) {
  const isFirstRun = useRef(true);

  const [value, setValue] = useState(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored !== null ? JSON.parse(stored) : initialValue;
    } catch (err) {
      console.warn(`useLocalStorage: could not read "${key}"`, err);
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.warn(`useLocalStorage: could not write "${key}"`, err);
    }
    isFirstRun.current = false;
  }, [key, value]);

  return [value, setValue];
}

export default useLocalStorage;
