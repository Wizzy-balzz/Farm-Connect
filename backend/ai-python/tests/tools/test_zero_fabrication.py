"""
Zero-fabrication tests for Python read-only intelligence and catalog tools.
Verifies that when zero or insufficient data exists:
- hasData is False
- sufficientData is False
- No artificial prices, projections, or statistics are invented.
- Weather outages return WEATHER_UNAVAILABLE without fabricating forecast.
"""

import pytest
from unittest.mock import patch
import httpx

from app.tools.read_tools.intelligence import (
    get_price_intelligence,
    get_demand_insights,
    get_demand_intelligence,
)
from app.tools.read_tools.marketplace_query import compare_products
from app.tools.external_tools.weather import get_weather_advisory


@pytest.mark.asyncio
async def test_price_intelligence_zero_listings_returns_has_data_false():
    """
    Mandatory: getPriceIntelligence with zero listings.
    Must return hasData = False and zero/null values, never invent fake prices.
    """
    result = await get_price_intelligence(commodity="NonExistentRareDragonfruit12345")
    assert result["hasData"] is False
    assert result["sampleSize"] == 0
    assert "statistics" not in result
    assert "fairPricingRange" not in result
    assert "does not currently have active listings" in result["message"]


@pytest.mark.asyncio
async def test_demand_insights_insufficient_data_returns_sufficient_data_false():
    """
    Mandatory: getDemandInsights with insufficient data.
    Must return sufficientData = False, without inventing order projections.
    """
    with patch("app.tools.read_tools.intelligence.db.query_get", return_value={"count": 1}):
        result = await get_demand_insights(category="NonExistentCrop99999")
        assert result["sufficientData"] is False
        assert "Not enough historical data" in result["message"]
        assert "projectedGrowth" not in result



@pytest.mark.asyncio
async def test_demand_intelligence_insufficient_data_returns_has_sufficient_data_false():
    """
    Mandatory: getDemandIntelligence with insufficient data.
    Must return hasSufficientData = False.
    """
    result = await get_demand_intelligence(commodity="NonExistentCrop88888")
    assert result["hasSufficientData"] is False
    assert "message" in result


@pytest.mark.asyncio
async def test_compare_products_missing_ids_no_invented_values():
    """
    Mandatory: compareProducts with non-existent product IDs.
    Returns empty list, never fabricates dummy products.
    """
    result = await compare_products(productIds=["fake_prod_999a", "fake_prod_999b"])
    assert isinstance(result, list)
    assert len(result) == 0


@pytest.mark.asyncio
async def test_weather_outage_returns_weather_unavailable_no_fabrication():
    """
    Mandatory: Weather outage returns structured WEATHER_UNAVAILABLE.
    Never fabricates a temperature or rainfall forecast.
    """
    with patch("httpx.AsyncClient.get", side_effect=httpx.ConnectTimeout("Connection to Open-Meteo timed out")):
        result = await get_weather_advisory(district="UnknownHimalayanPeak", use_cache=False)
        assert "error" in result
        assert result["error"]["code"] == "WEATHER_UNAVAILABLE"
        assert "temporarily unavailable" in result["error"]["message"].lower()
        # Verify no fake temperature or forecast is returned
        assert "current" not in result
        assert "indicators" not in result
