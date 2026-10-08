import pytest
from app.tools.read_tools.farming_guide_query import (
    get_crop_knowledge,
    get_soil_crop_compatibility,
    get_crop_calendar,
    get_crop_rotation_recommendations,
    get_crop_irrigation_guide,
    get_crop_nutrient_guide,
    get_crop_pest_disease_guide,
    get_farm_planner_recommendations,
)
from app.tools.registry import get_tool, list_tools


@pytest.mark.asyncio
async def test_get_crop_knowledge():
    res = await get_crop_knowledge(crop_name="Rice")
    assert res["success"] is True
    assert res["count"] > 0
    assert res["crops"][0]["name"] == "Rice"


@pytest.mark.asyncio
async def test_get_soil_crop_compatibility():
    res = await get_soil_crop_compatibility(soil_type="Clay Loam", ph=6.5, season="Kharif")
    assert res["success"] is True
    assert res["count"] > 0
    assert "compatibility" in res["results"][0]


@pytest.mark.asyncio
async def test_get_crop_calendar():
    res = await get_crop_calendar(crop_name="Rice")
    assert res["success"] is True
    assert res["crop"] == "Rice"
    assert len(res["stages"]) > 0


@pytest.mark.asyncio
async def test_get_crop_rotation_recommendations():
    res = await get_crop_rotation_recommendations(previous_crop="Rice")
    assert res["success"] is True
    assert res["previous_crop"] == "Rice"


@pytest.mark.asyncio
async def test_get_crop_irrigation_guide():
    res = await get_crop_irrigation_guide(crop_name="Rice")
    assert res["success"] is True
    assert "rainfall_considerations" in res["guide"]


@pytest.mark.asyncio
async def test_get_crop_nutrient_guide():
    res = await get_crop_nutrient_guide(crop_name="Rice")
    assert res["success"] is True
    assert "soil_test_notice" in res


@pytest.mark.asyncio
async def test_get_crop_pest_disease_guide():
    res = await get_crop_pest_disease_guide(crop_name="Rice")
    assert res["success"] is True
    assert "safety_disclaimer" in res


@pytest.mark.asyncio
async def test_get_farm_planner_recommendations():
    res = await get_farm_planner_recommendations(district="Thanjavur", soil_type="Clay Loam", season="Kharif")
    assert res["success"] is True
    assert res["count"] > 0


def test_registry_registration():
    tool = get_tool("getCropKnowledge")
    assert tool is not None
    assert tool.name == "getCropKnowledge"
    assert tool.classification == "read_only"
