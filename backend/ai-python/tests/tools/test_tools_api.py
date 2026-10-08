"""
Tests for internal tools API endpoints:
- GET /api/ai/tools (list 13 registered tools)
- POST /api/ai/tools/execute (authenticated execution)
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings

client = TestClient(app)
AUTH_HEADERS = {"X-Internal-Service-Key": settings.INTERNAL_API_SECRET}



def test_list_tools_unauthorized():
    resp = client.get("/api/ai/tools", headers={"X-Internal-Service-Key": "invalid_bad_key"})
    assert resp.status_code == 401



def test_list_tools_authorized():
    resp = client.get("/api/ai/tools", headers=AUTH_HEADERS)
    assert resp.status_code == 200
    tools = resp.json()
    assert isinstance(tools, list)
    assert len(tools) >= 20

    tool_names = {t["name"] for t in tools}
    assert "searchProducts" in tool_names
    assert "getWeatherAdvisory" in tool_names
    assert "getPriceIntelligence" in tool_names


def test_execute_tool_authorized_search_products():
    payload = {
        "tool_name": "searchProducts",
        "args": {"queryText": "Tomato", "category": "All"},
        "user": {"id": "farmer_test", "role": "farmer"}
    }
    resp = client.post("/api/ai/tools/execute", json=payload, headers=AUTH_HEADERS)
    assert resp.status_code == 200
    result = resp.json()
    assert result["success"] is True
    assert result["tool_name"] == "searchProducts"
    assert isinstance(result["data"], list)



def test_execute_tool_forbidden_role():
    payload = {
        "tool_name": "searchProducts",
        "args": {"queryText": "Tomato"},
        "user": {"id": "bad_actor", "role": "unauthorized_role"}
    }
    resp = client.post("/api/ai/tools/execute", json=payload, headers=AUTH_HEADERS)
    assert resp.status_code == 200
    result = resp.json()
    assert result["success"] is False
    assert result["error"]["code"] == "FORBIDDEN"


def test_execute_tool_not_found():
    payload = {
        "tool_name": "transferCrypto",
        "args": {},
        "user": {"id": "farmer_test", "role": "farmer"}
    }
    resp = client.post("/api/ai/tools/execute", json=payload, headers=AUTH_HEADERS)
    assert resp.status_code == 200
    result = resp.json()
    assert result["success"] is False
    assert result["error"]["code"] == "TOOL_NOT_FOUND"
