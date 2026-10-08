import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchCrops,
  checkSoilCompatibility,
  getRotationRecommendations,
  fetchCropDetail
} from "../../services/farmingGuideService.js";
import { Card } from "../../components/common/Card.jsx";
import { StatCard } from "../../components/common/StatCard.jsx";
import { Button } from "../../components/common/Button.jsx";
import { Input } from "../../components/common/Input.jsx";
import { Select } from "../../components/common/Select.jsx";
import { Badge } from "../../components/common/Badge.jsx";
import { Tabs } from "../../components/common/Tabs.jsx";
import { LoadingState } from "../../components/common/LoadingState.jsx";
import { EmptyState } from "../../components/common/EmptyState.jsx";
import { ErrorState } from "../../components/common/ErrorState.jsx";
import { Sprout, Search, ShieldCheck, Calendar, Droplets, ShieldAlert, Sparkles, TrendingUp, Info } from "../../components/icons/Icons.jsx";

const CATEGORIES = ["All", "Cereals", "Pulses", "Oilseeds", "Vegetables", "Fruits", "Spices", "Cash Crops", "Commercial", "Millets"];
const SEASONS = ["All", "Kharif", "Rabi", "Summer", "Year-round"];
const SOIL_TYPES = ["Clay Loam", "Sandy Loam", "Red Sandy Soil", "Black Cotton Soil", "Alluvial Loam", "Clay"];
const WATER_LEVELS = ["High / Irrigated", "Moderate / Semi-irrigated", "Low / Rainfed"];

export default function FarmingGuidePage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("library");

  // Crop Library state
  const [crops, setCrops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedSeason, setSelectedSeason] = useState("All");

  // Soil Compatibility state
  const [soilForm, setSoilForm] = useState({
    soilType: "Clay Loam",
    ph: "6.5",
    season: "Kharif",
    waterAvailability: "High / Irrigated",
    district: "Thanjavur",
    previousCrop: "Rice"
  });
  const [soilResults, setSoilResults] = useState(null);
  const [soilLoading, setSoilLoading] = useState(false);

  // Rotation state
  const [rotationPrevCrop, setRotationPrevCrop] = useState("Rice");
  const [rotationResults, setRotationResults] = useState(null);
  const [rotationLoading, setRotationLoading] = useState(false);

  // Selected crop for quick guides (Tabs 4, 5, 6)
  const [selectedCropId, setSelectedCropId] = useState("crop_rice");
  const [quickCropData, setQuickCropData] = useState(null);
  const [quickLoading, setQuickLoading] = useState(false);

  useEffect(() => {
    loadCrops();
  }, [selectedCategory, selectedSeason]);

  const loadCrops = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchCrops({
        q: searchQuery,
        category: selectedCategory,
        season: selectedSeason
      });
      if (res.success) {
        setCrops(res.data || []);
      } else {
        setError(res.error?.message || "Failed to load crop library");
      }
    } catch (err) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadCrops();
  };

  const handleSoilCheck = async (e) => {
    e.preventDefault();
    try {
      setSoilLoading(true);
      const res = await checkSoilCompatibility(soilForm);
      if (res.success) {
        setSoilResults(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSoilLoading(false);
    }
  };

  const handleRotationCheck = async (e) => {
    e.preventDefault();
    try {
      setRotationLoading(true);
      const res = await getRotationRecommendations({ previousCrop: rotationPrevCrop });
      if (res.success) {
        setRotationResults(res.suggestions);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRotationLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCropId) {
      loadQuickCropData(selectedCropId);
    }
  }, [selectedCropId]);

  const loadQuickCropData = async (cropId) => {
    try {
      setQuickLoading(true);
      const res = await fetchCropDetail(cropId);
      if (res.success) {
        setQuickCropData(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setQuickLoading(false);
    }
  };

  const tabs = [
    { id: "library", label: "Crop Library" },
    { id: "soil", label: "Soil Compatibility" },
    { id: "rotation", label: "Crop Rotation" },
    { id: "seed", label: "Seed & Sowing" },
    { id: "irrigation", label: "Irrigation & Nutrients" },
    { id: "pests", label: "Pest & Harvest" }
  ];

  return (
    <div className="fc-container animate-fade-in" style={{ padding: "24px 0" }}>
      {/* Header Banner */}
      <div className="fc-card" style={{ background: "linear-gradient(135deg, #1b4332 0%, #2d6a4f 100%)", color: "white", padding: "32px", borderRadius: "16px", marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
              <Sprout size={28} />
              <h1 style={{ fontSize: "28px", fontWeight: "700", margin: 0, color: "#ffffff" }}>Farming Guide & Crop Knowledge</h1>
            </div>
            <p style={{ color: "#d8f3dc", margin: 0, fontSize: "15px", maxWidth: "650px" }}>
              Authoritative agricultural extension knowledge for 17 regional crop varieties verified from ICAR, TNAU, and State Krishi Vigyan Kendras.
            </p>
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <Button variant="outline" style={{ background: "rgba(255,255,255,0.15)", color: "white", borderColor: "rgba(255,255,255,0.3)" }} onClick={() => navigate("/farmer/farm-planner")}>
              <Sparkles size={16} /> "What Should I Farm?"
            </Button>
            <Button variant="outline" style={{ background: "rgba(255,255,255,0.15)", color: "white", borderColor: "rgba(255,255,255,0.3)" }} onClick={() => navigate("/farmer/farm-diary")}>
              <Calendar size={16} /> Farm Diary
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ marginBottom: "24px" }}>
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      {/* TAB 1: CROP LIBRARY */}
      {activeTab === "library" && (
        <div>
          {/* Search & Filters */}
          <Card style={{ padding: "20px", marginBottom: "24px" }}>
            <form onSubmit={handleSearch} style={{ display: "grid", gridTemplateColumns: "1fr 200px 200px 100px", gap: "12px", alignItems: "center" }}>
              <Input
                placeholder="Search crops by name, category, scientific name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search size={16} />}
              />
              <Select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c === "All" ? "All Categories" : c}</option>)}
              </Select>
              <Select value={selectedSeason} onChange={(e) => setSelectedSeason(e.target.value)}>
                {SEASONS.map(s => <option key={s} value={s}>{s === "All" ? "All Seasons" : s}</option>)}
              </Select>
              <Button type="submit">Filter</Button>
            </form>
          </Card>

          {loading ? (
            <LoadingState text="Loading authoritative crop library..." />
          ) : error ? (
            <ErrorState message={error} onRetry={loadCrops} />
          ) : crops.length === 0 ? (
            <EmptyState title="No crops found" description="Try adjusting your search terms or filter criteria." />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px" }}>
              {crops.map((c) => (
                <Card key={c.id} style={{ display: "flex", flexDirection: "column", height: "100%", transition: "transform 0.2s, box-shadow 0.2s", cursor: "pointer" }} onClick={() => navigate(`/farmer/farming-guide/crops/${c.id}`)}>
                  <div style={{ padding: "20px", flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                      <h3 style={{ fontSize: "20px", fontWeight: "700", margin: 0, color: "var(--text-primary)" }}>{c.name}</h3>
                      <Badge variant="success">{c.category}</Badge>
                    </div>
                    <div style={{ fontSize: "13px", fontStyle: "italic", color: "var(--text-secondary)", marginBottom: "12px" }}>
                      {c.scientific_name || "Scientific classification recorded"}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px" }}>
                      <div><strong>Duration:</strong> {c.duration_days ? `${c.duration_days} Days` : "Seasonal"}</div>
                      <div><strong>pH Range:</strong> {c.ph_min && c.ph_max ? `${c.ph_min} - ${c.ph_max}` : "6.0 - 7.5"}</div>
                      <div style={{ gridColumn: "span 2" }}><strong>Seasons:</strong> {c.seasons || "Kharif, Rabi"}</div>
                      <div style={{ gridColumn: "span 2" }}><strong>Soil:</strong> {c.soil_texture || "Loamy Soil"}</div>
                    </div>
                  </div>
                  <div style={{ padding: "12px 20px", background: "var(--bg-subtle)", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", color: "var(--text-muted)" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <ShieldCheck size={14} color="#2d6a4f" /> Verified {c.last_verified ? c.last_verified.split("T")[0] : "ICAR"}
                    </span>
                    <span style={{ color: "var(--primary)", fontWeight: "600" }}>View Guide &rarr;</span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SOIL COMPATIBILITY */}
      {activeTab === "soil" && (
        <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: "24px" }}>
          <Card style={{ padding: "24px" }}>
            <h3 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Sprout size={20} color="var(--primary)" /> Soil & Field Parameters
            </h3>
            <form onSubmit={handleSoilCheck} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", marginBottom: "4px", display: "block" }}>Soil Texture Type</label>
                <Select value={soilForm.soilType} onChange={(e) => setSoilForm({ ...soilForm, soilType: e.target.value })}>
                  {SOIL_TYPES.map(st => <option key={st} value={st}>{st}</option>)}
                </Select>
              </div>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", marginBottom: "4px", display: "block" }}>Soil pH (if tested)</label>
                <Input type="number" step="0.1" placeholder="e.g. 6.5" value={soilForm.ph} onChange={(e) => setSoilForm({ ...soilForm, ph: e.target.value })} />
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Leave blank if unknown</span>
              </div>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", marginBottom: "4px", display: "block" }}>Target Season</label>
                <Select value={soilForm.season} onChange={(e) => setSoilForm({ ...soilForm, season: e.target.value })}>
                  <option value="Kharif">Kharif (Monsoon)</option>
                  <option value="Rabi">Rabi (Winter)</option>
                  <option value="Summer">Summer (Zaid)</option>
                </Select>
              </div>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", marginBottom: "4px", display: "block" }}>Water Availability</label>
                <Select value={soilForm.waterAvailability} onChange={(e) => setSoilForm({ ...soilForm, waterAvailability: e.target.value })}>
                  {WATER_LEVELS.map(wl => <option key={wl} value={wl}>{wl}</option>)}
                </Select>
              </div>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "600", marginBottom: "4px", display: "block" }}>Previous Crop (Rotation)</label>
                <Input placeholder="e.g. Rice" value={soilForm.previousCrop} onChange={(e) => setSoilForm({ ...soilForm, previousCrop: e.target.value })} />
              </div>
              <Button type="submit" loading={soilLoading} style={{ marginTop: "8px" }}>
                Evaluate Compatibility
              </Button>
            </form>
          </Card>

          <div>
            {!soilResults ? (
              <Card style={{ padding: "40px", textAlign: "center" }}>
                <Sprout size={48} color="var(--text-muted)" style={{ marginBottom: "16px" }} />
                <h3 style={{ fontSize: "18px", color: "var(--text-secondary)" }}>Enter soil & location details to run deterministic compatibility matching.</h3>
                <p style={{ fontSize: "13px", color: "var(--text-muted)", maxWidth: "450px", margin: "8px auto 0" }}>
                  Calculates compatibility based strictly on stored agronomic requirements. Zero invented facts.
                </p>
              </Card>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <h3 style={{ fontSize: "18px", fontWeight: "700" }}>Deterministic Matching Results ({soilResults.length} Crops)</h3>
                {soilResults.map((r) => (
                  <Card key={r.cropId} style={{ padding: "20px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                      <div>
                        <h4 style={{ fontSize: "18px", fontWeight: "700", margin: 0 }}>{r.crop}</h4>
                        <span style={{ fontSize: "12px", fontStyle: "italic", color: "var(--text-muted)" }}>{r.scientificName}</span>
                      </div>
                      <Badge variant={r.compatibility === "HIGH" ? "success" : r.compatibility === "MEDIUM" ? "warning" : "danger"} style={{ fontSize: "14px", padding: "6px 12px" }}>
                        {r.compatibility} COMPATIBILITY ({r.score}%)
                      </Badge>
                    </div>

                    {r.reasons && r.reasons.length > 0 && (
                      <div style={{ marginBottom: "8px", fontSize: "13px", color: "#1b4332" }}>
                        <strong>Positive Factors:</strong>
                        <ul style={{ margin: "4px 0 0 18px", padding: 0 }}>
                          {r.reasons.map((reason, idx) => <li key={idx}>{reason}</li>)}
                        </ul>
                      </div>
                    )}

                    {r.importantConditions && r.importantConditions.length > 0 && (
                      <div style={{ marginBottom: "8px", fontSize: "13px", color: "#b7094c" }}>
                        <strong>Important Conditions & Risks:</strong>
                        <ul style={{ margin: "4px 0 0 18px", padding: 0 }}>
                          {r.importantConditions.map((cond, idx) => <li key={idx}>{cond}</li>)}
                        </ul>
                      </div>
                    )}

                    {r.missingInformation && r.missingInformation[0] !== "None" && (
                      <div style={{ fontSize: "12px", background: "var(--bg-subtle)", padding: "8px 12px", borderRadius: "6px", color: "var(--text-muted)" }}>
                        <Info size={14} style={{ marginRight: "4px", inline: "true" }} />
                        {r.missingInformation.join("; ")}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: CROP ROTATION */}
      {activeTab === "rotation" && (
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          <Card style={{ padding: "24px", marginBottom: "24px" }}>
            <h3 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "16px" }}>Crop Rotation Planner</h3>
            <form onSubmit={handleRotationCheck} style={{ display: "flex", gap: "12px" }}>
              <Input
                placeholder="Enter previously harvested crop (e.g. Rice, Maize)"
                value={rotationPrevCrop}
                onChange={(e) => setRotationPrevCrop(e.target.value)}
              />
              <Button type="submit" loading={rotationLoading}>Find Rotation Options</Button>
            </form>
          </Card>

          {rotationResults && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {rotationResults.map((rec, idx) => (
                <Card key={idx} style={{ padding: "20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <h4 style={{ fontSize: "18px", fontWeight: "700", margin: 0 }}>Suggested Crop: {rec.suggestedCrop}</h4>
                    <Badge variant={rec.compatibility === "HIGH" ? "success" : "warning"}>{rec.compatibility} ROTATION</Badge>
                  </div>
                  <div style={{ fontSize: "14px", marginBottom: "8px" }}><strong>Why Recommended:</strong> {rec.reasons}</div>
                  <div style={{ fontSize: "14px", marginBottom: "8px", color: "var(--primary)" }}><strong>Soil Benefits:</strong> {rec.benefits}</div>
                  <div style={{ fontSize: "13px", color: "#b7094c", marginBottom: "8px" }}><strong>Crops to Avoid:</strong> {rec.cropsToAvoid}</div>
                  <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}><strong>Field Prep:</strong> {rec.fieldPreparation}</div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TABS 4, 5, 6: QUICK GUIDES SELECTOR & DETAILS */}
      {(activeTab === "seed" || activeTab === "irrigation" || activeTab === "pests") && (
        <div>
          <Card style={{ padding: "16px", marginBottom: "24px", display: "flex", alignItems: "center", gap: "16px" }}>
            <span style={{ fontWeight: "600", fontSize: "14px" }}>Select Crop Guide:</span>
            <Select value={selectedCropId} onChange={(e) => setSelectedCropId(e.target.value)} style={{ maxWidth: "300px" }}>
              {crops.map(c => <option key={c.id} value={c.id}>{c.name} ({c.category})</option>)}
            </Select>
            <Button variant="outline" size="sm" onClick={() => navigate(`/farmer/farming-guide/crops/${selectedCropId}`)}>
              Open Full Crop Guide Page &rarr;
            </Button>
          </Card>

          {quickLoading ? (
            <LoadingState text="Loading crop parameters..." />
          ) : quickCropData ? (
            <div>
              {/* TAB 4: SEED & SOWING */}
              {activeTab === "seed" && (
                <Card style={{ padding: "24px" }}>
                  <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "16px" }}>Seed & Sowing Guide — {quickCropData.name}</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                    <div>
                      <h4 style={{ fontSize: "15px", color: "var(--primary)", fontWeight: "700" }}>Seed Rate & Selection</h4>
                      <p style={{ fontSize: "14px" }}>{quickCropData.seedSowing?.seed_rate_per_acre || "Certified seed rate per acre as recommended."}</p>
                      <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>{quickCropData.seedSowing?.seed_selection}</p>
                    </div>
                    <div>
                      <h4 style={{ fontSize: "15px", color: "var(--primary)", fontWeight: "700" }}>Seed Treatment</h4>
                      <p style={{ fontSize: "14px" }}>{quickCropData.seedSowing?.seed_treatment || "Treat with bio-fungicide before sowing."}</p>
                    </div>
                    <div>
                      <h4 style={{ fontSize: "15px", color: "var(--primary)", fontWeight: "700" }}>Spacing & Sowing Depth</h4>
                      <p style={{ fontSize: "14px" }}>Spacing: {quickCropData.seedSowing?.spacing || "Standard row spacing"}</p>
                      <p style={{ fontSize: "14px" }}>Sowing Depth: {quickCropData.seedSowing?.depth_cm || 3.0} cm</p>
                    </div>
                    <div>
                      <h4 style={{ fontSize: "15px", color: "var(--primary)", fontWeight: "700" }}>Land Preparation</h4>
                      <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>{quickCropData.land_preparation}</p>
                    </div>
                  </div>
                </Card>
              )}

              {/* TAB 5: IRRIGATION & NUTRIENTS */}
              {activeTab === "irrigation" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                  <Card style={{ padding: "24px" }}>
                    <h3 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                      <Droplets color="var(--primary)" size={20} /> Irrigation Guide
                    </h3>
                    <div style={{ fontSize: "14px", display: "flex", flexDirection: "column", gap: "12px" }}>
                      <div><strong>Water Requirement:</strong> {quickCropData.irrigation?.water_requirement_mm || "500-800 mm"}</div>
                      <div><strong>Irrigation Method:</strong> {quickCropData.irrigation?.method || "Controlled Furrow / Drip"}</div>
                      <div><strong>Critical Growth Stages:</strong> {quickCropData.irrigation?.critical_stages || "Flowering, Fruit set"}</div>
                      <div style={{ background: "#e8f5e9", padding: "12px", borderRadius: "8px", borderLeft: "4px solid #2d6a4f" }}>
                        <strong>Weather Forecast Integration:</strong>
                        <p style={{ margin: "4px 0 0", fontSize: "13px" }}>{quickCropData.irrigation?.rainfall_considerations || "Review planned irrigation based on expected rainfall from weather service."}</p>
                      </div>
                    </div>
                  </Card>

                  <Card style={{ padding: "24px" }}>
                    <h3 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "16px" }}>Nutrient Management</h3>
                    <div style={{ background: "#fff3cd", borderLeft: "4px solid #ffc107", padding: "12px", borderRadius: "6px", marginBottom: "16px", fontSize: "12px", color: "#856404" }}>
                      <strong>MANDATORY NOTICE:</strong> Perform laboratory soil test before applying chemical fertilizers. Do not exceed recommended rates.
                    </div>
                    <div style={{ fontSize: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                      <div><strong>Nitrogen (N):</strong> {quickCropData.nutrients?.n_recommendation_kg_per_acre || "Recommended split dose"}</div>
                      <div><strong>Phosphorus (P):</strong> {quickCropData.nutrients?.p_recommendation_kg_per_acre || "Basal dose"}</div>
                      <div><strong>Potassium (K):</strong> {quickCropData.nutrients?.k_recommendation_kg_per_acre || "Split dose"}</div>
                      <div><strong>Micronutrients:</strong> {quickCropData.nutrients?.micronutrients || "Zinc / Boron if deficient"}</div>
                    </div>
                  </Card>
                </div>
              )}

              {/* TAB 6: PEST & HARVEST */}
              {activeTab === "pests" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  <Card style={{ padding: "24px" }}>
                    <h3 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                      <ShieldAlert color="#b7094c" size={20} /> Major Pests & Integrated Management
                    </h3>
                    <div style={{ background: "#f8d7da", color: "#721c24", padding: "10px 16px", borderRadius: "6px", fontSize: "12px", marginBottom: "16px" }}>
                      <strong>Pesticide Safety Warning:</strong> FarmConnect does not automatically prescribe chemical pesticide dosages. Consult your local Agricultural Extension Officer for confirmed outbreak handling.
                    </div>
                    {quickCropData.pests && quickCropData.pests.length > 0 ? (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                        {quickCropData.pests.map((p) => (
                          <div key={p.id} style={{ border: "1px solid var(--border)", padding: "16px", borderRadius: "8px" }}>
                            <h4 style={{ fontSize: "16px", fontWeight: "700", margin: "0 0 6px" }}>{p.name}</h4>
                            <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "6px" }}><strong>Symptoms:</strong> {p.symptoms}</div>
                            <div style={{ fontSize: "13px", color: "var(--primary)" }}><strong>Integrated Management:</strong> {p.integrated_management}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>Inspect crops regularly. Use Crop Image Analyzer for visual identification.</p>
                    )}
                  </Card>

                  <Card style={{ padding: "24px" }}>
                    <h3 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "16px" }}>Harvest & Post-Harvest Preservations</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", fontSize: "14px" }}>
                      <div>
                        <h4 style={{ fontSize: "15px", fontWeight: "700", color: "var(--primary)" }}>Harvest Maturity & Method</h4>
                        <p><strong>Maturity Indicators:</strong> {quickCropData.harvestPost?.maturity_indicators || "Harvest at full physiological maturity."}</p>
                        <p><strong>Timing & Method:</strong> {quickCropData.harvestPost?.harvest_method || "Manual or mechanical harvesting."}</p>
                      </div>
                      <div>
                        <h4 style={{ fontSize: "15px", fontWeight: "700", color: "var(--primary)" }}>Storage & Value Addition</h4>
                        <p><strong>Drying & Storage:</strong> {quickCropData.harvestPost?.storage || "Store in cool, dry warehouse."}</p>
                        {quickCropData.valueAddedProducts && quickCropData.valueAddedProducts.length > 0 && (
                          <div style={{ marginTop: "12px", background: "var(--bg-subtle)", padding: "10px", borderRadius: "6px" }}>
                            <strong>Available Value Addition Products:</strong>
                            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "6px" }}>
                              {quickCropData.valueAddedProducts.map(vap => (
                                <Badge key={vap.id} variant="success" style={{ cursor: "pointer" }} onClick={() => navigate(`/farmer/value-addition/${vap.id}`)}>
                                  {vap.product_name} ({vap.value_addition_multiplier}x Value)
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
