import { useState, useEffect, useCallback, useMemo, memo } from "react";
import { apiFetch } from "../../services/api.js";
import { Button } from "../common/Button.jsx";
import { Badge } from "../common/Badge.jsx";
import { Card } from "../common/Card.jsx";
import { Modal } from "../common/Modal.jsx";
import { Search, Trash, RefreshCw, Sprout, AlertTriangle, Plus } from "../icons/Icons.jsx";
import { useNotifications } from "../../hooks/useNotifications.js";

const MEMORY_TYPES = ["All", "preference", "crop_history", "strategy", "general"];

function AiMemoryManagerBase({ onMemoryChanged }) {
  const { notifySuccess, notifyError } = useNotifications();

  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("All");

  // Deletion Confirmation Modal State
  const [deleteConfirmItem, setDeleteConfirmItem] = useState(null);
  const [clearAllConfirmOpen, setClearAllConfirmOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // New Memory Modal State
  const [newMemoryModalOpen, setNewMemoryModalOpen] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newType, setNewType] = useState("preference");

  const fetchMemories = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const data = await apiFetch("/api/ai/memory");
      if (data && Array.isArray(data.memories)) {
        setMemories(data.memories);
      } else {
        setMemories([]);
      }
    } catch (err) {
      console.error("Failed to load AI memories:", err);
      notifyError("Failed to load AI memories.");
      setMemories([]);
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useEffect(() => {
    let ignore = false;
    apiFetch("/api/ai/memory")
      .then((data) => {
        if (!ignore && data && Array.isArray(data.memories)) {
          setMemories(data.memories);
        }
      })
      .catch((err) => {
        if (!ignore) {
          console.error("Failed to load AI memories:", err);
          notifyError("Failed to load AI memories.");
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [notifyError]);

  // Filtered Memories
  const filteredMemories = useMemo(() => {
    return memories.filter((m) => {
      const matchesType = selectedType === "All" || m.memoryType === selectedType;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        (m.key && m.key.toLowerCase().includes(q)) ||
        (m.value && m.value.toLowerCase().includes(q)) ||
        (m.memoryType && m.memoryType.toLowerCase().includes(q));
      return matchesType && matchesSearch;
    });
  }, [memories, selectedType, searchQuery]);

  // Handle single memory deletion
  const handleDeleteItem = async () => {
    if (!deleteConfirmItem) return;
    setActionLoading(true);
    try {
      const res = await apiFetch(`/api/ai/memory/${deleteConfirmItem.id}`, {
        method: "DELETE"
      });
      if (res && res.success) {
        setMemories((prev) => prev.filter((m) => m.id !== deleteConfirmItem.id));
        notifySuccess(`Removed memory preference "${deleteConfirmItem.key}"`);
        if (onMemoryChanged) onMemoryChanged();
      } else {
        notifyError("Failed to delete memory item.");
      }
    } catch (err) {
      notifyError(err.message || "Failed to delete memory item.");
    } finally {
      setActionLoading(false);
      setDeleteConfirmItem(null);
    }
  };

  // Handle clear all memories
  const handleClearAll = async () => {
    setActionLoading(true);
    try {
      const res = await apiFetch("/api/ai/memory", {
        method: "DELETE"
      });
      if (res && res.success) {
        setMemories([]);
        notifySuccess(`Cleared ${res.deletedCount || "all"} AI memories.`);
        if (onMemoryChanged) onMemoryChanged();
      } else {
        notifyError("Failed to clear memories.");
      }
    } catch (err) {
      notifyError(err.message || "Failed to clear memories.");
    } finally {
      setActionLoading(false);
      setClearAllConfirmOpen(false);
    }
  };

  // Handle manual preference addition
  const handleCreateMemory = async (e) => {
    e.preventDefault();
    if (!newKey.trim() || !newValue.trim()) {
      notifyError("Both preference name and value are required.");
      return;
    }

    setActionLoading(true);
    try {
      const res = await apiFetch("/api/ai/memory", {
        method: "POST",
        body: JSON.stringify({
          memoryType: newType,
          key: newKey.trim(),
          value: newValue.trim(),
          source: "user_explicit"
        })
      });

      if (res && res.success) {
        notifySuccess("AI memory preference saved.");
        setNewKey("");
        setNewValue("");
        setNewMemoryModalOpen(false);
        fetchMemories();
        if (onMemoryChanged) onMemoryChanged();
      }
    } catch (err) {
      notifyError(err.message || "Failed to save AI preference.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="fc-ai-memory-manager">
      {/* Header & Description */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14, marginBottom: 18 }}>
        <div>
          <h3 className="fc-h3" style={{ margin: "0 0 6px 0", display: "flex", alignItems: "center", gap: 8 }}>
            <Sprout size={20} color="var(--brand)" />
            AI Copilot Memory & Preferences
          </h3>
          <p className="fc-muted" style={{ fontSize: "13px", margin: 0, maxWidth: "600px", lineHeight: 1.5 }}>
            FarmConnect securely saves selected operational parameters (preferred crops, typical lot volumes, regional mandis) to deliver proactive and contextual farming advice.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchMemories}
            disabled={loading}
            aria-label="Refresh AI memories"
            title="Refresh memory list"
          >
            <RefreshCw size={14} /> Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setNewMemoryModalOpen(true)}
            style={{ fontWeight: 700 }}
          >
            <Plus size={14} /> Add Preference
          </Button>
          {memories.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setClearAllConfirmOpen(true)}
              style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
            >
              Clear All
            </Button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {MEMORY_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              className={`fc-radio-chip ${selectedType === type ? "active" : ""}`}
              onClick={() => setSelectedType(type)}
              style={{ fontSize: "12px", textTransform: "capitalize", padding: "4px 10px" }}
            >
              {type === "All" ? "All Memories" : type.replace("_", " ")}
            </button>
          ))}
        </div>

        <div style={{ position: "relative", minWidth: "220px" }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input
            className="fc-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search saved preferences..."
            style={{ paddingLeft: "32px", fontSize: "12.5px", height: "34px" }}
          />
        </div>
      </div>

      {/* Memory Cards Grid */}
      {loading ? (
        <div style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
          Loading AI memory profile...
        </div>
      ) : filteredMemories.length === 0 ? (
        <Card style={{ padding: "28px", textAlign: "center", background: "var(--bg-soft)" }}>
          <div style={{ fontSize: "28px", marginBottom: "8px" }}>🧠</div>
          <h4 style={{ margin: "0 0 6px 0", fontSize: "14px", fontWeight: 700 }}>
            {memories.length === 0 ? "No Saved AI Memories Yet" : "No Matching Memories Found"}
          </h4>
          <p className="fc-muted" style={{ fontSize: "12.5px", margin: "0 auto 16px auto", maxWidth: "440px", lineHeight: 1.4 }}>
            {memories.length === 0
              ? "As you interact with your Farming Copilot, key preferences such as preferred harvest lots and mandi targets will be automatically recorded here."
              : "Try adjusting your search query or switching categories."}
          </p>
          {memories.length === 0 && (
            <Button variant="outline" size="sm" onClick={() => setNewMemoryModalOpen(true)}>
              + Add First Preference
            </Button>
          )}
        </Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
          {filteredMemories.map((m) => (
            <Card
              key={m.id}
              style={{
                padding: "14px 16px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                borderLeft: "3px solid var(--brand)",
                background: "var(--surface)"
              }}
            >
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                  <Badge variant="neutral" style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    {m.memoryType || "general"}
                  </Badge>
                  <span className="fc-soft" style={{ fontSize: "11px" }}>
                    {m.updatedAt ? new Date(m.updatedAt).toLocaleDateString() : ""}
                  </span>
                </div>

                <div style={{ fontWeight: 700, fontSize: "13.5px", color: "var(--text)", marginBottom: 4 }}>
                  {m.key}
                </div>
                <div style={{ fontSize: "12.5px", color: "var(--text-muted)", lineHeight: 1.4, wordBreak: "break-word" }}>
                  {m.value}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, paddingTop: 8, borderTop: "1px solid var(--border)" }}>
                <span className="fc-soft" style={{ fontSize: "11px" }}>
                  Source: {m.source === "user_explicit" ? "Explicit" : "Conversation"}
                </span>
                <button
                  type="button"
                  onClick={() => setDeleteConfirmItem(m)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    padding: "4px 6px",
                    borderRadius: "4px",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: "11.5px",
                    transition: "color 0.15s"
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--danger)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                  aria-label={`Delete memory for ${m.key}`}
                  title="Forget this memory"
                >
                  <Trash size={13} /> Forget
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!deleteConfirmItem}
        onClose={() => setDeleteConfirmItem(null)}
        title="Forget AI Preference?"
        width={440}
      >
        <div style={{ padding: "4px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--danger)", marginBottom: 12 }}>
            <AlertTriangle size={20} />
            <strong style={{ fontSize: "14px" }}>Confirm Memory Removal</strong>
          </div>
          <p className="fc-muted" style={{ fontSize: "13px", lineHeight: 1.5, margin: "0 0 16px 0" }}>
            Are you sure you want FarmConnect AI to forget the preference for <strong>"{deleteConfirmItem?.key}"</strong>? The assistant will no longer consider this context in future recommendations.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <Button variant="ghost" onClick={() => setDeleteConfirmItem(null)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button
              variant="accent"
              onClick={handleDeleteItem}
              disabled={actionLoading}
              style={{ background: "var(--danger)", borderColor: "var(--danger)", color: "#fff" }}
            >
              {actionLoading ? "Forgetting..." : "Yes, Forget"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Clear All Confirmation Modal */}
      <Modal
        open={clearAllConfirmOpen}
        onClose={() => setClearAllConfirmOpen(false)}
        title="Clear All AI Memory?"
        width={460}
      >
        <div style={{ padding: "4px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--danger)", marginBottom: 12 }}>
            <AlertTriangle size={20} />
            <strong style={{ fontSize: "14px" }}>Clear Entire AI Profile</strong>
          </div>
          <p className="fc-muted" style={{ fontSize: "13px", lineHeight: 1.5, margin: "0 0 16px 0" }}>
            This will permanently remove all <strong>{memories.length}</strong> saved preferences and conversational memory context. Your assistant will start with a fresh default context.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <Button variant="ghost" onClick={() => setClearAllConfirmOpen(false)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button
              variant="accent"
              onClick={handleClearAll}
              disabled={actionLoading}
              style={{ background: "var(--danger)", borderColor: "var(--danger)", color: "#fff" }}
            >
              {actionLoading ? "Clearing..." : "Clear All Memories"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add New Preference Modal */}
      <Modal
        open={newMemoryModalOpen}
        onClose={() => setNewMemoryModalOpen(false)}
        title="Add AI Memory Preference"
        width={480}
      >
        <form onSubmit={handleCreateMemory} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: 4 }}>
              Preference Category
            </label>
            <select
              className="fc-select"
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              style={{ width: "100%" }}
            >
              <option value="preference">General Preference</option>
              <option value="crop_history">Crop & Harvest History</option>
              <option value="strategy">Selling / Procurement Strategy</option>
              <option value="general">Operational Constraint</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: 4 }}>
              Preference Name / Key
            </label>
            <input
              className="fc-input"
              type="text"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="e.g. preferred_mandi or typical_harvest_size"
              required
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, marginBottom: 4 }}>
              Preference Value / Specification
            </label>
            <input
              className="fc-input"
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="e.g. Pune APMC or 500 Quintals"
              required
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
            <Button variant="ghost" type="button" onClick={() => setNewMemoryModalOpen(false)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={actionLoading}>
              {actionLoading ? "Saving..." : "Save Preference"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export const AiMemoryManager = memo(AiMemoryManagerBase);
export default AiMemoryManager;
