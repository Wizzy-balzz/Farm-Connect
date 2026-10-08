import logging
import re
import time
from typing import Any, Dict, List, Optional, Tuple

from app.nlp.pipeline import process_nlp
from app.nlp.models import NlpPipelineResult
from app.ai.models import ReasoningRequest, ReasoningResponse, ReasoningType, StructuredReasoningOutput
from app.ai.prompts import build_reasoning_prompt
from app.ai.gemini_client import reasoning_engine
from app.ai.response_parser import parse_and_validate_response
from app.ai.fallback import build_fallback_response
from app.tools.registry import get_tools_for_role
from app.tools.dispatcher import dispatch_tool

logger = logging.getLogger("farmconnect.ai.reasoning")

from app.ai.project_knowledge import get_project_knowledge_response

# Intents that mandate structured agricultural reasoning beyond simple tool routing
COMPLEX_REASONING_INTENTS = {
    "SELLING_STRATEGY",
    "CROP_RECOMMENDATION",
    "FARM_ADVISORY"
}

# Backward-compatibility alias
GEMINI_REASONING_INTENTS = COMPLEX_REASONING_INTENTS

# Standard greetings that deterministic NLP handles directly
DETERMINISTIC_GREETING_WORDS = {
    "hello", "hi", "hey", "good morning", "good evening", "good afternoon",
    "vanakkam", "வணக்கம்", "namaste", "नमस्ते", "pranam", "प्रणाम",
    "thanks", "thank you", "dhanyavad", "धन्यवाद", "nandri", "நன்றி"
}


def should_use_complex_reasoning(nlp_result: NlpPipelineResult, force_reasoning: bool = False) -> Tuple[bool, str]:
    """
    Decision layer for reasoning complexity.
    Evaluates whether deterministic NLP can completely answer or route the query
    without invoking the complex reasoning engine.
    """
    if force_reasoning:
        return True, "forced_by_caller"

    intent = nlp_result.intent.intent
    text_lower = nlp_result.original_text.lower().strip()

    # 1. Complex reasoning intents ALWAYS qualify
    if intent in COMPLEX_REASONING_INTENTS:
        return True, f"complex_reasoning_intent:{intent}"

    # 2. Project knowledge queries are 100% deterministic
    if intent == "PROJECT_KNOWLEDGE":
        return False, "deterministic_project_knowledge"

    # 3. General greetings: keep 100% deterministic
    if intent == "GENERAL_CHAT":
        is_simple_greeting = any(re.search(r'\b' + re.escape(greet) + r'\b', text_lower) for greet in DETERMINISTIC_GREETING_WORDS)
        if is_simple_greeting or len(text_lower.split()) <= 3:
            return False, "deterministic_greeting"
        # Complex conversational query
        return True, "conversational_reasoning"

    # 4. Price Intelligence: deterministic unless explicit trend/advisory reasoning requested
    if intent == "PRICE_INTELLIGENCE":
        if any(kw in text_lower for kw in ("trend", "forecast", "why", "fluctuat", "predict")):
            return True, "price_trend_reasoning"
        return False, "deterministic_price_lookup"

    # 5. Transactional, tracking, and tool intents: route deterministically
    if intent in ("ORDER_TRACKING", "ORDER_QUERY", "MARKETPLACE_SEARCH", "BUYER_SEARCH", "BUYING_REQUEST", "SELLING_OFFER", "FOLLOWUP_REQUEST", "WEATHER_QUERY", "INVENTORY_QUERY", "INVENTORY_LOW_STOCK", "FARMING_GOALS", "FOLLOWUPS_QUERY", "FARM_REPORT", "DEMAND_INTELLIGENCE", "MEMORY_QUERY", "COPILOT_PLAN"):
        return False, f"deterministic_tool_routing:{intent}"

    # Default fallback: deterministic
    return False, "deterministic_default"


# Backward-compatibility alias
should_invoke_gemini = should_use_complex_reasoning


async def reason_about_query(request: ReasoningRequest) -> ReasoningResponse:
    """
    Core entrypoint for FarmConnect Agricultural Reasoning.
    Fully local, deterministic pipeline — ZERO external API calls.

    Pipeline:
      1. Deterministic NLP (Language -> Normalization -> Entities -> Context -> Intent)
      2. Reasoning Decision Layer (simple vs complex)
      3. Local Deterministic Reasoning Engine (if complex reasoning needed)
      4. Structured Response Validation & Sanitization
      5. Resilient Agricultural Fallback (on parse failure)
    """
    start_time = time.time()

    # Step 1: Run deterministic NLP pipeline FIRST
    nlp_result = process_nlp(request.text, context=request.context)

    # Step 2: Reasoning Decision Layer
    use_complex, decision_reason = should_use_complex_reasoning(
        nlp_result, force_reasoning=request.force_gemini
    )

    lang_code = (request.language_override or nlp_result.language.language).lower()
    intent = nlp_result.intent.intent
    entities_dict = nlp_result.entities.model_dump(exclude_none=True)

    # Step 3A: Deterministic Routing (Simple intents & Project Knowledge)
    if not use_complex:
        logger.info(f"[Reasoning] Deterministic response (reason: {decision_reason}).")
        total_latency_ms = int((time.time() - start_time) * 1000)

        # Generate deterministic response based on intent
        if intent == "PROJECT_KNOWLEDGE":
            ans = get_project_knowledge_response(request.text, lang=lang_code)
            return ReasoningResponse(
                answer=ans,
                intent="PROJECT_KNOWLEDGE",
                language=lang_code,
                confidence=nlp_result.intent.confidence,
                reasoning_type=ReasoningType.DETERMINISTIC_NLP.value,
                requires_tool=False,
                suggested_tool=None,
                warnings=[],
                fallback_used=False,
                gemini_used=False,
                entities=entities_dict,
                processing_metadata={
                    "decision_reason": decision_reason,
                    "pipeline_latency_ms": total_latency_ms
                }
            )

        elif intent == "GENERAL_CHAT":
            if lang_code in ("ta", "tamil", "tanglish"):
                ans = "வணக்கம்! FarmConnect விவசாய உதவி மையத்திற்கு வரவேற்கிறோம். நான் உங்களுக்கு எவ்வாறு உதவ முடியும்?"
            elif lang_code in ("hi", "hindi", "hinglish"):
                ans = "नमस्ते! FarmConnect कृषि सहायक में आपका स्वागत है। मैं आपकी क्या मदद कर सकता हूँ?"
            else:
                ans = "Hello! Welcome to FarmConnect. I can help you with crop selling strategies, market rates, buyer discovery, and farming advice."

            return ReasoningResponse(
                answer=ans,
                intent="GENERAL_CHAT",
                language=lang_code,
                confidence=nlp_result.intent.confidence,
                reasoning_type=ReasoningType.DETERMINISTIC_NLP.value,
                requires_tool=False,
                suggested_tool=None,
                warnings=[],
                fallback_used=False,
                gemini_used=False,
                entities=entities_dict,
                processing_metadata={
                    "decision_reason": decision_reason,
                    "pipeline_latency_ms": total_latency_ms
                }
            )

        elif intent in ("ORDER_TRACKING", "ORDER_QUERY"):
            return ReasoningResponse(
                answer="Retrieving your recent order status and list.",
                intent=intent,
                language=lang_code,
                confidence=nlp_result.intent.confidence,
                reasoning_type=ReasoningType.TOOL_ROUTING.value,
                requires_tool=True,
                suggested_tool="getMyOrders",
                suggested_tool_args={"limit": 30},
                warnings=[],
                fallback_used=False,
                gemini_used=False,
                entities=entities_dict,
                processing_metadata={
                    "decision_reason": decision_reason,
                    "pipeline_latency_ms": total_latency_ms
                }
            )

        elif intent in ("REVENUE_SALES_QUERY", "SALES_QUERY"):
            return ReasoningResponse(
                answer="Fetching your sales revenue and order analytics.",
                intent=intent,
                language=lang_code,
                confidence=nlp_result.intent.confidence,
                reasoning_type=ReasoningType.TOOL_ROUTING.value,
                requires_tool=True,
                suggested_tool="getMySales",
                suggested_tool_args={},
                warnings=[],
                fallback_used=False,
                gemini_used=False,
                entities=entities_dict,
                processing_metadata={
                    "decision_reason": decision_reason,
                    "pipeline_latency_ms": total_latency_ms
                }
            )

        elif intent == "BUYER_SEARCH":
            comm = nlp_result.entities.commodity or "produce"
            return ReasoningResponse(
                answer=f"Searching verified wholesale buyers and traders for {comm}.",
                intent="BUYER_SEARCH",
                language=lang_code,
                confidence=nlp_result.intent.confidence,
                reasoning_type=ReasoningType.TOOL_ROUTING.value,
                requires_tool=True,
                suggested_tool="getBuyers",
                suggested_tool_args={"commodity": comm, "location": nlp_result.entities.location},
                warnings=[],
                fallback_used=False,
                gemini_used=False,
                entities=entities_dict,
                processing_metadata={
                    "decision_reason": decision_reason,
                    "pipeline_latency_ms": total_latency_ms
                }
            )

        elif intent == "PRICE_INTELLIGENCE":
            comm = nlp_result.entities.commodity or "produce"
            return ReasoningResponse(
                answer=f"Retrieving current APMC mandi market rates for {comm}.",
                intent="PRICE_INTELLIGENCE",
                language=lang_code,
                confidence=nlp_result.intent.confidence,
                reasoning_type=ReasoningType.TOOL_ROUTING.value,
                requires_tool=True,
                suggested_tool="getMarketPrices",
                suggested_tool_args={"commodity": comm, "location": nlp_result.entities.location},
                warnings=[],
                fallback_used=False,
                gemini_used=False,
                entities=entities_dict,
                processing_metadata={
                    "decision_reason": decision_reason,
                    "pipeline_latency_ms": total_latency_ms
                }
            )

        else:
            # Other deterministic tool routes
            return ReasoningResponse(
                answer=f"FarmConnect processed your request for {nlp_result.entities.commodity or 'agricultural query'}.",
                intent=intent,
                language=lang_code,
                confidence=nlp_result.intent.confidence,
                reasoning_type=ReasoningType.DETERMINISTIC_NLP.value,
                requires_tool=False,
                suggested_tool=None,
                warnings=[],
                fallback_used=False,
                gemini_used=False,
                entities=entities_dict,
                processing_metadata={
                    "decision_reason": decision_reason,
                    "pipeline_latency_ms": total_latency_ms
                }
            )

    # Step 3B: Complex Agricultural Reasoning (Local Deterministic Engine)
    logger.info(f"[Reasoning] Invoking local reasoning engine (reason: {decision_reason})")
    commodity = nlp_result.entities.commodity or "produce"
    qty_str = (
        f"{nlp_result.entities.quantity:g} {nlp_result.entities.unit}"
        if nlp_result.entities.quantity and nlp_result.entities.unit
        else "your harvest"
    )

    engine_res = await reasoning_engine.generate_reasoning(
        intent=intent,
        commodity=commodity,
        qty_str=qty_str,
        language=lang_code,
        user_location=request.user_location,
        context=request.context,
    )

    total_latency_ms = int((time.time() - start_time) * 1000)

    # If engine failed (should not happen for local, but defensive)
    if not engine_res.success:
        logger.warning(
            f"[Reasoning] Local engine failed ({engine_res.error_code}): {engine_res.error_message}. Engaging fallback."
        )
        fb_resp = build_fallback_response(
            nlp_result=nlp_result,
            reason_label=engine_res.error_code.value if engine_res.error_code else "engine_error",
            error_details=engine_res.error_message
        )
        fb_resp.processing_metadata.update({
            "pipeline_latency_ms": total_latency_ms
        })
        return fb_resp

    # Step 4: Parse & Validate Response
    raw_answer_text = engine_res.text or ""
    structured_output, parse_warnings = parse_and_validate_response(raw_answer_text, nlp_result)

    if structured_output is None:
        logger.warning("[Reasoning] Local engine output parsing failed. Engaging fallback.")
        fb_resp = build_fallback_response(
            nlp_result=nlp_result,
            reason_label="malformed_engine_output",
            error_details="; ".join(parse_warnings)
        )
        fb_resp.processing_metadata.update({
            "pipeline_latency_ms": total_latency_ms
        })
        return fb_resp

    # Step 5: Successful Validated Output
    return ReasoningResponse(
        answer=structured_output.answer,
        intent=structured_output.intent,
        language=structured_output.language,
        confidence=structured_output.confidence,
        reasoning_type=structured_output.reasoning_type,
        requires_tool=structured_output.requires_tool,
        suggested_tool=structured_output.suggested_tool,
        suggested_tool_args=structured_output.suggested_tool_args or {},
        executed_tools=None,
        tool_call_count=0,
        warnings=parse_warnings + structured_output.warnings,
        fallback_used=False,
        gemini_used=False,
        entities=entities_dict,
        processing_metadata={
            "decision_reason": decision_reason,
            "engine_latency_ms": engine_res.latency_ms,
            "pipeline_latency_ms": total_latency_ms,
        }
    )
