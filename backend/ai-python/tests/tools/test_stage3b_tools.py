"""
FarmConnect — Phase 3B Stage 3B: Farmer Selling Strategy + Advanced Analytics Test Suite.
Tests all 8 approved migrated read-only tools:
1. getSellingRecommendation
2. getMySellingOpportunities
3. compareSellingOptions
4. getSellingPlan
5. compareAnalyticsPeriods
6. generateAnalyticsReport
7. getMarketplaceAnalytics
8. getPlatformAnalytics / getPlatformAnalyticsReport
"""

import pytest
from app.tools.dispatcher import dispatch_tool
from app.tools.registry import get_tool, get_gemini_tools_for_role


@pytest.mark.asyncio
async def test_get_selling_recommendation_farmer():
    """Verify getSellingRecommendation executes with deterministic facts and strategy."""
    user = {"id": "f1", "role": "farmer", "district": "Madurai"}
    res = await dispatch_tool(user, "getSellingRecommendation", {
        "crop": "Tomato",
        "quantity": 100,
        "urgency": "NORMAL",
    })
    assert res.success is True
    data = res.data
    assert "commodity" in data or "crop" in data
    assert "recommendation" in data
    assert data["recommendation"] in ("SELL_NOW", "HOLD", "SPLIT_BATCH", "PARTIAL_SELL", "WAIT", "NEED_MORE_INFORMATION")
    assert "FACTS" in data or "facts" in data
    assert "REASONING" in data or "reasoning" in data
    assert "suggestedPrice" in data
    assert "DISCLAIMER" in data or "disclaimer" in data


@pytest.mark.asyncio
async def test_get_selling_recommendation_zero_fabrication():
    """Verify unknown crop returns NEED_MORE_INFORMATION and no fabricated trends or revenue."""
    user = {"id": "f1", "role": "farmer", "district": "Madurai"}
    res = await dispatch_tool(user, "getSellingRecommendation", {
        "crop": "ExtremelyExoticCrop999",
        "quantity": 50,
    })
    assert res.success is True
    data = res.data
    assert data["recommendation"] == "NEED_MORE_INFORMATION"
    assert data["suggestedPrice"] is None
    assert data["estimatedGrossRevenue"] is None


@pytest.mark.asyncio
async def test_get_my_selling_opportunities():
    """Verify getMySellingOpportunities detects real opportunities without leaking buyer PII."""
    user = {"id": "f1", "role": "farmer", "district": "Madurai"}
    res = await dispatch_tool(user, "getMySellingOpportunities", {"limit": 5})
    assert res.success is True
    data = res.data
    assert "farmerId" in data
    assert data["farmerId"] == "f1"
    assert "opportunities" in data
    assert "opportunityCount" in data or "totalDetected" in data
    
    for opp in data.get("opportunities", []):
        assert "password" not in opp
        assert "token" not in opp
        assert "phone" not in opp
        assert "customerPhone" not in opp
        assert "address" not in opp


@pytest.mark.asyncio
async def test_compare_selling_options():
    """Verify compareSellingOptions returns channel breakdown matching Node implementation."""
    user = {"id": "f1", "role": "farmer", "district": "Madurai"}
    res = await dispatch_tool(user, "compareSellingOptions", {
        "commodities": ["Tomato", "Onion"],
    })
    assert res.success is True
    data = res.data
    assert "comparison" in data or "options" in data
    assert data.get("comparedCount", 0) >= 2
    assert "disclaimer" in data
    rows = data.get("comparison", [])
    for row in rows:
        assert "commodity" in row
        assert "recommendation" in row
        assert "riskLevel" in row


@pytest.mark.asyncio
async def test_get_selling_plan():
    """Verify getSellingPlan generates multi-crop plan matching Node structure."""
    user = {"id": "f1", "role": "farmer", "district": "Madurai"}
    res = await dispatch_tool(user, "getSellingPlan", {})
    assert res.success is True
    data = res.data
    assert "farmerId" in data
    assert data["farmerId"] == "f1"
    assert "totalCropsEvaluated" in data
    assert "plan" in data
    assert isinstance(data["plan"], (list, dict))


@pytest.mark.asyncio
async def test_compare_analytics_periods():
    """Verify compareAnalyticsPeriods compares two periods and calculates changes."""
    user = {"id": "f1", "role": "farmer", "district": "Madurai"}
    res = await dispatch_tool(user, "compareAnalyticsPeriods", {
        "period": "30d"
    })
    assert res.success is True
    data = res.data
    assert data["reportType"] == "PERIOD_COMPARISON"
    assert "period" in data
    assert "current" in data["period"]
    assert "previous" in data["period"]
    assert "comparisons" in data
    assert "facts" in data


@pytest.mark.asyncio
async def test_compare_analytics_periods_zero_fabrication():
    """Verify comparison with zero baseline period returns comparisonAvailable = False without fabricating percentages."""
    user = {"id": "f1", "role": "farmer", "district": "Madurai"}
    res = await dispatch_tool(user, "compareAnalyticsPeriods", {
        "period": "30d"
    })
    assert res.success is True
    data = res.data
    assert "comparisons" in data
    for comp in data["comparisons"]:
        if comp.get("previous", 0) == 0:
            assert comp["comparisonAvailable"] is False
            assert comp["percentageChange"] is None


@pytest.mark.asyncio
async def test_generate_analytics_report():
    """Verify generateAnalyticsReport generates structured sales/inventory reports."""
    user = {"id": "f1", "role": "farmer", "district": "Madurai"}
    res = await dispatch_tool(user, "generateAnalyticsReport", {
        "reportType": "SALES",
        "startDate": "2026-01-01",
        "endDate": "2026-10-01",
    })
    assert res.success is True
    data = res.data
    assert data["reportType"] == "SALES"
    assert "period" in data
    assert "metrics" in data
    assert "topProducts" in data
    assert "grossRevenue" in data["metrics"]


@pytest.mark.asyncio
async def test_get_marketplace_analytics():
    """Verify getMarketplaceAnalytics returns full GMV, category, and regional data."""
    user = {"id": "f1", "role": "farmer", "district": "Madurai"}
    res = await dispatch_tool(user, "getMarketplaceAnalytics", {
        "district": "Madurai",
        "days": 30,
    })
    assert res.success is True
    data = res.data
    assert data["reportType"] == "MARKETPLACE"
    assert "period" in data
    assert "metrics" in data
    assert "totalListings" in data["metrics"]
    assert "totalMarketplaceGmv" in data["metrics"]
    assert "facts" in data
    assert "insights" in data


@pytest.mark.asyncio
async def test_get_platform_analytics_admin_only():
    """Verify getPlatformAnalytics and getPlatformAnalyticsReport are restricted to admin."""
    admin_user = {"id": "admin_1", "role": "admin"}
    farmer_user = {"id": "f1", "role": "farmer"}
    vendor_user = {"id": "v1", "role": "vendor"}
    
    # 1. Admin allowed
    res_admin = await dispatch_tool(admin_user, "getPlatformAnalytics", {})
    assert res_admin.success is True
    assert "users" in res_admin.data
    assert "farmers" in res_admin.data
    assert "vendors" in res_admin.data
    assert "products" in res_admin.data
    assert "orders" in res_admin.data
    assert "deliveredRevenue" in res_admin.data
    
    res_admin_report = await dispatch_tool(admin_user, "getPlatformAnalyticsReport", {"period": "30d"})
    assert res_admin_report.success is True
    assert res_admin_report.data["reportType"] == "PLATFORM"
    assert "users" in res_admin_report.data
    assert "marketplace" in res_admin_report.data
    
    # 2. Farmer denied
    res_farmer = await dispatch_tool(farmer_user, "getPlatformAnalytics", {})
    assert res_farmer.success is False
    assert res_farmer.error["code"] == "FORBIDDEN"
    
    # 3. Vendor denied
    res_vendor = await dispatch_tool(vendor_user, "getPlatformAnalytics", {})
    assert res_vendor.success is False
    assert res_vendor.error["code"] == "FORBIDDEN"


@pytest.mark.asyncio
async def test_generate_platform_report_admin_isolation():
    """Verify generateAnalyticsReport with reportType='PLATFORM' strictly requires admin."""
    admin_user = {"id": "admin_1", "role": "admin"}
    farmer_user = {"id": "f1", "role": "farmer"}
    
    # Admin permitted
    res_admin = await dispatch_tool(admin_user, "generateAnalyticsReport", {"reportType": "PLATFORM"})
    assert res_admin.success is True
    assert res_admin.data["reportType"] == "PLATFORM"
    
    # Farmer denied
    res_farmer = await dispatch_tool(farmer_user, "generateAnalyticsReport", {"reportType": "PLATFORM"})
    assert res_farmer.success is False
    assert res_farmer.error["code"] == "FORBIDDEN"


@pytest.mark.asyncio
async def test_anti_spoofing_farmer_override():
    """Verify farmer cannot supply a spoofed farmerId to view another farmer's strategy/opportunities."""
    user = {"id": "f1", "role": "farmer", "district": "Madurai"}
    
    # Attempt to spoof f999
    res = await dispatch_tool(user, "getMySellingOpportunities", {"farmerId": "f999_spoofed"})
    assert res.success is True
    # Must be forced back to authenticated id f1
    assert res.data["farmerId"] == "f1"


@pytest.mark.asyncio
async def test_sql_injection_resistance():
    """Verify SQL injection payloads in parameters are safely escaped by parameterized queries."""
    user = {"id": "f1", "role": "farmer", "district": "Madurai"}
    
    # 1. Injection in crop name with known crop: securely handled by parameterized query
    res = await dispatch_tool(user, "getSellingRecommendation", {
        "crop": "Tomato' OR '1'='1",
        "quantity": 100,
    })
    assert res.success is True
    assert "recommendation" in res.data
    # Safe recommendation generated without SQL crash or data compromise
    assert res.data["recommendation"] in ("SELL_NOW", "HOLD", "PARTIAL_SELL", "WAIT", "NEED_MORE_INFORMATION")

    # 2. Pure SQL injection attack payload: must safely return insufficient data without leaking or matching everything
    res_malicious = await dispatch_tool(user, "getSellingRecommendation", {
        "crop": "' OR '1'='1' --",
        "quantity": 100,
    })
    assert res_malicious.success is True
    assert res_malicious.data["recommendation"] == "NEED_MORE_INFORMATION"


@pytest.mark.asyncio
async def test_gemini_declarations_stage3b():
    """Verify Gemini tool declarations include Stage 3B tools with appropriate role scoping."""
    farmer_tools = get_gemini_tools_for_role("farmer")
    assert len(farmer_tools) > 0
    fn_names = [tool["name"] for tool in farmer_tools if isinstance(tool, dict) and "name" in tool]
    
    for tool_name in [
        "getSellingRecommendation",
        "getMySellingOpportunities",
        "compareSellingOptions",
        "getSellingPlan",
        "compareAnalyticsPeriods",
        "generateAnalyticsReport",
        "getMarketplaceAnalytics",
    ]:
        assert tool_name in fn_names
    
    # Farmer must NOT have platform analytics in Gemini tool declaration
    assert "getPlatformAnalytics" not in fn_names
    assert "getPlatformAnalyticsReport" not in fn_names
    
    # Admin must have platform analytics
    admin_tools = get_gemini_tools_for_role("admin")
    admin_fn_names = [tool["name"] for tool in admin_tools if isinstance(tool, dict) and "name" in tool]
    assert "getPlatformAnalytics" in admin_fn_names
    assert "getPlatformAnalyticsReport" in admin_fn_names
