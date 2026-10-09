import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../../services/api.js";
import { useLanguage } from "../../hooks/useLanguage.js";
import { useNotifications } from "../../hooks/useNotifications.js";
import { Card } from "../common/Card.jsx";
import { Badge } from "../common/Badge.jsx";
import { Button } from "../common/Button.jsx";
import { ActionConfirmationCard } from "../ai/ActionConfirmationCard.jsx";

export function SmartInsightsSection() {
  const { lang } = useLanguage();
  const { notifySuccess, notifyError } = useNotifications();

  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [activeActionProposal, setActiveActionProposal] = useState(null);

  const fetchInsights = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiFetch(`/api/ai/insights?lang=${lang}&status=active`);
      if (data && data.insights) {
        setInsights(data.insights);
        window.dispatchEvent(new CustomEvent("fc-insights-updated"));
      }
    } catch (err) {
      console.warn("Failed to fetch proactive insights:", err);
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      const res = await apiFetch("/api/ai/insights/generate", { method: "POST" });
      if (res && res.success) {
        notifySuccess(`Generated ${res.count || 0} proactive agricultural insights.`);
        await fetchInsights();
      }
    } catch (err) {
      notifyError("Failed to trigger insight generation.");
    } finally {
      setGenerating(false);
    }
  };

  const handleMarkAsRead = async (id) => {
    try {
      await apiFetch(`/api/ai/insights/${id}/read`, { method: "POST" });
      setInsights((prev) => prev.filter((item) => item.id !== id));
      window.dispatchEvent(new CustomEvent("fc-insights-updated"));
      notifySuccess("Insight marked as read.");
    } catch {
      notifyError("Failed to update insight status.");
    }
  };

  const handleProposeAction = async (insight) => {
    const sug = insight.metadata?.actionSuggestion;
    if (!sug) return;

    try {
      const res = await apiFetch("/api/ai/actions/propose", {
        method: "POST",
        body: JSON.stringify({
          actionId: sug.type,
          parameters: sug
        })
      });

      if (res && res.success && res.action) {
        setActiveActionProposal(res.action);
        notifySuccess("Action proposal generated. Please confirm to execute.");
      }
    } catch (err) {
      notifyError(err.message || "Failed to generate action proposal.");
    }
  };

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case "critical":
        return <Badge variant="danger">Critical Risk</Badge>;
      case "warning":
        return <Badge variant="warning">Warning</Badge>;
      case "high":
        return <Badge variant="warning">High Priority</Badge>;
      case "info":
      default:
        return <Badge variant="info">Advisory</Badge>;
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case "inventory": return "📦";
      case "price": return "📈";
      case "demand": return "🔥";
      case "weather": return "🌧️";
      case "selling": return "💡";
      case "order": return "📋";
      default: return "🌱";
    }
  };

  return (
    <Card className="p-5 mb-6 border border-emerald-100 shadow-sm rounded-xl bg-gradient-to-r from-emerald-50/40 via-white to-teal-50/30">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 pb-3 border-b border-emerald-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xl shadow-sm">
            🤖
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              Proactive AI Agricultural Insights
              <span className="text-xs bg-emerald-100 text-emerald-800 font-medium px-2.5 py-0.5 rounded-full border border-emerald-200">
                Phase 7 AI Alerts
              </span>
            </h3>
            <p className="text-xs text-gray-600">
              Real-time non-autonomous agricultural advisories based on your live inventory, order demand, & Open-Meteo weather
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerate}
            disabled={generating}
            className="text-xs font-semibold"
          >
            {generating ? "Analyzing..." : "🔄 Refresh Analysis"}
          </Button>
        </div>
      </div>

      {activeActionProposal && (
        <div className="mb-5">
          <ActionConfirmationCard
            action={activeActionProposal}
            lang={lang}
            onActionExecuted={() => {
              setActiveActionProposal(null);
              fetchInsights();
            }}
            onActionCancelled={() => setActiveActionProposal(null)}
          />
        </div>
      )}

      {loading ? (
        <div className="py-8 text-center text-sm text-gray-500 flex items-center justify-center gap-2">
          <span className="animate-spin">⏳</span> Evaluating farm data and live weather...
        </div>
      ) : insights.length === 0 ? (
        <div className="py-6 text-center bg-emerald-50/50 rounded-lg border border-dashed border-emerald-200">
          <span className="text-2xl block mb-1">✅</span>
          <p className="text-sm font-semibold text-emerald-900">All clear! No active agricultural alerts at this time.</p>
          <p className="text-xs text-gray-500 mt-1">Your stock, market pricing, and regional weather conditions look stable.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {insights.map((item) => {
            const isExpanded = expandedId === item.id;
            const hasActionableSuggestion = Boolean(item.metadata?.actionSuggestion);

            return (
              <div
                key={item.id}
                className="p-4 rounded-xl border border-gray-200 bg-white hover:border-emerald-300 transition-all shadow-2xs"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl mt-0.5">{getTypeIcon(item.type)}</span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {getSeverityBadge(item.severity)}
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          {item.type}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-gray-900">{item.title}</h4>
                      <p className="text-xs text-gray-700 mt-1">{item.message}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 transition-colors"
                    >
                      {isExpanded ? "Hide Details ▲" : "View Facts & Reasoning ▼"}
                    </button>
                    <button
                      onClick={() => handleMarkAsRead(item.id)}
                      title="Mark as read"
                      className="text-xs text-gray-400 hover:text-gray-600 p-1"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-gray-50/70 p-3 rounded-lg">
                    <div className="bg-white p-2.5 rounded border border-gray-200">
                      <span className="font-bold text-gray-900 block mb-1 text-emerald-900 flex items-center gap-1">
                        📊 FACTS (Observed Data):
                      </span>
                      <ul className="list-disc pl-4 space-y-1 text-gray-700">
                        {Array.isArray(item.facts) ? (
                          item.facts.map((f, idx) => <li key={idx}>{f}</li>)
                        ) : (
                          <li>{item.facts}</li>
                        )}
                      </ul>
                    </div>

                    <div className="bg-white p-2.5 rounded border border-gray-200">
                      <span className="font-bold text-gray-900 block mb-1 text-amber-900 flex items-center gap-1">
                        💡 REASONING (AI Recommendation):
                      </span>
                      <ul className="list-disc pl-4 space-y-1 text-gray-700">
                        {Array.isArray(item.reasoning) ? (
                          item.reasoning.map((r, idx) => <li key={idx}>{r}</li>)
                        ) : (
                          <li>{item.reasoning}</li>
                        )}
                      </ul>
                    </div>

                    {hasActionableSuggestion && (
                      <div className="sm:col-span-2 mt-2 pt-2 border-t border-gray-200 flex items-center justify-between">
                        <span className="text-xs text-gray-600 font-medium">
                          Suggested Action: {item.metadata.actionSuggestion.type.replace(/_/g, " ")}
                        </span>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => handleProposeAction(item)}
                          className="text-xs py-1 px-3"
                        >
                          ⚡ Propose Action (Phase 6 Confirmation)
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export default SmartInsightsSection;
