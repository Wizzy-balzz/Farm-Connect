from app.ai.fallback import build_fallback_response
from app.nlp.pipeline import process_nlp


def test_fallback_selling_strategy_english():
    nlp_res = process_nlp("I have 2 tonnes of tomatoes ready to sell. Should I sell now or wait?")
    fb = build_fallback_response(nlp_res, reason_label="RATE_LIMITED")
    assert fb.fallback_used
    assert not fb.gemini_used
    assert fb.intent == "SELLING_STRATEGY"
    assert "Tomato" in fb.answer
    assert "perishable" in fb.answer.lower()
    assert fb.entities["commodity"] == "Tomato"
    assert fb.entities["quantity"] == 2.0
    assert fb.entities["unit"] == "tonne"


def test_fallback_selling_strategy_tamil():
    nlp_res = process_nlp("என்னிடம் 500 கிலோ தக்காளி உள்ளது. இப்போது விற்கலாமா காத்திருக்கலாமா?")
    fb = build_fallback_response(nlp_res, reason_label="TEMPORARILY_UNAVAILABLE")
    assert fb.fallback_used
    assert fb.intent == "SELLING_STRATEGY"
    assert "விற்பனை" in fb.answer
    assert fb.entities["commodity"] == "Tomato"
    assert fb.entities["quantity"] == 500.0


def test_fallback_selling_strategy_tanglish():
    nlp_res = process_nlp("En kitta 500 kg thakkali irukku. Ippo sell pannalama wait pannalama?")
    fb = build_fallback_response(nlp_res, reason_label="TIMEOUT")
    assert fb.fallback_used
    assert fb.intent == "SELLING_STRATEGY"
    assert "Tomato" in fb.answer
    assert "perishable" in fb.answer.lower()
    assert fb.entities["commodity"] == "Tomato"
    assert fb.entities["quantity"] == 500.0


def test_fallback_selling_strategy_hindi():
    nlp_res = process_nlp("मेरे पास 200 किलो टमाटर है। अभी बेचें या इंतज़ार करें?")
    fb = build_fallback_response(nlp_res, reason_label="NETWORK_ERROR")
    assert fb.fallback_used
    assert fb.intent == "SELLING_STRATEGY"
    assert "बिक्री रणनीति" in fb.answer
    assert fb.entities["commodity"] == "Tomato"


def test_fallback_price_intelligence():
    nlp_res = process_nlp("What is the price of onion today?")
    fb = build_fallback_response(nlp_res, reason_label="RATE_LIMITED")
    assert fb.fallback_used
    assert fb.intent == "PRICE_INTELLIGENCE"
    assert fb.requires_tool
    assert fb.suggested_tool == "getMarketPrices"


def test_fallback_farm_advisory():
    nlp_res = process_nlp("My tomato leaves have yellow curl disease, what fertilizer to spray?")
    fb = build_fallback_response(nlp_res, reason_label="RATE_LIMITED")
    assert fb.fallback_used
    assert fb.intent == "FARM_ADVISORY"
    assert "kvk" in fb.answer.lower() or "krishi vigyan kendra" in fb.answer.lower()
