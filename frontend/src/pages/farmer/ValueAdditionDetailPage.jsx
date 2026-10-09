import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import Card from "../../components/common/Card.jsx";
import Button from "../../components/common/Button.jsx";
import Badge from "../../components/common/Badge.jsx";
import LoadingState from "../../components/common/LoadingState.jsx";
import EmptyState from "../../components/common/EmptyState.jsx";
import ErrorState from "../../components/common/ErrorState.jsx";
import { getValueAdditionProductDetail } from "../../services/valueAdditionService.js";
import {
  ArrowLeft,
  Clock,
  Sprout,
  ArrowRight,
  ChevronDown,
  AlertTriangle
} from "../../components/icons/Icons.jsx";

export default function ValueAdditionDetailPage() {
  const { productId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detail, setDetail] = useState(null);
  const [activeStageIndex, setActiveStageIndex] = useState(0);
  const [activeSection, setActiveSection] = useState("all");

  useEffect(() => {
    let isMounted = true;

    getValueAdditionProductDetail(productId)
      .then((data) => {
        if (isMounted) {
          setDetail(data);
          setLoading(false);
          setActiveStageIndex(0);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || "Failed to load value-added product details.");
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [productId]);

  const handleBack = () => {
    navigate("/farmer/value-addition");
  };

  const guide = detail?.guide;
  const stages = guide?.stages || [];
  const equipment = guide?.equipment || [];
  const packaging = guide?.packaging;
  const marketInfo = guide?.marketInfo;
  const schemes = detail?.schemes || [];
  const relatedProducts = detail?.relatedProducts || [];

  const handlePrevStage = () => {
    if (activeStageIndex > 0) {
      setActiveStageIndex((prev) => prev - 1);
    }
  };

  const handleNextStage = () => {
    if (activeStageIndex < stages.length - 1) {
      setActiveStageIndex((prev) => prev + 1);
    }
  };

  const currentStage = stages[activeStageIndex];

  return (
    <div className="fc-page animate-fade-in" style={{ paddingBottom: "50px" }}>
      {/* Top Navigation & Breadcrumbs */}
      <div style={{ marginBottom: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <div>
          <Button variant="subtle" size="small" onClick={handleBack}>
            <ArrowLeft size={16} /> Back to Value Addition Catalog
          </Button>
        </div>

        {/* Hierarchical Processing Flow Breadcrumb Bar */}
        {detail && (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "0.8rem",
            color: "var(--muted)",
            flexWrap: "wrap",
            background: "var(--bg-subtle, #f8fafc)",
            padding: "8px 12px",
            borderRadius: "6px",
            border: "1px solid var(--border)"
          }}>
            <span style={{ fontWeight: 600, color: "var(--text-main)" }}>Crop: {detail.crop_name}</span>
            <ChevronDown size={14} style={{ transform: "rotate(-90deg)" }} />
            <span>Available Products</span>
            <ChevronDown size={14} style={{ transform: "rotate(-90deg)" }} />
            <span style={{ fontWeight: 600, color: "var(--primary)" }}>{detail.product_name}</span>
            <ChevronDown size={14} style={{ transform: "rotate(-90deg)" }} />
            <span>Processing Workflow</span>
            <ChevronDown size={14} style={{ transform: "rotate(-90deg)" }} />
            <span>Equipment</span>
            <ChevronDown size={14} style={{ transform: "rotate(-90deg)" }} />
            <span>Packaging</span>
            <ChevronDown size={14} style={{ transform: "rotate(-90deg)" }} />
            <span>Storage</span>
            <ChevronDown size={14} style={{ transform: "rotate(-90deg)" }} />
            <span>Market / Use</span>
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading && <LoadingState text="Loading detailed processing guide & workflow..." />}

      {/* Error State */}
      {!loading && error && (
        <ErrorState
          message={error}
          onRetry={() => {
            setLoading(true);
            setError(null);
            getValueAdditionProductDetail(productId)
              .then((data) => { setDetail(data); setLoading(false); })
              .catch((err) => { setError(err.message); setLoading(false); });
          }}
        />
      )}

      {/* Empty State */}
      {!loading && !error && !detail && (
        <EmptyState
          title="Product Guide Not Found"
          description="The requested value-added product processing guide could not be found."
          actionText="Back to Catalog"
          onAction={handleBack}
        />
      )}

      {/* Main Page Content */}
      {!loading && !error && detail && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Section Navigation Jump Bar */}
          <div style={{
            display: "flex",
            gap: "8px",
            borderBottom: "1px solid var(--border)",
            paddingBottom: "8px",
            overflowX: "auto"
          }}>
            {[
              { id: "all", label: "Full Guide" },
              { id: "overview", label: "Overview" },
              { id: "stages", label: `Processing Stages (${stages.length})` },
              { id: "equipment", label: `Equipment (${equipment.length})` },
              { id: "packaging", label: "Packaging" },
              { id: "storage", label: "Storage" },
              { id: "schemes", label: `Govt Schemes (${schemes.length})` },
              { id: "market", label: "Market / Use" }
            ].map((sec) => (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id)}
                style={{
                  padding: "6px 14px",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  border: "none",
                  borderRadius: "20px",
                  background: activeSection === sec.id ? "var(--primary)" : "var(--bg-subtle, #f1f5f9)",
                  color: activeSection === sec.id ? "#ffffff" : "var(--muted)",
                  cursor: "pointer",
                  whiteSpace: "nowrap"
                }}
              >
                {sec.label}
              </button>
            ))}
          </div>

          {/* 1. Header & Overview Card */}
          {(activeSection === "all" || activeSection === "overview") && (
            <Card padded>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: "280px" }}>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", marginBottom: "8px" }}>
                    <Badge variant="success">Crop: {detail.crop_name}</Badge>
                    <Badge variant="primary">{detail.category || "Value Addition"}</Badge>
                    {guide?.difficulty_level && (
                      <Badge variant="warning">Difficulty: {guide.difficulty_level}</Badge>
                    )}
                  </div>

                  <h1 className="fc-h1" style={{ margin: "4px 0 8px 0" }}>
                    {detail.product_name}
                  </h1>

                  <p className="fc-muted" style={{ margin: 0, fontSize: "0.95rem", lineHeight: 1.5 }}>
                    {detail.description}
                  </p>
                </div>

                {detail.value_addition_multiplier && (
                  <div style={{
                    padding: "16px",
                    borderRadius: "8px",
                    background: "var(--bg-subtle, #f8fafc)",
                    border: "1px solid var(--border)",
                    textAlign: "center",
                    minWidth: "160px"
                  }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>
                      Value Multiplier
                    </div>
                    <div style={{ fontSize: "1.75rem", fontWeight: "bold", color: "var(--primary)", marginTop: "2px" }}>
                      {detail.value_addition_multiplier}x
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "2px" }}>
                      vs Raw Harvest
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons Row: Calculator & Marketplace Listing */}
              <div style={{ display: "flex", gap: "10px", marginTop: "16px", flexWrap: "wrap" }}>
                <Button
                  variant="outline"
                  size="small"
                  onClick={() => navigate(`/farmer/value-addition/calculator?productId=${detail.id}`)}
                >
                  🧮 Calculate Economics
                </Button>
                <Button
                  variant="primary"
                  size="small"
                  onClick={() => navigate("/farmer/my-products", {
                    state: {
                      openAdd: true,
                      prefill: {
                        name: detail.product_name,
                        category: detail.category || "Processed Foods",
                        description: `Value-added ${detail.product_name} derived from ${detail.crop_name}. ${detail.description || ""}`,
                        value_added_product_id: detail.id,
                        price: Math.round(Number(detail.value_addition_multiplier * 50 || 100)),
                        unit: "kg",
                        stock: 100,
                        grade: "A"
                      }
                    }
                  })}
                >
                  🛒 List on Marketplace
                </Button>
              </div>

              {/* Summary Metrics Bar */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "12px",
                marginTop: "20px",
                paddingTop: "16px",
                borderTop: "1px solid var(--border)"
              }}>
                <div>
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>Processing Method</span>
                  <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{guide?.processing_method || "N/A"}</span>
                </div>
                <div>
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>Expected Yield</span>
                  <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                    {guide?.expected_yield_percentage ? `${guide.expected_yield_percentage}% by weight` : "Standard"}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>Approximate Duration</span>
                  <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                    {guide?.processing_time_hours ? `${guide.processing_time_hours} Hours` : "Variable"}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>Last Updated</span>
                  <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                    {detail.updated_at ? new Date(detail.updated_at).toLocaleDateString() : "Current"}
                  </span>
                </div>
              </div>
            </Card>
          )}

          {/* 2. Interactive Step-by-Step Processing Stages */}
          {(activeSection === "all" || activeSection === "stages") && (
            <Card padded>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
                <div>
                  <h2 className="fc-h2" style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                    <Sprout size={20} /> Processing Workflow & Timeline
                  </h2>
                  <p className="fc-muted" style={{ margin: "4px 0 0 0", fontSize: "0.875rem" }}>
                    Step-by-step conversion timeline from Raw {detail.crop_name} to finished {detail.product_name}.
                  </p>
                </div>

                {stages.length > 0 && (
                  <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--primary)" }}>
                    Stage {activeStageIndex + 1} of {stages.length}
                  </div>
                )}
              </div>

              {/* Stage Stepper Number Selector */}
              {stages.length > 0 && (
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  marginBottom: "20px",
                  flexWrap: "wrap"
                }}>
                  {stages.map((stg, idx) => (
                    <button
                      key={stg.id}
                      onClick={() => setActiveStageIndex(idx)}
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        border: activeStageIndex === idx ? "2px solid var(--primary)" : "1px solid var(--border)",
                        background: activeStageIndex === idx ? "var(--primary)" : (idx < activeStageIndex ? "#f0fdf4" : "var(--bg-subtle, #ffffff)"),
                        color: activeStageIndex === idx ? "#ffffff" : (idx < activeStageIndex ? "#166534" : "var(--muted)"),
                        fontWeight: "bold",
                        fontSize: "0.9rem",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                      title={`Jump to Stage ${stg.stage_number}: ${stg.stage_name}`}
                    >
                      {stg.stage_number}
                    </button>
                  ))}
                </div>
              )}

              {/* Active Stage Detail Card */}
              {currentStage ? (
                <div style={{
                  padding: "20px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background: "var(--bg-subtle, #f8fafc)",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.03)"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{
                        padding: "4px 10px",
                        borderRadius: "20px",
                        background: "var(--primary)",
                        color: "#ffffff",
                        fontWeight: "bold",
                        fontSize: "0.8rem"
                      }}>
                        Stage {currentStage.stage_number}
                      </div>
                      <h3 style={{ margin: 0, fontSize: "1.1rem", color: "var(--text-main)" }}>
                        {currentStage.stage_name}
                      </h3>
                    </div>

                    {currentStage.duration_minutes !== null && currentStage.duration_minutes !== undefined && (
                      <Badge variant="primary">
                        <Clock size={12} /> Approximate Duration: {currentStage.duration_minutes} mins
                      </Badge>
                    )}
                  </div>

                  <p style={{ margin: "0 0 16px 0", fontSize: "0.9rem", color: "var(--text-main)", lineHeight: 1.5 }}>
                    {currentStage.description}
                  </p>

                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "0.85rem" }}>
                    {currentStage.temperature_celsius !== null && currentStage.temperature_celsius !== undefined && (
                      <div style={{ background: "#eff6ff", color: "#1e40af", padding: "8px 12px", borderRadius: "6px", fontWeight: 600 }}>
                        Target Temperature Control: {currentStage.temperature_celsius}°C
                      </div>
                    )}

                    {currentStage.critical_control_points && (
                      <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", padding: "10px 14px", borderRadius: "6px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: "bold", marginBottom: "2px" }}>
                          <AlertTriangle size={15} /> Important Hygiene & Quality Consideration
                        </div>
                        <div>{currentStage.critical_control_points}</div>
                      </div>
                    )}
                  </div>

                  {/* Stage Stepper Previous / Next Controls */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "24px", paddingTop: "16px", borderTop: "1px solid var(--border)" }}>
                    <Button
                      variant="subtle"
                      size="small"
                      onClick={handlePrevStage}
                      disabled={activeStageIndex === 0}
                    >
                      <ArrowLeft size={14} /> Previous Step
                    </Button>

                    <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                      Step {activeStageIndex + 1} of {stages.length}
                    </div>

                    <Button
                      variant="primary"
                      size="small"
                      onClick={handleNextStage}
                      disabled={activeStageIndex === stages.length - 1}
                    >
                      Next Step <ArrowRight size={14} />
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="fc-muted" style={{ fontSize: "0.875rem" }}>No processing stages available.</p>
              )}

              {/* Full Sequential Visual Pipeline Summary */}
              <div style={{ marginTop: "30px", paddingTop: "20px", borderTop: "1px solid var(--border)" }}>
                <h4 style={{ margin: "0 0 14px 0", fontSize: "0.9rem", color: "var(--muted)" }}>Complete Visual Pipeline</h4>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0", maxWidth: "600px", margin: "0 auto" }}>
                  <div style={{ width: "100%", padding: "10px 14px", borderRadius: "6px", background: "#f0fdf4", border: "1px solid #bbf7d0", fontWeight: 600, color: "#15803d", textAlign: "center" }}>
                    Raw Crop: Raw {detail.crop_name}
                  </div>
                  <ChevronDown size={18} style={{ color: "var(--muted)", margin: "4px 0" }} />

                  {stages.map((stg) => (
                    <div key={stg.id} style={{ width: "100%", textAlign: "center" }}>
                      <div style={{ width: "100%", padding: "10px 14px", borderRadius: "6px", background: "var(--bg-subtle, #f8fafc)", border: "1px solid var(--border)", fontSize: "0.85rem", fontWeight: 600 }}>
                        Stage {stg.stage_number}: {stg.stage_name}
                        {stg.duration_minutes !== null && stg.duration_minutes !== undefined && (
                          <span style={{ fontSize: "0.75rem", color: "var(--muted)", marginLeft: "6px" }}>({stg.duration_minutes}m)</span>
                        )}
                      </div>
                      <ChevronDown size={18} style={{ color: "var(--muted)", margin: "4px 0" }} />
                    </div>
                  ))}

                  {packaging && (
                    <>
                      <div style={{ width: "100%", padding: "10px 14px", borderRadius: "6px", background: "#fefce8", border: "1px solid #fef08a", fontSize: "0.85rem", fontWeight: 600, color: "#713f12", textAlign: "center" }}>
                        Packaging: {packaging.packaging_type}
                      </div>
                      <ChevronDown size={18} style={{ color: "var(--muted)", margin: "4px 0" }} />
                    </>
                  )}

                  <div style={{ width: "100%", padding: "12px 14px", borderRadius: "6px", background: "var(--primary)", color: "#ffffff", fontWeight: "bold", textAlign: "center" }}>
                    Final Product: {detail.product_name}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* 3. Required Equipment Section */}
          {(activeSection === "all" || activeSection === "equipment") && (
            <Card padded>
              <h2 className="fc-h2" style={{ marginTop: 0, marginBottom: "16px" }}>Required Processing Equipment</h2>
              {equipment.length === 0 ? (
                <p className="fc-muted" style={{ fontSize: "0.875rem" }}>No equipment specifications listed.</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "12px" }}>
                  {equipment.map((eq) => (
                    <div key={eq.id} style={{
                      padding: "14px",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      background: "var(--bg-subtle, #f8fafc)"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                        <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>{eq.equipment_name}</div>
                        <Badge variant={eq.is_mandatory ? "primary" : "neutral"}>
                          {eq.is_mandatory ? "Mandatory" : "Optional"}
                        </Badge>
                      </div>
                      {eq.specification && (
                        <p style={{ margin: "6px 0 8px 0", fontSize: "0.8rem", color: "var(--muted)" }}>
                          {eq.specification}
                        </p>
                      )}
                      {eq.estimated_cost_min && (
                        <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--primary)" }}>
                          Estimated Cost: ₹{Number(eq.estimated_cost_min).toLocaleString()} - ₹{Number(eq.estimated_cost_max || eq.estimated_cost_min).toLocaleString()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* 4. Packaging Specifications Section */}
          {(activeSection === "all" || activeSection === "packaging") && packaging && (
            <Card padded>
              <h2 className="fc-h2" style={{ marginTop: 0, marginBottom: "16px" }}>Packaging Specifications</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
                <div>
                  <h4 style={{ margin: "0 0 6px 0", fontSize: "0.875rem", color: "var(--muted)" }}>Packaging Type</h4>
                  <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>{packaging.packaging_type}</div>
                </div>

                <div>
                  <h4 style={{ margin: "0 0 6px 0", fontSize: "0.875rem", color: "var(--muted)" }}>Material Specifications</h4>
                  <div style={{ fontSize: "0.85rem", color: "var(--text-main)" }}>
                    {packaging.material_specification || "Standard Food-Grade Container"}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* 5. Storage Conditions Section */}
          {(activeSection === "all" || activeSection === "storage") && packaging && (
            <Card padded>
              <h2 className="fc-h2" style={{ marginTop: 0, marginBottom: "16px" }}>Storage & Preservation Conditions</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
                <div style={{ padding: "12px", borderRadius: "6px", background: "var(--bg-subtle, #f8fafc)", border: "1px solid var(--border)" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>Storage Temperature</span>
                  <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                    {packaging.temp_min !== undefined && packaging.temp_max !== undefined ? `${packaging.temp_min}°C to ${packaging.temp_max}°C` : "Ambient"}
                  </span>
                </div>

                <div style={{ padding: "12px", borderRadius: "6px", background: "var(--bg-subtle, #f8fafc)", border: "1px solid var(--border)" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>Relative Humidity Limit</span>
                  <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                    {packaging.humidity_max ? `Max ${packaging.humidity_max}%` : "Standard"}
                  </span>
                </div>

                <div style={{ padding: "12px", borderRadius: "6px", background: "var(--bg-subtle, #f8fafc)", border: "1px solid var(--border)" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>Shelf Life</span>
                  <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--primary)" }}>
                    {packaging.shelf_life_days ? `${packaging.shelf_life_days} Days` : "Standard"}
                  </span>
                </div>
              </div>

              {packaging.storage_instructions && (
                <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: "1px solid var(--border)", fontSize: "0.85rem", color: "var(--muted)" }}>
                  <strong>Storage Instructions:</strong> {packaging.storage_instructions}
                </div>
              )}
            </Card>
          )}

          {/* 6. Relevant Government Support & Schemes Section */}
          {(activeSection === "all" || activeSection === "schemes") && (
            <Card padded>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                <div>
                  <h2 className="fc-h2" style={{ margin: 0 }}>Relevant Government Schemes & Support</h2>
                  <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "var(--muted)" }}>
                    Government processing subsidies, credit-linked capital support, and eligibility criteria for {detail.product_name} ({detail.crop_name}).
                  </p>
                </div>
                <Badge variant="primary">{schemes.length} Scheme{schemes.length === 1 ? '' : 's'} Supported</Badge>
              </div>

              {/* Official Verification Disclaimer Notice */}
              <div style={{
                background: "#fffbeb",
                border: "1px solid #fef3c7",
                borderRadius: "8px",
                padding: "12px 16px",
                marginBottom: "20px",
                fontSize: "0.825rem",
                color: "#92400e",
                lineHeight: 1.5
              }}>
                <strong>⚠️ Official Verification & Eligibility Note:</strong> Scheme benefits, subsidy percentages, and eligibility criteria are subject to official verification by the respective government ministry or state nodal agency upon formal application. FarmConnect displays database-supported scheme information for farmer guidance and does not grant automatic eligibility.
              </div>

              {schemes.length === 0 ? (
                <p className="fc-muted" style={{ fontSize: "0.875rem" }}>No mapped government schemes found in database for this product.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                  {schemes.map((s) => (
                    <div
                      key={s.scheme_id || s.id}
                      style={{
                        padding: "18px",
                        borderRadius: "10px",
                        border: "1px solid var(--border)",
                        background: "var(--bg-subtle, #f8fafc)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
                        <div>
                          <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "4px", flexWrap: "wrap" }}>
                            <Badge variant="success">{s.short_code}</Badge>
                            <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600 }}>
                              {s.authority}
                            </span>
                          </div>
                          <h3 style={{ margin: 0, fontSize: "1.05rem", color: "var(--text-main)", fontWeight: 700 }}>
                            {s.scheme_name}
                          </h3>
                        </div>

                        {s.last_updated_date && (
                          <div style={{ fontSize: "0.75rem", color: "var(--muted)", background: "var(--bg-card, #ffffff)", padding: "4px 8px", borderRadius: "4px", border: "1px solid var(--border)" }}>
                            Last Verified: {s.last_updated_date}
                          </div>
                        )}
                      </div>

                      <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-main)", lineHeight: 1.5 }}>
                        {s.description}
                      </p>

                      {s.relevance_notes && (
                        <div style={{ fontSize: "0.825rem", color: "var(--primary)", fontWeight: 600, background: "#eff6ff", padding: "8px 12px", borderRadius: "6px", border: "1px solid #bfdbfe" }}>
                          📌 Processing Support: {s.relevance_notes}
                        </div>
                      )}

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px", marginTop: "4px" }}>
                        {/* Eligibility Information */}
                        <div style={{ background: "#ffffff", padding: "12px 14px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                          <h4 style={{ margin: "0 0 6px 0", fontSize: "0.825rem", color: "#1e40af", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                            Eligibility Information
                          </h4>
                          <p style={{ margin: 0, fontSize: "0.825rem", color: "var(--text-main)", lineHeight: 1.45 }}>
                            {s.eligibility_info}
                          </p>
                        </div>

                        {/* Benefits Information */}
                        <div style={{ background: "#ffffff", padding: "12px 14px", borderRadius: "8px", border: "1px solid var(--border)" }}>
                          <h4 style={{ margin: "0 0 6px 0", fontSize: "0.825rem", color: "#15803d", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                            Benefits & Financial Incentives
                          </h4>
                          <p style={{ margin: 0, fontSize: "0.825rem", color: "var(--text-main)", lineHeight: 1.45 }}>
                            {s.benefits_info}
                          </p>
                        </div>
                      </div>

                      {/* Official Source Link Button */}
                      {s.official_source_url && (
                        <div style={{ marginTop: "6px", display: "flex", justifyContent: "flex-end" }}>
                          <a
                            href={s.official_source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              fontSize: "0.825rem",
                              fontWeight: 600,
                              color: "var(--primary)",
                              textDecoration: "none",
                              background: "var(--bg-card, #ffffff)",
                              padding: "6px 14px",
                              borderRadius: "6px",
                              border: "1px solid var(--primary)"
                            }}
                          >
                            Official Government Portal <ArrowRight size={14} />
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* 7. Market Demand & Commercial Use Section */}
          {(activeSection === "all" || activeSection === "market") && marketInfo && (
            <Card padded>
              <h2 className="fc-h2" style={{ marginTop: 0, marginBottom: "16px" }}>Market Demand & Commercial Use</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {marketInfo.target_market && (
                  <div>
                    <h4 style={{ margin: "0 0 4px 0", fontSize: "0.875rem", color: "var(--muted)" }}>Target Buyers & Market Outlets</h4>
                    <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 500 }}>{marketInfo.target_market}</p>
                  </div>
                )}

                {marketInfo.commercial_uses && (
                  <div>
                    <h4 style={{ margin: "0 0 4px 0", fontSize: "0.875rem", color: "var(--muted)" }}>Commercial Uses</h4>
                    <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--muted)" }}>{marketInfo.commercial_uses}</p>
                  </div>
                )}

                {marketInfo.quality_standards && (
                  <div>
                    <h4 style={{ margin: "0 0 4px 0", fontSize: "0.875rem", color: "var(--muted)" }}>Quality & FSSAI Standards</h4>
                    <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--muted)" }}>{marketInfo.quality_standards}</p>
                  </div>
                )}

                {marketInfo.govt_schemes_info && (
                  <div style={{ padding: "14px", borderRadius: "8px", background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                    <h4 style={{ margin: "0 0 4px 0", fontSize: "0.875rem", color: "#166534" }}>Government Subsidies & Schemes</h4>
                    <p style={{ margin: 0, fontSize: "0.875rem", color: "#15803d" }}>{marketInfo.govt_schemes_info}</p>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* 7. Authoritative Technical Reference */}
          {guide?.source_reference && (
            <Card padded style={{ background: "var(--bg-subtle, #f8fafc)" }}>
              <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                <strong>Authoritative Technical Source Reference:</strong> {guide.source_reference}
              </div>
            </Card>
          )}

          {/* 8. Related Value-Added Products */}
          {relatedProducts.length > 0 && (
            <Card padded>
              <h2 className="fc-h2" style={{ marginTop: 0, marginBottom: "16px" }}>
                Other Value-Added Products derived from {detail.crop_name}
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
                {relatedProducts.map((rel) => (
                  <Link
                    key={rel.id}
                    to={`/farmer/value-addition/${rel.id}`}
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <div className="fc-card fc-card-hoverable fc-card-pad" style={{ height: "100%", padding: "12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                        <Badge variant="success">{rel.crop_name}</Badge>
                        {rel.value_addition_multiplier && (
                          <span style={{ fontSize: "0.75rem", fontWeight: "bold", color: "var(--primary)" }}>
                            {rel.value_addition_multiplier}x
                          </span>
                        )}
                      </div>
                      <h4 style={{ margin: "4px 0", fontSize: "0.95rem", color: "var(--text-main)" }}>{rel.product_name}</h4>
                      {rel.processing_method && (
                        <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Method: {rel.processing_method}</div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
