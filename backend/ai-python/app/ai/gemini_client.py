"""
FarmConnect AI Error Classification, Sanitization & Deterministic Reasoning Engine

Fully local, deterministic agricultural reasoning. ZERO external API dependencies.
All complex reasoning intents (SELLING_STRATEGY, CROP_RECOMMENDATION, FARM_ADVISORY)
are handled by domain-specific deterministic templates using extracted NLP entities.
"""

import asyncio
import json
import logging
import re
import time
from typing import Any, Callable, Dict, List, Optional, Tuple

from app.core.config import settings
from app.ai.models import AiErrorCode, AiExecutionResult

# Backward-compatibility alias
GeminiErrorCode = AiErrorCode

logger = logging.getLogger("farmconnect.ai.engine")


def sanitize_log_string(raw: Any) -> str:
    """
    Sanitizes any string or exception message to ensure secrets, API keys, and sensitive tokens
    are NEVER logged or leaked.
    """
    if not raw:
        return ""
    text = str(raw)

    # Redact common credentials patterns
    text = re.sub(r"((?:key|secret|password|token)=)([^\s&]+)", r"\1[REDACTED]", text, flags=re.IGNORECASE)
    text = re.sub(r"(AIzaSy[A-Za-z0-9_-]{33})", "[REDACTED_KEY]", text)
    # Remove raw newline noise for structured single-line logging
    text = re.sub(r"[\r\n]+", " ", text).strip()
    return text


def classify_error(exc: Exception) -> Tuple[AiErrorCode, int, bool, str]:
    """
    Classifies an error from httpx, network calls, or internal service failures.
    Returns: (error_code, http_status, is_transient, sanitized_message)
    """
    if exc is None:
        return AiErrorCode.SUCCESS, 200, False, "Success"

    status_code: Optional[int] = None
    status_text: str = ""
    message_text: str = str(exc)

    # 1. Inspect error attributes
    if hasattr(exc, "code") and isinstance(getattr(exc, "code"), int):
        status_code = getattr(exc, "code")
    elif hasattr(exc, "status_code") and isinstance(getattr(exc, "status_code"), int):
        status_code = getattr(exc, "status_code")

    if hasattr(exc, "status") and getattr(exc, "status"):
        status_text = str(getattr(exc, "status"))
    if hasattr(exc, "message") and getattr(exc, "message"):
        message_text = str(getattr(exc, "message"))

    # 2. Extract embedded JSON in error message if present
    if "{" in message_text and "}" in message_text:
        try:
            match = re.search(r"\{[\s\S]*\}", message_text)
            if match:
                payload = json.loads(match.group(0))
                err_data = payload.get("error", payload)
                if isinstance(err_data, dict):
                    if isinstance(err_data.get("code"), int):
                        status_code = err_data["code"]
                    if err_data.get("status"):
                        status_text = str(err_data["status"])
                    if err_data.get("message"):
                        message_text = err_data["message"]
        except Exception:
            pass

    combined_lower = f"{message_text} {status_text}".lower()

    # 3. Timeout handling
    if (
        isinstance(exc, (asyncio.TimeoutError, TimeoutError))
        or "timeout" in combined_lower
        or "timed out" in combined_lower
        or status_code == 408
    ):
        return (
            AiErrorCode.TIMEOUT,
            408,
            True,
            sanitize_log_string(f"AI call timed out: {message_text}")
        )

    # 4. Network / Socket / Connection errors
    if (
        isinstance(exc, (ConnectionError, OSError))
        or "enotfound" in combined_lower
        or "econnrefused" in combined_lower
        or "connection reset" in combined_lower
        or "network" in combined_lower
        or "failed to connect" in combined_lower
        or "forcibly closed" in combined_lower
    ):
        return (
            AiErrorCode.NETWORK_ERROR,
            0,
            True,
            sanitize_log_string(f"Network error: {message_text}")
        )

    # 5. Rate Limited / 429
    if (
        status_code == 429
        or "resource_exhausted" in combined_lower
        or "rate limit" in combined_lower
        or "quota" in combined_lower
        or "too many requests" in combined_lower
    ):
        is_daily_exhausted = (
            "quota exceeded for metric" in combined_lower
            or "free_tier" in combined_lower
            or "daily quota" in combined_lower
            or "daily limit" in combined_lower
        )
        if is_daily_exhausted:
            return (
                AiErrorCode.QUOTA_EXHAUSTED,
                429,
                False,
                sanitize_log_string(f"Quota exhausted: {message_text}")
            )
        return (
            AiErrorCode.RATE_LIMITED,
            429,
            True,
            sanitize_log_string(f"Rate limited: {message_text}")
        )

    # 6. Temporary Unavailable / 503 / 502 / 504
    if (
        status_code in (502, 503, 504)
        or "unavailable" in combined_lower
        or "high demand" in combined_lower
        or "overloaded" in combined_lower
        or "try again later" in combined_lower
    ):
        return (
            AiErrorCode.TEMPORARILY_UNAVAILABLE,
            status_code or 503,
            True,
            sanitize_log_string(f"Service temporarily unavailable: {message_text}")
        )

    # 7. Internal Server Error / 500
    if (
        status_code == 500
        or (500 <= (status_code or 0) < 600)
        or "500" in combined_lower
        or "server error" in combined_lower
        or "internal error" in combined_lower
    ):
        return (
            AiErrorCode.SERVER_ERROR,
            status_code or 500,
            True,
            sanitize_log_string(f"Server error: {message_text}")
        )

    # 8. Authentication / 401
    if (
        status_code == 401
        or "unauthorized" in combined_lower
        or "api key not valid" in combined_lower
        or "invalid api key" in combined_lower
    ):
        return (
            AiErrorCode.AUTH_ERROR,
            401,
            False,
            "Authentication error."
        )

    # 9. Permission Denied / 403
    if (
        status_code == 403
        or "permission_denied" in combined_lower
        or "forbidden" in combined_lower
    ):
        return (
            AiErrorCode.PERMISSION_ERROR,
            403,
            False,
            "Permission denied."
        )

    # 10. Not Found / 404
    if (
        status_code == 404
        or "not_found" in combined_lower
        or "not supported" in combined_lower
        or "model not found" in combined_lower
    ):
        return (
            AiErrorCode.MODEL_NOT_FOUND,
            404,
            False,
            sanitize_log_string(f"Resource not found: {message_text}")
        )

    # 11. Bad Request / 400
    if (
        status_code == 400
        or "invalid_argument" in combined_lower
        or "bad request" in combined_lower
    ):
        return (
            AiErrorCode.BAD_REQUEST,
            400,
            False,
            sanitize_log_string(f"Invalid request format: {message_text}")
        )

    # 12. Fallthrough Unknown
    return (
        AiErrorCode.UNKNOWN_ERROR,
        status_code or 500,
        False,
        sanitize_log_string(message_text or "Unknown error")
    )


# Backward-compatibility alias
classify_gemini_error = classify_error


def calculate_backoff_delay(attempt: int) -> float:
    """
    Calculates exponential backoff with random jitter in seconds.
    Attempt 1: ~1000ms + (50-200ms) jitter = 1.05s - 1.20s
    Attempt 2: ~2000ms + (50-200ms) jitter = 2.05s - 2.20s
    Attempt 3: ~4000ms + (50-200ms) jitter = 4.05s - 4.20s
    """
    import random
    base_delays_ms = [1000, 2000, 4000]
    idx = max(0, min(attempt - 1, len(base_delays_ms) - 1))
    base_ms = base_delays_ms[idx]
    jitter_ms = random.randint(50, 200)
    return (base_ms + jitter_ms) / 1000.0


# ──────────────────────────────────────────────────────────────────────
# Deterministic Agricultural Reasoning Engine
# Replaces the former GeminiClient with fully local, zero-API reasoning.
# ──────────────────────────────────────────────────────────────────────

# Domain-specific templates for complex agricultural reasoning intents.
# These are used when the NLP pipeline classifies a query as needing
# advisory reasoning beyond simple tool routing.

_SELLING_STRATEGY_TEMPLATES = {
    "en": (
        "Selling Strategy for {commodity}: For {qty_str} of {commodity}, "
        "key factors to evaluate are: (1) Current local mandi arrivals and prevailing prices, "
        "(2) Cold storage availability and cost vs. spoilage risk if perishable, "
        "(3) Active buyer demand on FarmConnect for {commodity} in your region, "
        "(4) Transportation cost to the nearest APMC mandi. "
        "If the crop is highly perishable and you lack cold storage, selling immediately minimizes post-harvest losses. "
        "For durable crops, consider staggered selling over 3-5 days to capture price improvements."
    ),
    "ta": (
        "{commodity} விற்பனை வழிகாட்டுதல்: {qty_str} {commodity} உள்ளது. "
        "முக்கிய காரணிகள்: (1) உள்ளூர் மண்டி வரத்து மற்றும் நிலவும் விலைகள், "
        "(2) குளிர்பதன கிடங்கு வசதி vs. அழுகல் ஆபத்து, "
        "(3) FarmConnect-ல் உங்கள் பகுதியில் {commodity}-க்கான தேவை, "
        "(4) அருகிலுள்ள APMC மண்டிக்கு போக்குவரத்து செலவு. "
        "விரைவாக அழுகக்கூடிய பயிராக இருந்தால் உடனே விற்பனை செய்வது நல்லது."
    ),
    "hi": (
        "{commodity} बिक्री रणनीति: आपके पास {qty_str} {commodity} है। "
        "मुख्य कारक: (1) स्थानीय मंडी आवक और मौजूदा भाव, "
        "(2) कोल्ड स्टोरेज की उपलब्धता बनाम खराब होने का जोखिम, "
        "(3) FarmConnect पर आपके क्षेत्र में {commodity} की मांग, "
        "(4) निकटतम APMC मंडी तक परिवहन लागत। "
        "अगर फसल जल्दी खराब होने वाली है और कोल्ड स्टोरेज नहीं है, तो तुरंत बेचना सही रहेगा।"
    ),
}

_CROP_RECOMMENDATION_TEMPLATES = {
    "en": (
        "Crop Recommendation: The optimal crop depends on your soil type, irrigation availability, "
        "current season, and regional agro-climatic conditions. Key steps: "
        "(1) Test soil pH and nutrient levels at your nearest KVK, "
        "(2) Check regional crop calendars for planting windows, "
        "(3) Evaluate water availability for the crop cycle, "
        "(4) Consider market demand trends on FarmConnect for your region. "
        "Consult your local agricultural extension officer for variety-specific guidance."
    ),
    "ta": (
        "பயிர் பரிந்துரை: சரியான பயிர் உங்கள் மண் வகை, நீர்ப்பாசன வசதி, "
        "தற்போதைய பருவம், மற்றும் பிராந்திய வேளாண் காலநிலை நிலைமைகளைப் பொறுத்தது. "
        "உங்கள் அருகிலுள்ள KVK-ல் மண் பரிசோதனை செய்து, பிராந்திய பயிர் காலண்டரை சரிபார்க்கவும்."
    ),
    "hi": (
        "फसल सिफारिश: सही फसल आपकी मिट्टी के प्रकार, सिंचाई उपलब्धता, "
        "वर्तमान मौसम, और क्षेत्रीय कृषि-जलवायु स्थितियों पर निर्भर करती है। "
        "निकटतम KVK में मिट्टी परीक्षण कराएं और क्षेत्रीय फसल कैलेंडर देखें।"
    ),
}

_FARM_ADVISORY_TEMPLATES = {
    "en": (
        "Crop Advisory for {commodity}: For pest or disease management: "
        "(1) Inspect leaf undersides, stems, and roots for visible symptoms, "
        "(2) Take clear photographs for pathology identification, "
        "(3) Contact your nearest Krishi Vigyan Kendra (KVK) or agricultural extension officer, "
        "(4) Use only approved pesticides at recommended dosages — NEVER increase dosage without expert consultation. "
        "For nutrient deficiency (yellowing, stunted growth), test soil and apply balanced NPK fertilizer."
    ),
    "ta": (
        "{commodity} பயிர் ஆலோசனை: பூச்சி/நோய் மேலாண்மை: "
        "(1) இலைகளின் அடிப்பகுதி, தண்டு, வேர்களை ஆய்வு செய்யுங்கள், "
        "(2) நோய் கண்டறிதலுக்கு தெளிவான புகைப்படங்கள் எடுங்கள், "
        "(3) அருகிலுள்ள KVK அல்லது வேளாண் அலுவலரை தொடர்பு கொள்ளுங்கள்."
    ),
    "hi": (
        "{commodity} फसल सलाह: कीट/रोग प्रबंधन: "
        "(1) पत्तियों के नीचे, तने और जड़ों की जांच करें, "
        "(2) रोग पहचान के लिए स्पष्ट तस्वीरें लें, "
        "(3) निकटतम KVK या कृषि अधिकारी से संपर्क करें। "
        "केवल अनुमोदित कीटनाशकों का उपयोग करें।"
    ),
}


class LocalReasoningEngine:
    """
    Deterministic agricultural reasoning engine for FarmConnect.
    Produces structured advisory responses using NLP-extracted entities
    and domain-specific templates. ZERO external API calls.
    """

    def __init__(self):
        self._templates = {
            "SELLING_STRATEGY": _SELLING_STRATEGY_TEMPLATES,
            "CROP_RECOMMENDATION": _CROP_RECOMMENDATION_TEMPLATES,
            "FARM_ADVISORY": _FARM_ADVISORY_TEMPLATES,
        }

    async def generate_reasoning(
        self,
        intent: str,
        commodity: str = "produce",
        qty_str: str = "your harvest",
        language: str = "en",
        user_location: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> AiExecutionResult:
        """
        Generates a deterministic structured reasoning response.
        Returns an AiExecutionResult with the structured JSON answer.
        """
        start_time = time.time()
        lang_key = self._normalize_lang(language)

        templates = self._templates.get(intent)
        if not templates:
            # Unrecognized reasoning intent — return generic advisory
            answer = f"FarmConnect processed your request regarding {commodity}. Please consult your local agricultural officer for detailed guidance."
            return self._build_result(
                answer=answer, intent=intent, language=lang_key,
                reasoning_type="agricultural_advisory", start_time=start_time
            )

        template = templates.get(lang_key, templates.get("en", ""))
        answer = template.format(commodity=commodity, qty_str=qty_str)

        return self._build_result(
            answer=answer, intent=intent, language=lang_key,
            reasoning_type=intent.lower(), start_time=start_time
        )

    def _normalize_lang(self, lang: str) -> str:
        lang_lower = lang.lower()
        if lang_lower in ("ta", "tamil", "tanglish"):
            return "ta"
        if lang_lower in ("hi", "hindi", "hinglish"):
            return "hi"
        return "en"

    def _build_result(
        self,
        answer: str,
        intent: str,
        language: str,
        reasoning_type: str,
        start_time: float,
    ) -> AiExecutionResult:
        structured = {
            "answer": answer,
            "intent": intent,
            "language": language,
            "confidence": 0.85,
            "reasoning_type": reasoning_type,
            "requires_tool": False,
            "suggested_tool": None,
            "suggested_tool_args": {},
            "warnings": []
        }
        latency_ms = int((time.time() - start_time) * 1000)
        return AiExecutionResult(
            success=True,
            text=json.dumps(structured, ensure_ascii=False),
            function_calls=None,
            attempts=1,
            latency_ms=latency_ms,
            error_code=AiErrorCode.SUCCESS,
            error_message=None,
            is_transient=False
        )


# Global singleton instance — drop-in replacement for the former GeminiClient
reasoning_engine = LocalReasoningEngine()

# Backward-compatibility aliases
GeminiClient = LocalReasoningEngine
gemini_client = reasoning_engine
