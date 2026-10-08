import pytest
from app.nlp.pipeline import process_nlp
from app.core.config import settings


def test_pipeline_gemini_independence():
    """Verifies that the entire pipeline functions with zero Gemini connection or API key."""
    old_key = settings.GEMINI_API_KEY
    settings.GEMINI_API_KEY = ""
    try:
        res = process_nlp("I have 500 kg onions for sale near Madurai.")
        assert res.processing["gemini_used"] is False
        assert res.processing["deterministic"] is True
        assert res.entities.commodity == "Onion"
        assert res.entities.quantity == 500.0
        assert res.entities.unit == "kg"
        assert res.entities.location == "Madurai"
    finally:
        settings.GEMINI_API_KEY = old_key


def test_pipeline_context_resolution():
    """
    Verifies that context is resolved across turns:
    Turn 1: 'I am growing tomatoes in Tirunelveli.'
    Turn 2: 'What should I do if demand falls?'
    Carries forward: crop = Tomato, location = Tirunelveli
    """
    context = {
        "previous_messages": [
            {"role": "user", "content": "I am growing tomatoes in Tirunelveli."}
        ],
        "known_entities": {
            "commodity": "Tomato",
            "location": "Tirunelveli"
        }
    }

    turn2_res = process_nlp("What should I do if demand falls?", context=context)

    assert turn2_res.entities.commodity == "Tomato"
    assert turn2_res.entities.location == "Tirunelveli"
    assert turn2_res.context_metadata["resolved_from_context"]["commodity"] is True
    assert turn2_res.context_metadata["resolved_from_context"]["location"] is True


def test_internal_nlp_analyze_endpoint(client, internal_headers):
    """Verifies that the internal /api/ai/nlp/analyze endpoint operates as expected."""
    response = client.post(
        "/api/ai/nlp/analyze",
        json={"text": "I want to buy 500 kg onions."},
        headers=internal_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["intent"]["intent"] == "BUYING_REQUEST"
    assert data["entities"]["commodity"] == "Onion"
    assert data["entities"]["quantity"] == 500.0
    assert data["entities"]["unit"] == "kg"
    assert data["processing"]["gemini_used"] is False
