import pytest
from app.ai.models import ReasoningRequest
from app.ai.reasoning import reason_about_query, should_use_complex_reasoning
from app.nlp.pipeline import process_nlp


def test_should_use_complex_reasoning_rules():
    # 1. Greetings: local chat, not complex strategy
    nlp_hello = process_nlp("Hello, good morning!")
    use_complex, reason = should_use_complex_reasoning(nlp_hello)
    assert not use_complex
    assert "greeting" in reason

    nlp_vanakkam = process_nlp("வணக்கம்")
    use_complex, reason = should_use_complex_reasoning(nlp_vanakkam)
    assert not use_complex

    nlp_namaste = process_nlp("नमस्ते")
    use_complex, reason = should_use_complex_reasoning(nlp_namaste)
    assert not use_complex

    # 2. Tool routes: direct tool execution
    nlp_order = process_nlp("Where is my order?")
    use_complex, reason = should_use_complex_reasoning(nlp_order)
    assert not use_complex

    nlp_buyer = process_nlp("Show buyers for potato")
    use_complex, reason = should_use_complex_reasoning(nlp_buyer)
    assert not use_complex

    nlp_price = process_nlp("What is the price of tomato?")
    use_complex, reason = should_use_complex_reasoning(nlp_price)
    assert not use_complex

    # 3. Complex reasoning
    nlp_strat = process_nlp("Should I sell my 2 tonnes tomatoes now or wait?")
    use_complex, reason = should_use_complex_reasoning(nlp_strat)
    assert use_complex
    assert "SELLING_STRATEGY" in reason

    nlp_crop = process_nlp("What crop should I plant this season?")
    use_complex, reason = should_use_complex_reasoning(nlp_crop)
    assert use_complex

    nlp_farm = process_nlp("My crop leaves have pest infestation and yellow spots")
    use_complex, reason = should_use_complex_reasoning(nlp_farm)
    assert use_complex


@pytest.mark.asyncio
async def test_greeting_endpoint_local_reasoning():
    req = ReasoningRequest(text="Hello FarmConnect!")
    resp = await reason_about_query(req)

    assert not resp.fallback_used
    assert resp.intent == "GENERAL_CHAT"
    assert "FarmConnect" in resp.answer


@pytest.mark.asyncio
async def test_order_tracking_local_reasoning():
    req = ReasoningRequest(text="Track my order #1002")
    resp = await reason_about_query(req)

    assert resp.requires_tool
    assert resp.suggested_tool in ("getMyOrders", "trackOrder")


@pytest.mark.asyncio
async def test_price_lookup_local_reasoning():
    req = ReasoningRequest(text="What is the price of carrot in Coimbatore?")
    resp = await reason_about_query(req)

    assert resp.requires_tool
    assert resp.suggested_tool == "getMarketPrices"
