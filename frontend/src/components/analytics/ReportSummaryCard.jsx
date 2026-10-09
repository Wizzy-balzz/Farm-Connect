import { memo } from "react";
import { Badge } from "../common/Badge.jsx";

/**
 * FarmConnect Phase 10 — Report Summary Card
 * Cleanly separates FACTS, REASONING, INSIGHTS, RECOMMENDATIONS, and LIMITATIONS.
 */
function ReportSummaryCardBase({
  facts = [],
  insights = [],
  recommendations = [],
  limitations = [],
  reportType = "FARM_PERFORMANCE",
  period = null
}) {
  return (
    <div
      style={{
        background: "var(--bg-card, #fff)",
        border: "1px solid var(--border)",
        borderRadius: "10px",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "18px"
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid var(--border)",
          paddingBottom: "12px"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "18px" }}>📋</span>
          <h3 style={{ margin: 0, fontSize: "16px" }}>
            FarmConnect AI Executive Report
          </h3>
          <Badge variant="info">{reportType}</Badge>
        </div>
        {period && (
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            Period: {period.label || period}
          </span>
        )}
      </div>

      {/* 1. FACTS SECTION */}
      {facts && facts.length > 0 && (
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              marginBottom: "8px"
            }}
          >
            <span style={{ fontWeight: 700, fontSize: "13px", color: "var(--brand)" }}>
              ✅ VERIFIED DATABASE FACTS
            </span>
            <span
              style={{
                fontSize: "10px",
                background: "rgba(16, 185, 129, 0.12)",
                color: "#059669",
                padding: "2px 6px",
                borderRadius: "4px",
                fontWeight: 600
              }}
            >
              ZERO FABRICATION
            </span>
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: "20px",
              fontSize: "13px",
              lineHeight: "1.7",
              color: "var(--text)"
            }}
          >
            {facts.map((fact, i) => (
              <li key={`fact-${i}`}>{fact}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 2. REASONING & INSIGHTS */}
      {insights && insights.length > 0 && (
        <div
          style={{
            padding: "12px 14px",
            background: "var(--bg-soft)",
            borderRadius: "8px",
            borderLeft: "3px solid var(--accent, #6366f1)"
          }}
        >
          <div
            style={{
              fontWeight: 700,
              fontSize: "13px",
              color: "var(--accent, #6366f1)",
              marginBottom: "6px"
            }}
          >
            💡 AI REASONING & MARKET INSIGHTS
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: "18px",
              fontSize: "12.5px",
              lineHeight: "1.6",
              color: "var(--text)"
            }}
          >
            {insights.map((ins, i) => (
              <li key={`ins-${i}`}>{ins}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 3. RECOMMENDATIONS */}
      {recommendations && recommendations.length > 0 && (
        <div
          style={{
            padding: "12px 14px",
            background: "rgba(16, 185, 129, 0.06)",
            borderRadius: "8px",
            borderLeft: "3px solid #10b981"
          }}
        >
          <div
            style={{
              fontWeight: 700,
              fontSize: "13px",
              color: "#059669",
              marginBottom: "6px"
            }}
          >
            🌱 ACTIONABLE RECOMMENDATIONS (DECISION SUPPORT)
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: "18px",
              fontSize: "12.5px",
              lineHeight: "1.6",
              color: "var(--text)"
            }}
          >
            {recommendations.map((rec, i) => (
              <li key={`rec-${i}`}>{rec}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 4. LIMITATIONS & DISCLAIMERS */}
      {limitations && limitations.length > 0 && (
        <div
          style={{
            padding: "10px 14px",
            background: "rgba(245, 158, 11, 0.06)",
            borderRadius: "8px",
            border: "1px dashed rgba(245, 158, 11, 0.4)",
            fontSize: "12px",
            color: "var(--text-muted)"
          }}
        >
          <div
            style={{
              fontWeight: 600,
              color: "#d97706",
              marginBottom: "4px",
              display: "flex",
              alignItems: "center",
              gap: "4px"
            }}
          >
            <span>⚠️</span> REPORT LIMITATIONS & METHODOLOGY
          </div>
          <ul style={{ margin: 0, paddingLeft: "16px", lineHeight: "1.5" }}>
            {limitations.map((lim, i) => (
              <li key={`lim-${i}`}>{lim}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export const ReportSummaryCard = memo(ReportSummaryCardBase);
export default ReportSummaryCard;
