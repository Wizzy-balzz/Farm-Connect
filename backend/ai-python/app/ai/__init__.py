"""
FarmConnect Agricultural Reasoning Layer (Phase 2C)
Combines deterministic NLP preprocessing with structured Gemini 2.5/Flash reasoning.
"""

from app.ai.models import (
    GeminiErrorCode,
    ReasoningRequest,
    ReasoningResponse,
    ReasoningType,
    StructuredReasoningOutput,
)
from app.ai.gemini_client import (
    GeminiClient,
    classify_gemini_error,
    gemini_client,
    sanitize_log_string,
)
from app.ai.prompts import FARMCONNECT_SYSTEM_PROMPT, build_reasoning_prompt
from app.ai.response_parser import parse_and_validate_response
from app.ai.fallback import build_fallback_response
from app.ai.reasoning import reason_about_query, should_invoke_gemini

__all__ = [
    "GeminiErrorCode",
    "ReasoningRequest",
    "ReasoningResponse",
    "ReasoningType",
    "StructuredReasoningOutput",
    "GeminiClient",
    "gemini_client",
    "classify_gemini_error",
    "sanitize_log_string",
    "FARMCONNECT_SYSTEM_PROMPT",
    "build_reasoning_prompt",
    "parse_and_validate_response",
    "build_fallback_response",
    "reason_about_query",
    "should_invoke_gemini",
]
