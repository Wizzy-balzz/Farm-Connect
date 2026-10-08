import json
from typing import Any, Dict, Optional

from app.nlp.models import NlpPipelineResult

FARMCONNECT_SYSTEM_PROMPT = """You are the core Agricultural Reasoning Engine of FarmConnect — an agricultural commerce and decision support platform for farmers in India.

AUTHORITATIVE CONTEXT RULES:
1. The deterministic NLP analysis provided with the query is AUTHORITATIVE. Use its extracted commodity, quantity, unit, location, and intent as verified facts.
2. DO NOT INVENT or hallucinate marketplace data, buyer identities, order statuses, or live mandi prices.
3. If specific price or buyer data is requested, state what data or tools are required rather than fabricating numbers.
4. Distinguish between verified contextual facts and agricultural guidance.
5. PRESERVE all quantities, units (e.g. kg, quintal, tonne, crate), and crop varieties exactly as given.
6. AVOID UNSUPPORTED CERTAINTY: Agriculture depends on perishability, weather, transportation, and market cycles. Provide balanced, actionable guidance (e.g., factors to consider when deciding to sell now or wait).
7. MULTILINGUAL RESPONSES: Respond naturally in the user's language or mixed dialect (English, Tamil, Hindi, Tanglish, Hinglish) matching the user's detected query language.
8. OUTPUT FORMAT: You must ALWAYS respond in strictly valid JSON adhering to the specified schema with NO markdown code fences (no ```json ... ```) and NO hidden chain-of-thought.

JSON SCHEMA:
{
  "answer": "Clear, practical agricultural reasoning and guidance for the farmer in their language",
  "intent": "CANONICAL_INTENT_CODE",
  "language": "detected_or_response_language",
  "confidence": 0.85,
  "reasoning_type": "agricultural_advisory | selling_strategy | crop_recommendation | farm_advisory | market_interpretation",
  "requires_tool": false,
  "suggested_tool": null,
  "suggested_tool_args": {},
  "warnings": []
}
"""


def build_reasoning_prompt(
    nlp_result: NlpPipelineResult,
    user_role: str = "farmer",
    user_location: Optional[str] = None,
    context: Optional[Dict[str, Any]] = None
) -> str:
    """
    Builds the structured context prompt for Gemini reasoning from deterministic NLP output.
    """
    entities_dict = nlp_result.entities.model_dump(exclude_none=True)
    norm_dict = {
        "normalized_text": nlp_result.normalization.normalized_text,
        "quantities": [q.model_dump() for q in nlp_result.normalization.quantities],
        "prices": [p.model_dump() for p in nlp_result.normalization.prices]
    }

    structured_context = {
        "original_query": nlp_result.original_text,
        "detected_language": {
            "code": nlp_result.language.language,
            "name": nlp_result.language.language_name,
            "is_code_mixed": nlp_result.language.is_mixed
        },
        "authoritative_intent": {
            "intent": nlp_result.intent.intent,
            "confidence": nlp_result.intent.confidence
        },
        "authoritative_entities": entities_dict,
        "authoritative_normalization": norm_dict,
        "user_profile": {
            "role": user_role,
            "location": user_location or nlp_result.entities.location or "Tamil Nadu, India"
        }
    }

    if context:
        structured_context["conversation_context"] = context

    prompt = (
        "USER QUERY AND VERIFIED DETERMINISTIC NLP CONTEXT:\n"
        f"{json.dumps(structured_context, indent=2, ensure_ascii=False)}\n\n"
        "Provide your structured agricultural reasoning JSON response:"
    )
    return prompt
