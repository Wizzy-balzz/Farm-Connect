"""
Unit & Integration Tests for Phase A Value Addition AI Tools.
Tests:
- getValueAdditionRecommendations
- getValueAdditionProductDetails
- getValueAdditionProcessingGuide
- calculateValueAdditionEconomics
- RBAC permissions & read-only mutation restrictions
"""

import pytest
from app.tools.dispatcher import dispatch_tool
from app.tools.read_tools.value_addition_query import (
    get_value_addition_recommendations,
    get_value_addition_product_details,
    get_value_addition_processing_guide,
    calculate_value_addition_economics,
)


@pytest.mark.asyncio
async def test_get_value_addition_recommendations():
    res = await get_value_addition_recommendations(crop_name="Groundnut")
    assert res["success"] is True
    assert "products" in res
    assert isinstance(res["products"], list)
    if len(res["products"]) > 0:
        prod = res["products"][0]
        assert "product_name" in prod
        assert "value_addition_multiplier" in prod


@pytest.mark.asyncio
async def test_get_value_addition_product_details():
    recs = await get_value_addition_recommendations(crop_name="Rice")
    if recs["products"]:
        pid = recs["products"][0]["id"]
        res = await get_value_addition_product_details(product_id=pid)
        assert res["success"] is True
        assert res["product"]["id"] == pid
        assert "schemes" in res
        assert "disclaimer" in res


@pytest.mark.asyncio
async def test_get_value_addition_processing_guide():
    res = await get_value_addition_processing_guide(crop_name="Tomato")
    assert res["success"] is True
    assert "stages" in res
    assert "equipment" in res


@pytest.mark.asyncio
async def test_calculate_value_addition_economics():
    res = await calculate_value_addition_economics(
        raw_quantity=500.0,
        raw_unit_price=30.0,
        processing_cost=500.0,
        labour_cost=300.0,
        packaging_cost=200.0,
        expected_output_quantity=400.0,
        expected_selling_price=60.0
    )
    assert res["success"] is True
    assert res["inputs"]["raw_material_cost"] == 15000.0
    assert res["financials"]["total_processing_cost"] == 16000.0
    assert res["financials"]["projected_processed_revenue"] == 24000.0
    assert res["financials"]["projected_profit"] == 8000.0
    assert res["financials"]["roi_percentage"] == 50.0


@pytest.mark.asyncio
async def test_value_addition_dispatcher_rbac():
    farmer_user = {"id": "f1", "role": "farmer"}
    vendor_user = {"id": "v1", "role": "vendor"}

    # Farmer allowed
    farmer_res = await dispatch_tool(
        user=farmer_user,
        tool_name="getValueAdditionRecommendations",
        args={"crop_name": "Groundnut"}
    )
    assert farmer_res.success is True

    # Vendor blocked with FORBIDDEN
    vendor_res = await dispatch_tool(
        user=vendor_user,
        tool_name="getValueAdditionRecommendations",
        args={"crop_name": "Groundnut"}
    )
    assert vendor_res.success is False
    assert vendor_res.error["code"] == "FORBIDDEN"
