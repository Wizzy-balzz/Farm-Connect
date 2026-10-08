"""
Tests for Pydantic input schemas of all 13 Python tools.
Verifies validation, bounds, data types, and rejection of malformed arguments.
"""

import pytest
from pydantic import ValidationError

from app.tools.schemas import (
    SearchProductsInput,
    GetProductInput,
    GetNearbyProductsInput,
    GetFarmerProfileInput,
    GetFarmerProductsInput,
    CompareProductsInput,
    GetPriceInsightsInput,
    GetDemandInsightsInput,
    GetWeatherAdvisoryInput,
    GetPriceIntelligenceInput,
    GetDemandIntelligenceInput,
    GetMarketplaceOverviewInput,
    GetMarketplaceAnalyticsInput,
)


def test_search_products_schema_valid():
    inp = SearchProductsInput(
        queryText="Tomato",
        category="Vegetables",
        organic=True,
        maxPrice=150.0,
        moq=10.0
    )
    assert inp.queryText == "Tomato"
    assert inp.category == "Vegetables"
    assert inp.organic is True
    assert inp.maxPrice == 150.0
    assert inp.moq == 10.0


def test_search_products_schema_defaults():
    inp = SearchProductsInput()
    assert inp.queryText == ""
    assert inp.category == "All"
    assert inp.organic is False
    assert inp.maxPrice is None
    assert inp.moq is None


def test_search_products_schema_negative_price():
    with pytest.raises(ValidationError):
        SearchProductsInput(maxPrice=-10.0)


def test_get_product_schema():
    inp = GetProductInput(id="prod-123")
    assert inp.id == "prod-123"

    with pytest.raises(ValidationError):
        GetProductInput(id="")  # min_length=1


def test_compare_products_schema():
    inp = CompareProductsInput(productIds=["p1", "p2"])
    assert inp.productIds == ["p1", "p2"]

    # Deduplication and lowercasing
    inp_dups = CompareProductsInput(productIds=["p1", "p1", "p2"])
    assert inp_dups.productIds == ["p1", "p2"]

    # Reject empty
    with pytest.raises(ValidationError):
        CompareProductsInput(productIds=[])


def test_weather_advisory_schema_coordinates_bounds():
    inp = GetWeatherAdvisoryInput(district="Madurai", lat=9.9252, lng=78.1198)
    assert inp.lat == 9.9252
    assert inp.lng == 78.1198

    # Latitude out of range
    with pytest.raises(ValidationError):
        GetWeatherAdvisoryInput(lat=95.0, lng=78.0)

    # Longitude out of range
    with pytest.raises(ValidationError):
        GetWeatherAdvisoryInput(lat=10.0, lng=190.0)


def test_demand_intelligence_schema_days_bounds():
    inp = GetDemandIntelligenceInput(commodity="Tomato", days=45)
    assert inp.days == 45

    # days out of bounds (> 365)
    with pytest.raises(ValidationError):
        GetDemandIntelligenceInput(days=500)

    # days < 1
    with pytest.raises(ValidationError):
        GetDemandIntelligenceInput(days=0)


def test_get_farmer_profile_schema():
    inp = GetFarmerProfileInput(farmerId="f-999")
    assert inp.farmerId == "f-999"

    with pytest.raises(ValidationError):
        GetFarmerProfileInput(farmerId="")


def test_marketplace_analytics_schema():
    inp = GetMarketplaceAnalyticsInput(commodity="Onion", period="30d")
    assert inp.commodity == "Onion"
    assert inp.period == "30d"
