import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Card from "../../components/common/Card.jsx";
import Button from "../../components/common/Button.jsx";
import Badge from "../../components/common/Badge.jsx";
import LoadingState from "../../components/common/LoadingState.jsx";
import { getValueAdditionFilters, getValueAdditionProductDetail, saveValueAdditionProject } from "../../services/valueAdditionService.js";
import {
  ArrowLeft,
  Sprout,
  Info,
  CheckCircle
} from "../../components/icons/Icons.jsx";

export default function ValueAdditionCalculatorPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialProductId = searchParams.get("product_id");

  const [cropsList, setCropsList] = useState([]);
  const [loading, setLoading] = useState(Boolean(initialProductId));

  // Input states
  const [cropName, setCropName] = useState("Tomato");
  const [rawQty, setRawQty] = useState(500);
  const [rawUnitPrice, setRawUnitPrice] = useState(20);
  const [procCost, setProcCost] = useState(1500);
  const [labourCost, setLabourCost] = useState(1000);
  const [pkgCost, setPkgCost] = useState(800);
  const [transCost, setTransCost] = useState(500);
  const [otherCosts, setOtherCosts] = useState(200);

  const [processedQty, setProcessedQty] = useState(200);
  const [processedUnitPrice, setProcessedUnitPrice] = useState(120);

  // Save Project States
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [projectNameInput, setProjectNameInput] = useState("");

  // Load available crops and pre-fill if product_id is passed
  useEffect(() => {
    let isMounted = true;
    getValueAdditionFilters()
      .then((data) => {
        if (isMounted && data?.crops) {
          setCropsList(data.crops);
        }
      })
      .catch((err) => console.warn("Could not load crops list:", err));

    if (initialProductId) {
      getValueAdditionProductDetail(initialProductId)
        .then((data) => {
          if (isMounted && data) {
            setCropName(data.crop_name || "Tomato");
            if (data.guide?.expected_yield_percentage) {
              const yieldPct = Number(data.guide.expected_yield_percentage) / 100;
              setProcessedQty(Math.round(500 * yieldPct));
            }
          }
        })
        .finally(() => {
          if (isMounted) setLoading(false);
        });
    }
    return () => { isMounted = false; };
  }, [initialProductId]);

  // Sanitize numeric inputs (prevent negative/invalid values)
  const sanitized = useMemo(() => {
    const qty = Math.max(0, Number(rawQty) || 0);
    const rawPrice = Math.max(0, Number(rawUnitPrice) || 0);
    const pCost = Math.max(0, Number(procCost) || 0);
    const lCost = Math.max(0, Number(labourCost) || 0);
    const pkgC = Math.max(0, Number(pkgCost) || 0);
    const tCost = Math.max(0, Number(transCost) || 0);
    const oCost = Math.max(0, Number(otherCosts) || 0);

    const outQty = Math.max(0, Number(processedQty) || 0);
    const outPrice = Math.max(0, Number(processedUnitPrice) || 0);

    // Raw Option Calculations
    const rawMaterialCost = qty * rawPrice;
    const rawRevenue = rawMaterialCost;

    // Value Addition Option Calculations
    const totalProcessingOverhead = pCost + lCost + pkgC + tCost + oCost;
    const totalCost = rawMaterialCost + totalProcessingOverhead;

    const estimatedRevenue = outQty * outPrice;
    const estimatedProfit = estimatedRevenue - totalCost;

    // Prevent division by zero
    const profitMargin = estimatedRevenue > 0 ? (estimatedProfit / estimatedRevenue) * 100 : 0;
    const netGainOverRaw = estimatedProfit - rawRevenue;

    return {
      qty,
      rawPrice,
      rawMaterialCost,
      rawRevenue,
      pCost,
      lCost,
      pkgC,
      tCost,
      oCost,
      totalProcessingOverhead,
      totalCost,
      outQty,
      outPrice,
      estimatedRevenue,
      estimatedProfit,
      profitMargin,
      netGainOverRaw
    };
  }, [rawQty, rawUnitPrice, procCost, labourCost, pkgCost, transCost, otherCosts, processedQty, processedUnitPrice]);

  const handleSaveProject = async () => {
    setSaving(true);
    setSaveSuccess(null);
    setSaveError(null);

    try {
      const payload = {
        project_name: projectNameInput.trim() || `Value Addition Project - ${cropName}`,
        crop_name: cropName,
        value_added_product_id: initialProductId || null,
        raw_quantity: sanitized.qty,
        raw_unit: "kg",
        raw_unit_price: sanitized.rawPrice,
        raw_material_cost: sanitized.rawMaterialCost,
        processing_cost: sanitized.pCost,
        labour_cost: sanitized.lCost,
        packaging_cost: sanitized.pkgC,
        transport_cost: sanitized.tCost,
        other_costs: sanitized.oCost,
        expected_processed_qty: sanitized.outQty,
        processed_unit: "kg",
        expected_selling_price: sanitized.outPrice
      };

      const saved = await saveValueAdditionProject(payload);
      setSaveSuccess(`Project "${saved.project_name}" saved successfully!`);
    } catch (err) {
      setSaveError(err.message || "Failed to save processing project.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fc-page animate-fade-in" style={{ paddingBottom: "50px" }}>
      {/* Back Navigation Bar */}
      <div style={{ marginBottom: "16px" }}>
        <Button variant="subtle" size="small" onClick={() => navigate("/farmer/value-addition")}>
          <ArrowLeft size={16} /> Back to Catalog
        </Button>
      </div>

      {/* Header */}
      <div className="fc-page-header" style={{ marginBottom: "20px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--primary)", fontWeight: 600, fontSize: "0.875rem", marginBottom: "4px" }}>
            <Sprout size={16} /> Decision Support System
          </div>
          <h1 className="fc-h1" style={{ margin: 0 }}>Value Addition Economics Calculator</h1>
          <p className="fc-muted" style={{ margin: "4px 0 0 0", fontSize: "0.875rem" }}>
            Compare financial returns of selling raw harvest versus processing into value-added products.
          </p>
        </div>
      </div>

      {/* Mandatory Disclaimer */}
      <div style={{
        padding: "12px 16px",
        borderRadius: "8px",
        background: "#eff6ff",
        border: "1px solid #bfdbfe",
        color: "#1e40af",
        fontSize: "0.85rem",
        marginBottom: "20px",
        display: "flex",
        alignItems: "flex-start",
        gap: "10px"
      }}>
        <Info size={18} style={{ marginTop: "2px", flexShrink: 0 }} />
        <div>
          <strong>Disclaimer & Estimation Notice:</strong> All calculations presented on this page are financial estimates intended solely for decision support. Actual market returns may vary based on local labor rates, batch yield variations, and fluctuating market prices.
        </div>
      </div>

      {loading && <LoadingState text="Loading product parameters..." />}

      {!loading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
          {/* Input Panel Card */}
          <Card padded>
            <h2 className="fc-h2" style={{ marginTop: 0, marginBottom: "16px" }}>Calculator Inputs</h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* Crop Selection */}
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>
                  Source Crop
                </label>
                <select
                  className="fc-input"
                  value={cropName}
                  onChange={(e) => setCropName(e.target.value)}
                  style={{ width: "100%" }}
                >
                  {cropsList.length > 0 ? (
                    cropsList.map((c) => <option key={c} value={c}>{c}</option>)
                  ) : (
                    <option value="Tomato">Tomato</option>
                  )}
                </select>
              </div>

              {/* Raw Quantity & Raw Unit Price */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>
                    Raw Harvest Quantity (kg)
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="fc-input"
                    value={rawQty}
                    onChange={(e) => setRawQty(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>
                    Raw Price (₹ / kg)
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="fc-input"
                    value={rawUnitPrice}
                    onChange={(e) => setRawUnitPrice(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>
              </div>

              <div style={{ padding: "8px 12px", background: "var(--bg-subtle, #f8fafc)", borderRadius: "6px", fontSize: "0.8rem", color: "var(--muted)" }}>
                Raw Crop Value: <strong>₹{sanitized.rawMaterialCost.toLocaleString()}</strong>
              </div>

              {/* Processing Cost Overheads */}
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
                <h4 style={{ margin: "0 0 10px 0", fontSize: "0.85rem", color: "var(--text-main)" }}>Processing & Operational Overheads (₹)</h4>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", color: "var(--muted)", marginBottom: "2px" }}>Processing / Energy (₹)</label>
                    <input type="number" min="0" className="fc-input" value={procCost} onChange={(e) => setProcCost(e.target.value)} style={{ width: "100%" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", color: "var(--muted)", marginBottom: "2px" }}>Labour Cost (₹)</label>
                    <input type="number" min="0" className="fc-input" value={labourCost} onChange={(e) => setLabourCost(e.target.value)} style={{ width: "100%" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", color: "var(--muted)", marginBottom: "2px" }}>Packaging Cost (₹)</label>
                    <input type="number" min="0" className="fc-input" value={pkgCost} onChange={(e) => setPkgCost(e.target.value)} style={{ width: "100%" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", color: "var(--muted)", marginBottom: "2px" }}>Transport / Logistics (₹)</label>
                    <input type="number" min="0" className="fc-input" value={transCost} onChange={(e) => setTransCost(e.target.value)} style={{ width: "100%" }} />
                  </div>
                </div>

                <div style={{ marginTop: "10px" }}>
                  <label style={{ display: "block", fontSize: "0.75rem", color: "var(--muted)", marginBottom: "2px" }}>Other Miscellaneous Costs (₹)</label>
                  <input type="number" min="0" className="fc-input" value={otherCosts} onChange={(e) => setOtherCosts(e.target.value)} style={{ width: "100%" }} />
                </div>
              </div>

              {/* Output Processed Output & Price */}
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
                <h4 style={{ margin: "0 0 10px 0", fontSize: "0.85rem", color: "var(--text-main)" }}>Expected Processed Output & Sale Price</h4>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", color: "var(--muted)", marginBottom: "2px" }}>Processed Qty (kg)</label>
                    <input type="number" min="0" className="fc-input" value={processedQty} onChange={(e) => setProcessedQty(e.target.value)} style={{ width: "100%" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", color: "var(--muted)", marginBottom: "2px" }}>Processed Price (₹ / kg)</label>
                    <input type="number" min="0" className="fc-input" value={processedUnitPrice} onChange={(e) => setProcessedUnitPrice(e.target.value)} style={{ width: "100%" }} />
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Results Comparison Card */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Raw Product Option */}
            <Card padded>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0, fontSize: "1rem", color: "var(--text-main)" }}>Option A: Raw Product Sale</h3>
                <Badge variant="neutral">Unprocessed</Badge>
              </div>

              <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--border)" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Estimated Raw Revenue</div>
                <div style={{ fontSize: "1.4rem", fontWeight: "bold", color: "var(--text-main)", marginTop: "2px" }}>
                  ₹{sanitized.rawRevenue.toLocaleString()}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "2px" }}>
                  ({sanitized.qty} kg × ₹{sanitized.rawPrice}/kg)
                </div>
              </div>
            </Card>

            {/* Value-Added Processed Option */}
            <Card padded style={{ border: "2px solid var(--primary)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0, fontSize: "1rem", color: "var(--primary)" }}>Option B: Value-Added Processed Sale</h3>
                <Badge variant="success">Value-Added</Badge>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginTop: "16px", paddingTop: "12px", borderTop: "1px solid var(--border)" }}>
                <div>
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>Total Cost</span>
                  <span style={{ fontSize: "1.1rem", fontWeight: "bold", color: "var(--text-main)" }}>
                    ₹{sanitized.totalCost.toLocaleString()}
                  </span>
                </div>

                <div>
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>Estimated Revenue</span>
                  <span style={{ fontSize: "1.1rem", fontWeight: "bold", color: "var(--primary)" }}>
                    ₹{sanitized.estimatedRevenue.toLocaleString()}
                  </span>
                </div>

                <div>
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>Estimated Net Profit</span>
                  <span style={{ fontSize: "1.25rem", fontWeight: "bold", color: sanitized.estimatedProfit >= 0 ? "#16a34a" : "#dc2626" }}>
                    ₹{sanitized.estimatedProfit.toLocaleString()}
                  </span>
                </div>

                <div>
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>Profit Margin</span>
                  <span style={{ fontSize: "1.25rem", fontWeight: "bold", color: sanitized.profitMargin >= 0 ? "#16a34a" : "#dc2626" }}>
                    {sanitized.profitMargin.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Net Comparison Highlight */}
              <div style={{
                marginTop: "16px",
                padding: "12px 14px",
                borderRadius: "6px",
                background: sanitized.netGainOverRaw >= 0 ? "#f0fdf4" : "#fef2f2",
                border: sanitized.netGainOverRaw >= 0 ? "1px solid #bbf7d0" : "1px solid #fecaca",
                color: sanitized.netGainOverRaw >= 0 ? "#15803d" : "#991b1b"
              }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase" }}>
                  Net Processing Benefit over Raw Sale
                </div>
                <div style={{ fontSize: "1.2rem", fontWeight: "bold", marginTop: "2px" }}>
                  {sanitized.netGainOverRaw >= 0 ? `+ ₹${sanitized.netGainOverRaw.toLocaleString()} Additional Net Income` : `- ₹${Math.abs(sanitized.netGainOverRaw).toLocaleString()} Loss vs Raw Sale`}
                </div>
              </div>
            </Card>

            {/* Explicit Save Project Action Panel */}
            <Card padded style={{ border: "1px dashed var(--primary)", background: "var(--bg-subtle, #f8fafc)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <h4 style={{ margin: 0, fontSize: "0.95rem", color: "var(--text-main)" }}>Save This Processing Plan</h4>
                <Badge variant="neutral">Explicit Save Only</Badge>
              </div>
              <p style={{ margin: "0 0 12px 0", fontSize: "0.8rem", color: "var(--muted)" }}>
                Save your calculated scenario to your personal project portfolio for future tracking.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", color: "var(--muted)", marginBottom: "4px" }}>
                    Project Title
                  </label>
                  <input
                    type="text"
                    className="fc-input"
                    placeholder={`e.g. ${cropName} Processing Plan`}
                    value={projectNameInput}
                    onChange={(e) => setProjectNameInput(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>

                {saveError && (
                  <div style={{ color: "var(--danger)", fontSize: "0.8rem" }}>
                    {saveError}
                  </div>
                )}

                {saveSuccess && (
                  <div style={{
                    color: "#15803d",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    padding: "10px 12px",
                    background: "#f0fdf4",
                    borderRadius: "6px",
                    border: "1px solid #bbf7d0",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px"
                  }}>
                    <CheckCircle size={16} /> {saveSuccess}
                  </div>
                )}

                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "4px" }}>
                  <Button
                    variant="primary"
                    onClick={handleSaveProject}
                    disabled={saving}
                    style={{ flex: 1 }}
                  >
                    {saving ? "Saving..." : "Save Project"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate("/farmer/value-addition/projects")}
                  >
                    My Saved Projects
                  </Button>
                </div>
              </div>
            </Card>

            {/* Total Cost Breakdown Accordion */}
            <Card padded>
              <h4 style={{ margin: "0 0 10px 0", fontSize: "0.85rem", color: "var(--muted)" }}>Transparent Cost Formula Breakdown</h4>
              <div style={{ fontSize: "0.8rem", display: "flex", flexDirection: "column", gap: "6px", color: "var(--text-main)" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Raw Material Cost:</span>
                  <strong>₹{sanitized.rawMaterialCost.toLocaleString()}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Processing / Energy:</span>
                  <strong>+ ₹{sanitized.pCost.toLocaleString()}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Labour Overhead:</span>
                  <strong>+ ₹{sanitized.lCost.toLocaleString()}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Packaging Material:</span>
                  <strong>+ ₹{sanitized.pkgC.toLocaleString()}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Transport & Freight:</span>
                  <strong>+ ₹{sanitized.tCost.toLocaleString()}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Other Miscellaneous:</span>
                  <strong>+ ₹{sanitized.oCost.toLocaleString()}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border)", paddingTop: "6px", fontWeight: "bold" }}>
                  <span>Total Calculated Cost:</span>
                  <span style={{ color: "var(--primary)" }}>₹{sanitized.totalCost.toLocaleString()}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
