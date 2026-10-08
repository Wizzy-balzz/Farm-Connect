"""
Tests for RBAC and permission validation across the 13 tools.
Verifies farmer, vendor, admin authorizations, and rejection of unauthorized or unknown roles.
"""

import pytest
from app.tools.permissions import is_tool_allowed, get_allowed_tool_names_for_role, sanitize_tool_params
from app.tools.registry import TOOL_REGISTRY


ALL_13_TOOLS = [
    "searchProducts",
    "getProduct",
    "getNearbyProducts",
    "getFarmerProfile",
    "getFarmerProducts",
    "compareProducts",
    "getPriceInsights",
    "getDemandInsights",
    "getWeatherAdvisory",
    "getPriceIntelligence",
    "getDemandIntelligence",
    "getMarketplaceOverview",
    "getMarketplaceAnalytics",
]


def test_registry_contains_at_least_13_tools():
    assert len(TOOL_REGISTRY) >= 13
    for tool_name in ALL_13_TOOLS:
        assert tool_name in TOOL_REGISTRY



def test_all_13_tools_allowed_for_farmer():
    user = {"id": "farmer_1", "role": "farmer"}
    allowed = get_allowed_tool_names_for_role("farmer")
    for tool_name in ALL_13_TOOLS:
        assert is_tool_allowed(user, tool_name) is True
        assert tool_name in allowed


def test_all_13_tools_allowed_for_vendor():
    user = {"id": "vendor_1", "role": "vendor"}
    allowed = get_allowed_tool_names_for_role("vendor")
    for tool_name in ALL_13_TOOLS:
        assert is_tool_allowed(user, tool_name) is True
        assert tool_name in allowed


def test_all_13_tools_allowed_for_admin():
    user = {"id": "admin_1", "role": "admin"}
    allowed = get_allowed_tool_names_for_role("admin")
    for tool_name in ALL_13_TOOLS:
        assert is_tool_allowed(user, tool_name) is True
        assert tool_name in allowed


def test_unauthorized_role_rejected():
    user = {"id": "guest_1", "role": "anonymous_guest"}
    for tool_name in ALL_13_TOOLS:
        assert is_tool_allowed(user, tool_name) is False


def test_missing_role_rejected():
    user = {"id": "no_role"}
    for tool_name in ALL_13_TOOLS:
        assert is_tool_allowed(user, tool_name) is False


def test_sanitize_tool_params_location_fallback():
    user = {
        "id": "u1",
        "role": "farmer",
        "district": "Madurai",
        "state": "Tamil Nadu"
    }
    # User provides no district/region, fallback to user context
    sanitized = sanitize_tool_params("getNearbyProducts", {}, user)
    assert sanitized.get("district") == "Madurai"
    assert sanitized.get("region") == "Tamil Nadu"

    # User explicitly provides district, do not overwrite
    sanitized_explicit = sanitize_tool_params("getNearbyProducts", {"district": "Nashik"}, user)
    assert sanitized_explicit.get("district") == "Nashik"
