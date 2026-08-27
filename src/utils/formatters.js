const CURRENCY_SYMBOLS = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "CA$",
  AUD: "A$",
  CNY: "¥",
  JPY: "¥",
  BRL: "R$",
  ZAF: "R"
};

export function formatCurrency(amount, currencyCode = "INR") {
  const num = Number(amount || 0);
  const code = (currencyCode || "INR").toUpperCase();
  const symbol = CURRENCY_SYMBOLS[code] || `${code} `;

  if (code === "INR") {
    return `${symbol}${num.toLocaleString("en-IN")}`;
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2
    }).format(num);
  } catch {
    return `${symbol}${num.toFixed(2)}`;
  }
}

export function formatDate(dateStr) {
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

export function initials(name) {
  return String(name || "").trim().slice(0, 1).toUpperCase();
}

export function uid(prefix = "id") {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
}

export function getActivePrice(product, qty) {
  if (!product) return 0;
  let tiers = {};
  try {
    tiers = JSON.parse(product.tierPrices || "{}");
  } catch {
    tiers = {};
  }
  
  let activePrice = product.price;
  const sortedTiers = Object.entries(tiers)
    .map(([threshold, price]) => ({ threshold: Number(threshold), price: Number(price) }))
    .sort((a, b) => b.threshold - a.threshold);
    
  for (const tier of sortedTiers) {
    if (qty >= tier.threshold) {
      activePrice = tier.price;
      break;
    }
  }
  return activePrice;
}
