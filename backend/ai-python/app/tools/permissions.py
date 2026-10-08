"""
Permission and RBAC rules for Python AI tools.
Ported from backend/ai/aiPermissions.js for the 13 Phase 3B read-only tools.
"""

from typing import Any, Dict, List, Optional, Union

# The 13 Stage 1 read-only public catalog & weather tools
STAGE1_TOOL_NAMES = {
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
}

# The 7 Stage 2 authenticated read-only user & analytics tools
STAGE2_TOOL_NAMES = {
    "getMyOrders",
    "getMySales",
    "getMyInventory",
    "getMyFarmReport",
    "getMySalesAnalytics",
    "getMyInventoryAnalytics",
    "getMyProductPerformance",
}

# The 8 Stage 3A public & regional read-only marketplace tools
STAGE3A_TOOL_NAMES = {
    "getFarmerProfile",
    "getFarmerProducts",
    "compareProducts",
    "getPriceInsights",
    "getDemandInsights",
    "getDemandIntelligence",
    "getMarketplaceOverview",
    "getNearbyBuyerOpportunities",
}

# The 8 Stage 3B farmer selling strategy & advanced analytics tools
STAGE3B_TOOL_NAMES = {
    "getSellingRecommendation",
    "getMySellingOpportunities",
    "compareSellingOptions",
    "getSellingPlan",
    "compareAnalyticsPeriods",
    "generateAnalyticsReport",
    "getMarketplaceAnalytics",
    "getPlatformAnalytics",
    "getPlatformAnalyticsReport",
}

# The 3 Stage 3C-1 authenticated copilot memory tools
STAGE3C1_TOOL_NAMES = {
    "getMyAiMemory",
    "searchMyAiMemory",
    "getRelevantUserContext",
}

# The 3 Stage 3C-2 authenticated copilot goals & follow-up tools
STAGE3C2_FARMER_GOAL_TOOLS = {
    "getMyFarmingGoals",
    "getGoalProgress",
}
STAGE3C2_FOLLOWUP_TOOLS = {
    "getMyFollowUps",
}
STAGE3C2_TOOL_NAMES = STAGE3C2_FARMER_GOAL_TOOLS | STAGE3C2_FOLLOWUP_TOOLS

# The Stage 3C-3 authenticated copilot planner orchestration tool
STAGE3C3_TOOL_NAMES = {
    "executeCopilotPlan",
}

# Phase 3C-4: Action Proposal Tools
# Python FORMULATES proposals only. Node executes, tokens, persists, confirms.
STAGE3C4_TOOL_NAMES = {
    "proposeUpdateProductPrice",
    "proposeUpdateInventory",
    "proposeCreateProductListing",
    "proposeCancelOrder",
    "proposeSendMessage",
}

# Subset: tools only farmers+admins can propose (not vendors)
STAGE3C4_FARMER_ONLY_TOOLS = {
    "proposeUpdateProductPrice",
    "proposeUpdateInventory",
    "proposeCreateProductListing",
}

# Subset: tools farmers + vendors + admins can propose
STAGE3C4_SHARED_TOOLS = {
    "proposeCancelOrder",
    "proposeSendMessage",
}

# Phase A Value Addition Tools
VALUE_ADDITION_TOOL_NAMES = {
    "getValueAdditionRecommendations",
    "getValueAdditionProductDetails",
    "getValueAdditionProcessingGuide",
    "calculateValueAdditionEconomics",
}

# Role permissions for Phase 3C-4 + Phase A (Value Addition)
ROLE_PERMISSIONS: Dict[str, List[str]] = {
    "farmer": list(
        STAGE1_TOOL_NAMES
        | STAGE2_TOOL_NAMES
        | STAGE3A_TOOL_NAMES
        | {
            "getSellingRecommendation",
            "getMySellingOpportunities",
            "compareSellingOptions",
            "getSellingPlan",
            "compareAnalyticsPeriods",
            "generateAnalyticsReport",
            "getMarketplaceAnalytics",
        }
        | STAGE3C1_TOOL_NAMES
        | STAGE3C2_TOOL_NAMES
        | STAGE3C3_TOOL_NAMES
        | STAGE3C4_TOOL_NAMES
        | VALUE_ADDITION_TOOL_NAMES
    ),
    "vendor": list(
        STAGE1_TOOL_NAMES
        | STAGE3A_TOOL_NAMES
        | {"getMyOrders", "getMarketplaceAnalytics"}
        | STAGE3C1_TOOL_NAMES
        | STAGE3C2_FOLLOWUP_TOOLS
        | STAGE3C3_TOOL_NAMES
        | STAGE3C4_SHARED_TOOLS  # vendors can only propose CANCEL_ORDER, SEND_MESSAGE
    ),
    "admin": list(
        STAGE1_TOOL_NAMES
        | STAGE2_TOOL_NAMES
        | STAGE3A_TOOL_NAMES
        | STAGE3B_TOOL_NAMES
        | STAGE3C1_TOOL_NAMES
        | STAGE3C2_TOOL_NAMES
        | STAGE3C3_TOOL_NAMES
        | STAGE3C4_TOOL_NAMES
        | VALUE_ADDITION_TOOL_NAMES
    ),
}


def get_allowed_tool_names_for_role(role: Optional[str]) -> List[str]:
    """Returns the list of tool names permitted for the given role."""
    if not role or not isinstance(role, str):
        return []
    return ROLE_PERMISSIONS.get(role.lower().strip(), [])


def is_tool_allowed(user_or_role: Union[str, Dict[str, Any], None], tool_name: str) -> bool:
    """
    Verifies execution-time authorization for a role (or user dict) and tool name.
    Accepts either role string or user dict.
    """
    if not user_or_role or not tool_name:
        return False

    if isinstance(user_or_role, dict):
        role_str = user_or_role.get("role")
    else:
        role_str = str(user_or_role)

    if not role_str or not isinstance(role_str, str):
        return False

    allowed = get_allowed_tool_names_for_role(role_str)
    return tool_name in allowed


def sanitize_tool_params(arg1: Any, arg2: Any, arg3: Any = None) -> Dict[str, Any]:
    """
    Sanitizes tool parameters, injects session location context as fallback,
    and CRITICALLY enforces authenticated user ownership.
    Prevents cross-user ID tampering:
    - Farmers: farmerId is FORCIBLY OVERWRITTEN with authenticated user.id
    - Vendors: vendorId is FORCIBLY OVERWRITTEN with authenticated user.id, farmerId is stripped
    - Admins: can inspect an explicit farmerId if supplied, or defaults to user.id
    """
    if isinstance(arg1, str):
        tool_name = arg1
        params = arg2 or {}
        user = arg3 or {}
    else:
        user = arg1 or {}
        tool_name = arg2 or ""
        params = arg3 or {}

    sanitized = dict(params or {})
    user_role = (user.get("role") or "").lower()
    user_id = str(user.get("id") or user.get("user_id") or "")

    # 1. Location fallback for geographic tools
    if tool_name in (
        "getWeatherAdvisory",
        "getMarketplaceOverview",
        "getNearbyProducts",
        "getNearbyBuyerOpportunities",
        "getSellingRecommendation",
        "getMySellingOpportunities",
        "compareSellingOptions",
        "getSellingPlan"
    ):
        if not sanitized.get("lat") and user.get("lat"):
            sanitized["lat"] = user["lat"]
        if not sanitized.get("lng") and user.get("lng"):
            sanitized["lng"] = user["lng"]
        if not sanitized.get("district") and user.get("district"):
            sanitized["district"] = user["district"]
        if not sanitized.get("region") and (user.get("region") or user.get("state")):
            sanitized["region"] = user.get("region") or user.get("state")

    # 2. Strict user context ownership enforcement (Anti-Spoofing Guard)
    if user_role == "farmer":
        # Farmer querying private sales, inventory, or analytics
        if tool_name in (
            "getMySales",
            "getMyInventory",
            "getMyFarmReport",
            "getMySalesAnalytics",
            "getMyInventoryAnalytics",
            "getMyProductPerformance",
            "getSellingRecommendation",
            "getMySellingOpportunities",
            "compareSellingOptions",
            "getSellingPlan",
            "compareAnalyticsPeriods",
            "generateAnalyticsReport"
        ):
            sanitized["farmerId"] = user_id

        if tool_name == "getMyOrders":
            sanitized["farmerId"] = user_id
            sanitized.pop("vendorId", None)

    elif user_role == "vendor":
        # Vendor querying orders: only their own purchases allowed
        if tool_name == "getMyOrders":
            sanitized["vendorId"] = user_id
        # Strip any farmerId to prevent vendor access to farmer private data (except public catalog lookup)
        if tool_name not in ("getFarmerProfile", "getFarmerProducts"):
            sanitized.pop("farmerId", None)

    elif user_role == "admin":
        # Admin can view specific farmer if requested, else default to own ID
        if not sanitized.get("farmerId") and tool_name in (
            "getMySales",
            "getMyInventory",
            "getMyFarmReport",
            "getMySalesAnalytics",
            "getMyInventoryAnalytics",
            "getMyProductPerformance",
            "getSellingRecommendation",
            "getMySellingOpportunities",
            "compareSellingOptions",
            "getSellingPlan",
            "compareAnalyticsPeriods",
            "generateAnalyticsReport"
        ):
            sanitized["farmerId"] = user_id

    # 3. Personal AI Memory, Goals, Follow-ups & Copilot Planner: Strictly enforce user isolation across all roles
    if tool_name in STAGE3C1_TOOL_NAMES or tool_name in STAGE3C2_TOOL_NAMES or tool_name in STAGE3C3_TOOL_NAMES:
        sanitized["userId"] = user_id

    # 4. Phase 3C-4 Action Proposal Tools: Enforce authenticated user identity.
    # Python MUST NOT trust any identity from proposal parameters.
    # Strip ALL identity override fields from proposal parameters.
    if tool_name in STAGE3C4_TOOL_NAMES:
        # Remove forbidden identity overrides from the passed parameters
        for field in ("userId", "farmerId", "vendorId", "accountId",
                      "user_id", "farmer_id", "vendor_id"):
            sanitized.pop(field, None)
        # Pass authenticated user to handler — handler itself uses user context not params

    return sanitized
