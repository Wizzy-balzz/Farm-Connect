import { useState, useEffect } from "react";
import Modal from "../common/Modal.jsx";
import Badge from "../common/Badge.jsx";
import LoadingState from "../common/LoadingState.jsx";
import ErrorState from "../common/ErrorState.jsx";
import { getValueAdditionProductDetail } from "../../services/valueAdditionService.js";
import { Clock, ArrowRight } from "../icons/Icons.jsx";

export default function ValueAdditionDetailModal({ productId, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detail, setDetail] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    if (!productId) return;
    let isMounted = true;

    getValueAdditionProductDetail(productId)
      .then((data) => {
        if (isMounted) {
          setDetail(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || "Failed to load product guide details.");
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [productId]);

  if (!productId) return null;

  const guide = detail?.guide;
  const stages = guide?.stages || [];
  const equipment = guide?.equipment || [];
  const packaging = guide?.packaging;
  const marketInfo = guide?.marketInfo;
  const schemes = detail?.schemes || [];

  return (
    <Modal
      isOpen={Boolean(productId)}
      onClose={onClose}
      title={detail ? `${detail.product_name} (${detail.crop_name})` : "Processing Guide"}
      maxWidth="800px"
    >
      {loading && <LoadingState text="Loading processing guide & technical specs..." />}

      {error && (
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

      {!loading && !error && detail && (
        <div>
          {/* Header Summary Banner */}
          <div
            style={{
              padding: "16px",
              borderRadius: "8px",
              background: "var(--bg-subtle, #f8fafc)",
              border: "1px solid var(--border)",
              marginBottom: "20px"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
              <div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "6px" }}>
                  <Badge variant="success">Derived from: {detail.crop_name}</Badge>
                  <Badge variant="primary">{detail.category || "Value Addition"}</Badge>
                  {guide?.difficulty_level && (
                    <Badge variant="warning">{guide.difficulty_level}</Badge>
                  )}
                </div>
                <h3 style={{ margin: 0, fontSize: "1.25rem", color: "var(--text-main)" }}>
                  {detail.product_name}
                </h3>
              </div>
              {detail.value_addition_multiplier && (
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>Value Multiplier</span>
                  <span style={{ fontSize: "1.25rem", fontWeight: "bold", color: "var(--primary)" }}>
                    {detail.value_addition_multiplier}x Value
                  </span>
                </div>
              )}
            </div>
            <p style={{ margin: "10px 0 0 0", fontSize: "0.875rem", color: "var(--muted)" }}>
              {detail.description}
            </p>
          </div>

          {/* Tab Navigation */}
          <div
            style={{
              display: "flex",
              gap: "8px",
              borderBottom: "1px solid var(--border)",
              marginBottom: "16px",
              overflowX: "auto"
            }}
          >
            {[
              { id: "overview", label: "Overview & Method" },
              { id: "stages", label: `Processing Stages (${stages.length})` },
              { id: "equipment", label: `Required Equipment (${equipment.length})` },
              { id: "packaging", label: "Packaging & Storage" },
              { id: "schemes", label: `Govt Schemes (${schemes.length})` },
              { id: "market", label: "Market / Commercial" }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: "8px 14px",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  border: "none",
                  background: "transparent",
                  borderBottom: activeTab === tab.id ? "2px solid var(--primary)" : "2px solid transparent",
                  color: activeTab === tab.id ? "var(--primary)" : "var(--muted)",
                  cursor: "pointer",
                  whiteSpace: "nowrap"
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab 1: Overview */}
          {activeTab === "overview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
                <div className="fc-card fc-card-pad" style={{ padding: "12px" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Processing Method</span>
                  <div style={{ fontWeight: 600, marginTop: "4px" }}>{guide?.processing_method || "N/A"}</div>
                </div>
                <div className="fc-card fc-card-pad" style={{ padding: "12px" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Expected Yield</span>
                  <div style={{ fontWeight: 600, marginTop: "4px" }}>
                    {guide?.expected_yield_percentage ? `${guide.expected_yield_percentage}% by weight` : "Standard"}
                  </div>
                </div>
                <div className="fc-card fc-card-pad" style={{ padding: "12px" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Processing Time</span>
                  <div style={{ fontWeight: 600, marginTop: "4px" }}>
                    {guide?.processing_time_hours ? `${guide.processing_time_hours} Hours` : "Variable"}
                  </div>
                </div>
              </div>

              {guide?.summary && (
                <div>
                  <h4 style={{ margin: "0 0 6px 0", fontSize: "0.95rem" }}>Method Summary</h4>
                  <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--muted)", lineHeight: 1.5 }}>
                    {guide.summary}
                  </p>
                </div>
              )}

              {guide?.source_reference && (
                <div style={{ fontSize: "0.75rem", color: "var(--muted)", background: "var(--bg-subtle)", padding: "10px", borderRadius: "6px" }}>
                  <strong>Authoritative Reference:</strong> {guide.source_reference}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Processing Stages */}
          {activeTab === "stages" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {stages.length === 0 ? (
                <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>No detailed processing stages specified.</p>
              ) : (
                stages.map((stg) => (
                  <div key={stg.id} className="fc-card fc-card-pad" style={{ padding: "14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <span style={{ fontWeight: "bold", color: "var(--primary)", fontSize: "0.9rem" }}>
                        Stage {stg.stage_number}: {stg.stage_name}
                      </span>
                      {stg.duration_minutes && (
                        <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                          <Clock size={12} /> {stg.duration_minutes} mins
                        </span>
                      )}
                    </div>
                    <p style={{ margin: "4px 0 8px 0", fontSize: "0.875rem", color: "var(--text-main)" }}>
                      {stg.description}
                    </p>
                    {stg.temperature_celsius && (
                      <div style={{ fontSize: "0.75rem", color: "var(--primary)", fontWeight: 600, marginBottom: "4px" }}>
                        Target Temperature: {stg.temperature_celsius}°C
                      </div>
                    )}
                    {stg.critical_control_points && (
                      <div style={{ fontSize: "0.75rem", color: "var(--danger, #dc2626)", background: "#fef2f2", padding: "6px 10px", borderRadius: "4px" }}>
                        <strong>Quality & Hygiene Checkpoint:</strong> {stg.critical_control_points}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab 3: Required Equipment */}
          {activeTab === "equipment" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {equipment.length === 0 ? (
                <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>No equipment specifications listed.</p>
              ) : (
                equipment.map((eq) => (
                  <div key={eq.id} className="fc-card fc-card-pad" style={{ padding: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{eq.equipment_name}</div>
                      {eq.specification && (
                        <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "2px" }}>{eq.specification}</div>
                      )}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      {eq.estimated_cost_min && (
                        <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--primary)", display: "block" }}>
                          ₹{Number(eq.estimated_cost_min).toLocaleString()} - ₹{Number(eq.estimated_cost_max || eq.estimated_cost_min).toLocaleString()}
                        </span>
                      )}
                      <Badge variant={eq.is_mandatory ? "primary" : "neutral"}>
                        {eq.is_mandatory ? "Mandatory" : "Optional"}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab 4: Packaging & Storage */}
          {activeTab === "packaging" && (
            <div>
              {!packaging ? (
                <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>No packaging & storage information recorded.</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px" }}>
                  <div className="fc-card fc-card-pad" style={{ padding: "14px" }}>
                    <h5 style={{ margin: "0 0 8px 0", fontSize: "0.875rem", color: "var(--muted)" }}>Packaging Type</h5>
                    <div style={{ fontWeight: 600 }}>{packaging.packaging_type}</div>
                    {packaging.material_specification && (
                      <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "4px" }}>{packaging.material_specification}</p>
                    )}
                  </div>
                  <div className="fc-card fc-card-pad" style={{ padding: "14px" }}>
                    <h5 style={{ margin: "0 0 8px 0", fontSize: "0.875rem", color: "var(--muted)" }}>Shelf Life & Storage</h5>
                    <div style={{ fontWeight: 600, color: "var(--primary)" }}>
                      {packaging.shelf_life_days ? `${packaging.shelf_life_days} Days Shelf Life` : "Standard Shelf Life"}
                    </div>
                    {packaging.storage_instructions && (
                      <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "4px" }}>{packaging.storage_instructions}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 5: Relevant Government Schemes */}
          {activeTab === "schemes" && (
            <div>
              {/* Disclaimer Notice Banner */}
              <div style={{
                background: "#fffbeb",
                border: "1px solid #fef3c7",
                borderRadius: "8px",
                padding: "10px 14px",
                marginBottom: "14px",
                fontSize: "0.8rem",
                color: "#92400e",
                lineHeight: 1.45
              }}>
                <strong>⚠️ Official Verification Note:</strong> Scheme benefits and eligibility details are maintained by government authorities and require formal verification upon application.
              </div>

              {schemes.length === 0 ? (
                <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>No government schemes currently mapped for this product.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {schemes.map((s) => (
                    <div
                      key={s.scheme_id || s.id}
                      style={{
                        padding: "14px",
                        borderRadius: "8px",
                        border: "1px solid var(--border)",
                        background: "var(--bg-subtle, #f8fafc)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", flexWrap: "wrap" }}>
                        <div>
                          <div style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "2px" }}>
                            <Badge variant="success">{s.short_code}</Badge>
                            <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600 }}>{s.authority}</span>
                          </div>
                          <h4 style={{ margin: 0, fontSize: "0.95rem", color: "var(--text-main)" }}>{s.scheme_name}</h4>
                        </div>
                        {s.last_updated_date && (
                          <span style={{ fontSize: "0.725rem", color: "var(--muted)", background: "#ffffff", padding: "2px 6px", borderRadius: "4px", border: "1px solid var(--border)" }}>
                            Updated: {s.last_updated_date}
                          </span>
                        )}
                      </div>

                      <p style={{ margin: 0, fontSize: "0.825rem", color: "var(--text-main)", lineHeight: 1.4 }}>{s.description}</p>

                      {s.relevance_notes && (
                        <div style={{ fontSize: "0.775rem", color: "var(--primary)", fontWeight: 600, background: "#eff6ff", padding: "6px 10px", borderRadius: "4px", border: "1px solid #bfdbfe" }}>
                          📌 Processing Support: {s.relevance_notes}
                        </div>
                      )}

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "8px" }}>
                        <div style={{ background: "#ffffff", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border)", fontSize: "0.775rem" }}>
                          <strong style={{ color: "#1e40af", display: "block", marginBottom: "2px" }}>Eligibility Information:</strong>
                          {s.eligibility_info}
                        </div>
                        <div style={{ background: "#ffffff", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border)", fontSize: "0.775rem" }}>
                          <strong style={{ color: "#15803d", display: "block", marginBottom: "2px" }}>Benefits & Subsidies:</strong>
                          {s.benefits_info}
                        </div>
                      </div>

                      {s.official_source_url && (
                        <div style={{ marginTop: "2px", display: "flex", justifyContent: "flex-end" }}>
                          <a
                            href={s.official_source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              fontSize: "0.775rem",
                              fontWeight: 600,
                              color: "var(--primary)",
                              textDecoration: "none"
                            }}
                          >
                            Official Source Portal <ArrowRight size={12} />
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 6: Market & Commercial Info */}
          {activeTab === "market" && (
            <div>
              {!marketInfo ? (
                <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>No market information recorded.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {marketInfo.target_market && (
                    <div className="fc-card fc-card-pad" style={{ padding: "12px" }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Target Buyers & Market</span>
                      <div style={{ fontWeight: 600, marginTop: "2px" }}>{marketInfo.target_market}</div>
                    </div>
                  )}
                  {marketInfo.commercial_uses && (
                    <div className="fc-card fc-card-pad" style={{ padding: "12px" }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Commercial Uses</span>
                      <div style={{ fontSize: "0.875rem", marginTop: "2px" }}>{marketInfo.commercial_uses}</div>
                    </div>
                  )}
                  {marketInfo.quality_standards && (
                    <div className="fc-card fc-card-pad" style={{ padding: "12px" }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Quality & FSSAI Standards</span>
                      <div style={{ fontSize: "0.875rem", marginTop: "2px" }}>{marketInfo.quality_standards}</div>
                    </div>
                  )}
                  {marketInfo.govt_schemes_info && (
                    <div className="fc-card fc-card-pad" style={{ padding: "12px", background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                      <span style={{ fontSize: "0.75rem", color: "#166534", fontWeight: "bold" }}>Government Subsidies & Support</span>
                      <div style={{ fontSize: "0.875rem", color: "#15803d", marginTop: "2px" }}>{marketInfo.govt_schemes_info}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
