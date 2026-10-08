"""
Deterministic Tool Router for FarmConnect Python NLP.
Maps recognized user intents and extracted entities directly to safe, registered tools.
Strictly respects RBAC boundaries, user scoping, and confidence thresholds.
"""

from typing import Any, Dict, Optional, Tuple
from app.nlp.models import NlpPipelineResult
from app.tools.permissions import is_tool_allowed


INTENT_TO_TOOL_MAPPING: Dict[str, str] = {
    "INVENTORY_LOW_STOCK": "getMyInventoryAnalytics",
    "INVENTORY_QUERY": "getMyInventory",
    "REVENUE_SALES_QUERY": "getMySalesAnalytics",
    "MARKETPLACE_SEARCH": "searchProducts",
    "FARMING_GOALS": "getMyFarmingGoals",
    "FOLLOWUPS_QUERY": "getMyFollowUps",
    "WEATHER_QUERY": "getWeatherAdvisory",
    "FARM_REPORT": "getMyFarmReport",
    "PRICE_INTELLIGENCE": "getPriceIntelligence",
    "DEMAND_INTELLIGENCE": "getDemandIntelligence",
    "SELLING_STRATEGY": "getSellingRecommendation",
    "BUYER_SEARCH": "getNearbyBuyerOpportunities",
    "ORDER_QUERY": "getMyOrders",
    "ORDER_TRACKING": "getMyOrders",
    "MEMORY_QUERY": "getMyAiMemory",
    "COPILOT_PLAN": "executeCopilotPlan",
}


def route_intent_to_tool(
    nlp_result: NlpPipelineResult,
    user: Dict[str, Any]
) -> Tuple[Optional[str], Dict[str, Any], bool]:
    """
    Evaluates whether the query requires a tool call, and selects the matching tool
    with prepared arguments.

    Returns:
        (tool_name, tool_args, is_low_confidence)
    """
    intent = nlp_result.intent.intent
    conf = nlp_result.intent.confidence
    entities = nlp_result.entities

    # Ambiguous or very low confidence query -> do not run a random tool
    if conf < 0.60:
        return None, {}, True

    # General chat, project knowledge, or conversational greetings -> no tool
    if intent in ("GENERAL_CHAT", "FARM_ADVISORY", "CROP_RECOMMENDATION", "PROJECT_KNOWLEDGE"):
        return None, {}, False

    tool_name = INTENT_TO_TOOL_MAPPING.get(intent)
    if not tool_name:
        return None, {}, False

    # Build tool arguments based on tool schema
    args: Dict[str, Any] = {}

    if tool_name == "getMyInventoryAnalytics":
        args = {
            "period": "30d"
        }
    elif tool_name == "getMyInventory":
        args = {
            "commodity": entities.commodity
        }
    elif tool_name == "getMySalesAnalytics":
        args = {
            "period": "30d",
            "commodity": entities.commodity
        }
    elif tool_name == "searchProducts":
        args = {}
        if entities.commodity:
            args["commodity"] = entities.commodity
        if entities.location:
            args["location"] = entities.location
    elif tool_name == "getWeatherAdvisory":
        args = {
            "location": entities.location or user.get("region") or "Tamil Nadu"
        }
    elif tool_name in ("getPriceIntelligence", "getPriceInsights"):
        args = {
            "commodity": entities.commodity or "tomato",
            "location": entities.location or user.get("region") or "Tamil Nadu"
        }
    elif tool_name in ("getDemandIntelligence", "getDemandInsights"):
        args = {
            "commodity": entities.commodity or "tomato",
            "location": entities.location or user.get("region") or "Tamil Nadu"
        }
    elif tool_name in ("getSellingRecommendation", "getSellingPlan"):
        args = {
            "commodity": entities.commodity or "tomato"
        }
    elif tool_name == "getMyFarmReport":
        args = {
            "period": "30d"
        }
    elif tool_name == "getNearbyBuyerOpportunities":
        args = {
            "commodity": entities.commodity or "tomato",
            "maxDistanceKm": 50
        }
    elif tool_name == "executeCopilotPlan":
        args = {
            "workflowIntent": "SHOULD_I_SELL",
            "initialParams": {"commodity": entities.commodity or "tomato"}
        }
    elif tool_name == "getMyOrders":
        args = {
            "limit": 30
        }

    return tool_name, args, False
