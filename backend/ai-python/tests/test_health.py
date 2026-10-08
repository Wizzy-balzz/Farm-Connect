def test_health_check_endpoint(client):
    """Verifies that /health endpoint is operational and returns service details."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "FarmConnect Python AI/NLP Service"
    assert data["version"] == "2.0.0"
    assert "status" in data
    assert "database" in data


def test_diagnostics_endpoint(client):
    """Verifies that /api/ai/diagnostics endpoint matches existing contract."""
    response = client.get("/api/ai/diagnostics")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "aiEngine" in data
    assert "nlpEngine" in data
    assert "database" in data
    raw_text = response.text
    assert "your_gemini_api_key" not in raw_text
    assert "password" not in raw_text.lower() or "password=" not in raw_text
