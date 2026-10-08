def test_chat_contract_compatibility(client, internal_headers):
    """Verifies that the /api/ai/chat endpoint response preserves Node.js response fields."""
    response = client.post(
        "/api/ai/chat",
        json={"prompt": "What is the tomato price?", "lang": "en"},
        headers=internal_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "conversationId" in data
    assert "message" in data
    msg = data["message"]
    assert "id" in msg
    assert "role" in msg
    assert "content" in msg
    assert "createdAt" in msg


def test_selling_strategy_contract(client, internal_headers):
    """Verifies that the selling strategy endpoint preserves response shape."""
    response = client.post(
        "/api/ai/marketplace/selling-strategy",
        json={"commodity": "Tomato", "quantity": 100},
        headers=internal_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "strategy" in data
    assert data["strategy"]["recommendation"] in ["SELL_NOW", "WAIT", "PARTIAL_SELL"]
    assert "estimatedGrossRevenue" in data["strategy"]
