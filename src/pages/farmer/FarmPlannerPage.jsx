import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getPlannerRecommendations } from "../../services/farmingGuideService.js";
import { Card } from "../../components/common/Card.jsx";
import { Button } from "../../components/common/Button.jsx";
import { Input } from "../../components/common/Input.jsx";
import { Select } from "../../components/common/Select.jsx";
import { Badge } from "../../components/common/Badge.jsx";
import { LoadingState } from "../../components/common/LoadingState.jsx";
import { Sparkles, Sprout, ShieldCheck, ExternalLink, ArrowRight, CloudRain, ShoppingBag } from "../../components/icons/Icons.jsx";

const SOIL_TYPES = ["Clay Loam", "Sandy Loam", "Red Sandy Soil", "Black Cotton Soil", "Alluvial Loam", "Clay"];
const WATER_LEVELS = ["High / Irrigated", "Moderate / Semi-irrigated", "Low / Rainfed"];

export default function FarmPlannerPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    location: "Thanjavur",
    district: "Thanjavur",
    soilType: "Clay Loam",
    ph: "6.5",
    landArea: "3.0",
    waterAvailability: "High / Irrigated",
    season: "Kharif",
    budget: "50000",
    previousCrop: "Maize"
  });

  const [recommendations, setRecommendations] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleRecommend = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await getPlannerRecommendations(form);
      if (res.success) {
        setRecommendations(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fc-container animate-fade-in" style={{ padding: "24px 0" }}>
      {/* Signature Banner */}
      <div className="fc-card" style={{ background: "linear-gradient(135deg, #1b4332 0%, #2d6a4f 100%)", color: "white", padding: "32px", borderRadius: "16px", marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
          <Sparkles size={32} color="#ffd166" />
          <h1 style={{ fontSize: "32px", fontWeight: "800", margin: 0, color: "#ffffff" }}>"What Should I Farm?"</h1>
        </div>
        <p style={{ color: "#d8f3dc", margin: "4px 0 0", fontSize: "16px", maxWidth: "700px" }}>
          FarmConnect Signature Crop Planner. Deterministically matches your soil, water, season, location, and previous crop with verified agronomy, weather advice, active market prices, government schemes, and value addition options.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: "24px" }}>
        {/* Planner Inputs Form */}
        <Card style={{ padding: "24px", height: "fit-content" }}>
          <h3 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Sprout size={20} color="var(--primary)" /> Your Land & Season Inputs
          </h3>
          <form onSubmit={handleRecommend} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label style={{ fontSize: "13px", fontWeight: "600", marginBottom: "4px", display: "block" }}>District / Location *</label>
              <Input value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value, location: e.target.value })} required />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", marginBottom: "4px", display: "block" }}>Soil Texture</label>
                <Select value={form.soilType} onChange={(e) => setForm({ ...form, soilType: e.target.value })}>
                  {SOIL_TYPES.map(st => <option key={st} value={st}>{st}</option>)}
                </Select>
              </div>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", marginBottom: "4px", display: "block" }}>Soil pH</label>
                <Input type="number" step="0.1" value={form.ph} onChange={(e) => setForm({ ...form, ph: e.target.value })} placeholder="6.5" />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", marginBottom: "4px", display: "block" }}>Land Area (Acres)</label>
                <Input type="number" step="0.5" value={form.landArea} onChange={(e) => setForm({ ...form, landArea: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", marginBottom: "4px", display: "block" }}>Target Season</label>
                <Select value={form.season} onChange={(e) => setForm({ ...form, season: e.target.value })}>
                  <option value="Kharif">Kharif (Monsoon)</option>
                  <option value="Rabi">Rabi (Winter)</option>
                  <option value="Summer">Summer (Zaid)</option>
                </Select>
              </div>
            </div>

            <div>
              <label style={{ fontSize: "13px", fontWeight: "600", marginBottom: "4px", display: "block" }}>Water Availability</label>
              <Select value={form.waterAvailability} onChange={(e) => setForm({ ...form, waterAvailability: e.target.value })}>
                {WATER_LEVELS.map(wl => <option key={wl} value={wl}>{wl}</option>)}
              </Select>
            </div>

            <div>
              <label style={{ fontSize: "13px", fontWeight: "600", marginBottom: "4px", display: "block" }}>Previous Harvested Crop</label>
              <Input placeholder="e.g. Rice, Maize" value={form.previousCrop} onChange={(e) => setForm({ ...form, previousCrop: e.target.value })} />
            </div>

            <div>
              <label style={{ fontSize: "13px", fontWeight: "600", marginBottom: "4px", display: "block" }}>Budget Limit (₹)</label>
              <Input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} placeholder="e.g. 50000" />
            </div>

            <Button type="submit" loading={loading} style={{ marginTop: "8px" }}>
              Generate Crop Rankings
            </Button>
          </form>
        </Card>

        {/* Output Ranking List */}
        <div>
          {loading ? (
            <LoadingState text="Executing multi-factor crop recommendation engine..." />
          ) : !recommendations ? (
            <Card style={{ padding: "40px", textAlign: "center" }}>
              <Sparkles size={48} color="var(--primary)" style={{ marginBottom: "16px" }} />
              <h3 style={{ fontSize: "18px", color: "var(--text-secondary)" }}>Click "Generate Crop Rankings" to discover optimal crops for your land.</h3>
            </Card>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <h2 style={{ fontSize: "20px", fontWeight: "700", margin: 0 }}>
                Top Crop Recommendations for {form.district} ({form.landArea} Acres, {form.season})
              </h2>

              {recommendations.map((rec, idx) => (
                <Card key={rec.cropId} style={{ padding: "24px", borderLeft: `6px solid ${idx === 0 ? "#2d6a4f" : idx === 1 ? "#0077b6" : "var(--border)"}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <h3 style={{ fontSize: "22px", fontWeight: "700", margin: 0 }}>#{idx + 1} {rec.crop}</h3>
                        <Badge variant="success">{rec.category}</Badge>
                      </div>
                      <span style={{ fontSize: "13px", fontStyle: "italic", color: "var(--text-muted)" }}>{rec.scientificName}</span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <Badge variant={rec.compatibilityScore >= 75 ? "success" : "warning"} style={{ fontSize: "15px", padding: "6px 14px" }}>
                        {rec.compatibilityScore}% MATCH
                      </Badge>
                    </div>
                  </div>

                  <p style={{ fontSize: "14px", color: "var(--text-primary)", fontWeight: "500", marginBottom: "14px" }}>
                    <strong>Why Recommended:</strong> {rec.whyRecommended}
                  </p>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px", background: "var(--bg-subtle)", padding: "12px", borderRadius: "8px" }}>
                    <div><strong>Soil Match:</strong> {rec.soilSuitability}</div>
                    <div><strong>Season:</strong> {rec.seasonSuitability}</div>
                    <div><strong>Water Match:</strong> {rec.waterSuitability}</div>
                    <div><strong>Crop Duration:</strong> {rec.durationDays ? `${rec.durationDays} Days` : "Seasonal"}</div>
                  </div>

                  {/* Weather Advice */}
                  <div style={{ fontSize: "13px", color: "#1b4332", background: "#e8f5e9", padding: "10px 14px", borderRadius: "6px", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <CloudRain size={16} /> <strong>Weather Consideration:</strong> {rec.weatherConsiderations}
                  </div>

                  {/* Active Market Info */}
                  {rec.marketInformation && rec.marketInformation.averagePrice && (
                    <div style={{ fontSize: "13px", color: "#0077b6", background: "#e0f3fe", padding: "10px 14px", borderRadius: "6px", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                      <ShoppingBag size={16} /> <strong>Active Marketplace Price:</strong> ₹{rec.marketInformation.averagePrice} / {rec.marketInformation.unit} ({rec.marketInformation.source})
                    </div>
                  )}

                  {/* Relevant Government Schemes */}
                  {rec.relevantGovernmentSchemes && rec.relevantGovernmentSchemes.length > 0 && (
                    <div style={{ marginBottom: "12px" }}>
                      <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--primary)" }}>Applicable Government Support:</span>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "6px" }}>
                        {rec.relevantGovernmentSchemes.map(gs => (
                          <Badge key={gs.id} variant="outline" style={{ background: "white", cursor: "pointer" }} onClick={() => window.open(gs.official_source_url, "_blank")}>
                            {gs.scheme_name} <ExternalLink size={10} style={{ marginLeft: "4px" }} />
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Relevant Value Addition */}
                  {rec.relevantValueAddition && rec.relevantValueAddition.length > 0 && (
                    <div style={{ marginBottom: "16px" }}>
                      <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--primary)" }}>Value Addition Opportunities:</span>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "6px" }}>
                        {rec.relevantValueAddition.map(vap => (
                          <Badge key={vap.id} variant="success" style={{ cursor: "pointer" }} onClick={() => navigate(`/farmer/value-addition/${vap.id}`)}>
                            {vap.product_name} ({vap.value_addition_multiplier}x Value)
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
                    <Button variant="outline" size="sm" onClick={() => navigate(`/farmer/farming-guide/crops/${rec.cropId}`)}>
                      View Complete Farming Guide &rarr;
                    </Button>
                    <Button size="sm" onClick={() => navigate("/farmer/farm-economics")}>
                      Calculate Economics & Profit &rarr;
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
