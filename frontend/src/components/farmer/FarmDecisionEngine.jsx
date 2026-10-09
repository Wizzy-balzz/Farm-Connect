import { useState, useEffect, useMemo, memo } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../../services/api.js";
import { FarmDecisionCard } from "./FarmDecisionCard.jsx";
import { FarmDecisionMap } from "./FarmDecisionMap.jsx";
import { calculateDistanceKm } from "../../services/mapProvider.js";

/**
 * FarmDecisionEngine — The Signature FarmConnect Hallmark Experience
 * Orchestrates the full journey:
 * Crop → Price → Demand → Location → AI Interpretation → Opportunity → Decision → Action
 */
function FarmDecisionEngineBase({ farmerProfile = null, myProducts = [], onOpenActionCenter }) {
  const navigate = useNavigate();

  // Determine available crops from inventory or fallback to standard regional crops
  const availableCrops = useMemo(() => {
    if (Array.isArray(myProducts) && myProducts.length > 0) {
      return myProducts.map((p) => ({
        name: p.name,
        product: p,
        stock: p.stock,
        unit: p.unit || "kg"
      }));
    }
    const primary = farmerProfile?.primaryCrop || "Tomato";
    return [
      { name: primary, product: null, stock: 0, unit: "kg" },
      { name: "Wheat", product: null, stock: 0, unit: "kg" },
      { name: "Potato", product: null, stock: 0, unit: "kg" }
    ];
  }, [myProducts, farmerProfile]);

  const [selectedCropName, setSelectedCropName] = useState(() => availableCrops[0]?.name || "Tomato");
  const [strategy, setStrategy] = useState(null);
  const [buyers, setBuyers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Active product item if present in inventory
  const activeProduct = useMemo(() => {
    return myProducts.find((p) => p.name.toLowerCase() === selectedCropName.toLowerCase()) || null;
  }, [myProducts, selectedCropName]);

  // Farmer's geographic profile
  const farmLocation = useMemo(() => ({
    lat: farmerProfile?.lat || 20.0059,
    lng: farmerProfile?.lng || 73.7898,
    farmName: farmerProfile?.farmName || "Green Valley Farms",
    region: farmerProfile?.region || "Maharashtra",
    district: farmerProfile?.district || "Nashik"
  }), [farmerProfile]);

  useEffect(() => {
    let isSubscribed = true;

    async function loadFacts() {
      setLoading(true);
      try {
        const stock = activeProduct?.stock || null;

        // 1. Fetch AI Selling Strategy
        const stratRes = await apiFetch("/api/ai/marketplace/selling-strategy", {
          method: "POST",
          body: JSON.stringify({
            commodity: selectedCropName,
            quantity: stock
          })
        });

        if (isSubscribed && stratRes?.success && stratRes.strategy) {
          setStrategy(stratRes.strategy);
        }

        // 2. Fetch Nearby Buyer Demands
        const buyerRes = await apiFetch(`/api/ai/marketplace/buyers?district=${encodeURIComponent(farmLocation.district)}&region=${encodeURIComponent(farmLocation.region)}`);
        if (isSubscribed && buyerRes?.success && Array.isArray(buyerRes.buyerOpportunities)) {
          const mappedBuyers = buyerRes.buyerOpportunities.map((b) => {
            const bLat = parseFloat(b.lat) || (farmLocation.lat + 0.18);
            const bLng = parseFloat(b.lng) || (farmLocation.lng + 0.22);
            const dist = calculateDistanceKm(farmLocation.lat, farmLocation.lng, bLat, bLng);
            return {
              ...b,
              distanceKm: dist,
              lat: bLat,
              lng: bLng
            };
          });

          const matchingBuyers = mappedBuyers.filter((b) =>
            b.productName?.toLowerCase().includes(selectedCropName.toLowerCase())
          );

          setBuyers(matchingBuyers.length > 0 ? matchingBuyers : mappedBuyers);
        }
      } catch (err) {
        console.warn("[FarmDecisionEngine] Strategy fetch warning:", err);
      } finally {
        if (isSubscribed) {
          setLoading(false);
        }
      }
    }

    void loadFacts();
    return () => {
      isSubscribed = false;
    };
  }, [selectedCropName, activeProduct, farmLocation]);

  const nearestBuyer = useMemo(() => {
    if (!buyers || buyers.length === 0) return null;
    return [...buyers].sort((a, b) => (a.distanceKm || 999) - (b.distanceKm || 999))[0];
  }, [buyers]);

  return (
    <div
      className="fc-hallmark-engine"
      style={{
        background: "var(--bg-soft)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg, 14px)",
        padding: "24px",
        marginBottom: "28px",
        boxShadow: "var(--shadow-sm)"
      }}
    >
      {/* Hallmark Header & Value Proposition */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14, marginBottom: "20px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span style={{ fontSize: "20px" }}>🌾</span>
            <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--brand)" }}>
              FARMCONNECT PRODUCT HALLMARK
            </span>
            <span style={{ fontSize: "10.5px", background: "var(--brand-light)", color: "var(--brand-dark)", padding: "1px 8px", borderRadius: "999px", fontWeight: 700 }}>
              Live Decision Flow
            </span>
          </div>
          <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "22px", fontWeight: 800, margin: 0, color: "var(--text)" }}>
            What should I do with my crop today?
          </h2>
          <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
            Real-time synthesis connecting <strong>Crop Health</strong>, <strong>Market Price</strong>, <strong>Buyer Demand</strong>, and <strong>Logistics</strong> into verified actions.
          </p>
        </div>

        {/* Crop Selector Tabs */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)", marginRight: 4 }}>Select Crop:</span>
          {availableCrops.map((c) => {
            const isSelected = c.name.toLowerCase() === selectedCropName.toLowerCase();
            return (
              <button
                key={c.name}
                type="button"
                onClick={() => setSelectedCropName(c.name)}
                style={{
                  background: isSelected ? "var(--brand)" : "var(--surface)",
                  color: isSelected ? "#ffffff" : "var(--text)",
                  border: isSelected ? "1.5px solid var(--brand-dark)" : "1px solid var(--border)",
                  borderRadius: "999px",
                  padding: "6px 14px",
                  fontSize: "12.5px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.2s"
                }}
              >
                <span>{c.name === "Tomato" ? "🍅" : c.name === "Wheat" ? "🌾" : "🥔"}</span>
                <span>{c.name}</span>
                {c.stock > 0 && (
                  <span
                    style={{
                      background: isSelected ? "rgba(255,255,255,0.25)" : "var(--bg-soft)",
                      padding: "1px 6px",
                      borderRadius: "10px",
                      fontSize: "10.5px"
                    }}
                  >
                    {c.stock} {c.unit}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Signature Dual Panel: Decision Card (Left) + Logistics Map (Right) */}
      <div className="fc-grid-2" style={{ gap: "20px", alignItems: "stretch" }}>
        <FarmDecisionCard
          crop={selectedCropName}
          inventoryItem={activeProduct}
          strategy={strategy}
          marketStats={strategy?.facts ? { avgPrice: parseFloat(strategy.facts.currentMedianPrice) || 32 } : null}
          nearestBuyer={nearestBuyer}
          loading={loading}
          onOpenChat={(prompt) => {
            window.dispatchEvent(new CustomEvent("fc-open-ai-chat", { detail: { prompt } }));
          }}
          onSellSmarter={() => {
            navigate("/farmer/sell-smarter", { state: { preselectedCrop: selectedCropName } });
          }}
          onViewBuyers={() => {
            const el = document.getElementById("farm-decision-map-section");
            el?.scrollIntoView({ behavior: "smooth" });
          }}
        />

        <div id="farm-decision-map-section" style={{ display: "flex", flexDirection: "column" }}>
          <FarmDecisionMap
            farmLocation={farmLocation}
            crop={selectedCropName}
            buyers={buyers}
            onSelectBuyer={(buyer) => {
              window.dispatchEvent(new CustomEvent("fc-open-ai-chat", {
                detail: {
                  prompt: `Analyze deal terms for buyer "${buyer.vendorName}" seeking ${buyer.qty || 100} kg of ${selectedCropName} at ₹${buyer.unitPrice || 32}/kg in ${buyer.deliveryDistrict || buyer.deliveryRegion}.`
                }
              }));
            }}
          />
        </div>
      </div>

      {/* Hallmark Cross-Capability Connectors */}
      <div
        style={{
          marginTop: "18px",
          padding: "12px 18px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md, 8px)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap", fontSize: "12.5px" }}>
          <span style={{ fontWeight: 700, color: "var(--brand-dark)" }}>Connected Intelligence:</span>
          <button
            type="button"
            className="fc-link-btn"
            onClick={() => navigate("/farmer/crop-health")}
            style={{ fontSize: "12.5px", display: "inline-flex", alignItems: "center", gap: 4 }}
          >
            🌱 Scan {selectedCropName} Health Vision →
          </button>
          <span style={{ color: "var(--border-strong)" }}>•</span>
          <button
            type="button"
            className="fc-link-btn"
            onClick={() => navigate("/farmer/sell-smarter")}
            style={{ fontSize: "12.5px", display: "inline-flex", alignItems: "center", gap: 4 }}
          >
            🤖 Autonomous Selling Agent →
          </button>
          <span style={{ color: "var(--border-strong)" }}>•</span>
          <button
            type="button"
            className="fc-link-btn"
            onClick={() => {
              if (onOpenActionCenter) onOpenActionCenter();
            }}
            style={{ fontSize: "12.5px", display: "inline-flex", alignItems: "center", gap: 4 }}
          >
            📋 Copilot Action Center →
          </button>
        </div>

        <div style={{ fontSize: "11px", color: "var(--text-soft)" }}>
          Human-in-the-loop: Every commercial mutation requires explicit confirmation
        </div>
      </div>
    </div>
  );
}

export const FarmDecisionEngine = memo(FarmDecisionEngineBase);
export default FarmDecisionEngine;
