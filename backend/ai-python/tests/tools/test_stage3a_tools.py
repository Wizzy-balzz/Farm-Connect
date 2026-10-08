"""
FarmConnect — Phase 3B Stage 3A: Public & Regional Read-Only Tools Test Suite.
Tests all 8 migrated read-only tools:
1. getFarmerProfile
2. getFarmerProducts
3. compareProducts
4. getPriceInsights
5. getDemandInsights
6. getDemandIntelligence
7. getMarketplaceOverview
8. getNearbyBuyerOpportunities
"""

import pytest
from app.tools.dispatcher import dispatch_tool
from app.tools.registry import get_tool, get_gemini_tools_for_role


@pytest.mark.asyncio
async def test_get_farmer_profile_security_and_scrubbing():
    """Verify getFarmerProfile returns public safe info and never leaks credentials/secrets."""
    user = {"id": "v1", "role": "vendor", "district": "Nashik"}
    
    # 1. Valid farmer lookup
    res = await dispatch_tool(user, "getFarmerProfile", {"farmerId": "f1"})
    assert res.success is True
    data = res.data
    assert data is not None
    assert data["id"] == "f1"
    assert "name" in data
    assert "farmName" in data
    # Verify strict exclusion of sensitive fields
    assert "password" not in data
    assert "password_hash" not in data
    assert "passwordHash" not in data
    assert "email" not in data
    assert "phone" not in data
    assert "otp" not in data
    assert "token" not in data


@pytest.mark.asyncio
async def test_get_farmer_profile_non_existent():
    """Verify non-existent farmer returns null safely without error."""
    user = {"id": "v1", "role": "vendor", "district": "Nashik"}
    res = await dispatch_tool(user, "getFarmerProfile", {"farmerId": "f999999_nonexistent"})
    assert res.success is True
    assert res.data is None


@pytest.mark.asyncio
async def test_get_farmer_products():
    """Verify getFarmerProducts returns active product listings for the specified farmer."""
    user = {"id": "v1", "role": "vendor", "district": "Nashik"}
    res = await dispatch_tool(user, "getFarmerProducts", {"farmerId": "f1"})
    assert res.success is True
    assert isinstance(res.data, list)
    for p in res.data:
        assert p["farmerId"] == "f1"
        assert "price" in p
        assert "name" in p


@pytest.mark.asyncio
async def test_compare_products_parameterized():
    """Verify compareProducts correctly compares multiple products without SQL injection."""
    user = {"id": "f1", "role": "farmer", "district": "Madurai"}
    
    # Valid product IDs
    res = await dispatch_tool(user, "compareProducts", {"productIds": ["p1", "p2"]})
    assert res.success is True
    assert isinstance(res.data, list)
    
    # SQL injection attempt inside productIds
    injection_res = await dispatch_tool(user, "compareProducts", {"productIds": ["p1' OR '1'='1", "p2"]})
    assert injection_res.success is True
    # Should safely return only matched product records, not all records
    assert len(injection_res.data) <= 2


@pytest.mark.asyncio
async def test_get_price_insights():
    """Verify getPriceInsights returns category price range and statistics."""
    user = {"id": "f1", "role": "farmer", "district": "Madurai"}
    res = await dispatch_tool(user, "getPriceInsights", {"productId": "p1"})
    assert res.success is True
    assert res.data is not None
    assert "recommendedRange" in res.data
    assert "platformAverage" in res.data
    assert "basis" in res.data


@pytest.mark.asyncio
async def test_get_demand_insights_zero_fabrication():
    """Verify getDemandInsights respects order count thresholds without inventing forecast numbers."""
    user = {"id": "f1", "role": "farmer", "district": "Madurai"}
    res = await dispatch_tool(user, "getDemandInsights", {"category": "Vegetables"})
    assert res.success is True
    assert "sufficientData" in res.data
    if not res.data["sufficientData"]:
        assert "at least 2 completed orders" in res.data["message"].lower()


@pytest.mark.asyncio
async def test_get_demand_intelligence_metrics_and_trends():
    """Verify getDemandIntelligence provides structured metrics or explicit insufficient-data response."""
    user = {"id": "f1", "role": "farmer", "district": "Madurai"}
    res = await dispatch_tool(user, "getDemandIntelligence", {"category": "Vegetables", "commodity": "Tomato", "days": 30})
    assert res.success is True
    assert "hasSufficientData" in res.data
    if res.data["hasSufficientData"]:
        assert "metrics" in res.data
        assert "trend" in res.data
        assert "topDemandedProduce" in res.data
        assert "basis" in res.data


@pytest.mark.asyncio
async def test_get_marketplace_overview_location_filtering():
    """Verify getMarketplaceOverview returns regional listings and distinct categories."""
    user = {"id": "f1", "role": "farmer", "district": "Nashik", "region": "Maharashtra"}
    
    # 1. Explicit district
    res = await dispatch_tool(user, "getMarketplaceOverview", {"district": "Nashik"})
    assert res.success is True
    assert res.data["success"] is True
    assert "totalListings" in res.data
    assert "categories" in res.data
    assert "recentListings" in res.data
    
    # 2. Location fallback from session user context
    fallback_res = await dispatch_tool(user, "getMarketplaceOverview", {})
    assert fallback_res.success is True
    assert fallback_res.data["location"]["district"] == "Nashik"


@pytest.mark.asyncio
async def test_get_nearby_buyer_opportunities_privacy_and_unfulfilled():
    """
    Verify getNearbyBuyerOpportunities:
    - Filters unfulfilled buyer orders ('Pending', 'Processing')
    - Strips private customer info (no phone, no addresses, no payment tokens)
    - Zero fabrication: returns 0 opportunities if none exist.
    """
    user = {"id": "f1", "role": "farmer", "district": "Nashik", "region": "Maharashtra"}
    res = await dispatch_tool(user, "getNearbyBuyerOpportunities", {"district": "Nashik"})
    assert res.success is True
    assert res.data["success"] is True
    assert "buyerDemandCount" in res.data
    assert "buyerOpportunities" in res.data
    
    for opp in res.data["buyerOpportunities"]:
        # Verify unfulfilled statuses only
        assert opp["status"] in ("Pending", "Processing")
        # Verify strict absence of PII
        assert "phone" not in opp
        assert "customerPhone" not in opp
        assert "address" not in opp
        assert "deliveryAddress" not in opp
        assert "cardNumber" not in opp
        assert "cvv" not in opp
        assert "paymentToken" not in opp
        # Verify public wholesale demand fields
        assert "orderId" in opp
        assert "productName" in opp
        assert "qty" in opp
        assert "unitPrice" in opp


@pytest.mark.asyncio
async def test_role_based_access_control():
    """Verify role permissions for all 8 Stage 3A tools across farmer, vendor, admin, and unauth."""
    tools = [
        "getFarmerProfile",
        "getFarmerProducts",
        "compareProducts",
        "getPriceInsights",
        "getDemandInsights",
        "getDemandIntelligence",
        "getMarketplaceOverview",
        "getNearbyBuyerOpportunities"
    ]
    
    farmer_user = {"id": "f1", "role": "farmer"}
    vendor_user = {"id": "v1", "role": "vendor"}
    admin_user = {"id": "a1", "role": "admin"}
    invalid_user = {"id": "u1", "role": "guest"}
    
    for t_name in tools:
        # Farmer allowed
        t_def = get_tool(t_name)
        assert t_def is not None
        assert "farmer" in t_def.required_roles
        assert "vendor" in t_def.required_roles
        assert "admin" in t_def.required_roles
        
        # Unauthorized role rejected
        unauth_res = await dispatch_tool(invalid_user, t_name, {"farmerId": "f1", "productIds": ["p1"]})
        assert unauth_res.success is False
        assert unauth_res.error["code"] == "FORBIDDEN"


@pytest.mark.asyncio
async def test_gemini_tool_declarations_for_stage3a():
    """Verify Gemini tool declarations contain the 8 Stage 3A tools for farmer and vendor."""
    farmer_tools = get_gemini_tools_for_role("farmer")
    assert len(farmer_tools) > 0
    fn_names = [tool["name"] for tool in farmer_tools if isinstance(tool, dict) and "name" in tool]
    
    for expected in [
        "getFarmerProfile",
        "getFarmerProducts",
        "compareProducts",
        "getPriceInsights",
        "getDemandInsights",
        "getDemandIntelligence",
        "getMarketplaceOverview",
        "getNearbyBuyerOpportunities"
    ]:
        assert expected in fn_names
