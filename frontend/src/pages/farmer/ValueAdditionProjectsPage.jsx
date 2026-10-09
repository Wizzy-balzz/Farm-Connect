import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../components/common/Card.jsx";
import Button from "../../components/common/Button.jsx";
import Badge from "../../components/common/Badge.jsx";
import LoadingState from "../../components/common/LoadingState.jsx";
import EmptyState from "../../components/common/EmptyState.jsx";
import ErrorState from "../../components/common/ErrorState.jsx";
import { getValueAdditionProjects, deleteValueAdditionProject } from "../../services/valueAdditionService.js";
import {
  ArrowLeft,
  Sprout,
  Plus,
  Trash2,
  Eye,
  TrendingUp,
  RefreshCw,
  Calculator
} from "../../components/icons/Icons.jsx";

export default function ValueAdditionProjectsPage() {
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedProject, setSelectedProject] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const loadProjects = () => {
    setLoading(true);
    setError(null);
    getValueAdditionProjects()
      .then((data) => {
        setProjects(data || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load saved processing projects.");
        setLoading(false);
      });
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete project "${name}"?`)) {
      return;
    }
    setDeletingId(id);
    try {
      await deleteValueAdditionProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      if (selectedProject?.id === id) {
        setSelectedProject(null);
      }
    } catch (err) {
      alert(err.message || "Failed to delete project.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fc-page animate-fade-in" style={{ paddingBottom: "50px" }}>
      {/* Top Bar */}
      <div style={{ marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Button variant="subtle" size="small" onClick={() => navigate("/farmer/value-addition")}>
          <ArrowLeft size={16} /> Back to Catalog
        </Button>
        <div style={{ display: "flex", gap: "10px" }}>
          <Button variant="outline" size="small" onClick={() => navigate("/farmer/value-addition/calculator")}>
            <Calculator size={14} /> Open Calculator
          </Button>
        </div>
      </div>

      {/* Header */}
      <div className="fc-page-header" style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--primary)", fontWeight: 600, fontSize: "0.875rem", marginBottom: "4px" }}>
            <Sprout size={16} /> Saved Portfolio
          </div>
          <h1 className="fc-h1" style={{ margin: 0 }}>My Value Addition Projects</h1>
          <p className="fc-muted" style={{ margin: "4px 0 0 0", fontSize: "0.875rem" }}>
            Track and manage your explicitly saved processing calculation scenarios and ROI projections.
          </p>
        </div>

        <Button variant="primary" onClick={() => navigate("/farmer/value-addition/calculator")}>
          <Plus size={16} /> New Processing Plan
        </Button>
      </div>

      {/* Loading State */}
      {loading && <LoadingState text="Loading saved processing projects..." />}

      {/* Error State */}
      {!loading && error && (
        <ErrorState
          message={error}
          onRetry={loadProjects}
        />
      )}

      {/* Empty State */}
      {!loading && !error && projects.length === 0 && (
        <EmptyState
          title="No saved value addition projects yet."
          description="Use the Value Addition Calculator to compute processing profit scenarios and save your project plans here."
          actionText="Open Calculator"
          onAction={() => navigate("/farmer/value-addition/calculator")}
        />
      )}

      {/* Projects Grid / Cards */}
      {!loading && !error && projects.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ fontSize: "0.85rem", color: "var(--muted)", fontWeight: 600 }}>
            {projects.length} Saved {projects.length === 1 ? "Project" : "Projects"}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
            {projects.map((proj) => {
              const profit = Number(proj.projected_profit || 0);
              const roi = Number(proj.roi_percentage || 0);
              const formattedDate = proj.created_at ? new Date(proj.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";

              return (
                <Card key={proj.id} hoverable style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginBottom: "8px" }}>
                    <Badge variant="primary">{proj.crop_name}</Badge>
                    <Badge variant={proj.status === "COMPLETED" ? "success" : "neutral"}>
                      {proj.status || "SAVED"}
                    </Badge>
                  </div>

                  <h3 style={{ margin: "4px 0 6px 0", fontSize: "1.1rem", color: "var(--text-main)" }}>
                    {proj.project_name}
                  </h3>

                  {proj.catalog_product_name && (
                    <div style={{ fontSize: "0.8rem", color: "var(--primary)", fontWeight: 500, marginBottom: "8px" }}>
                      Target Product: {proj.catalog_product_name}
                    </div>
                  )}

                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "8px",
                    padding: "10px",
                    background: "var(--bg-subtle, #f8fafc)",
                    borderRadius: "6px",
                    margin: "8px 0 14px 0",
                    fontSize: "0.8rem"
                  }}>
                    <div>
                      <span style={{ color: "var(--muted)", display: "block" }}>Input Raw Qty</span>
                      <strong>{Number(proj.raw_quantity).toLocaleString()} {proj.raw_unit || "kg"}</strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--muted)", display: "block" }}>Expected Output</span>
                      <strong>{Number(proj.expected_processed_qty).toLocaleString()} {proj.processed_unit || "kg"}</strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--muted)", display: "block" }}>Total Cost</span>
                      <strong>₹{Number(proj.total_cost).toLocaleString()}</strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--muted)", display: "block" }}>Expected Revenue</span>
                      <strong>₹{Number(proj.projected_revenue).toLocaleString()}</strong>
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <div>
                      <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>Estimated Net Profit</span>
                      <span style={{ fontSize: "1.15rem", fontWeight: "bold", color: profit >= 0 ? "#16a34a" : "#dc2626" }}>
                        ₹{profit.toLocaleString()}
                      </span>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block" }}>Projected ROI</span>
                      <span style={{ fontSize: "1.15rem", fontWeight: "bold", color: roi >= 0 ? "#16a34a" : "#dc2626" }}>
                        {roi.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div style={{ marginTop: "auto", paddingTop: "10px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      Saved: {formattedDate}
                    </span>

                    <div style={{ display: "flex", gap: "6px" }}>
                      <Button
                        variant="subtle"
                        size="small"
                        onClick={() => setSelectedProject(proj)}
                      >
                        <Eye size={14} /> View
                      </Button>
                      <Button
                        variant="primary"
                        size="small"
                        onClick={() => navigate("/farmer/my-products", {
                          state: {
                            openAdd: true,
                            prefill: {
                              name: proj.project_name,
                              category: "Processed Foods",
                              description: `Value-added ${proj.project_name} project. Output yield: ${proj.expected_processed_qty} ${proj.processed_unit || "kg"}.`,
                              value_added_product_id: proj.value_added_product_id || null,
                              price: Math.round(Number(proj.expected_selling_price || 100)),
                              unit: proj.processed_unit || "kg",
                              stock: Math.round(Number(proj.expected_processed_qty || 100)),
                              grade: "A"
                            }
                          }
                        })}
                      >
                        🛒 Sell
                      </Button>
                      <Button
                        variant="subtle"
                        size="small"
                        disabled={deletingId === proj.id}
                        onClick={() => handleDelete(proj.id, proj.project_name)}
                        style={{ color: "var(--danger)" }}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Project Detail Modal */}
      {selectedProject && (
        <div className="fc-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedProject(null); }}>
          <div className="fc-modal-content animate-fade-in" style={{ maxWidth: "560px", width: "90%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div>
                <Badge variant="primary">{selectedProject.crop_name}</Badge>
                <h2 className="fc-h2" style={{ margin: "4px 0 0 0" }}>{selectedProject.project_name}</h2>
              </div>
              <button className="fc-icon-btn" onClick={() => setSelectedProject(null)}>✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "0.85rem" }}>
              <div style={{ padding: "12px", background: "var(--bg-subtle, #f8fafc)", borderRadius: "8px" }}>
                <div style={{ fontWeight: 600, marginBottom: "6px", color: "var(--text-main)" }}>Raw Crop Parameters</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <div>Raw Harvest Qty: <strong>{Number(selectedProject.raw_quantity).toLocaleString()} {selectedProject.raw_unit}</strong></div>
                  <div>Raw Price: <strong>₹{Number(selectedProject.raw_unit_price).toLocaleString()} / {selectedProject.raw_unit}</strong></div>
                  <div style={{ gridColumn: "span 2" }}>Raw Crop Base Value: <strong>₹{Number(selectedProject.raw_material_cost).toLocaleString()}</strong></div>
                </div>
              </div>

              <div style={{ padding: "12px", background: "var(--bg-subtle, #f8fafc)", borderRadius: "8px" }}>
                <div style={{ fontWeight: 600, marginBottom: "6px", color: "var(--text-main)" }}>Processing & Operational Overheads</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                  <div>Processing / Energy: ₹{Number(selectedProject.processing_cost).toLocaleString()}</div>
                  <div>Labour Cost: ₹{Number(selectedProject.labour_cost).toLocaleString()}</div>
                  <div>Packaging Cost: ₹{Number(selectedProject.packaging_cost).toLocaleString()}</div>
                  <div>Transport Cost: ₹{Number(selectedProject.transport_cost).toLocaleString()}</div>
                  <div>Other Costs: ₹{Number(selectedProject.other_costs).toLocaleString()}</div>
                  <div style={{ fontWeight: "bold" }}>Total Cost: ₹{Number(selectedProject.total_cost).toLocaleString()}</div>
                </div>
              </div>

              <div style={{ padding: "12px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", color: "#15803d" }}>
                <div style={{ fontWeight: 600, marginBottom: "6px" }}>Output & Projected Returns</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <div>Expected Output: <strong>{Number(selectedProject.expected_processed_qty).toLocaleString()} {selectedProject.processed_unit}</strong></div>
                  <div>Selling Price: <strong>₹{Number(selectedProject.expected_selling_price).toLocaleString()} / {selectedProject.processed_unit}</strong></div>
                  <div>Projected Revenue: <strong>₹{Number(selectedProject.projected_revenue).toLocaleString()}</strong></div>
                  <div>Estimated Profit: <strong>₹{Number(selectedProject.projected_profit).toLocaleString()}</strong></div>
                  <div style={{ gridColumn: "span 2", fontSize: "1rem" }}>
                    Projected ROI: <strong>{Number(selectedProject.roi_percentage).toFixed(1)}%</strong>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end" }}>
              <Button variant="outline" onClick={() => setSelectedProject(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
