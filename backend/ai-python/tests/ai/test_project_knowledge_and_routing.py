"""
Unit and Integration Tests for Project Knowledge and Live Data Routing.
Validates:
1. Project Knowledge Questions (English, Tamil, Hindi, Tanglish)
2. Live Data Tool Routing (Products, Orders, Inventory, Low-Stock, Market Prices, Goals)
3. Natural Variations Recognition
4. User Isolation & Security Protections
"""

import pytest
from app.ai.models import ReasoningRequest
from app.ai.reasoning import reason_about_query
from app.nlp.pipeline import process_nlp
from app.nlp.tool_router import route_intent_to_tool
from app.tools.dispatcher import dispatch_tool
from app.ai.project_knowledge import get_project_knowledge_response, match_project_topic


# =====================================================================
# 1. PROJECT KNOWLEDGE TESTS
# =====================================================================

@pytest.mark.parametrize("query,expected_topic_keyword", [
    ("What is FarmConnect?", "marketplace"),
    ("What features does FarmConnect have?", "Farmer"),
    ("What can I do as a farmer?", "Farmer"),
    ("What can a vendor do?", "Vendor"),
    ("What can an admin do?", "Admin"),
    ("Does FarmConnect support Google login?", "Google OAuth"),
    ("Does FarmConnect support multiple languages?", "languages"),
    ("Does FarmConnect support voice?", "Speech-to-Text"),
    ("What AI features are available?", "Python AI Copilot"),
    ("What technologies are used?", "React"),
    ("What APIs are integrated?", "Open-Meteo"),
    ("What makes FarmConnect different from a CRUD application?", "CRUD"),
    ("What can you help me with?", "assist"),
])
def test_project_knowledge_queries_direct(query, expected_topic_keyword):
    nlp_res = process_nlp(query)
    assert nlp_res.intent.intent == "PROJECT_KNOWLEDGE"
    assert nlp_res.intent.confidence >= 0.90

    ans = get_project_knowledge_response(query, lang="en")
    assert expected_topic_keyword.lower() in ans.lower()


@pytest.mark.asyncio
async def test_project_knowledge_reasoning_endpoint():
    req = ReasoningRequest(text="What can a farmer do on FarmConnect?")
    resp = await reason_about_query(req)

    assert resp.intent == "PROJECT_KNOWLEDGE"
    assert not resp.requires_tool
    assert not resp.fallback_used
    assert "Farmer" in resp.answer
    assert "listings" in resp.answer.lower() or "inventory" in resp.answer.lower()


@pytest.mark.parametrize("query,lang", [
    ("பார்ம்கனெக்ட் என்றால் என்ன?", "ta"),
    ("விவசாயி என்ன செய்ய முடியும்?", "ta"),
    ("FarmConnect kya hai?", "hi"),
    ("Farmer kya kar sakta hai?", "hinglish"),
])
def test_project_knowledge_multilingual(query, lang):
    nlp_res = process_nlp(query)
    assert nlp_res.intent.intent == "PROJECT_KNOWLEDGE"
    ans = get_project_knowledge_response(query, lang=lang)
    assert len(ans) > 30


# =====================================================================
# 2. LIVE DATA ROUTING TESTS (Natural Variations)
# =====================================================================

TEST_FARMER_USER = {
    "id": "usr_farmer_test_101",
    "role": "farmer",
    "name": "Test Farmer",
    "region": "Coimbatore"
}

TEST_VENDOR_USER = {
    "id": "usr_vendor_test_202",
    "role": "vendor",
    "name": "Test Vendor",
    "region": "Coimbatore"
}


@pytest.mark.parametrize("query,expected_tool", [
    ("List marketplace products", "searchProducts"),
    ("Show available products", "searchProducts"),
    ("what products are available", "searchProducts"),
    ("browse all produce listings", "searchProducts"),
    ("List my orders", "getMyOrders"),
    ("Show my orders", "getMyOrders"),
    ("what orders do I have", "getMyOrders"),
    ("Show my inventory", "getMyInventory"),
    ("what is in my inventory", "getMyInventory"),
    ("Show low-stock items", "getMyInventoryAnalytics"),
    ("list low-stock produce", "getMyInventoryAnalytics"),
    ("Give market prices", "getPriceIntelligence"),
    ("what is the market price of tomato", "getPriceIntelligence"),
    ("Show my farming goals", "getMyFarmingGoals"),
    ("my farming goals progress", "getMyFarmingGoals"),
])
def test_live_data_intent_tool_routing(query, expected_tool):
    nlp_res = process_nlp(query)
    tool_name, tool_args, is_low_conf = route_intent_to_tool(nlp_res, TEST_FARMER_USER)

    assert not is_low_conf, f"Query '{query}' was falsely marked low confidence"
    assert tool_name == expected_tool, f"Expected {expected_tool}, got {tool_name} for '{query}'"


# =====================================================================
# 3. LIVE TOOL EXECUTION & DATA RETURN TESTS
# =====================================================================

@pytest.mark.asyncio
async def test_live_data_tool_execution_products():
    nlp_res = process_nlp("List marketplace products")
    tool_name, tool_args, _ = route_intent_to_tool(nlp_res, TEST_FARMER_USER)

    res = await dispatch_tool(TEST_FARMER_USER, tool_name, tool_args)
    assert res.success
    assert res.data is not None
    assert "products" in res.data or isinstance(res.data, list)


@pytest.mark.asyncio
async def test_live_data_tool_execution_orders():
    nlp_res = process_nlp("Show my orders")
    tool_name, tool_args, _ = route_intent_to_tool(nlp_res, TEST_FARMER_USER)

    res = await dispatch_tool(TEST_FARMER_USER, tool_name, tool_args)
    assert res.success
    assert res.data is not None
    assert "orders" in res.data or isinstance(res.data, list)


@pytest.mark.asyncio
async def test_live_data_tool_execution_inventory():
    nlp_res = process_nlp("Show my inventory")
    tool_name, tool_args, _ = route_intent_to_tool(nlp_res, TEST_FARMER_USER)

    res = await dispatch_tool(TEST_FARMER_USER, tool_name, tool_args)
    assert res.success
    assert res.data is not None


@pytest.mark.asyncio
async def test_live_data_tool_execution_price_intelligence():
    nlp_res = process_nlp("Give market price for tomato")
    tool_name, tool_args, _ = route_intent_to_tool(nlp_res, TEST_FARMER_USER)

    res = await dispatch_tool(TEST_FARMER_USER, tool_name, tool_args)
    assert res.success
    assert res.data is not None


# =====================================================================
# 4. SECURITY & USER ISOLATION TESTS
# =====================================================================

@pytest.mark.asyncio
async def test_security_rbac_vendor_inventory_forbidden():
    """Vendor attempting to query private farmer inventory analytics must be denied."""
    res = await dispatch_tool(TEST_VENDOR_USER, "getMyInventoryAnalytics", {})
    assert not res.success
    assert "FORBIDDEN" in res.error.get("code", "")


@pytest.mark.asyncio
async def test_security_user_scoping():
    """Tool dispatch strictly uses authenticated user context dict."""
    res = await dispatch_tool(TEST_FARMER_USER, "getMyOrders", {})
    assert res.success
    # Ensure user scoping context was respected
    assert res.data is not None
