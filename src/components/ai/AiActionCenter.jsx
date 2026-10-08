import { useState, useEffect, useCallback, memo } from "react";
import { apiFetch } from "../../services/api.js";
import { Card, Button, Badge, EmptyState } from "../common/index.js";
import { ActionConfirmationCard } from "./ActionConfirmationCard.jsx";
import { Check, X, Clock, RefreshCw, AlertTriangle, ArrowRight } from "../icons/Icons.jsx";
import { useNotifications } from "../../hooks/useNotifications.js";

function AiActionCenterBase({ onClose, onActionUpdated }) {
  const { notifySuccess, notifyError } = useNotifications();
  const [loading, setLoading] = useState(true);
  const [pendingActions, setPendingActions] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [activeFilter, setActiveFilter] = useState("all");

  const fetchActionsAndFollowups = useCallback(async () => {
    try {
      setLoading(true);
      const [actionsRes, followupsRes] = await Promise.all([
        apiFetch("/api/ai/copilot/pending-actions").catch(() => ({ pendingActions: [] })),
        apiFetch("/api/ai/followups?status=pending").catch(() => ({ followups: [] }))
      ]);

      if (actionsRes && actionsRes.pendingActions) {
        setPendingActions(actionsRes.pendingActions);
      }
      if (followupsRes && followupsRes.followups) {
        setFollowups(followupsRes.followups);
      }
    } catch (err) {
      console.error("Failed to load action center data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActionsAndFollowups();
  }, [fetchActionsAndFollowups]);

  const handleCompleteFollowup = async (id) => {
    try {
      await apiFetch(`/api/ai/followups/${id}/complete`, { method: "PUT" });
      notifySuccess("Follow-up task marked as complete!");
      fetchActionsAndFollowups();
      if (onActionUpdated) onActionUpdated();
    } catch (err) {
      notifyError("Failed to update follow-up.");
    }
  };

  const handleDismissFollowup = async (id) => {
    try {
      await apiFetch(`/api/ai/followups/${id}`, { method: "DELETE" });
      notifySuccess("Follow-up task dismissed.");
      fetchActionsAndFollowups();
      if (onActionUpdated) onActionUpdated();
    } catch (err) {
      notifyError("Failed to dismiss follow-up.");
    }
  };

  return (
    <Card style={{ padding: "24px", border: "1px solid var(--border)", boxShadow: "var(--shadow-md)" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 className="fc-h3" style={{ margin: "0 0 4px 0", display: "flex", alignItems: "center", gap: 8 }}>
            <span>⚡ Copilot Action Center</span>
            <Badge variant={pendingActions.length > 0 ? "warning" : "neutral"}>
              {pendingActions.length} Pending
            </Badge>
          </h2>
          <p className="fc-soft" style={{ margin: 0, fontSize: "13px" }}>
            All high-impact agricultural actions require your explicit review and confirmation before execution.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Button variant="outline" size="sm" onClick={fetchActionsAndFollowups} disabled={loading}>
            🔄 Refresh
          </Button>
          {onClose && (
            <Button variant="outline" size="sm" onClick={onClose}>
              ✕ Close
            </Button>
          )}
        </div>
      </div>

      {/* Tabs / Filter */}
      <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--border)", paddingBottom: "12px", marginBottom: "20px" }}>
        <button
          className={`fc-btn fc-btn-sm ${activeFilter === "all" ? "fc-btn-primary" : "fc-btn-outline"}`}
          onClick={() => setActiveFilter("all")}
        >
          All Items ({pendingActions.length + followups.length})
        </button>
        <button
          className={`fc-btn fc-btn-sm ${activeFilter === "actions" ? "fc-btn-primary" : "fc-btn-outline"}`}
          onClick={() => setActiveFilter("actions")}
        >
          Pending Mutations ({pendingActions.length})
        </button>
        <button
          className={`fc-btn fc-btn-sm ${activeFilter === "followups" ? "fc-btn-primary" : "fc-btn-outline"}`}
          onClick={() => setActiveFilter("followups")}
        >
          Tasks & Reminders ({followups.length})
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "40px" }} className="fc-soft">
          <RefreshCw size={20} style={{ animation: "spin 1s linear infinite", marginBottom: 8 }} />
          <div>Checking pending actions...</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Pending Mutations */}
          {(activeFilter === "all" || activeFilter === "actions") && (
            <>
              {pendingActions.map((action) => (
                <div
                  key={action.id}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    padding: "16px",
                    background: "var(--surface-hover)"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: "15px" }}>
                          {action.actionId?.replace(/_/g, " ")}
                        </span>
                        <Badge variant="warning">Requires Confirmation</Badge>
                      </div>
                      <div className="fc-soft" style={{ fontSize: "12px" }}>
                        Entity: {action.parameters?.productId || action.parameters?.orderId || "Produce Lot"}
                      </div>
                    </div>
                  </div>

                  {/* Values diff */}
                  <div
                    style={{
                      display: "flex",
                      gap: 16,
                      background: "var(--surface)",
                      padding: "12px",
                      borderRadius: "6px",
                      marginBottom: 14,
                      fontSize: "13px"
                    }}
                  >
                    <div>
                      <div className="fc-soft" style={{ fontSize: "11px" }}>CURRENT VALUE:</div>
                      <strong>{action.expectedState?.price ? `₹${action.expectedState.price}` : action.expectedState?.stock !== undefined ? `${action.expectedState.stock} units` : "N/A"}</strong>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", color: "var(--brand)" }}>→</div>
                    <div>
                      <div className="fc-soft" style={{ fontSize: "11px" }}>PROPOSED VALUE:</div>
                      <strong style={{ color: "var(--brand)" }}>
                        {action.parameters?.newPrice ? `₹${action.parameters.newPrice}` : action.parameters?.newStock !== undefined ? `${action.parameters.newStock} units` : action.parameters?.name || "Proposal"}
                      </strong>
                    </div>
                  </div>

                  <div className="fc-soft" style={{ fontSize: "12px", marginBottom: 12 }}>
                    Reason: {action.parameters?.reason || "Market benchmark update recommended by AI Copilot."}
                  </div>

                  {/* Confirmation Card / Action buttons */}
                  <ActionConfirmationCard
                    action={{
                      ...action,
                      actionType: action.actionId,
                      currentValue: action.expectedState?.price || action.expectedState?.stock,
                      proposedValue: action.parameters?.newPrice || action.parameters?.newStock,
                      confirmationToken: action.parameters?.confirmationToken || action.confirmationToken
                    }}
                    onActionComplete={() => {
                      fetchActionsAndFollowups();
                      if (onActionUpdated) onActionUpdated();
                    }}
                  />
                </div>
              ))}
            </>
          )}

          {/* Follow-up Tasks */}
          {(activeFilter === "all" || activeFilter === "followups") && (
            <>
              {followups.map((f) => (
                <div
                  key={f.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "14px 18px",
                    background: "var(--surface)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border)",
                    gap: 14
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <Clock size={18} style={{ color: "var(--brand)" }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "14px" }}>{f.title}</div>
                      {f.description && <div className="fc-soft" style={{ fontSize: "12px", marginTop: 2 }}>{f.description}</div>}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <Button variant="outline" size="sm" onClick={() => handleCompleteFollowup(f.id)}>
                      ✓ Complete
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDismissFollowup(f.id)} style={{ color: "#ef4444" }}>
                      ✕ Dismiss
                    </Button>
                  </div>
                </div>
              ))}
            </>
          )}

          {pendingActions.length === 0 && followups.length === 0 && (
            <EmptyState
              title="All Caught Up!"
              description="There are no pending actions or follow-ups waiting for confirmation. Your farm operations are fully synchronized."
            />
          )}
        </div>
      )}
    </Card>
  );
}

export const AiActionCenter = memo(AiActionCenterBase);
export default AiActionCenter;
