import json
import logging
import re
from typing import Any, Dict, List, Optional, Tuple

from app.nlp.models import NlpPipelineResult
from app.ai.models import StructuredReasoningOutput

logger = logging.getLogger("farmconnect.ai.parser")

KNOWN_FARMCONNECT_TOOLS = {
    # 13 Migrated Phase 3B Stage 1 Tools
    "searchProducts",
    "getProduct",
    "getNearbyProducts",
    "getFarmerProfile",
    "getFarmerProducts",
    "compareProducts",
    "getPriceInsights",
    "getDemandInsights",
    "getWeatherAdvisory",
    "getPriceIntelligence",
    "getDemandIntelligence",
    "getMarketplaceOverview",
    "getMarketplaceAnalytics",
    # 7 Migrated Phase 3B Stage 2 Tools
    "getMyOrders",
    "getMySales",
    "getMyInventory",
    "getMyFarmReport",
    "getMySalesAnalytics",
    "getMyInventoryAnalytics",
    "getMyProductPerformance",
    # Stage 3A Migrated Tools
    "getNearbyBuyerOpportunities",
    # Stage 3B Migrated Tools
    "getSellingRecommendation",
    "getMySellingOpportunities",
    "compareSellingOptions",
    "getSellingPlan",
    "compareAnalyticsPeriods",
    "generateAnalyticsReport",
    "getPlatformAnalytics",
    "getPlatformAnalyticsReport",
    # Existing tool references
    "getMarketPrices",
    "getBuyers",
    "trackOrder",
    "createProduceListing",
    "createFollowupTask",
    "calculateDeliveryFee",
    "getUserProfile"
}




def sanitize_answer_text(text: str) -> str:
    """Removes any internal reasoning tags, markdown thought blocks, or leaked instructions."""
    if not text:
        return ""
    cleaned = re.sub(r"<thought>[\s\S]*?</thought>", "", text, flags=re.IGNORECASE)
    cleaned = re.sub(r"Thinking Process:[\s\S]*?\n\n", "", cleaned, flags=re.IGNORECASE)
    return cleaned.strip()


def parse_and_validate_response(
    raw_text: str,
    nlp_result: NlpPipelineResult
) -> Tuple[Optional[StructuredReasoningOutput], List[str]]:
    """
    Defensively parses and validates Gemini raw response text into StructuredReasoningOutput.
    Recovers from markdown wrappers, JSON syntax variances, and trailing conversational text.
    Returns: (StructuredReasoningOutput or None, list_of_warnings)
    """
    warnings: List[str] = []
    if not raw_text or not raw_text.strip():
        return None, ["Empty model output received"]

    cleaned = raw_text.strip()

    # 1. Strip markdown fences if present (```json ... ``` or ``` ... ```)
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)
        cleaned = cleaned.strip()

    parsed_dict: Optional[Dict[str, Any]] = None

    # 2. Direct JSON Parse Attempt
    try:
        parsed_dict = json.loads(cleaned)
    except json.JSONDecodeError:
        # 3. Regex search for JSON object within text
        json_match = re.search(r"\{[\s\S]*\}", cleaned)
        if json_match:
            try:
                parsed_dict = json.loads(json_match.group(0))
                warnings.append("Extracted JSON from surrounding markdown/text")
            except json.JSONDecodeError:
                parsed_dict = None

    # 4. Fallback recovery: if JSON decoding completely failed, check if plain text is a valid answer
    if not isinstance(parsed_dict, dict):
        if "{" not in cleaned and "}" not in cleaned:
            plain_answer = sanitize_answer_text(cleaned)
            if len(plain_answer) > 10:
                logger.info("[ResponseParser] Recovering from plain text model answer")
                warnings.append("Parsed plain-text model output as answer")
                recovered = StructuredReasoningOutput(
                    answer=plain_answer,
                    intent=nlp_result.intent.intent,
                    language=nlp_result.language.language,
                    confidence=nlp_result.intent.confidence,
                    reasoning_type="agricultural_advisory",
                    requires_tool=False,
                    suggested_tool=None,
                    warnings=warnings
                )
                return recovered, warnings
        return None, ["Failed to decode structured JSON from model response"]

    # 5. Validate & sanitize required fields
    raw_answer = parsed_dict.get("answer")
    if not raw_answer or not isinstance(raw_answer, str) or not raw_answer.strip():
        return None, ["Model output JSON contains empty or missing 'answer' field"]

    clean_answer = sanitize_answer_text(raw_answer)
    if not clean_answer:
        return None, ["Model answer was empty after sanitizing chain-of-thought"]

    # Intent validation (preserves deterministic NLP intent if model deviates wildly)
    intent = str(parsed_dict.get("intent") or nlp_result.intent.intent).strip()
    if intent not in {
        "SELLING_STRATEGY", "CROP_RECOMMENDATION", "FARM_ADVISORY",
        "PRICE_INTELLIGENCE", "WEATHER_QUERY", "BUYING_REQUEST",
        "SELLING_OFFER", "BUYER_SEARCH", "ORDER_TRACKING",
        "FOLLOWUP_REQUEST", "GENERAL_CHAT"
    }:
        warnings.append(f"Model returned unrecognized intent '{intent}'; restored deterministic intent '{nlp_result.intent.intent}'")
        intent = nlp_result.intent.intent

    # Language validation
    lang = str(parsed_dict.get("language") or nlp_result.language.language).strip()

    # Confidence validation
    try:
        confidence = float(parsed_dict.get("confidence", 0.85))
        confidence = max(0.0, min(1.0, confidence))
    except (TypeError, ValueError):
        confidence = 0.85

    reasoning_type = str(parsed_dict.get("reasoning_type", "agricultural_advisory")).strip()
    requires_tool = bool(parsed_dict.get("requires_tool", False))
    suggested_tool = parsed_dict.get("suggested_tool")

    # Tool validation: do not allow fabricated tool names
    if suggested_tool:
        suggested_tool_str = str(suggested_tool).strip()
        if suggested_tool_str not in KNOWN_FARMCONNECT_TOOLS:
            warnings.append(f"Model proposed unsupported tool '{suggested_tool_str}'; neutralized")
            suggested_tool = None
            requires_tool = False
        else:
            suggested_tool = suggested_tool_str

    suggested_args = parsed_dict.get("suggested_tool_args")
    if not isinstance(suggested_args, dict):
        suggested_args = {}

    structured_output = StructuredReasoningOutput(
        answer=clean_answer,
        intent=intent,
        language=lang,
        confidence=confidence,
        reasoning_type=reasoning_type,
        requires_tool=requires_tool,
        suggested_tool=suggested_tool,
        suggested_tool_args=suggested_args,
        warnings=warnings
    )

    return structured_output, warnings
