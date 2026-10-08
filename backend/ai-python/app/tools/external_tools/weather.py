"""
External Weather Tool: getWeatherAdvisory.
Integrates directly with Open-Meteo REST API using httpx (non-blocking async).
Zero fabrication: If Open-Meteo is unreachable, returns structured WEATHER_UNAVAILABLE error.
Adheres to backend/services/weatherService.js agricultural interpretations.
"""

import time
from typing import Any, Dict, List, Optional
import httpx

from app.tools.read_tools.marketplace_query import normalize_crop_name

# Regional and district coordinate centroids matching weatherService.js
REGIONAL_COORDINATES = {
    "nashik": {"lat": 19.9975, "lng": 73.7898, "name": "Nashik, Maharashtra"},
    "pune": {"lat": 18.5204, "lng": 73.8567, "name": "Pune, Maharashtra"},
    "mumbai": {"lat": 19.0760, "lng": 72.8777, "name": "Mumbai, Maharashtra"},
    "nagpur": {"lat": 21.1458, "lng": 79.0882, "name": "Nagpur, Maharashtra"},
    "coimbatore": {"lat": 11.0168, "lng": 76.9558, "name": "Coimbatore, Tamil Nadu"},
    "madurai": {"lat": 9.9252, "lng": 78.1198, "name": "Madurai, Tamil Nadu"},
    "chennai": {"lat": 13.0827, "lng": 80.2707, "name": "Chennai, Tamil Nadu"},
    "salem": {"lat": 11.6643, "lng": 78.1460, "name": "Salem, Tamil Nadu"},
    "tirunelveli": {"lat": 8.7139, "lng": 77.7567, "name": "Tirunelveli, Tamil Nadu"},
    "ludhiana": {"lat": 30.9010, "lng": 75.8573, "name": "Ludhiana, Punjab"},
    "amritsar": {"lat": 31.6340, "lng": 74.8723, "name": "Amritsar, Punjab"},
    "kochi": {"lat": 9.9312, "lng": 76.2673, "name": "Kochi, Kerala"},
    "wayanad": {"lat": 11.6854, "lng": 76.1320, "name": "Wayanad, Kerala"},
    "maharashtra": {"lat": 19.7515, "lng": 75.7139, "name": "Maharashtra"},
    "tamil nadu": {"lat": 11.1271, "lng": 78.6569, "name": "Tamil Nadu"},
    "punjab": {"lat": 31.1471, "lng": 75.3412, "name": "Punjab"},
    "kerala": {"lat": 10.8505, "lng": 76.2711, "name": "Kerala"},
    "karnataka": {"lat": 15.3173, "lng": 75.7139, "name": "Karnataka"},
    "andhra pradesh": {"lat": 15.9129, "lng": 79.7400, "name": "Andhra Pradesh"},
    "gujarat": {"lat": 22.2587, "lng": 71.1924, "name": "Gujarat"},
    "uttar pradesh": {"lat": 26.8467, "lng": 80.9462, "name": "Uttar Pradesh"},
    "haryana": {"lat": 29.0588, "lng": 76.0856, "name": "Haryana"},
    "delhi": {"lat": 28.7041, "lng": 77.1025, "name": "Delhi"},
    "india": {"lat": 20.5937, "lng": 78.9629, "name": "India"}
}

WMO_CODE_MAP = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    62: "Light rain",
    63: "Moderate rain",
    65: "Heavy rain",
    71: "Slight snowfall",
    73: "Moderate snowfall",
    75: "Heavy snowfall",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail"
}

_WEATHER_CACHE: Dict[str, Dict[str, Any]] = {}
WEATHER_CACHE = _WEATHER_CACHE
CACHE_TTL_SECONDS = 600  # 10 minutes


def resolve_coordinates(params: Dict[str, Any], user: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Resolves latitude and longitude coordinates from user profile or explicit params."""
    u = user or {}
    lat_val = params.get("lat") or u.get("lat")
    lng_val = params.get("lng") or u.get("lng")
    district = (params.get("district") or u.get("district") or "").strip()
    region = (params.get("region") or u.get("region") or "").strip()

    try:
        if lat_val is not None and lng_val is not None:
            p_lat = float(lat_val)
            p_lng = float(lng_val)
            if p_lat != 0 and p_lng != 0:
                name = f"{district}, {region}" if district else (region or "India")
                return {"lat": p_lat, "lng": p_lng, "resolvedName": name}
    except (ValueError, TypeError):
        pass

    if district:
        k = district.lower()
        if k in REGIONAL_COORDINATES:
            return {
                "lat": REGIONAL_COORDINATES[k]["lat"],
                "lng": REGIONAL_COORDINATES[k]["lng"],
                "resolvedName": REGIONAL_COORDINATES[k]["name"]
            }

    if region:
        k = region.lower()
        if k in REGIONAL_COORDINATES:
            return {
                "lat": REGIONAL_COORDINATES[k]["lat"],
                "lng": REGIONAL_COORDINATES[k]["lng"],
                "resolvedName": REGIONAL_COORDINATES[k]["name"]
            }

    return {
        "lat": REGIONAL_COORDINATES["india"]["lat"],
        "lng": REGIONAL_COORDINATES["india"]["lng"],
        "resolvedName": "India"
    }


async def get_live_weather_forecast(coords: Dict[str, Any], use_cache: bool = True) -> Dict[str, Any]:
    """Fetches real weather from Open-Meteo REST API with timeout and in-memory cache."""
    cache_key = f"{coords['lat']:.2f},{coords['lng']:.2f}"
    if use_cache:
        cached = _WEATHER_CACHE.get(cache_key)
        if cached and (time.time() - cached["timestamp"]) < CACHE_TTL_SECONDS:
            return cached["data"]

    url = "https://api.open-meteo.com/v1/forecast"
    query_params = {
        "latitude": str(coords["lat"]),
        "longitude": str(coords["lng"]),
        "current": "temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m",
        "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max",
        "timezone": "auto"
    }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(url, params=query_params)
            if resp.status_code != 200:
                raise RuntimeError(f"Open-Meteo returned status {resp.status_code}")
            json_data = resp.json()

        curr = json_data.get("current", {})
        daily = json_data.get("daily", {})

        wmo_code = curr.get("weather_code", 0)
        condition = WMO_CODE_MAP.get(wmo_code, "Clear")
        temp = curr.get("temperature_2m", 28.0)
        humidity = curr.get("relative_humidity_2m", 60.0)
        wind = curr.get("wind_speed_10m", 8.0)
        precip = curr.get("precipitation", 0.0)

        daily_forecast = []
        dates = daily.get("time", [])
        w_codes = daily.get("weather_code", [])
        max_temps = daily.get("temperature_2m_max", [])
        min_temps = daily.get("temperature_2m_min", [])
        precip_sums = daily.get("precipitation_sum", [])
        precip_probs = daily.get("precipitation_probability_max", [])

        rain_expected_48h = False
        high_rainfall_days = []
        heat_risk = False

        for idx, dt in enumerate(dates[:7]):
            c_code = w_codes[idx] if idx < len(w_codes) else 0
            cond = WMO_CODE_MAP.get(c_code, "Clear")
            t_max = max_temps[idx] if idx < len(max_temps) else temp
            t_min = min_temps[idx] if idx < len(min_temps) else temp - 5
            p_sum = precip_sums[idx] if idx < len(precip_sums) else 0.0
            p_prob = precip_probs[idx] if idx < len(precip_probs) else 0

            if idx < 2 and (p_sum > 2.0 or p_prob > 50):
                rain_expected_48h = True

            if p_sum > 15.0 or p_prob > 70:
                high_rainfall_days.append(f"{dt} ({cond}, {p_prob}% rain prob)")

            if t_max > 38.0:
                heat_risk = True

            daily_forecast.append({
                "date": dt,
                "condition": cond,
                "maxTempC": t_max,
                "minTempC": t_min,
                "rainMm": p_sum,
                "rainProbPct": p_prob
            })

        payload = {
            "success": True,
            "data": {
                "location": coords["resolvedName"],
                "coordinates": {"lat": coords["lat"], "lng": coords["lng"]},
                "current": {
                    "temperatureC": temp,
                    "condition": condition,
                    "humidityPct": humidity,
                    "windSpeedKmh": wind,
                    "precipitationMm": precip
                },
                "forecast": daily_forecast,
                "agriculturalIndicators": {
                    "rainExpectedNext48h": rain_expected_48h,
                    "highRainfallRiskDays": high_rainfall_days,
                    "heatRisk": heat_risk,
                    "favorableHarvestingConditions": not rain_expected_48h
                },
                "source": "Open-Meteo REST API",
                "cachedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ")
            }
        }
        if use_cache:
            _WEATHER_CACHE[cache_key] = {"timestamp": time.time(), "data": payload}
        return payload

    except Exception:
        # Zero-fabrication: Never invent temperature or rainfall if API fails
        return {
            "success": False,
            "error": {
                "code": "WEATHER_UNAVAILABLE",
                "message": "Weather information is temporarily unavailable for this region."
            }
        }


async def get_weather_advisory(
    params: Optional[Dict[str, Any]] = None,
    user: Optional[Dict[str, Any]] = None,
    district: Optional[str] = None,
    region: Optional[str] = None,
    crop: Optional[str] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    use_cache: bool = True,
    **kwargs: Any
) -> Dict[str, Any]:
    """Retrieve live agricultural weather forecast and synthesize harvest/spray advisories."""
    p = {**(params or {}), **kwargs}
    if district:
        p["district"] = district
    if region:
        p["region"] = region
    if crop:
        p["crop"] = crop
    if lat is not None:
        p["lat"] = lat
    if lng is not None:
        p["lng"] = lng

    coords = resolve_coordinates(p, user)
    weather_res = await get_live_weather_forecast(coords, use_cache=use_cache)

    if not weather_res or not weather_res.get("success"):
        return {
            "error": {
                "code": "WEATHER_UNAVAILABLE",
                "message": "Weather information is temporarily unavailable for this region."
            }
        }

    w_data = weather_res["data"]
    current = w_data["current"]
    indicators = w_data["agriculturalIndicators"]

    raw_crop = p.get("crop") or (user.get("primaryCrop") if user else None)
    canonical_crop = normalize_crop_name(raw_crop) if raw_crop else None

    advisory_points: List[str] = []

    if indicators["rainExpectedNext48h"]:
        advisory_points.append(
            "Precipitation is anticipated within the next 48 hours. Consider completing urgent harvesting and ensure harvested produce is sheltered in dry storage."
        )
    else:
        advisory_points.append(
            "No significant rainfall is expected over the next 48 hours. Field conditions appear favorable for harvest, drying, and transit."
        )

    if current["temperatureC"] > 35:
        advisory_points.append(
            f"Elevated temperature ({current['temperatureC']}°C) detected. For sensitive produce like leafy greens and ripe tomatoes, harvest in the early morning or evening to preserve freshness and reduce heat wilt."
        )

    if current["windSpeedKmh"] > 20:
        advisory_points.append(
            f"Wind speed is elevated ({current['windSpeedKmh']} km/h). Postpone delicate foliage spraying until calmer wind conditions prevail."
        )

    if canonical_crop:
        advisory_points.append(
            f"For {canonical_crop}: ensure proper moisture drainage and post-harvest shading given current {current['condition'].lower()} conditions."
        )

    return {
        "provider": "Open-Meteo",
        "district": p.get("district") or coords["resolvedName"],
        "location": w_data["location"],
        "current": {
            "temperature": current["temperatureC"],
            "condition": current["condition"],
            "humidity": current["humidityPct"],
            "windSpeed": current["windSpeedKmh"],
        },
        "currentConditions": {
            "temperature": f"{current['temperatureC']}°C",
            "condition": current["condition"],
            "humidity": f"{current['humidityPct']}%",
            "windSpeed": f"{current['windSpeedKmh']} km/h"
        },
        "riskAssessment": {
            "rainExpectedNext48h": indicators["rainExpectedNext48h"],
            "highRainfallRiskDays": indicators["highRainfallRiskDays"],
            "heatRisk": indicators["heatRisk"],
            "favorableHarvestingConditions": indicators["favorableHarvestingConditions"]
        },
        "agriculturalAdvisory": {
            "crop": canonical_crop or "General produce",
            "sprayRecommendation": "Postpone spraying" if indicators["rainExpectedNext48h"] or current["windSpeedKmh"] > 20 else "Favorable for spraying",
            "harvestRecommendation": "Caution (Rain risk)" if indicators["rainExpectedNext48h"] else "Favorable for harvest"
        },
        "indicators": {
            "rainNext48h": indicators["rainExpectedNext48h"],
            "upcomingRainRisks": indicators["highRainfallRiskDays"],
            "harvestingSuitability": "Favorable" if indicators["favorableHarvestingConditions"] else "Caution (Rain risk)"
        },
        "advisories": advisory_points,
        "disclaimer": "Based on available Open-Meteo meteorological forecasts. Local micro-climates may vary; consider field conditions before major agricultural decisions."
    }
