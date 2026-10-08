import logging
from typing import Any, Dict, Optional

from app.nlp.models import NlpPipelineResult
from app.ai.models import ReasoningResponse, ReasoningType

logger = logging.getLogger("farmconnect.ai.fallback")


def build_fallback_response(
    nlp_result: NlpPipelineResult,
    reason_label: str = "service_unavailable",
    error_details: Optional[str] = None
) -> ReasoningResponse:
    """
    Constructs a deterministic, safe, domain-accurate agricultural response
    using extracted NLP entities and intent rules when Gemini is unavailable,
    rate-limited (429), or offline.
    """
    intent = nlp_result.intent.intent
    lang = nlp_result.language.language.lower()
    entities = nlp_result.entities
    commodity = entities.commodity or "produce"
    qty_str = f"{entities.quantity:g} {entities.unit}" if entities.quantity and entities.unit else "your harvest"

    warnings = [f"Deterministic fallback triggered: {reason_label}"]
    if error_details:
        warnings.append(f"Reason: {error_details}")

    # 1. SELLING_STRATEGY fallback
    if intent == "SELLING_STRATEGY":
        if lang in ("ta", "tamil"):
            answer = (
                f"{commodity} விற்பனை வழிகாட்டுதல்: உங்களிடம் உள்ள {qty_str} {commodity} விரைவாக அழுகக்கூடிய பயிராக இருந்தால், "
                "முறையான குளிர்பதன கிடங்கு வசதி இல்லாதபட்சத்தில் உடனடியாக உள்ளூர் சந்தையில் விற்பனை செய்வது அழுகல் இழப்பை தவிர்க்கும். "
                "உள்ளூர் மண்டி வரத்து மற்றும் போக்குவரத்து செலவுகளை சரிபார்த்து முடிவெடுங்கள்."
            )
        elif lang in ("hi", "hindi"):
            answer = (
                f"{commodity} बिक्री रणनीति: आपके पास {qty_str} {commodity} है। यदि कोल्ड स्टोरेज की सुविधा नहीं है, "
                "तो पके हुए माल को तुरंत स्थानीय मंडी में बेचना नुकसान से बचाएगा। स्थानीय आवक और मांग को देखकर ही निर्णय लें।"
            )
        elif lang == "tanglish":
            answer = (
                f"{commodity} selling strategy: Ungitta {qty_str} {commodity} irukku. Idhu perishable crop என்பதால், "
                "cold storage illana ippove local mandila sell panradhu safe, spoilage risk kuraikkum. Mandi arrivals check pannikonga."
            )
        elif lang == "hinglish":
            answer = (
                f"{commodity} selling strategy: Aapke paas {qty_str} {commodity} hai. Ye perishable crop hai, agar cold storage "
                "nahi hai toh abhi mandi me sell karna safe option hai taaki spoilage na ho. Mandi rates aur demand check karein."
            )
        else:
            answer = (
                f"Selling Strategy for {commodity}: For {qty_str} of {commodity}, note that fresh produce is perishable. "
                "Unless you have temperature-controlled cold storage, selling ready stock now minimizes spoilage loss. "
                "If local mandi supply is low and prices are rising, consider staggered selling over 2-3 days."
            )

        return ReasoningResponse(
            answer=answer,
            intent="SELLING_STRATEGY",
            language=lang,
            confidence=0.80,
            reasoning_type=ReasoningType.DETERMINISTIC_FALLBACK.value,
            requires_tool=False,
            suggested_tool="getMarketPrices",
            suggested_tool_args={"commodity": commodity},
            warnings=warnings,
            fallback_used=True,
            gemini_used=False,
            entities=entities.model_dump(exclude_none=True),
            processing_metadata={"fallback_trigger": reason_label}
        )

    # 2. PRICE_INTELLIGENCE fallback
    elif intent == "PRICE_INTELLIGENCE":
        if lang in ("ta", "tamil", "tanglish"):
            answer = f"{commodity} விலை நிலவரம் அறிய FarmConnect நேரடி மண்டி விலைப்பட்டியலை சரிபார்க்கவும்."
        elif lang in ("hi", "hindi", "hinglish"):
            answer = f"{commodity} के ताजा मंडी भाव देखने के लिए FarmConnect मंडी दर सूची देखें।"
        else:
            answer = f"To check real-time market prices for {commodity}, please access the verified FarmConnect Mandi Price intelligence."

        return ReasoningResponse(
            answer=answer,
            intent="PRICE_INTELLIGENCE",
            language=lang,
            confidence=0.85,
            reasoning_type=ReasoningType.DETERMINISTIC_FALLBACK.value,
            requires_tool=True,
            suggested_tool="getMarketPrices",
            suggested_tool_args={"commodity": commodity, "location": entities.location},
            warnings=warnings,
            fallback_used=True,
            gemini_used=False,
            entities=entities.model_dump(exclude_none=True),
            processing_metadata={"fallback_trigger": reason_label}
        )

    # 3. FARM_ADVISORY fallback
    elif intent == "FARM_ADVISORY":
        if lang in ("ta", "tamil", "tanglish"):
            answer = (
                f"{commodity} பயிர் பாதுகாப்பு: பூச்சி அல்லது நோய் தாக்குதலை கட்டுப்படுத்த உடனடியாக அருகிலுள்ள வேளாண் அறிவியல் மையம் (KVK) "
                "அல்லது வேளாண்மை அலுவலரை அணுகி சரியான பூச்சிக்கொல்லி/உர அளவை அறிந்து கொள்ளவும்."
            )
        elif lang in ("hi", "hindi", "hinglish"):
            answer = (
                f"{commodity} फसल सलाह: कीट या रोग नियंत्रण के लिए उचित कीटनाशक और खाद की मात्रा हेतु नजदीकी कृषि विज्ञान केंद्र (KVK) "
                "या कृषि अधिकारी से संपर्क करें।"
            )
        else:
            answer = (
                f"Crop Advisory for {commodity}: For pest or nutrient deficiencies, inspect leaf undersides for signs of infection. "
                "Consult your nearest Krishi Vigyan Kendra (KVK) or agricultural extension officer for approved regional dosage."
            )

        return ReasoningResponse(
            answer=answer,
            intent="FARM_ADVISORY",
            language=lang,
            confidence=0.75,
            reasoning_type=ReasoningType.DETERMINISTIC_FALLBACK.value,
            requires_tool=False,
            suggested_tool=None,
            warnings=warnings,
            fallback_used=True,
            gemini_used=False,
            entities=entities.model_dump(exclude_none=True),
            processing_metadata={"fallback_trigger": reason_label}
        )

    # 4. CROP_RECOMMENDATION fallback
    elif intent == "CROP_RECOMMENDATION":
        answer = (
            f"Recommended crops depend on local soil type, irrigation availability, and current season. "
            "For optimal yield, test soil pH and refer to the regional agro-climatic advisory."
        )
        return ReasoningResponse(
            answer=answer,
            intent="CROP_RECOMMENDATION",
            language=lang,
            confidence=0.75,
            reasoning_type=ReasoningType.DETERMINISTIC_FALLBACK.value,
            requires_tool=False,
            suggested_tool=None,
            warnings=warnings,
            fallback_used=True,
            gemini_used=False,
            entities=entities.model_dump(exclude_none=True),
            processing_metadata={"fallback_trigger": reason_label}
        )

    # 5. ORDER_TRACKING fallback
    elif intent == "ORDER_TRACKING":
        return ReasoningResponse(
            answer="Please check the Orders section or provide your Order ID to track the real-time shipment status.",
            intent="ORDER_TRACKING",
            language=lang,
            confidence=0.90,
            reasoning_type=ReasoningType.TOOL_ROUTING.value,
            requires_tool=True,
            suggested_tool="getMyOrders",
            warnings=warnings,
            fallback_used=True,
            gemini_used=False,
            entities=entities.model_dump(exclude_none=True),
            processing_metadata={"fallback_trigger": reason_label}
        )

    # 6. BUYER_SEARCH fallback
    elif intent == "BUYER_SEARCH":
        return ReasoningResponse(
            answer=f"Searching verified buyers and traders looking for {commodity} in your region.",
            intent="BUYER_SEARCH",
            language=lang,
            confidence=0.90,
            reasoning_type=ReasoningType.TOOL_ROUTING.value,
            requires_tool=True,
            suggested_tool="getBuyers",
            suggested_tool_args={"commodity": commodity, "location": entities.location},
            warnings=warnings,
            fallback_used=True,
            gemini_used=False,
            entities=entities.model_dump(exclude_none=True),
            processing_metadata={"fallback_trigger": reason_label}
        )

    # 7. GENERAL_CHAT fallback
    elif intent == "GENERAL_CHAT":
        if lang in ("ta", "tamil", "tanglish"):
            greet = "வணக்கம்! FarmConnect விவசாய உதவி மையத்திற்கு வரவேற்கிறோம். நான் உங்களுக்கு எவ்வாறு உதவ முடியும்?"
        elif lang in ("hi", "hindi", "hinglish"):
            greet = "नमस्ते! FarmConnect कृषि सहायक में आपका स्वागत है। मैं आपकी क्या मदद कर सकता हूँ?"
        else:
            greet = "Hello! Welcome to FarmConnect AI assistant. How can I help you with your crops, market rates, or selling today?"

        return ReasoningResponse(
            answer=greet,
            intent="GENERAL_CHAT",
            language=lang,
            confidence=0.95,
            reasoning_type=ReasoningType.GENERAL_CONVERSATION.value,
            requires_tool=False,
            warnings=warnings,
            fallback_used=True,
            gemini_used=False,
            entities=entities.model_dump(exclude_none=True),
            processing_metadata={"fallback_trigger": reason_label}
        )

    # 8. Generic Catch-All
    return ReasoningResponse(
        answer=f"FarmConnect is processing your request for {commodity}. Please verify details with your local agricultural officer.",
        intent=intent,
        language=lang,
        confidence=0.60,
        reasoning_type=ReasoningType.DETERMINISTIC_FALLBACK.value,
        requires_tool=False,
        warnings=warnings,
        fallback_used=True,
        gemini_used=False,
        entities=entities.model_dump(exclude_none=True),
        processing_metadata={"fallback_trigger": reason_label}
    )
