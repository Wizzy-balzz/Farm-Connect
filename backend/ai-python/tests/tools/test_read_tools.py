"""
Integration tests for read_tools handlers (marketplace, farmer, intelligence).
Verifies handler execution, query filtering, and data contracts.
"""

import pytest
from app.tools.read_tools.marketplace_query import (
    search_products,
    get_product,
    get_nearby_products,
    compare_products,
)
from app.tools.read_tools.farmer_query import (
    get_farmer_profile,
    get_farmer_products,
)
from app.tools.read_tools.intelligence import (
    get_price_insights,
    get_demand_insights,
    get_marketplace_overview,
    get_marketplace_analytics,
)


@pytest.mark.asyncio
async def test_search_products_general_query():
    res = await search_products(queryText="Tomato", limit=5)
    assert isinstance(res, list)


@pytest.mark.asyncio
async def test_search_products_category_and_organic():
    res = await search_products(category="Vegetables", organic=True, limit=5)
    assert isinstance(res, list)


@pytest.mark.asyncio
async def test_get_product_not_found():
    res = await get_product(id="non_existent_product_id_xyz")
    assert res is None


@pytest.mark.asyncio
async def test_get_nearby_products_district_query():
    res = await get_nearby_products(district="Madurai")
    assert isinstance(res, list)


@pytest.mark.asyncio
async def test_get_farmer_profile_non_existent():
    res = await get_farmer_profile(farmerId="non_existent_farmer_id")
    assert res is None


@pytest.mark.asyncio
async def test_get_farmer_products_non_existent():
    res = await get_farmer_products(farmerId="non_existent_farmer_id")
    assert isinstance(res, list)
    assert len(res) == 0



@pytest.mark.asyncio
async def test_price_insights_crop():
    res = await get_price_insights(crop="Tomato")
    assert "recommendedRange" in res
    assert "platformAverage" in res
    assert "reasons" in res


@pytest.mark.asyncio
async def test_marketplace_overview():
    res = await get_marketplace_overview()
    assert "totalListings" in res
    assert "categories" in res
    assert "recentListings" in res


@pytest.mark.asyncio
async def test_marketplace_analytics():
    res = await get_marketplace_analytics(period="30d")
    assert "period" in res
    assert res["period"] == "30d"
    assert "totalRevenue" in res
    assert "orderCount" in res

