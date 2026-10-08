import { useState, useEffect, useCallback, memo } from "react";
import { apiFetch } from "../../services/api.js";
import { Card, Button, Badge, EmptyState } from "../common/index.js";
import {
  Sprout,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  Check,
  RefreshCw,
  Plus,
  ArrowRight,
  Info
} from "../icons/Icons.jsx";
import { formatCurrency } from "../../utils/formatters.js";

function FarmCopilotDashboardBase({ onOpenActionCenter, onAskChat }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  // Goal Creation Form State
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [newGoalTarget, setNewGoalTarget] = useState("");
  const [newGoalUnit, setNewGoalUnit] = useState("kg");
  const [newGoalCategory, setNewGoalCategory] = useState("selling");
  const [newGoalDeadline, setNewGoalDeadline] = useState("");
  const [creatingGoal, setCreatingGoal] = useState(false);

  // Follow-up Form State
  const [showFollowupModal, setShowFollowupModal] = useState(false);
  const [newFollowupTitle, setNewFollowupTitle] = useState("");
  const [newFollowupDesc, setNewFollowupDesc] = useState("");
  const [newFollowupType, setNewFollowupType] = useState("price_alert");
  const [creatingFollowup, setCreatingFollowup] = useState(false);

  // Plan Execution State
  const [planQuery, setPlanQuery] = useState("Should I sell my tomatoes this week?");
  const [planning, setPlanning] = useState(false);
  const [planResult, setPlanResult] = useState(null);

  const fetchCopilotData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch("/api/ai/copilot/dashboard");
      if (res && res.copilot) {
        setData(res.copilot);
      }
    } catch (err) {
      console.error("Failed to load copilot dashboard:", err);
      setError(err.message || "Failed to load copilot summary.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCopilotData();
  }, [fetchCopilotData]);

  const handleCreateGoal = async (e) => {
    e.preventDefault();
    if (!newGoalTitle.trim() || !newGoalTarget) return;

    try {
      setCreatingGoal(true);
      await apiFetch("/api/ai/goals", {
        method: "POST",
        body: JSON.stringify({
          title: newGoalTitle.trim(),
          category: newGoalCategory,
          targetValue: parseFloat(newGoalTarget),
          unit: newGoalUnit,
          deadline: newGoalDeadline || null
        })
      });
      setShowGoalModal(false);
      setNewGoalTitle("");
      setNewGoalTarget("");
      fetchCopilotData();
    } catch (err) {
      alert(err.message || "Failed to create goal.");
    } finally {
      setCreatingGoal(false);
    }
  };

  const handleCreateFollowup = async (e) => {
    e.preventDefault();
    if (!newFollowupTitle.trim()) return;

    try {
      setCreatingFollowup(true);
      await apiFetch("/api/ai/followups", {
        method: "POST",
        body: JSON.stringify({
          title: newFollowupTitle.trim(),
          description: newFollowupDesc.trim(),
          type: newFollowupType
        })
      });
      setShowFollowupModal(false);
      setNewFollowupTitle("");
      setNewFollowupDesc("");
      fetchCopilotData();
    } catch (err) {
      alert(err.message || "Failed to create reminder.");
    } finally {
      setCreatingFollowup(false);
    }
  };

  const handleCompleteFollowup = async (id) => {
    try {
      await apiFetch(`/api/ai/followups/${id}/complete`, { method: "PUT" });
      fetchCopilotData();
    } catch (err) {
      console.error("Complete followup error:", err);
    }
  };

  const handleRecalculateGoal = async (id) => {
    try {
      await apiFetch(`/api/ai/goals/${id}/recalculate`, { method: "POST" });
      fetchCopilotData();
    } catch (err) {
      console.error("Recalculate goal error:", err);
    }
  };

  const handleRunPlanner = async (queryText) => {
    const q = queryText || planQuery;
    try {
      setPlanning(true);
      setPlanResult(null);
      const res = await apiFetch("/api/ai/copilot/plan", {
        method: "POST",
        body: JSON.stringify({ query: q })
      });
      if (res && res.success) {
        setPlanResult(res);
      }
    } catch (err) {
      console.error("Plan execution error:", err);
    } finally {
      setPlanning(false);
    }
  };

  if (loading && !data) {
    return (
      <Card style={{ padding: "28px", textAlign: "center", minHeight: "220px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div>
          <RefreshCw size={24} style={{ animation: "spin 1s linear infinite", color: "var(--brand)", marginBottom: "12px" }} />
          <div style={{ fontWeight: 600, color: "var(--text)" }}>AI Farming Personal Copilot is analyzing your farm...</div>
          <div className="fc-soft" style={{ fontSize: "12px", marginTop: "4px" }}>Synchronizing inventory, market demand, goals, and weather</div>
        </div>
      </Card>
    );
  }

  const { priorities = [], goals = [], followups = [], insights = [], pendingActions = [] } = data || {};

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* 1. COPILOT HERO BANNER */}
      <div
        style={{
          background: "linear-gradient(135deg, #1e3a2b 0%, #2d5a3f 50%, #1e4d3a 100%)",
          borderRadius: "var(--radius-lg)",
          padding: "24px 28px",
          color: "#ffffff",
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.2)",
          position: "relative",
          overflow: "hidden"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ background: "rgba(255,255,255,0.2)", padding: "4px 10px", borderRadius: "12px", fontSize: "12px", fontWeight: 700, letterSpacing: "0.5px" }}>
                🌾 FARMCONNECT AI COPILOT
              </span>
              <span style={{ fontSize: "12px", opacity: 0.85 }}>Phase 11 Active</span>
            </div>
            <h2 style={{ margin: "0 0 6px 0", fontSize: "24px", fontWeight: 800 }}>
              Hello, {data?.userName || "Farmer"}!
            </h2>
            <p style={{ margin: 0, fontSize: "14px", opacity: 0.9, maxWidth: "600px" }}>
              Your proactive copilot is actively tracking your goals, inventory momentum, and wholesale selling opportunities.
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {pendingActions.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenActionCenter}
                style={{ background: "#fef3c7", color: "#92400e", borderColor: "#fde68a", fontWeight: 700 }}
              >
                ⚠️ {pendingActions.length} Pending Actions
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchCopilotData()}
              style={{ background: "rgba(255,255,255,0.15)", color: "#fff", borderColor: "rgba(255,255,255,0.3)" }}
            >
              🔄 Refresh Status
            </Button>
          </div>
        </div>

        {/* Priorities Ticker */}
        {priorities.length > 0 && (
          <div
            style={{
              marginTop: "20px",
              padding: "12px 16px",
              background: "rgba(0,0,0,0.25)",
              borderRadius: "var(--radius-md)",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap"
            }}
          >
            <strong style={{ fontSize: "12px", color: "#86efac", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Today's Priorities:
            </strong>
            {priorities.slice(0, 3).map((pri, idx) => (
              <div key={pri.id || idx} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "13px" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: pri.severity === "warning" ? "#fbbf24" : "#4ade80" }} />
                <span>{pri.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. COPILOT STRATEGIC PLANNER (MULTI-STEP AGENT) */}
      <Card style={{ padding: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h3 className="fc-h3" style={{ margin: "0 0 4px 0", display: "flex", alignItems: "center", gap: 8 }}>
              <span>🧠 Multi-Step Strategic Planner</span>
              <Badge variant="primary">Agentic</Badge>
            </h3>
            <p className="fc-soft" style={{ margin: 0, fontSize: "13px" }}>
              AI coordinates inventory, prices, market demand, and weather to formulate verified recommendations.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPlanQuery("Should I sell my tomatoes this week?");
                handleRunPlanner("Should I sell my tomatoes this week?");
              }}
              disabled={planning}
            >
              🍅 Tomato Sell Plan
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPlanQuery("Review farm health and selling opportunities");
                handleRunPlanner("Review farm health and selling opportunities");
              }}
              disabled={planning}
            >
              📊 30-Day Opportunity Check
            </Button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: "16px" }}>
          <input
            type="text"
            className="fc-input"
            value={planQuery}
            onChange={(e) => setPlanQuery(e.target.value)}
            placeholder="Ask a strategic farming question (e.g., Should I sell my harvest now?)"
            style={{ flex: 1 }}
            disabled={planning}
          />
          <Button variant="primary" onClick={() => handleRunPlanner()} disabled={planning}>
            {planning ? "Executing Plan..." : "Run Plan →"}
          </Button>
        </div>

        {/* Plan Steps Visibility */}
        {planResult && (
          <div style={{ background: "var(--surface-hover)", borderRadius: "var(--radius-md)", padding: "18px", marginTop: "16px", border: "1px solid var(--border)" }}>
            <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--brand)" }}>
              Plan Execution Trace ({planResult.completedSteps}/{planResult.totalSteps} steps completed in {planResult.totalDurationMs}ms)
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "18px" }}>
              {planResult.planSteps.map((step) => (
                <div
                  key={step.stepIndex}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "8px 12px",
                    background: "var(--surface)",
                    borderRadius: "6px",
                    fontSize: "13px"
                  }}
                >
                  <span style={{ fontWeight: 700, color: step.status === "completed" ? "#16a34a" : "#ca8a04" }}>
                    {step.status === "completed" ? "✓" : "⏳"} Step {step.stepIndex}:
                  </span>
                  <span style={{ fontWeight: 600 }}>{step.description}</span>
                  {step.summary && (
                    <span className="fc-soft" style={{ marginLeft: "auto", fontSize: "12px" }}>
                      {step.summary} ({step.durationMs}ms)
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Facts vs Reasoning vs Recommendation */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
              <div style={{ background: "var(--surface)", padding: "14px", borderRadius: "8px", borderLeft: "4px solid #3b82f6" }}>
                <div style={{ fontWeight: 700, fontSize: "12px", color: "#1d4ed8", marginBottom: 6 }}>
                  VERIFIED FACTS:
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: "12px", lineHeight: "1.6" }}>
                  {(planResult.facts || []).map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>

              <div style={{ background: "var(--surface)", padding: "14px", borderRadius: "8px", borderLeft: "4px solid #10b981" }}>
                <div style={{ fontWeight: 700, fontSize: "12px", color: "#047857", marginBottom: 6 }}>
                  AI REASONING & SYNTHESIS:
                </div>
                <div style={{ fontSize: "12px", lineHeight: "1.6", whiteSpace: "pre-line" }}>
                  {planResult.reasoning}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 14, padding: "12px 16px", background: "rgba(22, 163, 74, 0.1)", borderRadius: "6px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                <strong style={{ color: "#15803d", fontSize: "13px" }}>
                  RECOMMENDATION: {planResult.recommendation?.action}
                </strong>
                <div style={{ fontSize: "12px", color: "var(--text)" }}>
                  {planResult.recommendation?.description}
                </div>
              </div>
              {onOpenActionCenter && (
                <Button variant="outline" size="sm" onClick={onOpenActionCenter}>
                  Review Action Center →
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* 3. ACTIVE GOALS & FOLLOW-UPS GRID */}
      <div className="fc-grid-2">
        {/* Farming Goals Section */}
        <Card style={{ padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 className="fc-h3" style={{ margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
              <span>🎯 Farming & Selling Goals</span>
              <Badge variant="neutral">{goals.length}</Badge>
            </h3>
            <Button variant="outline" size="sm" onClick={() => setShowGoalModal(true)}>
              + Set Goal
            </Button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {goals.map((g) => (
              <div
                key={g.id}
                style={{
                  padding: "14px",
                  background: "var(--surface-hover)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border)"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div>
                    <strong style={{ fontSize: "14px", color: "var(--text)" }}>{g.title}</strong>
                    <div className="fc-soft" style={{ fontSize: "11px", textTransform: "capitalize" }}>
                      Category: {g.category} {g.deadline ? `• Deadline: ${g.deadline}` : ""}
                    </div>
                  </div>
                  <button
                    className="fc-link-btn"
                    onClick={() => handleRecalculateGoal(g.id)}
                    title="Recalculate with live sales/inventory"
                    style={{ fontSize: "11px" }}
                  >
                    🔄 Recalculate
                  </button>
                </div>

                {/* Progress Bar */}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                  <span>Progress: {g.currentValue} / {g.targetValue} {g.unit}</span>
                  <strong>{g.progressPercent}%</strong>
                </div>
                <div style={{ width: "100%", height: "8px", background: "var(--border)", borderRadius: "4px", overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${Math.min(100, g.progressPercent)}%`,
                      height: "100%",
                      background: g.progressPercent >= 100 ? "#16a34a" : "var(--brand)",
                      borderRadius: "4px",
                      transition: "width 0.4s ease"
                    }}
                  />
                </div>
              </div>
            ))}

            {goals.length === 0 && (
              <EmptyState
                title="No active farming goals"
                description="Set a target to sell crops, reduce inventory, or track monthly farm sales."
              />
            )}
          </div>
        </Card>

        {/* Follow-ups & Reminders Section */}
        <Card style={{ padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 className="fc-h3" style={{ margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
              <span>⏰ AI Follow-ups & Tasks</span>
              <Badge variant="neutral">{followups.length}</Badge>
            </h3>
            <Button variant="outline" size="sm" onClick={() => setShowFollowupModal(true)}>
              + Schedule Task
            </Button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {followups.map((f) => (
              <div
                key={f.id}
                style={{
                  padding: "12px 14px",
                  background: "var(--surface-hover)",
                  borderRadius: "var(--radius-md)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  border: "1px solid var(--border)"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Clock size={16} style={{ color: "var(--brand)" }} />
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)" }}>{f.title}</div>
                    {f.description && <div className="fc-soft" style={{ fontSize: "11px" }}>{f.description}</div>}
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCompleteFollowup(f.id)}
                  title="Mark as completed"
                  style={{ fontSize: "12px", padding: "4px 10px" }}
                >
                  ✓ Done
                </Button>
              </div>
            ))}

            {followups.length === 0 && (
              <EmptyState
                title="No pending follow-ups"
                description="Copilot will proactively add reminders when weather risks or price movements occur."
              />
            )}
          </div>
        </Card>
      </div>

      {/* Set Goal Modal */}
      {showGoalModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px"
          }}
        >
          <div style={{ background: "var(--surface)", borderRadius: "var(--radius-lg)", padding: "24px", maxWidth: "450px", width: "100%", boxShadow: "var(--shadow-xl)" }}>
            <h3 className="fc-h3" style={{ marginBottom: "16px" }}>🎯 Set a New Farming Goal</h3>
            <form onSubmit={handleCreateGoal} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label className="fc-label">Goal Title *</label>
                <input
                  type="text"
                  className="fc-input"
                  placeholder="e.g. Sell 500 kg of Tomatoes this month"
                  value={newGoalTitle}
                  onChange={(e) => setNewGoalTitle(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label className="fc-label">Target Quantity / Value *</label>
                  <input
                    type="number"
                    className="fc-input"
                    placeholder="500"
                    value={newGoalTarget}
                    onChange={(e) => setNewGoalTarget(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="fc-label">Unit</label>
                  <input
                    type="text"
                    className="fc-input"
                    value={newGoalUnit}
                    onChange={(e) => setNewGoalUnit(e.target.value)}
                    placeholder="kg / INR"
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label className="fc-label">Category</label>
                  <select className="fc-input" value={newGoalCategory} onChange={(e) => setNewGoalCategory(e.target.value)}>
                    <option value="selling">Selling</option>
                    <option value="production">Production</option>
                    <option value="revenue">Revenue</option>
                    <option value="inventory">Inventory</option>
                  </select>
                </div>
                <div>
                  <label className="fc-label">Deadline</label>
                  <input
                    type="date"
                    className="fc-input"
                    value={newGoalDeadline}
                    onChange={(e) => setNewGoalDeadline(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                <Button variant="outline" type="button" onClick={() => setShowGoalModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" disabled={creatingGoal}>
                  {creatingGoal ? "Saving..." : "Save Goal"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Followup Modal */}
      {showFollowupModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px"
          }}
        >
          <div style={{ background: "var(--surface)", borderRadius: "var(--radius-lg)", padding: "24px", maxWidth: "450px", width: "100%", boxShadow: "var(--shadow-xl)" }}>
            <h3 className="fc-h3" style={{ marginBottom: "16px" }}>⏰ Schedule Follow-up Task</h3>
            <form onSubmit={handleCreateFollowup} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label className="fc-label">Task Title *</label>
                <input
                  type="text"
                  className="fc-input"
                  placeholder="e.g. Check tomato wholesale rates tomorrow"
                  value={newFollowupTitle}
                  onChange={(e) => setNewFollowupTitle(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="fc-label">Description (Optional)</label>
                <input
                  type="text"
                  className="fc-input"
                  placeholder="Additional context or notes"
                  value={newFollowupDesc}
                  onChange={(e) => setNewFollowupDesc(e.target.value)}
                />
              </div>

              <div>
                <label className="fc-label">Task Type</label>
                <select className="fc-input" value={newFollowupType} onChange={(e) => setNewFollowupType(e.target.value)}>
                  <option value="price_alert">Price Alert</option>
                  <option value="weather_check">Weather Check</option>
                  <option value="inventory_review">Inventory Review</option>
                  <option value="order_review">Order Review</option>
                  <option value="harvest_reminder">Harvest Reminder</option>
                  <option value="custom">Custom Task</option>
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                <Button variant="outline" type="button" onClick={() => setShowFollowupModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" disabled={creatingFollowup}>
                  {creatingFollowup ? "Scheduling..." : "Schedule Task"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export const FarmCopilotDashboard = memo(FarmCopilotDashboardBase);
export default FarmCopilotDashboard;
