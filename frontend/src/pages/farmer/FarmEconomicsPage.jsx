import { useState } from "react";
import { calculateEconomics } from "../../services/farmingGuideService.js";
import { Card } from "../../components/common/Card.jsx";
import { Button } from "../../components/common/Button.jsx";
import { Input } from "../../components/common/Input.jsx";
import { Select } from "../../components/common/Select.jsx";
import { Badge } from "../../components/common/Badge.jsx";
import { DollarSign, TrendingUp, AlertTriangle, Calculator, Sparkles } from "../../components/icons/Icons.jsx";

export default function FarmEconomicsPage() {
  const [form, setForm] = useState({
    cropName: "Rice",
    areaAcres: "2.5",
    seedCost: "2500",
    fertilizerCost: "6000",
    labourCost: "8000",
    irrigationCost: "2000",
    pestCost: "1500",
    transportCost: "1200",
    otherCost: "800",
    expectedYieldQty: "5000",
    expectedYieldUnit: "kg",
    expectedSellingPrice: "25"
  });

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleCalculate = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await calculateEconomics(form);
      if (res.success) {
        setResult(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fc-container animate-fade-in" style={{ padding: "24px 0" }}>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: "700", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
          <Calculator size={28} color="var(--primary)" /> Farm Economics Calculator
        </h1>
        <p style={{ color: "var(--text-secondary)", margin: "4px 0 0", fontSize: "14px" }}>
          Server-side cost, revenue, and profit per acre estimation engine.
        </p>
      </div>

      {/* Mandatory Notice */}
      <div style={{ background: "#fff3cd", borderLeft: "4px solid #ffc107", color: "#856404", padding: "14px 18px", borderRadius: "8px", marginBottom: "24px", fontSize: "14px", display: "flex", alignItems: "center", gap: "10px" }}>
        <AlertTriangle size={20} />
        <div>
          <strong>PROJECTION NOTICE:</strong> All calculations are server-side ESTIMATES. Realized revenue depends on weather, actual yield, and market prices.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        {/* Form Inputs */}
        <Card style={{ padding: "24px" }}>
          <h3 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "16px" }}>Crop & Cost Breakdown Inputs</h3>
          <form onSubmit={handleCalculate} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", marginBottom: "4px", display: "block" }}>Crop Name</label>
                <Input value={form.cropName} onChange={(e) => setForm({ ...form, cropName: e.target.value })} required />
              </div>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", marginBottom: "4px", display: "block" }}>Cultivation Area (Acres)</label>
                <Input type="number" step="0.1" value={form.areaAcres} onChange={(e) => setForm({ ...form, areaAcres: e.target.value })} required />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", marginBottom: "4px", display: "block" }}>Seed Cost (₹)</label>
                <Input type="number" value={form.seedCost} onChange={(e) => setForm({ ...form, seedCost: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", marginBottom: "4px", display: "block" }}>Fertilizer & Nutrient Cost (₹)</label>
                <Input type="number" value={form.fertilizerCost} onChange={(e) => setForm({ ...form, fertilizerCost: e.target.value })} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", marginBottom: "4px", display: "block" }}>Labour Cost (₹)</label>
                <Input type="number" value={form.labourCost} onChange={(e) => setForm({ ...form, labourCost: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", marginBottom: "4px", display: "block" }}>Irrigation Cost (₹)</label>
                <Input type="number" value={form.irrigationCost} onChange={(e) => setForm({ ...form, irrigationCost: e.target.value })} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", marginBottom: "4px", display: "block" }}>Pest Management (₹)</label>
                <Input type="number" value={form.pestCost} onChange={(e) => setForm({ ...form, pestCost: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", marginBottom: "4px", display: "block" }}>Transport (₹)</label>
                <Input type="number" value={form.transportCost} onChange={(e) => setForm({ ...form, transportCost: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", marginBottom: "4px", display: "block" }}>Other Expenses (₹)</label>
                <Input type="number" value={form.otherCost} onChange={(e) => setForm({ ...form, otherCost: e.target.value })} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", background: "var(--bg-subtle)", padding: "16px", borderRadius: "8px" }}>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", marginBottom: "4px", display: "block" }}>Expected Yield Qty</label>
                <Input type="number" value={form.expectedYieldQty} onChange={(e) => setForm({ ...form, expectedYieldQty: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", marginBottom: "4px", display: "block" }}>Yield Unit</label>
                <Select value={form.expectedYieldUnit} onChange={(e) => setForm({ ...form, expectedYieldUnit: e.target.value })}>
                  <option value="kg">kg</option>
                  <option value="quintal">quintal</option>
                  <option value="tonne">tonne</option>
                </Select>
              </div>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", marginBottom: "4px", display: "block" }}>Selling Price (₹/{form.expectedYieldUnit})</label>
                <Input type="number" value={form.expectedSellingPrice} onChange={(e) => setForm({ ...form, expectedSellingPrice: e.target.value })} />
              </div>
            </div>

            <Button type="submit" loading={loading} style={{ marginTop: "8px" }}>
              Calculate Server-Side Economics
            </Button>
          </form>
        </Card>

        {/* Calculation Output */}
        <div>
          {!result ? (
            <Card style={{ padding: "40px", textAlign: "center" }}>
              <Calculator size={48} color="var(--text-muted)" style={{ marginBottom: "16px" }} />
              <h3 style={{ fontSize: "18px", color: "var(--text-secondary)" }}>Fill in your cultivation costs & expected yield to calculate estimated profit.</h3>
            </Card>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <Card style={{ padding: "24px", background: "linear-gradient(135deg, #1b4332 0%, #2d6a4f 100%)", color: "white" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <h3 style={{ fontSize: "20px", fontWeight: "700", margin: 0, color: "#ffffff" }}>{result.cropName} Economics Summary</h3>
                  <Badge variant="success" style={{ background: "rgba(255,255,255,0.2)", color: "white" }}>ESTIMATE ONLY</Badge>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
                  <div style={{ background: "rgba(255,255,255,0.1)", padding: "16px", borderRadius: "10px" }}>
                    <div style={{ fontSize: "13px", color: "#d8f3dc" }}>Total Production Cost</div>
                    <div style={{ fontSize: "24px", fontWeight: "700", color: "#ffffff" }}>₹{result.totalCost.toLocaleString("en-IN")}</div>
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.1)", padding: "16px", borderRadius: "10px" }}>
                    <div style={{ fontSize: "13px", color: "#d8f3dc" }}>Expected Gross Revenue</div>
                    <div style={{ fontSize: "24px", fontWeight: "700", color: "#ffffff" }}>₹{result.expectedRevenue.toLocaleString("en-IN")}</div>
                  </div>
                </div>

                <div style={{ background: result.estimatedProfit >= 0 ? "rgba(45, 106, 79, 0.4)" : "rgba(183, 9, 76, 0.4)", padding: "20px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.3)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: "14px", color: "#d8f3dc" }}>Estimated Total Net Profit</div>
                      <div style={{ fontSize: "32px", fontWeight: "800", color: "#ffffff" }}>₹{result.estimatedProfit.toLocaleString("en-IN")}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "13px", color: "#d8f3dc" }}>Estimated Profit / Acre</div>
                      <div style={{ fontSize: "22px", fontWeight: "700", color: "#ffffff" }}>₹{Math.round(result.profitPerAcre).toLocaleString("en-IN")} / acre</div>
                    </div>
                  </div>
                </div>
              </Card>

              <Card style={{ padding: "24px" }}>
                <h4 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "12px" }}>Detailed Cost Itemization</h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "14px" }}>
                  <div>Seed: ₹{result.costBreakdown.seedCost}</div>
                  <div>Fertilizer: ₹{result.costBreakdown.fertilizerCost}</div>
                  <div>Labour: ₹{result.costBreakdown.labourCost}</div>
                  <div>Irrigation: ₹{result.costBreakdown.irrigationCost}</div>
                  <div>Pest Control: ₹{result.costBreakdown.pestCost}</div>
                  <div>Transport: ₹{result.costBreakdown.transportCost}</div>
                  <div>Other: ₹{result.costBreakdown.otherCost}</div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
