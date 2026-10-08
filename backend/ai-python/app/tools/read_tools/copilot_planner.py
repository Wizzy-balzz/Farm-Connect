"""
Copilot Multi-Step Agent Planner:
- executeCopilotPlan

Exact port of orchestration logic from backend/services/aiPlannerService.js.
Coordinates approved read-only tools, handles intermediate facts, and enforces:
- Max steps: 10
- Max tool calls: 12
- Max timeout: 30 seconds
- Recursion prohibition (nested executeCopilotPlan strictly blocked)
- Mutation prohibition (mutation tools strictly blocked from direct execution)
- Defense-in-depth Anti-IDOR & prompt injection protection
"""

import asyncio
import re
import time
from typing import Any, Dict, List, Optional

MAX_PLAN_STEPS = 10
MAX_TOOL_CALLS = 12
MAX_EXECUTION_TIME_SECONDS = 30.0

# Forbidden tools that perform mutations or side-effects and MUST NEVER be executed directly by Python planner
FORBIDDEN_MUTATION_TOOLS = {
    "proposeUpdateProductPrice",
    "proposeUpdateInventory",
    "proposeCreateProductListing",
    "proposeCancelOrder",
    "proposeSendMessage",
    "proposeUpdateGoalProgress",
    "completeFollowUp",
    "proposeMemoryUpdate",
    "proposeCreateFarmingGoal",
    "proposeCreateFollowUp",
    "confirmAction",
    "cancelAction",
    "saveMemoryItem",
    "deleteMemoryItem",
    "clearUserMemories",
    "createGoal",
    "updateGoal",
    "deleteGoal",
    "createFollowup",
    "completeFollowup",
    "dismissFollowup",
}


def get_standard_plan_workflow(intent: str, params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    """
    Standard templates for deterministic read-only multi-step plans.
    Used when query intent matches common agricultural workflows.
    """
    p = params or {}
    crop = p.get("commodity") or p.get("crop") or "Tomato"

    intent_upper = (intent or "").upper()

    if intent_upper in ("SELL_OR_WAIT_EVALUATION", "SHOULD_I_SELL"):
        return [
            {
                "toolName": "getMyInventory",
                "params": {},
                "description": "Check current farm inventory and stock levels"
            },
            {
                "toolName": "getPriceIntelligence",
                "params": {"commodity": crop},
                "description": f"Check current market prices and benchmarks for {crop}"
            },
            {
                "toolName": "getDemandIntelligence",
                "params": {"commodity": crop},
                "description": f"Analyze market demand momentum and trends for {crop}"
            },
            {
                "toolName": "getWeatherAdvisory",
                "params": {"crop": crop},
                "description": f"Check 5-day weather forecast and rain/wind harvesting risks for {crop}"
            },
            {
                "toolName": "getMyOrders",
                "params": {},
                "description": "Check pending and accepted wholesale buyer orders"
            },
            {
                "toolName": "getSellingRecommendation",
                "params": {"commodity": crop},
                "description": f"Synthesize data to compare SELL_NOW vs WAIT vs PARTIAL_SELL for {crop}"
            }
        ]

    elif intent_upper == "FARM_HEALTH_AND_OPPORTUNITY":
        return [
            {
                "toolName": "getMyFarmReport",
                "params": {"period": "30d"},
                "description": "Retrieve comprehensive 30-day farm performance and sales"
            },
            {
                "toolName": "getMySellingOpportunities",
                "params": {},
                "description": "Detect data-driven selling opportunities across inventory"
            },
            {
                "toolName": "getMarketplaceOverview",
                "params": {},
                "description": "Fetch active regional marketplace overview and trends"
            }
        ]

    elif intent_upper == "GOAL_PROGRESS_CHECK":
        return [
            {
                "toolName": "getMyFarmingGoals",
                "params": {"status": "active"},
                "description": "Fetch all active farming goals"
            },
            {
                "toolName": "getMySales",
                "params": {},
                "description": "Retrieve verified completed sales"
            },
            {
                "toolName": "getMyInventory",
                "params": {},
                "description": "Retrieve verified current inventory"
            }
        ]

    else:
        return [
            {
                "toolName": "getMyInventory",
                "params": {},
                "description": "Check farm inventory"
            },
            {
                "toolName": "getPriceIntelligence",
                "params": {"commodity": crop},
                "description": f"Check market prices for {crop}"
            },
            {
                "toolName": "getSellingRecommendation",
                "params": {"commodity": crop},
                "description": f"Evaluate selling strategy for {crop}"
            }
        ]


async def execute_copilot_plan(
    user: Dict[str, Any],
    query: Optional[str] = "",
    workflowIntent: Optional[str] = None,
    commodity: Optional[str] = None,
    crop: Optional[str] = None,
    customSteps: Optional[List[Any]] = None,
    **kwargs: Any
) -> Dict[str, Any]:
    """
    Multi-Step Agent Planner Core.
    Executes sequential read-only tool plans with hard step limits, call limits, and timeouts.
    """
    if not user or not user.get("id") or not user.get("role"):
        raise PermissionError("UNAUTHENTICATED: Authentication required for AI Planner.")

    start_time = time.perf_counter()
    plan_steps: List[Dict[str, Any]] = []
    verified_facts: Dict[str, Any] = {}
    total_tool_calls = 0
    proposed_action = None

    # 1. Resolve steps: customSteps OR template workflow
    steps_to_execute: List[Dict[str, Any]] = []

    if customSteps is not None:
        if len(customSteps) > MAX_PLAN_STEPS:
            return {
                "success": False,
                "error": {
                    "code": "PLAN_STEP_LIMIT_EXCEEDED",
                    "message": f"Plan exceeds maximum limit of {MAX_PLAN_STEPS} steps."
                },
                "totalSteps": len(customSteps),
                "completedSteps": 0,
                "totalToolCalls": 0,
                "planSteps": []
            }
        for s in customSteps:
            if isinstance(s, dict):
                steps_to_execute.append(s)
            elif hasattr(s, "model_dump"):
                steps_to_execute.append(s.model_dump())
    else:
        user_query = str(query or "").strip()
        q_lower = user_query.lower()
        detected_intent = workflowIntent or "SHOULD_I_SELL"

        if any(w in q_lower for w in ["goal", "target", "progress"]):
            detected_intent = "GOAL_PROGRESS_CHECK"
        elif any(w in q_lower for w in ["farm report", "opportunity", "performance"]):
            detected_intent = "FARM_HEALTH_AND_OPPORTUNITY"

        # Detect crop from query or explicit parameters
        target_crop = commodity or crop or kwargs.get("crop") or kwargs.get("commodity") or "Tomato"
        crop_match = re.search(r"(tomato|onion|potato|carrot|rice|wheat|spinach|banana|pepper|தக்காளி|வெங்காயம்|टमाटर|प्याज)", q_lower, re.IGNORECASE)
        if crop_match:
            c = crop_match.group(1).lower()
            if "tomato" in c or "தக்காளி" in c or "टमाटर" in c:
                target_crop = "Tomato"
            elif "onion" in c or "வெங்காயம்" in c or "प्याज" in c:
                target_crop = "Onion"
            elif "potato" in c:
                target_crop = "Potato"
            elif "carrot" in c:
                target_crop = "Carrot"
            elif "rice" in c:
                target_crop = "Rice"
            elif "wheat" in c:
                target_crop = "Wheat"

        steps_to_execute = get_standard_plan_workflow(detected_intent, {"commodity": target_crop, "crop": target_crop})

    # Hard cap check
    if len(steps_to_execute) > MAX_PLAN_STEPS:
        return {
            "success": False,
            "error": {
                "code": "PLAN_STEP_LIMIT_EXCEEDED",
                "message": f"Plan exceeds maximum limit of {MAX_PLAN_STEPS} steps."
            },
            "totalSteps": len(steps_to_execute),
            "completedSteps": 0,
            "totalToolCalls": 0,
            "planSteps": []
        }

    # Initialize plan step records
    for idx, s in enumerate(steps_to_execute):
        plan_steps.append({
            "stepIndex": idx + 1,
            "toolName": s.get("toolName", "unknown"),
            "description": s.get("description") or f"Execute {s.get('toolName')}",
            "status": "pending",
            "durationMs": 0,
            "summary": None,
            "error": None
        })

    # Internal plan execution coroutine
    async def _run_plan_steps() -> None:
        nonlocal total_tool_calls, proposed_action
        import app.tools.dispatcher as disp_mod
        from app.tools.registry import get_tool

        for i in range(len(steps_to_execute)):
            step = steps_to_execute[i]
            step_record = plan_steps[i]
            tool_name = step.get("toolName", "")

            # 1. Tool Call Limit check
            if total_tool_calls >= MAX_TOOL_CALLS:
                step_record["status"] = "skipped"
                step_record["summary"] = f"Skipped: Tool call limit reached (max {MAX_TOOL_CALLS} calls)."
                continue

            # 2. Timeout check
            elapsed_seconds = time.perf_counter() - start_time
            if elapsed_seconds >= MAX_EXECUTION_TIME_SECONDS:
                step_record["status"] = "skipped"
                step_record["summary"] = "Skipped: Execution timeout reached."
                continue

            # 3. Recursion Protection
            if tool_name == "executeCopilotPlan":
                step_record["status"] = "failed"
                step_record["error"] = "RECURSION_PROHIBITED: Nested invocation of executeCopilotPlan is strictly forbidden."
                step_record["summary"] = "Execution blocked: Recursive planner calls are prohibited."
                continue

            # 4. Mutation Protection
            if tool_name in FORBIDDEN_MUTATION_TOOLS:
                step_record["status"] = "failed"
                step_record["error"] = f"MUTATION_PROHIBITED: Tool '{tool_name}' performs database mutations and cannot be executed directly by Python AI planner."
                step_record["summary"] = "Execution blocked: Mutation tools require authoritative Node.js confirmation."
                continue

            # 5. Tool Registration Check
            tool_def = get_tool(tool_name)
            if not tool_def:
                step_record["status"] = "failed"
                step_record["error"] = f"TOOL_NOT_FOUND: Tool '{tool_name}' is not recognized or not available in Python read registry."
                step_record["summary"] = f"Unavailable: Tool '{tool_name}' not found."
                continue

            step_record["status"] = "running"
            step_start = time.perf_counter()
            total_tool_calls += 1

            try:
                # Merge parameters with intermediate dependent facts
                merged_params = dict(step.get("params") or {})
                if verified_facts.get("crop") and not merged_params.get("commodity") and not merged_params.get("crop"):
                    merged_params["commodity"] = verified_facts["crop"]

                # Execute through secure dispatcher (enforces RBAC, identity override, sanitization)
                tool_res = await disp_mod.dispatch_tool(user, tool_name, merged_params)
                step_duration_ms = round((time.perf_counter() - step_start) * 1000.0, 2)
                step_record["durationMs"] = step_duration_ms

                if tool_res.success:
                    step_record["status"] = "completed"
                    data = tool_res.data

                    # Record intermediate facts based on tool
                    if tool_name == "getMyInventory":
                        items = data if isinstance(data, list) else data.get("products", []) if isinstance(data, dict) else []
                        verified_facts["inventory"] = [
                            {"id": p.get("id"), "name": p.get("name"), "stock": p.get("stock"), "price": p.get("price")}
                            for p in items
                        ]
                        step_record["summary"] = f"Found {len(items)} inventory items in catalog."

                    elif tool_name == "getPriceIntelligence" and isinstance(data, dict):
                        verified_facts["price"] = {
                            "commodity": data.get("commodity"),
                            "averagePrice": data.get("averagePrice"),
                            "priceRange": data.get("priceRange"),
                            "priceMomentum": data.get("priceMomentum")
                        }
                        step_record["summary"] = f"Average price: ₹{data.get('averagePrice', 'N/A')}/unit (Trend: {data.get('priceMomentum', 'Stable')})."

                    elif tool_name == "getDemandIntelligence" and isinstance(data, dict):
                        verified_facts["demand"] = {
                            "demandTrend": data.get("demandTrend"),
                            "buyerSearches": data.get("buyerSearches"),
                            "growthPercent": data.get("growthPercent")
                        }
                        step_record["summary"] = f"Demand trend: {data.get('demandTrend', 'Stable')}."

                    elif tool_name == "getWeatherAdvisory" and isinstance(data, dict):
                        verified_facts["weather"] = {
                            "rainRisk": data.get("rainRisk"),
                            "windRisk": data.get("windRisk"),
                            "recommendation": data.get("recommendation")
                        }
                        step_record["summary"] = f"Harvest suitability: {data.get('recommendation', 'Favorable')}."

                    elif tool_name == "getMyOrders":
                        orders = data if isinstance(data, list) else []
                        pending_orders = [o for o in orders if str(o.get("status", "")).lower() == "pending"]
                        verified_facts["pendingOrdersCount"] = len(pending_orders)
                        step_record["summary"] = f"{len(pending_orders)} pending orders found."

                    elif tool_name == "getSellingRecommendation" and isinstance(data, dict):
                        verified_facts["sellingStrategy"] = data
                        step_record["summary"] = f"Recommendation: {data.get('recommendation', 'SELL_PARTIALLY')}."
                        if data.get("actionProposal"):
                            proposed_action = data["actionProposal"]

                    elif tool_name == "getMyFarmingGoals":
                        goals = data if isinstance(data, list) else []
                        verified_facts["goalsCount"] = len(goals)
                        step_record["summary"] = f"Retrieved {len(goals)} active farming goals."

                    elif tool_name == "getGoalProgress" and isinstance(data, dict):
                        verified_facts["goalProgress"] = data
                        step_record["summary"] = f"Goal progress: {data.get('goal', {}).get('progressPercent', 0)}% verified."

                    else:
                        step_record["summary"] = "Data successfully gathered."

                else:
                    step_record["status"] = "failed"
                    step_record["error"] = tool_res.error.get("message") if tool_res.error else "Tool execution unsuccessful."
                    step_record["summary"] = f"Unavailable: {step_record['error']}"

            except Exception as exc:
                step_record["status"] = "failed"
                step_record["error"] = str(exc)
                step_record["durationMs"] = round((time.perf_counter() - step_start) * 1000.0, 2)
                step_record["summary"] = f"Error: {str(exc)}"

    # Execute with strict 30-second timeout guard
    try:
        await asyncio.wait_for(_run_plan_steps(), timeout=MAX_EXECUTION_TIME_SECONDS)
    except asyncio.TimeoutError:
        return {
            "success": False,
            "error": {
                "code": "AI_PLANNER_TIMEOUT",
                "message": f"AI Planner execution exceeded {MAX_EXECUTION_TIME_SECONDS}s timeout limit."
            },
            "totalSteps": len(plan_steps),
            "completedSteps": sum(1 for s in plan_steps if s.get("status") == "completed"),
            "totalToolCalls": total_tool_calls,
            "totalDurationMs": round((time.perf_counter() - start_time) * 1000.0, 2),
            "planSteps": plan_steps,
            "facts": [],
            "verifiedFacts": verified_facts,
            "reasoning": "Plan aborted due to execution timeout.",
            "recommendation": None,
            "proposedAction": None
        }

    # Synthesize Facts, Reasoning, and Recommendation
    facts_list: List[str] = []
    if verified_facts.get("inventory"):
        items_str = ", ".join(f"{p.get('name')} ({p.get('stock')} units)" for p in verified_facts["inventory"]) or "None"
        facts_list.append(f"Farm Inventory: {items_str}")
    if verified_facts.get("price"):
        p_info = verified_facts["price"]
        p_range = p_info.get("priceRange") or {}
        facts_list.append(
            f"Market Price: Average ₹{p_info.get('averagePrice', 'N/A')}/kg for {p_info.get('commodity', 'produce')} "
            f"(Range: ₹{p_range.get('min', 'N/A')} - ₹{p_range.get('max', 'N/A')})"
        )
    if verified_facts.get("demand"):
        facts_list.append(f"Market Demand: Trend is {verified_facts['demand'].get('demandTrend', 'stable')}")
    if verified_facts.get("weather"):
        facts_list.append(f"Weather Forecast: {verified_facts['weather'].get('recommendation', 'Clear')}")
    if verified_facts.get("pendingOrdersCount") is not None:
        facts_list.append(f"Pending Buyer Orders: {verified_facts['pendingOrdersCount']} orders")
    if verified_facts.get("goalsCount") is not None:
        facts_list.append(f"Active Goals: {verified_facts['goalsCount']} goals tracked")

    # Derive reasoning
    strategy_rec = "SELL_PARTIALLY"
    explanation = "Based on balanced inventory levels and current market demand momentum."
    if verified_facts.get("sellingStrategy"):
        strategy_rec = verified_facts["sellingStrategy"].get("recommendation") or "SELL_PARTIALLY"
        explanation = verified_facts["sellingStrategy"].get("reasoning") or explanation

    price_trend = verified_facts.get("price", {}).get("priceMomentum") or "Stable"
    demand_trend = verified_facts.get("demand", {}).get("demandTrend") or "moderate"
    weather_rec = verified_facts.get("weather", {}).get("recommendation") or "favorable for farm operations"

    reasoning_text = "\n".join([
        f"Price and Demand Analysis: {price_trend} price trend with {demand_trend} market demand.",
        f"Operational & Weather Risk: Weather is {weather_rec}.",
        f"Synthesis: {explanation}"
    ])

    recommendation = {
        "action": strategy_rec,
        "description": f"Recommendation: {strategy_rec.replace('_', ' ')}. Review selling opportunities and confirm appropriate orders.",
        "disclaimer": "All recommendations are decision-support guidelines based on verified platform data. Market conditions remain subject to change."
    }

    total_duration_ms = round((time.perf_counter() - start_time) * 1000.0, 2)
    completed_steps_count = sum(1 for s in plan_steps if s.get("status") == "completed")

    return {
        "success": True,
        "totalSteps": len(plan_steps),
        "completedSteps": completed_steps_count,
        "totalToolCalls": total_tool_calls,
        "totalDurationMs": total_duration_ms,
        "planSteps": plan_steps,
        "facts": facts_list,
        "verifiedFacts": verified_facts,
        "reasoning": reasoning_text,
        "recommendation": recommendation,
        "proposedAction": proposed_action
    }
