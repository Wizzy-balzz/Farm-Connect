import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch

from app.main import app
from app.core.config import settings
from app.ai.models import GeminiErrorCode, GeminiExecutionResult


@pytest.fixture
def client():
    return TestClient(app)


def test_reason_endpoint_unauthorized_without_secret(client):
    settings.INTERNAL_API_SECRET = "production_secret_key_required"
    try:
        response = client.post("/api/ai/reason", json={"text": "Hello"})
        assert response.status_code in (401, 403)
    finally:
        settings.INTERNAL_API_SECRET = "farmconnect_internal_ai_secret_dev_key"


def test_reason_endpoint_authorized_deterministic_greeting(client):
    headers = {settings.INTERNAL_AUTH_HEADER_NAME: settings.INTERNAL_API_SECRET}
    response = client.post("/api/ai/reason", json={"text": "Hello FarmConnect!"}, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["intent"] == "GENERAL_CHAT"
    assert not data["gemini_used"]
    assert not data["fallback_used"]
    assert "FarmConnect" in data["answer"]


def test_reason_endpoint_authorized_complex_reasoning(client):
    headers = {settings.INTERNAL_AUTH_HEADER_NAME: settings.INTERNAL_API_SECRET}
    response = client.post(
        "/api/ai/reason",
        json={"text": "I have 2 tonnes of tomatoes ready to sell. Should I sell now or wait?"},
        headers=headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["intent"] == "SELLING_STRATEGY"
    assert data["entities"]["commodity"] == "Tomato"
    assert data["entities"]["quantity"] == 2.0
    assert "tomato" in data["answer"].lower() or "sell" in data["answer"].lower()
