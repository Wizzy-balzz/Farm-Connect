import { useState, useEffect, memo } from "react";
import { apiFetch } from "../../services/api.js";
import { Button } from "../common/Button.jsx";
import { Badge } from "../common/Badge.jsx";
import { Card } from "../common/Card.jsx";
import { TrendingUp } from "../icons/Icons.jsx";

function formatApiError(err, fallbackMessage) {
  if (!err) return fallbackMessage;

  if (err.status === 401) {
    return "Session expired or authentication required. Please sign in again.";
  }
  if (err.status === 403) {
    return err.message && !err.message.includes("undefined")
      ? err.message
      : "Access denied. You do not have permission to access this marketplace feature.";
  }
  if (err.status === 429) {
    return "Too many requests. Please wait a moment before trying again.";
  }
  if (err.status >= 500 && err.status < 600) {
    return "Server error encountered while processing your request. Please try again later.";
  }
  if (err.status) {
    return err.message || fallbackMessage;
  }

  // Native fetch/network connectivity failure (no HTTP response status)
  return "Network error connecting to marketplace services. Please check your connection and try again.";
}

function MarketplaceAgentBase({ onActionProposal, onSendChatMessage }) {
  const [activeTab, setActiveTab] = useState("recommendation"); // "recommendation" | "plan" | "compare" | "opportunities"
  const [selectedCrop, setSelectedCrop] = useState("Tomato");
  const [quantityInput, setQuantityInput] = useState("100");
  const [loading, setLoading] = useState(false);
  const [strategyResult, setStrategyResult] = useState(null);
  const [planResult, setPlanResult] = useState(null);
  const [compareResult, setCompareResult] = useState(null);
  const [oppResult, setOppResult] = useState(null);
  const [error, setError] = useState(null);

  // Fetch initial opportunities on mount
  useEffect(() => {
    let active = true;
    apiFetch("/api/ai/marketplace/opportunities")
      .then((res) => {
        if (active && res?.success) {
          setOppResult(res.opportunities || []);
        }
      })
      .catch(() => {
        // silent catch
      });
    return () => {
      active = false;
    };
  }, []);

  const fetchStrategy = async (crop = selectedCrop, qty = quantityInput) => {
    setLoading(true);
    setError(null);
    try {
      const numQty = parseFloat(qty);
      const res = await apiFetch("/api/ai/marketplace/selling-strategy", {
        method: "POST",
        body: JSON.stringify({
          commodity: crop,
          quantity: !isNaN(numQty) && numQty > 0 ? numQty : null
        })
      });
      if (res.success && res.strategy) {
        setStrategyResult(res.strategy);
      } else {
        setError(res.error?.message || "Failed to generate selling strategy");
      }
    } catch (err) {
      setError(formatApiError(err, "Failed to generate selling strategy. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const fetchSellingPlan = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/ai/marketplace/selling-plan", {
        method: "POST",
        body: JSON.stringify({})
      });
      if (res.success) {
        setPlanResult(res.plan || []);
      } else {
        setError(res.error?.message || "Failed to generate selling plan");
      }
    } catch (err) {
      setError(formatApiError(err, "Failed to generate selling plan. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const fetchComparison = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/ai/marketplace/compare", {
        method: "POST",
        body: JSON.stringify({ commodities: ["Tomato", "Onion", "Wheat"] })
      });
      if (res.success) {
        setCompareResult(res.comparison || []);
      } else {
        setError(res.error?.message || "Failed to compare crops");
      }
    } catch (err) {
      setError(formatApiError(err, "Failed to run comparison. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const renderBadge = (rec) => {
    switch (rec) {
      case "SELL_NOW":
        return <Badge variant="success">🛒 SELL NOW</Badge>;
      case "PARTIAL_SELL":
        return <Badge variant="warning">⚖️ PARTIAL SELL</Badge>;
      case "WAIT":
        return <Badge variant="info">⏳ WAIT & HOLD</Badge>;
      case "LIST_NOW":
        return <Badge variant="primary">📢 LIST NOW</Badge>;
      default:
        return <Badge variant="neutral">ℹ️ MORE DATA NEEDED</Badge>;
    }
  };

  return (
    <Card padded={false} style={{ background: "var(--surface)", border: "1px solid var(--border)", overflow: "hidden" }}>
      {/* Top Header */}
      <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", background: "var(--bg-soft)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "11.5px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--brand)" }}>
              <TrendingUp size={14} /> AI SELLING INTELLIGENCE
            </div>
            <h2 className="fc-h2" style={{ margin: "4px 0 2px 0", color: "var(--text)" }}>
              Marketplace & Selling Agent
            </h2>
            <p className="fc-muted" style={{ margin: 0, fontSize: "13px" }}>
              Algorithmic selling advice, price intelligence & harvest scheduling backed by live market demand.
            </p>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <Button
              variant={activeTab === "recommendation" ? "primary" : "outline"}
              size="sm"
              onClick={() => { setActiveTab("recommendation"); fetchStrategy(); }}
            >
              🎯 Single Crop
            </Button>
            <Button
              variant={activeTab === "plan" ? "primary" : "outline"}
              size="sm"
              onClick={() => { setActiveTab("plan"); fetchSellingPlan(); }}
            >
              📋 Selling Plan
            </Button>
            <Button
              variant={activeTab === "compare" ? "primary" : "outline"}
              size="sm"
              onClick={() => { setActiveTab("compare"); fetchComparison(); }}
            >
              ⚖️ Compare Crops
            </Button>
          </div>
        </div>
      </div>

      <div style={{ padding: "20px 24px" }}>
        {error && (
          <div style={{ background: "var(--danger-light)", border: "1px solid var(--danger-border)", color: "var(--danger)", padding: "12px 16px", borderRadius: "var(--radius-sm)", marginBottom: "16px", fontSize: "13px" }}>
            {error}
          </div>
        )}

        {/* TAB 1: SINGLE CROP RECOMMENDATION */}
        {activeTab === "recommendation" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Input Controls */}
            <div style={{ background: "var(--bg-soft)", padding: "16px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", display: "flex", flexWrap: "wrap", gap: "14px", alignItems: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "11.5px", fontWeight: 700, color: "var(--text-muted)" }}>Crop Name</label>
                <input
                  type="text"
                  value={selectedCrop}
                  onChange={(e) => setSelectedCrop(e.target.value)}
                  placeholder="e.g. Tomato, Onion"
                  className="fc-input"
                  style={{ width: "150px", padding: "6px 10px", fontSize: "13px" }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "11.5px", fontWeight: 700, color: "var(--text-muted)" }}>Quantity (kg)</label>
                <input
                  type="number"
                  value={quantityInput}
                  onChange={(e) => setQuantityInput(e.target.value)}
                  placeholder="100"
                  className="fc-input"
                  style={{ width: "120px", padding: "6px 10px", fontSize: "13px" }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "flex-end", marginTop: "auto" }}>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => fetchStrategy()}
                  disabled={loading}
                >
                  {loading ? "Analyzing Market..." : "Analyze Market Strategy"}
                </Button>
              </div>
            </div>

            {/* Quick Natural Prompt Chips */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center", fontSize: "12px" }}>
              <span className="fc-muted" style={{ fontWeight: 600 }}>Quick Inquiries:</span>
              <button
                type="button"
                onClick={() => { setSelectedCrop("Tomato"); setQuantityInput("100"); fetchStrategy("Tomato", "100"); }}
                className="fc-radio-chip"
                style={{ fontSize: "11.5px", padding: "4px 10px" }}
              >
                "I have 100 kg tomato. Should I sell now?"
              </button>
              <button
                type="button"
                onClick={() => { setSelectedCrop("Onion"); setQuantityInput("50"); fetchStrategy("Onion", "50"); }}
                className="fc-radio-chip"
                style={{ fontSize: "11.5px", padding: "4px 10px" }}
              >
                "50 kg onion selling advice"
              </button>
            </div>

            {/* Strategy Card Output */}
            {strategyResult && (
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "20px", display: "flex", flexDirection: "column", gap: "16px", boxShadow: "var(--shadow-sm)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: "12px", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <h3 className="fc-h3" style={{ margin: 0, color: "var(--brand-dark)" }}>
                      {strategyResult.targetCommodity} Selling Recommendation
                    </h3>
                    {strategyResult.targetQuantity && (
                      <p className="fc-muted" style={{ margin: "2px 0 0 0", fontSize: "12px" }}>
                        Target Volume: <strong>{strategyResult.targetQuantity} kg</strong>
                      </p>
                    )}
                  </div>
                  <div>{renderBadge(strategyResult.recommendation)}</div>
                </div>

                {/* Estimated Gross Revenue */}
                {strategyResult.grossRevenueText && (
                  <div style={{ background: "var(--brand-light)", border: "1px solid var(--brand-border)", padding: "12px 16px", borderRadius: "var(--radius-sm)", color: "var(--brand-dark)", fontWeight: 700, fontSize: "15px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>💰 {strategyResult.grossRevenueText}</span>
                    <span style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-muted)" }}>Estimated Gross Realization</span>
                  </div>
                )}

                {/* Verified FACTS Grid */}
                <div>
                  <h4 style={{ fontSize: "11.5px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: "8px" }}>
                    📊 Verified Agricultural Marketplace Facts
                  </h4>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
                    <div style={{ background: "var(--bg-soft)", padding: "10px 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                      <span className="fc-soft" style={{ fontSize: "11px", display: "block" }}>Farm Inventory Stock</span>
                      <span style={{ fontWeight: 700, fontSize: "13px", color: "var(--text)" }}>{strategyResult.facts.inventoryStock}</span>
                    </div>
                    <div style={{ background: "var(--bg-soft)", padding: "10px 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                      <span className="fc-soft" style={{ fontSize: "11px", display: "block" }}>Current Median Price</span>
                      <span style={{ fontWeight: 700, fontSize: "13px", color: "var(--brand)" }}>{strategyResult.facts.currentMedianPrice}</span>
                    </div>
                    <div style={{ background: "var(--bg-soft)", padding: "10px 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                      <span className="fc-soft" style={{ fontSize: "11px", display: "block" }}>Marketplace Price Band</span>
                      <span style={{ fontWeight: 700, fontSize: "13px", color: "var(--text)" }}>{strategyResult.facts.priceRange}</span>
                    </div>
                    <div style={{ background: "var(--bg-soft)", padding: "10px 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                      <span className="fc-soft" style={{ fontSize: "11px", display: "block" }}>Wholesale Demand Trend</span>
                      <span style={{ fontWeight: 700, fontSize: "13px", textTransform: "capitalize", color: "var(--text)" }}>{strategyResult.facts.demandTrend}</span>
                    </div>
                    <div style={{ background: "var(--bg-soft)", padding: "10px 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                      <span className="fc-soft" style={{ fontSize: "11px", display: "block" }}>Weather Conditions</span>
                      <span style={{ fontWeight: 700, fontSize: "13px", color: "var(--accent)" }}>{strategyResult.facts.weatherConditions}</span>
                    </div>
                  </div>
                </div>

                {/* Objective REASONING */}
                <div>
                  <h4 style={{ fontSize: "11.5px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: "6px" }}>
                    🧠 Agronomic & Market Reasoning
                  </h4>
                  <div style={{ background: "var(--bg)", padding: "14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", fontSize: "13px", lineHeight: "1.6", color: "var(--text)" }}>
                    {strategyResult.reasoning}
                  </div>
                </div>

                {/* Action Trigger Buttons */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", paddingTop: "12px", borderTop: "1px solid var(--border)" }}>
                  {strategyResult.recommendation === "LIST_NOW" && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        if (onSendChatMessage) {
                          onSendChatMessage(`Propose creating a product listing for ${strategyResult.targetCommodity} with 100 kg at ${strategyResult.facts.currentMedianPrice || "₹40/kg"}`);
                        } else if (onActionProposal) {
                          onActionProposal("CREATE_LISTING", { commodity: strategyResult.targetCommodity });
                        }
                      }}
                    >
                      📝 Create Harvest Listing
                    </Button>
                  )}
                  {(strategyResult.recommendation === "SELL_NOW" || strategyResult.recommendation === "PARTIAL_SELL") && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        if (onSendChatMessage) {
                          onSendChatMessage(`Prepare action proposal to adjust listing price or inventory for ${strategyResult.targetCommodity}`);
                        } else if (onActionProposal) {
                          onActionProposal("ADJUST_PRICE", { commodity: strategyResult.targetCommodity });
                        }
                      }}
                    >
                      ⚡ Review & Propose Sale Action
                    </Button>
                  )}
                </div>

                {/* Disclaimer */}
                <p className="fc-soft" style={{ fontSize: "11px", margin: 0, fontStyle: "italic" }}>
                  ⚠️ {strategyResult.disclaimer || "AI-assisted selling guidance is calculated from real market observations and historical volumes. All transactions require explicit farmer sign-off."}
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: FARM SELLING PLAN */}
        {activeTab === "plan" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 className="fc-h3" style={{ margin: 0 }}>
                Comprehensive Farm Selling Plan
              </h3>
              <Button variant="outline" size="sm" onClick={fetchSellingPlan} disabled={loading}>
                {loading ? "Generating..." : "Refresh Plan"}
              </Button>
            </div>

            {planResult && planResult.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "14px" }}>
                {planResult.map((item, idx) => (
                  <div key={idx} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}>
                      <span style={{ fontWeight: 800, fontSize: "14px", color: "var(--brand-dark)" }}>{item.product}</span>
                      {renderBadge(item.recommendation)}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "12px" }}>
                      <div><span className="fc-soft">Inventory:</span> <strong>{item.inventory}</strong></div>
                      <div><span className="fc-soft">Market:</span> <strong>{item.marketSituation}</strong></div>
                      <div><span className="fc-soft">Suggested Qty:</span> <strong>{item.suggestedQuantity}</strong></div>
                      <div><span className="fc-soft">Timing:</span> <strong>{item.suggestedTiming}</strong></div>
                    </div>
                    <p style={{ fontSize: "12px", color: "var(--text-secondary)", background: "var(--bg-soft)", padding: "8px 10px", borderRadius: "var(--radius-xs)", margin: 0 }}>
                      {item.reasoning}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="fc-soft" style={{ fontSize: "13px", padding: "20px 0", textAlign: "center" }}>
                Click "Refresh Plan" to analyze your farm's harvest lots and generate an automated multi-crop selling schedule.
              </p>
            )}
          </div>
        )}

        {/* TAB 3: COMPARE CROPS */}
        {activeTab === "compare" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 className="fc-h3" style={{ margin: 0 }}>
                Side-by-Side Crop Comparison
              </h3>
              <Button variant="outline" size="sm" onClick={fetchComparison} disabled={loading}>
                {loading ? "Comparing..." : "Run Comparison"}
              </Button>
            </div>

            {compareResult && compareResult.length > 0 && (
              <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}>
                <table className="fc-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px" }}>
                  <thead>
                    <tr style={{ background: "var(--bg-soft)", borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                      <th style={{ padding: "10px 14px" }}>Crop</th>
                      <th style={{ padding: "10px 14px" }}>Inventory</th>
                      <th style={{ padding: "10px 14px" }}>Current Median</th>
                      <th style={{ padding: "10px 14px" }}>Demand Signal</th>
                      <th style={{ padding: "10px 14px" }}>Weather Risk</th>
                      <th style={{ padding: "10px 14px" }}>Recommendation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compareResult.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "10px 14px", fontWeight: 700, color: "var(--brand-dark)" }}>{row.commodity}</td>
                        <td style={{ padding: "10px 14px" }}>{row.inventory}</td>
                        <td style={{ padding: "10px 14px", fontWeight: 700, color: "var(--brand)" }}>{row.currentPrice}</td>
                        <td style={{ padding: "10px 14px", textTransform: "capitalize" }}>{row.demandTrend}</td>
                        <td style={{ padding: "10px 14px", color: "var(--accent)" }}>{row.weatherRisk}</td>
                        <td style={{ padding: "10px 14px" }}>{renderBadge(row.recommendation)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* OPPORTUNITIES ALERT STRIP */}
        {oppResult && oppResult.length > 0 && (
          <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px solid var(--border)" }}>
            <h4 style={{ fontSize: "12px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--accent)", margin: "0 0 10px 0" }}>
              ⚡ Real-Time Selling Opportunities ({oppResult.length})
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {oppResult.map((opp, i) => (
                <div key={i} style={{ background: "var(--accent-light)", border: "1px solid var(--accent-border)", padding: "12px 16px", borderRadius: "var(--radius-sm)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: "13px", color: "var(--accent-dark)", display: "block" }}>{opp.title}</span>
                    <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{opp.description}</span>
                  </div>
                  <div>{renderBadge(opp.action)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

export const MarketplaceAgent = memo(MarketplaceAgentBase);
export default MarketplaceAgent;
