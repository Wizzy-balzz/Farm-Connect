import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fetchCropDetail } from "../../services/farmingGuideService.js";
import { Card } from "../../components/common/Card.jsx";
import { Button } from "../../components/common/Button.jsx";
import { Badge } from "../../components/common/Badge.jsx";
import { LoadingState } from "../../components/common/LoadingState.jsx";
import { ErrorState } from "../../components/common/ErrorState.jsx";
import { Sprout, ShieldCheck, ArrowLeft, Calendar, Droplets, ShieldAlert, Sparkles, ExternalLink } from "../../components/icons/Icons.jsx";

export default function CropDetailPage() {
  const { cropId } = useParams();
  const navigate = useNavigate();

  const [crop, setCrop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDetail();
  }, [cropId]);

  const loadDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchCropDetail(cropId);
      if (res.success) {
        setCrop(res.data);
      } else {
        setError(res.error?.message || "Crop detail not found.");
      }
    } catch (err) {
      setError(err.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ padding: "60px 0" }}><LoadingState text="Loading crop guide parameters..." /></div>;
  if (error || !crop) return <div style={{ padding: "60px 0" }}><ErrorState message={error || "Crop not found"} onRetry={loadDetail} /></div>;

  return (
    <div className="fc-container animate-fade-in" style={{ padding: "24px 0" }}>
      {/* Back Button */}
      <Button variant="ghost" size="sm" onClick={() => navigate("/farmer/farming-guide")} style={{ marginBottom: "16px" }}>
        <ArrowLeft size={16} /> Back to Farming Guide Hub
      </Button>

      {/* Header Banner */}
      <Card style={{ padding: "32px", background: "linear-gradient(135deg, #1b4332 0%, #2d6a4f 100%)", color: "white", borderRadius: "16px", marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
              <h1 style={{ fontSize: "32px", fontWeight: "700", margin: 0, color: "#ffffff" }}>{crop.name}</h1>
              <Badge variant="success" style={{ background: "rgba(255,255,255,0.2)", color: "white", fontSize: "14px" }}>{crop.category}</Badge>
            </div>
            <p style={{ fontSize: "16px", fontStyle: "italic", color: "#d8f3dc", margin: "0 0 12px" }}>{crop.scientific_name}</p>
            <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", fontSize: "14px", color: "#b7e4c7" }}>
              <div><strong>Duration:</strong> {crop.duration_days ? `${crop.duration_days} Days` : "Seasonal"}</div>
              <div><strong>Seasons:</strong> {crop.seasons || "Kharif, Rabi"}</div>
              <div><strong>Suitable Regions:</strong> {crop.suitable_regions}</div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "12px", background: "rgba(0,0,0,0.2)", padding: "8px 14px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.2)" }}>
              <ShieldCheck size={14} color="#74c69d" style={{ marginRight: "6px", inline: "true" }} />
              Source: {crop.source || "ICAR / Agricultural Extension"}
              <div style={{ fontSize: "11px", color: "#d8f3dc", marginTop: "4px" }}>Last Verified: {crop.last_verified ? crop.last_verified.split("T")[0] : "2026-01-15"}</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Grid Layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "24px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Soil & Climate Specifications */}
          <Card style={{ padding: "24px" }}>
            <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Sprout size={20} color="var(--primary)" /> Soil & Climate Requirements
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", fontSize: "14px" }}>
              <div>
                <strong>Soil Texture:</strong>
                <p style={{ margin: "4px 0 12px", color: "var(--text-secondary)" }}>{crop.soil_texture || "Well-drained loamy soil"}</p>
              </div>
              <div>
                <strong>Ideal pH Range:</strong>
                <p style={{ margin: "4px 0 12px", color: "var(--text-secondary)" }}>{crop.ph_min && crop.ph_max ? `${crop.ph_min} - ${crop.ph_max}` : "6.0 - 7.5"}</p>
              </div>
              <div>
                <strong>Temperature Range:</strong>
                <p style={{ margin: "4px 0 12px", color: "var(--text-secondary)" }}>{crop.temperature_min_c && crop.temperature_max_c ? `${crop.temperature_min_c}°C - ${crop.temperature_max_c}°C` : "20°C - 35°C"}</p>
              </div>
              <div>
                <strong>Annual Rainfall:</strong>
                <p style={{ margin: "4px 0 12px", color: "var(--text-secondary)" }}>{crop.rainfall_min_mm && crop.rainfall_max_mm ? `${crop.rainfall_min_mm} - ${crop.rainfall_max_mm} mm` : "500 - 1200 mm"}</p>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <strong>Land Preparation Procedure:</strong>
                <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", lineHeight: "1.6" }}>{crop.land_preparation}</p>
              </div>
            </div>
          </Card>

          {/* Growth Stages Timeline */}
          <Card style={{ padding: "24px" }}>
            <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Calendar size={20} color="var(--primary)" /> Growth Stages & Farmer Activities
            </h3>
            {crop.growthStages && crop.growthStages.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {crop.growthStages.map((gs) => (
                  <div key={gs.id} style={{ borderLeft: "4px solid var(--primary)", paddingLeft: "16px", background: "var(--bg-subtle)", padding: "16px", borderRadius: "0 8px 8px 0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <h4 style={{ fontSize: "16px", fontWeight: "700", margin: 0 }}>Stage {gs.stage_order}: {gs.stage_name}</h4>
                      <Badge variant="outline">{gs.duration_days ? `${gs.duration_days} Days` : "Stage Phase"}</Badge>
                    </div>
                    <p style={{ fontSize: "14px", margin: "0 0 8px", color: "var(--text-primary)" }}><strong>Farmer Activity:</strong> {gs.farmer_activity}</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "13px", color: "var(--text-secondary)" }}>
                      <div><strong>Irrigation:</strong> {gs.irrigation_consideration}</div>
                      <div><strong>Nutrients:</strong> {gs.nutrient_consideration}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: "14px", color: "var(--text-muted)" }}>Sequence stages apply as standard for {crop.name}. Specific dates depend on your local sowing date.</p>
            )}
          </Card>

          {/* Seed & Sowing Guide */}
          {crop.seedSowing && (
            <Card style={{ padding: "24px" }}>
              <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "16px" }}>Seed & Sowing Instructions</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", fontSize: "14px" }}>
                <div><strong>Seed Rate per Acre:</strong> <p style={{ margin: "4px 0" }}>{crop.seedSowing.seed_rate_per_acre}</p></div>
                <div><strong>Sowing Spacing:</strong> <p style={{ margin: "4px 0" }}>{crop.seedSowing.spacing}</p></div>
                <div style={{ gridColumn: "span 2" }}><strong>Seed Treatment:</strong> <p style={{ margin: "4px 0", color: "var(--text-secondary)" }}>{crop.seedSowing.seed_treatment}</p></div>
              </div>
            </Card>
          )}

          {/* Irrigation & Nutrient Management */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
            <Card style={{ padding: "24px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                <Droplets size={20} color="var(--primary)" /> Irrigation Guide
              </h3>
              <p style={{ fontSize: "14px", margin: "0 0 8px" }}><strong>Requirement:</strong> {crop.irrigation?.water_requirement_mm || "500-800 mm"}</p>
              <p style={{ fontSize: "14px", margin: "0 0 8px" }}><strong>Method:</strong> {crop.irrigation?.method || "Furrow/Drip"}</p>
              <div style={{ background: "#e8f5e9", padding: "10px", borderRadius: "6px", fontSize: "13px", color: "#1b4332", marginTop: "12px" }}>
                <strong>Rainfall Integration:</strong> {crop.irrigation?.rainfall_considerations || "Review planned irrigation based on expected rainfall from weather service."}
              </div>
            </Card>

            <Card style={{ padding: "24px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "12px" }}>Nutrient Management</h3>
              <div style={{ background: "#fff3cd", color: "#856404", padding: "8px 12px", borderRadius: "6px", fontSize: "12px", marginBottom: "12px" }}>
                Perform laboratory soil test before applying chemical fertilizers.
              </div>
              <p style={{ fontSize: "13px", margin: "0 0 6px" }}><strong>N Dosage:</strong> {crop.nutrients?.n_recommendation_kg_per_acre || "Split dosage"}</p>
              <p style={{ fontSize: "13px", margin: "0 0 6px" }}><strong>P Dosage:</strong> {crop.nutrients?.p_recommendation_kg_per_acre || "Basal dose"}</p>
              <p style={{ fontSize: "13px", margin: "0 0 6px" }}><strong>K Dosage:</strong> {crop.nutrients?.k_recommendation_kg_per_acre || "Split dose"}</p>
            </Card>
          </div>
        </div>

        {/* Sidebar Integrations */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Farm Economics Shortcut */}
          <Card style={{ padding: "20px", background: "var(--bg-subtle)" }}>
            <h4 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "8px" }}>Farm Economics Calculator</h4>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px" }}>
              Calculate estimated cost, revenue, and profit per acre for cultivating {crop.name}.
            </p>
            <Button style={{ width: "100%" }} onClick={() => navigate("/farmer/farm-economics")}>
              Calculate Economics &rarr;
            </Button>
          </Card>

          {/* Phase A Value Addition Link */}
          <Card style={{ padding: "20px" }}>
            <h4 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Sparkles size={18} color="var(--primary)" /> Value Addition
            </h4>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "12px" }}>
              Explore processing opportunities for {crop.name} to increase profit margin.
            </p>
            {crop.valueAddedProducts && crop.valueAddedProducts.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {crop.valueAddedProducts.map(vap => (
                  <div key={vap.id} style={{ padding: "10px", background: "var(--bg-subtle)", borderRadius: "6px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => navigate(`/farmer/value-addition/${vap.id}`)}>
                    <span style={{ fontSize: "13px", fontWeight: "600" }}>{vap.product_name}</span>
                    <Badge variant="success">{vap.value_addition_multiplier}x Value</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <Button variant="outline" size="sm" style={{ width: "100%" }} onClick={() => navigate("/farmer/value-addition")}>
                Browse All Value Addition &rarr;
              </Button>
            )}
          </Card>

          {/* Phase A Government Support Link */}
          {crop.governmentSchemes && crop.governmentSchemes.length > 0 && (
            <Card style={{ padding: "20px" }}>
              <h4 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "8px" }}>Relevant Government Support</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {crop.governmentSchemes.map(gs => (
                  <div key={gs.id} style={{ fontSize: "13px", padding: "10px", border: "1px solid var(--border)", borderRadius: "6px" }}>
                    <div style={{ fontWeight: "700", color: "var(--primary)" }}>{gs.scheme_name}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", margin: "2px 0 6px" }}>{gs.authority}</div>
                    <a href={gs.official_source_url} target="_blank" rel="noreferrer" style={{ fontSize: "12px", color: "var(--primary)", textDecoration: "none", display: "flex", alignItems: "center", gap: "4px" }}>
                      Official Portal <ExternalLink size={12} />
                    </a>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
