import { useContext } from "react";
import { LanguageContext } from "../context/LanguageContext.jsx";

/**
 * Custom Hook: useLanguage
 * Thin wrapper around LanguageContext so components never
 * import useContext + the raw context directly.
 * Returns { lang, setLang, t }
 */
export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside <LanguageProvider>");
  return ctx;
}

export default useLanguage;
