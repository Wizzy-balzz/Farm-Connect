/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useMemo, useCallback } from "react";

export const NavigationContext = createContext(null);

function getDefaultPage() {
  try {
    const role = JSON.parse(localStorage.getItem("fc_role") || "null");
    return role === "farmer" ? "farmer-dashboard" : "marketplace";
  } catch {
    return "marketplace";
  }
}

export function NavigationProvider({ children }) {
  const [route, setRoute] = useState(() => ({ page: getDefaultPage(), params: {} }));

  const navigate = useCallback((page, params = {}) => {
    setRoute({ page, params });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const value = useMemo(() => ({ route, navigate }), [route, navigate]);

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}
