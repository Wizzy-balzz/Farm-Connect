import { useState, useEffect, useRef, memo } from "react";
import { apiFetch } from "../../services/api.js";
import { Card } from "../common/Card.jsx";
import { Button } from "../common/Button.jsx";
import { Badge } from "../common/Badge.jsx";
import { useNotifications } from "../../hooks/useNotifications.js";

function ActionConfirmationCardBase({ action, lang = "en", onActionComplete }) {
  const { notifySuccess, notifyError } = useNotifications();

  const [status, setStatus] = useState("PENDING"); // PENDING | CONFIRMED | CANCELLED | EXPIRED | FAILED | STALE
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successResult, setSuccessResult] = useState(null);
  const [timeLeftMs, setTimeLeftMs] = useState(300000);

  const expiresAtMs = action.expiresAt ? new Date(action.expiresAt).getTime() : Date.now() + 300000;
  const isExecutingRef = useRef(false);

  useEffect(() => {
    const updateTimer = () => {
      const remaining = expiresAtMs - Date.now();
      if (remaining <= 0) {
        setTimeLeftMs(0);
        if (status === "PENDING") {
          setStatus("EXPIRED");
        }
      } else {
        setTimeLeftMs(remaining);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [expiresAtMs, status]);

  const formatSeconds = (ms) => {
    const sec = Math.max(0, Math.floor(ms / 1000));
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}m ${secs < 10 ? "0" : ""}${secs}s`;
  };

  const handleConfirm = async () => {
    if (isExecutingRef.current || loading || status !== "PENDING") return;
    if (!action.confirmationToken) {
      notifyError("Invalid confirmation token.");
      return;
    }

    isExecutingRef.current = true;
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await apiFetch("/api/ai/actions/confirm", {
        method: "POST",
        body: JSON.stringify({ confirmationToken: action.confirmationToken })
      });

      if (res.success) {
        setStatus("CONFIRMED");
        setSuccessResult(res.result);
        const msg = lang === "ta" ? "செயல்பாடு வெற்றி பெற்றது!" : lang === "hi" ? "कार्रवाई सफल रही!" : "Action executed successfully!";
        notifySuccess(msg);
        if (onActionComplete) onActionComplete({ status: "CONFIRMED", result: res.result, action });
      } else {
        const errCode = res.error?.code;
        if (errCode === "ACTION_STALE") {
          setStatus("STALE");
          setErrorMessage(lang === "ta" ? "தரவு மாற்றப்பட்டது (பழைய தரவு)." : lang === "hi" ? "डेटा बदल गया था (पुराना डेटा)।" : "Action aborted: Underlying data was modified by another session.");
        } else if (errCode === "EXPIRED") {
          setStatus("EXPIRED");
          setErrorMessage(lang === "ta" ? "உறுதிப்படுத்தல் காலம் முடிந்தது." : lang === "hi" ? "पुष्टि की समय सीमा समाप्त।" : "Action token has expired.");
        } else {
          setStatus("FAILED");
          setErrorMessage(res.error?.message || "Action confirmation failed.");
        }
        notifyError(res.error?.message || "Action failed.");
      }
    } catch (err) {
      console.error("Confirm action error:", err);
      setStatus("FAILED");
      const errorMsg = err.data?.error?.message || err.message || "Failed to confirm action.";
      setErrorMessage(errorMsg);
      notifyError(errorMsg);
    } finally {
      setLoading(false);
      isExecutingRef.current = false;
    }
  };

  const handleCancel = async () => {
    if (isExecutingRef.current || loading || status !== "PENDING") return;
    isExecutingRef.current = true;
    setLoading(true);

    try {
      await apiFetch("/api/ai/actions/cancel", {
        method: "POST",
        body: JSON.stringify({ actionId: action.actionId })
      });
      setStatus("CANCELLED");
      const msg = lang === "ta" ? "செயல்பாடு இரத்து செய்யப்பட்டது." : lang === "hi" ? "कार्रवाई रद्द कर दी गई।" : "Action proposal cancelled.";
      notifySuccess(msg);
      if (onActionComplete) onActionComplete({ status: "CANCELLED", action });
    } catch (err) {
      console.error("Cancel action error:", err);
      setStatus("CANCELLED");
    } finally {
      setLoading(false);
      isExecutingRef.current = false;
    }
  };

  const riskBadgeVariant = action.riskLevel === "HIGH_RISK" ? "danger" : action.riskLevel === "SENSITIVE" ? "warning" : "info";

  const loc = action.localizedText && action.localizedText[lang] ? action.localizedText[lang] : {
    title: action.actionType ? action.actionType.replace(/_/g, " ") : "Action Proposal",
    summary: action.summary || "",
    impact: action.impact || ""
  };

  return (
    <Card
      style={{
        padding: "16px",
        margin: "10px 0",
        border: status === "CONFIRMED" ? "2px solid var(--brand)" : status === "FAILED" || status === "STALE" ? "2px solid #e53935" : status === "CANCELLED" || status === "EXPIRED" ? "1px solid var(--border)" : "2px solid #f57c00",
        background: status === "CONFIRMED" ? "var(--brand-light)" : status === "FAILED" || status === "STALE" ? "#ffebee" : status === "CANCELLED" || status === "EXPIRED" ? "var(--bg-soft)" : "#fff8e1",
        borderRadius: "12px",
        boxShadow: "var(--shadow-md)"
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "16px" }}>⚡</span>
            <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "var(--text)" }}>
              {loc.title}
            </h4>
          </div>
          <p style={{ margin: "4px 0 0 0", fontSize: "12.5px", color: "var(--text-soft)", lineHeight: "1.4" }}>
            {loc.summary}
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
          <Badge variant={riskBadgeVariant} style={{ fontSize: "10px", fontWeight: 700 }}>
            {action.riskLevel || "LOW_RISK"}
          </Badge>
          {status === "PENDING" && (
            <span style={{ fontSize: "11px", fontWeight: 700, color: timeLeftMs < 60000 ? "#d32f2f" : "#f57c00" }}>
              ⏱ {formatSeconds(timeLeftMs)}
            </span>
          )}
        </div>
      </div>

      {/* Diff View / Parameter Values */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          padding: "10px 12px",
          marginBottom: "12px",
          fontSize: "12px"
        }}
      >
        {action.diffText ? (
          <div style={{ fontWeight: 700, color: "var(--brand-dark)" }}>
            🔄 {action.diffText}
          </div>
        ) : (
          <div style={{ display: "flex", gap: "16px" }}>
            {action.currentValue !== undefined && (
              <div>
                <span style={{ color: "var(--text-soft)", display: "block", fontSize: "11px" }}>Current</span>
                <span style={{ textDecoration: "line-through", color: "#d32f2f", fontWeight: 700 }}>
                  {String(action.currentValue)}
                </span>
              </div>
            )}
            {action.proposedValue !== undefined && (
              <div>
                <span style={{ color: "var(--text-soft)", display: "block", fontSize: "11px" }}>Proposed</span>
                <span style={{ color: "var(--brand)", fontWeight: 700 }}>
                  {String(action.proposedValue)}
                </span>
              </div>
            )}
          </div>
        )}

        {loc.impact && (
          <div style={{ marginTop: "6px", fontSize: "11.5px", fontStyle: "italic", color: "var(--text-muted)" }}>
            ℹ️ Impact: {loc.impact}
          </div>
        )}
      </div>

      {/* Status Banner or Interactive Action Buttons */}
      {status === "PENDING" ? (
        <div>
          <div style={{ fontSize: "11px", color: "var(--text-soft)", marginBottom: "10px", lineHeight: "1.3" }}>
            {lang === "ta"
              ? "⚠️ இந்த மாற்றத்தை நடைமுறைப்படுத்த 'உறுதி செய்' பொத்தானை அழுத்தவும்."
              : lang === "hi"
              ? "⚠️ इस बदलाव को लागू करने के लिए 'पुष्टि करें' बटन दबाएं।"
              : "⚠️ Click 'Confirm Action' to execute this mutation into database. Saying yes or speaking will not execute it."}
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <Button
              size="sm"
              variant="primary"
              onClick={handleConfirm}
              disabled={loading || timeLeftMs <= 0}
              style={{
                flex: 1,
                fontWeight: 700,
                background: "#2e7d32",
                color: "#ffffff",
                boxShadow: "0 2px 8px rgba(46, 125, 50, 0.3)"
              }}
            >
              {loading ? "⏳ Executing..." : "✓ Confirm Action"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancel}
              disabled={loading}
              style={{ flex: 1, color: "#d32f2f", borderColor: "#ef5350" }}
            >
              ✕ Cancel
            </Button>
          </div>
        </div>
      ) : status === "CONFIRMED" ? (
        <div style={{ color: "#2e7d32", fontWeight: 700, fontSize: "12.5px", display: "flex", alignItems: "center", gap: "6px" }}>
          <span>✅ Action Executed Successfully</span>
          {successResult && successResult.price && <span>(Price: ₹{successResult.price})</span>}
        </div>
      ) : status === "CANCELLED" ? (
        <div style={{ color: "var(--text-soft)", fontStyle: "italic", fontSize: "12px" }}>
          🚫 Proposal Cancelled by User
        </div>
      ) : status === "EXPIRED" ? (
        <div style={{ color: "#d32f2f", fontStyle: "italic", fontSize: "12px" }}>
          ⏱ Proposal Expired (5-minute window passed)
        </div>
      ) : (
        <div style={{ color: "#d32f2f", fontWeight: 700, fontSize: "12px" }}>
          ❌ {errorMessage || "Action Execution Failed"}
        </div>
      )}
    </Card>
  );
}

export const ActionConfirmationCard = memo(ActionConfirmationCardBase);
