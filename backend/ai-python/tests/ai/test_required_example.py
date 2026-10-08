import pytest
from app.ai.models import ReasoningRequest
from app.ai.reasoning import reason_about_query
from app.nlp.pipeline import process_nlp


def test_required_example_deterministic_nlp_flow():
    """Verifies that the required example produces exact NLP extracted entities and intent."""
    query = "I have 2 tonnes of tomatoes ready to sell. Should I sell now or wait?"
    nlp_res = process_nlp(query)

    assert nlp_res.intent.intent == "SELLING_STRATEGY"
    assert nlp_res.entities.commodity == "Tomato"
    assert nlp_res.entities.quantity == 2.0
    assert nlp_res.entities.unit == "tonne"


@pytest.mark.asyncio
async def test_required_example_local_reasoning():
    """
    Verifies that the local reasoning engine produces a structured agricultural response.
    """
    req = ReasoningRequest(text="I have 2 tonnes of tomatoes ready to sell. Should I sell now or wait?")
    resp = await reason_about_query(req)

    # Verified entities preserved
    assert resp.intent == "SELLING_STRATEGY"
    assert resp.entities["commodity"] == "Tomato"
    assert resp.entities["quantity"] == 2.0
    assert resp.entities["unit"] == "tonne"

    # Validated reasoning answer
    assert "tomato" in resp.answer.lower() or "sell" in resp.answer.lower()


@pytest.mark.asyncio
async def test_tanglish_example_local_reasoning():
    """
    Tests: 'En kitta 500 kg thakkali irukku. Ippo sell pannalama wait pannalama?'
    Expected: Tanglish NLP -> Tomato, 500 kg, SELLING_STRATEGY -> Tanglish reasoning output.
    """
    req = ReasoningRequest(text="En kitta 500 kg thakkali irukku. Ippo sell pannalama wait pannalama?")
    resp = await reason_about_query(req)

    assert resp.intent == "SELLING_STRATEGY"
    assert resp.language in ("tanglish", "ta")
    assert resp.entities["commodity"] == "Tomato"
    assert resp.entities["quantity"] == 500.0
    assert resp.entities["unit"] == "kg"
