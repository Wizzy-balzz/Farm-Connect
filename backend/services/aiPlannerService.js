import { executeAiTool, getFunctionDeclarationsForRole } from "../ai/aiTools.js";

export const MAX_PLAN_STEPS = 10;
export const MAX_TOOL_CALLS = 12;
export const MAX_EXECUTION_TIME_MS = 30000;

/**
 * Executes a promise with strict timeout
 */
function withTimeout(promise, ms, timeoutMsg = "PLANNER_TIMEOUT") {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(timeoutMsg)), ms))
  ]);
}

/**
 * Standard templates for deterministic read-only multi-step plans
 * Used when Gemini API is offline/fallback or when common farming copilot workflows are triggered
 */
export function getStandardPlanWorkflow(intent, params = {}) {
  const crop = params.commodity || params.crop || "Tomato";

  switch (intent) {
    case "SELL_OR_WAIT_EVALUATION":
    case "SHOULD_I_SELL":
      return [
        {
          toolName: "getMyInventory",
          params: {},
          description: "Check current farm inventory and stock levels"
        },
        {
          toolName: "getPriceIntelligence",
          params: { commodity: crop },
          description: `Check current market prices and benchmarks for ${crop}`
        },
        {
          toolName: "getDemandIntelligence",
          params: { commodity: crop },
          description: `Analyze market demand momentum and trends for ${crop}`
        },
        {
          toolName: "getWeatherAdvisory",
          params: { crop },
          description: `Check 5-day weather forecast and rain/wind harvesting risks`
        },
        {
          toolName: "getMyOrders",
          params: {},
          description: "Check pending and accepted wholesale buyer orders"
        },
        {
          toolName: "getSellingRecommendation",
          params: { commodity: crop },
          description: `Synthesize data to compare SELL_NOW vs WAIT vs PARTIAL_SELL for ${crop}`
        }
      ];

    case "FARM_HEALTH_AND_OPPORTUNITY":
      return [
        {
          toolName: "getMyFarmReport",
          params: { period: "30d" },
          description: "Retrieve comprehensive 30-day farm performance and sales"
        },
        {
          toolName: "getMySellingOpportunities",
          params: {},
          description: "Detect data-driven selling opportunities across inventory"
        },
        {
          toolName: "getMyProactiveInsights",
          params: {},
          description: "Fetch active proactive agricultural alerts and risks"
        }
      ];

    case "GOAL_PROGRESS_CHECK":
      return [
        {
          toolName: "getMyFarmingGoals",
          params: { status: "active" },
          description: "Fetch all active farming goals"
        },
        {
          toolName: "getMySales",
          params: {},
          description: "Retrieve verified completed sales"
        },
        {
          toolName: "getMyInventory",
          params: {},
          description: "Retrieve verified current inventory"
        }
      ];

    default:
      return [
        {
          toolName: "getMyInventory",
          params: {},
          description: "Check farm inventory"
        },
        {
          toolName: "getPriceIntelligence",
          params: { commodity: crop },
          description: `Check market prices for ${crop}`
        },
        {
          toolName: "getSellingRecommendation",
          params: { commodity: crop },
          description: `Evaluate selling strategy for ${crop}`
        }
      ];
  }
}

/**
 * Multi-Step Agent Planner Core
 * Coordinates existing read-only tools, handles intermediate dependencies, enforce timeouts & step limits.
 */
export async function executeCopilotPlan({
  user,
  query: userQuery,
  workflowIntent = null,
  initialParams = {},
  customSteps = null
}) {
  if (!user || !user.id || !user.role) {
    throw new Error("UNAUTHENTICATED: Authentication required for AI Planner.");
  }

  const startTime = Date.now();
  const planSteps = [];
  const verifiedFacts = {};
  let totalToolCalls = 0;
  let proposedAction = null;

  // Resolve steps: customSteps OR template workflow
  let stepsToExecute = [];
  if (Array.isArray(customSteps) && customSteps.length > 0) {
    stepsToExecute = customSteps.slice(0, MAX_PLAN_STEPS);
  } else {
    // Detect intent from user query if not explicitly provided
    let detectedIntent = workflowIntent || "SHOULD_I_SELL";
    const qLower = (userQuery || "").toLowerCase();

    if (qLower.includes("goal") || qLower.includes("target") || qLower.includes("progress")) {
      detectedIntent = "GOAL_PROGRESS_CHECK";
    } else if (qLower.includes("farm report") || qLower.includes("opportunity") || qLower.includes("performance")) {
      detectedIntent = "FARM_HEALTH_AND_OPPORTUNITY";
    }

    // Extract crop parameter if present
    const cropMatch = qLower.match(/(tomato|onion|potato|carrot|rice|wheat|spinach|banana|pepper|தக்காளி|வெங்காயம்|टमाटर|प्याज)/i);
    let commodity = initialParams.commodity || initialParams.crop || "Tomato";
    if (cropMatch) {
      const c = cropMatch[1].toLowerCase();
      if (c.includes("tomato") || c.includes("தக்காளி") || c.includes("टमाटर")) commodity = "Tomato";
      else if (c.includes("onion") || c.includes("வெங்காயம்") || c.includes("प्याज")) commodity = "Onion";
      else if (c.includes("potato")) commodity = "Potato";
      else if (c.includes("carrot")) commodity = "Carrot";
      else if (c.includes("rice")) commodity = "Rice";
      else if (c.includes("wheat")) commodity = "Wheat";
    }

    stepsToExecute = getStandardPlanWorkflow(detectedIntent, { ...initialParams, commodity });
  }

  // Cap steps to MAX_PLAN_STEPS
  if (stepsToExecute.length > MAX_PLAN_STEPS) {
    stepsToExecute = stepsToExecute.slice(0, MAX_PLAN_STEPS);
  }

  // Initialize plan steps status tracking for UI visibility
  stepsToExecute.forEach((s, idx) => {
    planSteps.push({
      stepIndex: idx + 1,
      toolName: s.toolName,
      description: s.description || `Execute ${s.toolName}`,
      status: "pending",
      durationMs: 0,
      summary: null,
      error: null
    });
  });

  const executionPromise = (async () => {
    for (let i = 0; i < stepsToExecute.length; i++) {
      // Hard limits check
      if (totalToolCalls >= MAX_TOOL_CALLS) {
        planSteps[i].status = "skipped";
        planSteps[i].summary = "Skipped: Tool call limit reached.";
        break;
      }

      if (Date.now() - startTime >= MAX_EXECUTION_TIME_MS) {
        planSteps[i].status = "skipped";
        planSteps[i].summary = "Skipped: Execution timeout reached.";
        break;
      }

      const step = stepsToExecute[i];
      const stepRecord = planSteps[i];
      stepRecord.status = "running";
      const stepStart = Date.now();
      totalToolCalls++;

      try {
        // Prepare step parameters with intermediate dependent facts
        const mergedParams = { ...(step.params || {}) };
        if (verifiedFacts.crop && !mergedParams.commodity && !mergedParams.crop) {
          mergedParams.commodity = verifiedFacts.crop;
        }

        const toolRes = await executeAiTool(user, step.toolName, mergedParams);
        const duration = Date.now() - stepStart;
        stepRecord.durationMs = duration;

        if (toolRes && toolRes.success) {
          stepRecord.status = "completed";
          const data = toolRes.data !== undefined ? toolRes.data : toolRes;

          // Record intermediate facts
          if (step.toolName === "getMyInventory") {
            const items = Array.isArray(data) ? data : data.products || [];
            verifiedFacts.inventory = items.map((p) => ({ id: p.id, name: p.name, stock: p.stock, price: p.price }));
            stepRecord.summary = `Found ${items.length} inventory items in catalog.`;
          } else if (step.toolName === "getPriceIntelligence") {
            verifiedFacts.price = {
              commodity: data.commodity,
              averagePrice: data.averagePrice,
              priceRange: data.priceRange,
              priceMomentum: data.priceMomentum
            };
            stepRecord.summary = `Average price: ₹${data.averagePrice || "N/A"}/unit (Trend: ${data.priceMomentum || "Stable"}).`;
          } else if (step.toolName === "getDemandIntelligence") {
            verifiedFacts.demand = {
              demandTrend: data.demandTrend,
              buyerSearches: data.buyerSearches,
              growthPercent: data.growthPercent
            };
            stepRecord.summary = `Demand trend: ${data.demandTrend || "Stable"}.`;
          } else if (step.toolName === "getWeatherAdvisory") {
            verifiedFacts.weather = {
              rainRisk: data.rainRisk,
              windRisk: data.windRisk,
              recommendation: data.recommendation
            };
            stepRecord.summary = `Harvest suitability: ${data.recommendation || "Favorable"}.`;
          } else if (step.toolName === "getMyOrders") {
            const orders = Array.isArray(data) ? data : [];
            const pendingOrders = orders.filter((o) => o.status === "Pending");
            verifiedFacts.pendingOrdersCount = pendingOrders.length;
            stepRecord.summary = `${pendingOrders.length} pending orders found.`;
          } else if (step.toolName === "getSellingRecommendation") {
            verifiedFacts.sellingStrategy = data;
            stepRecord.summary = `Recommendation: ${data.recommendation || "SELL_PARTIALLY"}.`;
            if (data.actionProposal) {
              proposedAction = data.actionProposal;
            }
          } else {
            stepRecord.summary = "Data successfully gathered.";
          }
        } else {
          // Graceful handling of tool failure: record failure but continue next independent steps
          stepRecord.status = "failed";
          stepRecord.error = toolRes?.error?.message || "Tool execution returned unsuccessful.";
          stepRecord.summary = `Unavailable: ${stepRecord.error}`;
        }
      } catch (toolErr) {
        stepRecord.status = "failed";
        stepRecord.error = toolErr.message || "Execution exception";
        stepRecord.durationMs = Date.now() - stepStart;
        stepRecord.summary = `Error: ${toolErr.message}`;
      }
    }
  })();

  await withTimeout(executionPromise, MAX_EXECUTION_TIME_MS, "AI_PLANNER_TIMEOUT");

  // Synthesize Facts, Reasoning, and Recommendation
  const factsList = [];
  if (verifiedFacts.inventory) {
    factsList.push(`Farm Inventory: ${verifiedFacts.inventory.map((p) => `${p.name} (${p.stock} units)`).join(", ") || "None"}`);
  }
  if (verifiedFacts.price) {
    factsList.push(`Market Price: Average ₹${verifiedFacts.price.averagePrice}/kg for ${verifiedFacts.price.commodity} (Range: ₹${verifiedFacts.price.priceRange?.min || "N/A"} - ₹${verifiedFacts.price.priceRange?.max || "N/A"})`);
  }
  if (verifiedFacts.demand) {
    factsList.push(`Market Demand: Trend is ${verifiedFacts.demand.demandTrend || "stable"}`);
  }
  if (verifiedFacts.weather) {
    factsList.push(`Weather Forecast: ${verifiedFacts.weather.recommendation || "Clear"}`);
  }
  if (verifiedFacts.pendingOrdersCount !== undefined) {
    factsList.push(`Pending Buyer Orders: ${verifiedFacts.pendingOrdersCount} orders`);
  }

  // Derive reasoning
  let strategyRec = "SELL_PARTIALLY";
  let explanation = "Based on balanced inventory levels and current market demand momentum.";
  if (verifiedFacts.sellingStrategy) {
    strategyRec = verifiedFacts.sellingStrategy.recommendation || "SELL_PARTIALLY";
    explanation = verifiedFacts.sellingStrategy.reasoning || explanation;
  }

  const reasoning = [
    `Price and Demand Analysis: ${verifiedFacts.price?.priceMomentum || "Stable"} price trend with ${verifiedFacts.demand?.demandTrend || "moderate"} market demand.`,
    `Operational & Weather Risk: Weather is ${verifiedFacts.weather?.recommendation || "favorable for farm operations"}.`,
    `Synthesis: ${explanation}`
  ].join("\n");

  const recommendation = {
    action: strategyRec,
    description: `Recommendation: ${strategyRec.replace(/_/g, " ")}. Review selling opportunities and confirm appropriate orders.`,
    disclaimer: "All recommendations are decision-support guidelines based on verified platform data. Market conditions remain subject to change."
  };

  const totalDurationMs = Date.now() - startTime;

  return {
    success: true,
    totalSteps: planSteps.length,
    completedSteps: planSteps.filter((s) => s.status === "completed").length,
    totalToolCalls,
    totalDurationMs,
    planSteps,
    facts: factsList,
    verifiedFacts,
    reasoning,
    recommendation,
    proposedAction
  };
}
