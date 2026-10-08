"""
Tests for weather tool: Open-Meteo integration, crop advisory, risk assessment, and caching.
"""

import pytest
from unittest.mock import patch, MagicMock
from app.tools.external_tools.weather import get_weather_advisory, WEATHER_CACHE


MOCK_OPEN_METEO_RESPONSE = {
    "current": {
        "temperature_2m": 31.5,
        "relative_humidity_2m": 65,
        "precipitation": 0.0,
        "wind_speed_10m": 12.0
    },
    "daily": {
        "time": ["2026-10-02", "2026-10-03", "2026-10-04"],
        "temperature_2m_max": [33.0, 34.0, 32.5],
        "temperature_2m_min": [24.0, 24.5, 23.8],
        "precipitation_sum": [0.0, 15.0, 5.0],
        "precipitation_probability_max": [10, 75, 40]
    }
}


@pytest.mark.asyncio
async def test_weather_advisory_successful_mock():
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = MOCK_OPEN_METEO_RESPONSE
    mock_resp.raise_for_status = MagicMock()

    with patch("httpx.AsyncClient.get", return_value=mock_resp):
        res = await get_weather_advisory(district="Madurai", crop="Tomato", use_cache=False)
        assert res["provider"] == "Open-Meteo"
        assert res["district"] == "Madurai"
        assert res["current"]["temperature"] == 31.5
        assert res["agriculturalAdvisory"]["crop"] == "Tomato"
        assert "sprayRecommendation" in res["agriculturalAdvisory"]
        assert "harvestRecommendation" in res["agriculturalAdvisory"]
        assert res["riskAssessment"]["rainExpectedNext48h"] is True


@pytest.mark.asyncio
async def test_weather_advisory_cache_hit():
    WEATHER_CACHE.clear()
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = MOCK_OPEN_METEO_RESPONSE
    mock_resp.raise_for_status = MagicMock()

    with patch("httpx.AsyncClient.get", return_value=mock_resp) as mock_get:
        # First call hits mock
        res1 = await get_weather_advisory(district="Nashik", crop="Onion", use_cache=True)
        assert res1["district"] == "Nashik"
        assert mock_get.call_count == 1

        # Second call hits memory cache without HTTP call
        res2 = await get_weather_advisory(district="Nashik", crop="Onion", use_cache=True)
        assert res2["district"] == "Nashik"
        assert mock_get.call_count == 1  # Still 1 call
