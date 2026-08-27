import enJson from "../locales/en.json";
import taJson from "../locales/ta.json";
import hiJson from "../locales/hi.json";

function flattenDictionary(jsonObj) {
  const flat = {};
  for (const groupKey in jsonObj) {
    const group = jsonObj[groupKey];
    if (typeof group === "object") {
      for (const key in group) {
        flat[key] = group[key];
        flat[`${groupKey}.${key}`] = group[key];
      }
    }
  }
  return { ...jsonObj, ...flat };
}

export const translations = {
  en: flattenDictionary(enJson),
  ta: flattenDictionary(taJson),
  hi: flattenDictionary(hiJson),
};

export default translations;
