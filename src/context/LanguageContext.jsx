/* eslint-disable react-refresh/only-export-components */
import { createContext, useMemo, useCallback, useState, useEffect } from "react";
import i18n from "../i18n.js";
import { translations } from "../utils/translations.js";

export const LanguageContext = createContext(null);

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "ta", label: "தமிழ்" },
  { code: "hi", label: "हिन्दी" },
];

// Client-side translation cache for missing strings dynamically requested via API
const clientTranslationCache = new Map();

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    return (
      localStorage.getItem("farmconnect-language") ||
      localStorage.getItem("fc_lang") ||
      "en"
    );
  });

  const [, setTick] = useState(0);

  const setLang = useCallback((newLang) => {
    if (!["en", "ta", "hi"].includes(newLang)) return;
    setLangState(newLang);
    localStorage.setItem("farmconnect-language", newLang);
    localStorage.setItem("fc_lang", newLang);
    i18n.changeLanguage(newLang);
  }, []);

  useEffect(() => {
    i18n.changeLanguage(lang);
  }, [lang]);

  // Enhanced t function that handles dot notation, flat keys, and fallback to i18n / translations / dynamic backend api
  const t = useCallback(
    (key, fallbackText) => {
      if (!key) return "";

      // 1. Try i18next first
      if (i18n.exists(key)) {
        return i18n.t(key);
      }

      // 2. Try nested keys in translations dictionary (e.g. "common.save")
      const parts = key.split(".");
      let dictObj = translations[lang];
      if (dictObj) {
        for (const part of parts) {
          if (dictObj && typeof dictObj === "object" && part in dictObj) {
            dictObj = dictObj[part];
          } else {
            dictObj = null;
            break;
          }
        }
        if (dictObj && typeof dictObj === "string") {
          return dictObj;
        }
      }

      // 3. Try flat key lookup in translations dictionary
      if (translations[lang]?.[key]) {
        return translations[lang][key];
      }

      // 4. Try English dictionary as fallback for flat keys
      if (translations.en?.[key]) {
        return translations.en[key];
      }

      // 5. Check client-side dynamic translation cache
      const cacheKey = `${lang}:${key}`;
      if (clientTranslationCache.has(cacheKey)) {
        return clientTranslationCache.get(cacheKey);
      }

      // 6. If target is non-English and string is visible text, trigger background API fetch to /api/translate
      if (lang !== "en" && typeof key === "string" && key.trim() !== "" && !key.includes("<")) {
        // Fetch translation asynchronously without blocking UI
        fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            texts: [key],
            sourceLanguage: "en",
            targetLanguage: lang,
          }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.translations && data.translations[0]) {
              clientTranslationCache.set(cacheKey, data.translations[0]);
              setTick((prev) => prev + 1); // trigger component re-render when dynamic translation arrives
            }
          })
          .catch((err) => {
            console.warn("Dynamic API translation fallback warning:", err);
          });
      }

      return fallbackText || key;
    },
    [lang]
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
