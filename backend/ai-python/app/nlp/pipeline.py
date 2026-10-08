from typing import Any, Dict, Optional
from app.nlp.models import ExtractedEntities, NlpPipelineResult
from app.nlp.language import detect_language
from app.nlp.normalization import normalize_text
from app.nlp.entities import extract_entities
from app.nlp.intent import detect_intent
from app.nlp.agriculture_dictionary import CROP_NAME_CANONICAL, KNOWN_LOCATIONS


def resolve_contextual_entities(current_entities: ExtractedEntities, context: Optional[Dict[str, Any]] = None) -> ExtractedEntities:
    """
    Lightweight deterministic context resolution.
    Carries forward known commodities and locations from prior turns if not explicitly re-stated.
    """
    if not context or not isinstance(context, dict):
        return current_entities

    resolved = current_entities.model_copy()

    # Prior turn entities check
    known_entities = context.get("known_entities", {})
    if isinstance(known_entities, dict):
        if not resolved.commodity and known_entities.get("commodity"):
            resolved.commodity = known_entities["commodity"]
        if not resolved.location and known_entities.get("location"):
            resolved.location = known_entities["location"]

    # History scan if previous_messages are provided
    prev_messages = context.get("previous_messages", [])
    if isinstance(prev_messages, list) and not resolved.commodity:
        for msg in reversed(prev_messages):
            content = msg.get("content", "") if isinstance(msg, dict) else str(msg)
            content_lower = content.lower()
            for crop_key, (canon_crop, _) in CROP_NAME_CANONICAL.items():
                if crop_key.lower() in content_lower:
                    resolved.commodity = canon_crop
                    break
            if resolved.commodity:
                break

    if isinstance(prev_messages, list) and not resolved.location:
        for msg in reversed(prev_messages):
            content = msg.get("content", "") if isinstance(msg, dict) else str(msg)
            for loc in KNOWN_LOCATIONS:
                if loc.lower() in content.lower():
                    resolved.location = loc
                    break
            if resolved.location:
                break

    return resolved


def process_nlp(text: str, context: Optional[Dict[str, Any]] = None) -> NlpPipelineResult:
    """
    Executes the complete deterministic NLP pipeline:
    Language Detection -> Normalization -> Entity Extraction -> Context Resolution -> Intent Classification.
    Runs 100% locally and deterministically with zero Gemini or network calls.
    """
    safe_text = (text or "").strip()

    # 1. Language & Script Detection
    lang_result = detect_language(safe_text)

    # 2. Text Normalization (Numbers, Units, Currencies)
    norm_result = normalize_text(safe_text)

    # 3. Entity Extraction
    extracted_entities = extract_entities(safe_text, norm_result=norm_result)

    # 4. Context Resolution (carry forward missing entities from history)
    resolved_entities = resolve_contextual_entities(extracted_entities, context)

    # 5. Intent Detection
    intent_result = detect_intent(safe_text, entities=resolved_entities)

    return NlpPipelineResult(
        original_text=safe_text,
        language=lang_result,
        normalization=norm_result,
        entities=resolved_entities,
        intent=intent_result,
        context_metadata={
            "resolved_from_context": {
                "commodity": bool(not extracted_entities.commodity and resolved_entities.commodity),
                "location": bool(not extracted_entities.location and resolved_entities.location)
            }
        },
        processing={
            "gemini_used": False,
            "deterministic": True,
            "pipeline_version": "1.0.0"
        }
    )
