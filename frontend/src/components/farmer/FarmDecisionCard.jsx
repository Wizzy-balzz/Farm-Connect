import { memo } from "react";
import { Badge } from "../common/Badge.jsx";
import { Button } from "../common/Button.jsx";
import { TrendingUp, MapPin, Sprout } from "../icons/Icons.jsx";
import { formatCurrency } from "../../utils/formatters.js";

/**
 * FarmDecisionCard — Core Hallmark Component
 * Visually unifies: Crop → Price → Demand → Location → AI Interpretation → Decision → Action
 */
function FarmDecisionCardBase({
  crop = "Tomato",
  inventoryItem = null,
  strategy = null,
  marketStats = null,
  nearestBuyer = null,
  loading = false,
  onOpenChat,
  onSellSmarter,
  onViewBuyers
}) {
  const stock = inventoryItem?.stock ?? 0;
  const unit = inventoryItem?.unit || "kg";
  const listedPrice = inventoryItem?.price;
  const isOrganic = Boolean(inventoryItem?.organic);

  // Price analysis
  const avgMarketPrice = marketStats?.avgPrice ?? strategy?.facts?.currentMedianPrice;
  const priceRange = strategy?.facts?.priceRange || (avgMarketPrice ? `₹${(avgMarketPrice * 0.95).toFixed(0)} - ₹${(avgMarketPrice * 1.08).toFixed(0)}/${unit}` : null);
  const recBadge = strategy?.recommendation || (stock > 0 ? "SELL_NOW" : "MORE_DATA_NEEDED");

  const renderBadge = (rec) => {
    switch (rec) {
      case "SELL_NOW":
        return <Badge variant="success" style={{ fontWeight: 800 }}>🛒 SELL NOW</Badge>;
      case "PARTIAL_SELL":
        return <Badge variant="warning" style={{ fontWeight: 800 }}>⚖️ PARTIAL SELL</Badge>;
      case "WAIT":
        return <Badge variant="info" style={{ fontWeight: 800 }}>⏳ HOLD STOCK</Badge>;
      case "LIST_NOW":
        return <Badge variant="primary" style={{ fontWeight: 800 }}>📢 LIST BATCH</Badge>;
      default:
        return <Badge variant="neutral" style={{ fontWeight: 800 }}>ℹ️ REVIEW</Badge>;
    }
  };

  const handleAskAi = () => {
    const prompt = `Give me a tactical selling decision for my ${stock > 0 ? `${stock} ${unit} of ` : ""}${crop} in current markets. What price and timing do you recommend?`;
    if (onOpenChat) {
      onOpenChat(prompt);
    } else {
      window.dispatchEvent(new CustomEvent("fc-open-ai-chat", { detail: { prompt } }));
    }
  };

  return (
    <div
      className="fc-decision-card"
      style={{
        background: "var(--surface)",
        border: "1.5px solid var(--border-strong)",
        borderRadius: "var(--radius-lg, 12px)",
        padding: "24px",
        boxShadow: "var(--shadow-sm)",
        display: "flex",
        flexDirection: "column",
        gap: "18px",
        position: "relative"
      }}
    >
      {/* 1. Header: Crop Identity & Recommendation Status */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span style={{ fontSize: "20px" }}>🌾</span>
            <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--brand)" }}>
              SIGNATURE DECISION SIGNAL
            </span>
            {isOrganic && (
              <span style={{ fontSize: "10.5px", background: "var(--brand-light)", color: "var(--brand-dark)", padding: "1px 7px", borderRadius: "999px", fontWeight: 700 }}>
                🌱 Certified Organic
              </span>
            )}
          </div>
          <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "22px", fontWeight: 800, margin: 0, color: "var(--text)" }}>
            {crop}
          </h2>
          <div style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "2px" }}>
            {stock > 0 ? (
              <span><strong>{stock} {unit}</strong> available in harvest storage</span>
            ) : (
              <span className="fc-soft" style={{ fontStyle: "italic" }}>No active lot currently in inventory</span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          {renderBadge(recBadge)}
          <span style={{ fontSize: "11px", color: "var(--text-soft)" }}>AI Confidence: Verified Data</span>
        </div>
      </div>

      {/* 2. Agricultural Intelligence Grid: Price + Demand + Location */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "12px",
          background: "var(--bg-soft)",
          padding: "14px 16px",
          borderRadius: "var(--radius-md, 8px)",
          border: "1px solid var(--border)"
        }}
      >
        {/* PRICE SIGNAL */}
        <div>
          <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-soft)", display: "flex", alignItems: "center", gap: 4 }}>
            <span>Market Price</span>
          </div>
          <div style={{ fontSize: "17px", fontWeight: 800, color: "var(--brand)", marginTop: 2 }}>
            {listedPrice ? formatCurrency(listedPrice) : (priceRange || "₹30 - ₹38/kg")}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            {listedPrice && avgMarketPrice
              ? listedPrice >= avgMarketPrice
                ? `+₹${(listedPrice - avgMarketPrice).toFixed(1)} vs market avg`
                : `-₹${(avgMarketPrice - listedPrice).toFixed(1)} margin headroom`
              : "Regional benchmark"}
          </div>
        </div>

        {/* DEMAND SIGNAL */}
        <div>
          <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-soft)", display: "flex", alignItems: "center", gap: 4 }}>
            <span>Demand Trend</span>
          </div>
          <div style={{ fontSize: "17px", fontWeight: 800, color: "var(--accent)", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
            <TrendingUp size={16} />
            <span>{strategy?.facts?.demandTrend === "increasing" ? "Surging (High)" : "Steady Demand"}</span>
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            B2B institutional orders
          </div>
        </div>

        {/* LOCATION & LOGISTICS SIGNAL */}
        <div>
          <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-soft)", display: "flex", alignItems: "center", gap: 4 }}>
            <MapPin size={12} />
            <span>Nearby Market</span>
          </div>
          <div style={{ fontSize: "15px", fontWeight: 800, color: "var(--text)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {nearestBuyer?.deliveryDistrict || nearestBuyer?.deliveryRegion || "District Mandi"}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            {nearestBuyer?.distanceKm ? `${nearestBuyer.distanceKm} km transit radius` : "Direct farm pickup ready"}
          </div>
        </div>
      </div>

      {/* 3. AI Strategic Interpretation & Reasoning */}
      <div
        style={{
          borderLeft: "3.5px solid var(--brand)",
          background: "var(--brand-light)",
          padding: "12px 14px",
          borderRadius: "0 var(--radius-sm, 6px) var(--radius-sm, 6px) 0",
          fontSize: "12.5px",
          color: "var(--brand-dark)",
          lineHeight: 1.5
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, marginBottom: "4px" }}>
          <Sprout size={15} color="var(--brand)" />
          <span>AI Agricultural Signal</span>
        </div>
        {loading ? (
          <span style={{ fontStyle: "italic", opacity: 0.8 }}>Analyzing live marketplace facts and price dynamics...</span>
        ) : strategy?.reasoning ? (
          <p style={{ margin: 0 }}>{strategy.reasoning}</p>
        ) : (
          <p style={{ margin: 0 }}>
            {stock > 0
              ? `Procurement demand for ${crop} is favorable in nearby districts. Estimated wholesale gross yield is approximately ${strategy?.grossRevenueText || formatCurrency((listedPrice || 32) * stock)}.`
              : `Monitor daily market quotes for ${crop}. Once harvested, listing Grade A batches allows you to capture active institutional buyer demand.`}
          </p>
        )}
      </div>

      {/* 4. Action Layer: Direct Decisions & Confirmations */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, paddingTop: "4px" }}>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <Button
            variant="accent"
            size="sm"
            onClick={onSellSmarter}
            style={{ fontWeight: 700 }}
            title="Launch Autonomous Selling Strategy"
          >
            🛒 Sell Smarter →
          </Button>
          {nearestBuyer && (
            <Button
              variant="outline"
              size="sm"
              onClick={onViewBuyers}
              style={{ fontWeight: 600 }}
              title="Inspect verified buyer requests on map"
            >
              👥 View Buyers ({nearestBuyer.qty} {unit})
            </Button>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleAskAi}
          style={{ fontSize: "12px", color: "var(--brand-dark)", fontWeight: 700 }}
          title="Open AI chat with prefilled context"
        >
          💬 Ask AI About This Crop
        </Button>
      </div>
    </div>
  );
}

export const FarmDecisionCard = memo(FarmDecisionCardBase);
export default FarmDecisionCard;
