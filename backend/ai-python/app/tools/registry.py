"""
Tool Registry for Python AI Tools.
Single source of truth for all migrated Python AI tools.
"""

from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional, Type
from pydantic import BaseModel

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
    GetMyOrdersInput,
    GetMySalesInput,
    GetMyInventoryInput,
    GetMyFarmReportInput,
    GetMySalesAnalyticsInput,
    GetMyInventoryAnalyticsInput,
    GetMyProductPerformanceInput,
    GetNearbyBuyerOpportunitiesInput,
    GetSellingRecommendationInput,
    GetMySellingOpportunitiesInput,
    CompareSellingOptionsInput,
    GetSellingPlanInput,
    CompareAnalyticsPeriodsInput,
    GenerateAnalyticsReportInput,
    GetPlatformAnalyticsInput,
    GetPlatformAnalyticsReportInput,
    GetMyAiMemoryInput,
    SearchMyAiMemoryInput,
    GetRelevantUserContextInput,
    GetMyFarmingGoalsInput,
    GetMyFollowUpsInput,
    GetGoalProgressInput,
    ExecuteCopilotPlanInput,
    # Phase 3C-4 Action Proposal Schemas
    ProposeUpdateProductPriceInput,
    ProposeUpdateInventoryInput,
    ProposeCreateProductListingInput,
    ProposeCancelOrderInput,
    ProposeSendMessageInput,
    # Phase A Value Addition Schemas
    GetValueAdditionRecommendationsInput,
    GetValueAdditionProductDetailsInput,
    GetValueAdditionProcessingGuideInput,
    CalculateValueAdditionEconomicsInput,
    # Phase B Farming Guide Schemas
    GetCropKnowledgeInput,
    GetSoilCropCompatibilityInput,
    GetCropCalendarInput,
    GetCropRotationRecommendationsInput,
    GetCropIrrigationGuideInput,
    GetCropNutrientGuideInput,
    GetCropPestDiseaseGuideInput,
    GetFarmPlannerRecommendationsInput,
)
from app.tools.read_tools.value_addition_query import (
    get_value_addition_recommendations,
    get_value_addition_product_details,
    get_value_addition_processing_guide,
    calculate_value_addition_economics,
)
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
from app.tools.read_tools.marketplace_query import (
    search_products,
    get_product,
    get_nearby_products,
    compare_products,
    get_nearby_buyer_opportunities,
)
from app.tools.read_tools.farmer_query import (
    get_farmer_profile,
    get_farmer_products,
)
from app.tools.read_tools.intelligence import (
    get_price_insights,
    get_demand_insights,
    get_price_intelligence,
    get_demand_intelligence,
    get_marketplace_overview,
    get_marketplace_analytics,
)
from app.tools.external_tools.weather import get_weather_advisory
from app.tools.read_tools.user_analytics import (
    get_my_orders,
    get_my_sales,
    get_my_inventory,
    get_farmer_sales_analytics,
    get_farmer_inventory_analytics,
    get_product_performance,
    get_farm_performance_report,
    compare_analytics_periods,
    get_platform_analytics,
    get_platform_wide_analytics,
    generate_analytics_report,
)
from app.tools.read_tools.selling_strategy import (
    get_selling_recommendation,
    get_my_selling_opportunities,
    handle_compare_selling_options,
    get_selling_plan,
)
from app.tools.read_tools.copilot_memory import (
    get_my_ai_memory,
    search_my_ai_memory,
    get_relevant_user_context,
)
from app.tools.read_tools.copilot_tasks import (
    get_my_farming_goals,
    get_my_follow_ups,
    get_goal_progress,
)
from app.tools.read_tools.copilot_planner import (
    execute_copilot_plan,
)
from app.tools.action_proposal.proposal_tools import (
    propose_update_product_price,
    propose_update_inventory,
    propose_create_product_listing,
    propose_cancel_order,
    propose_send_message,
)



@dataclass
class ToolDefinition:
    name: str
    description: str
    input_schema: Type[BaseModel]
    handler: Callable[..., Any]
    required_roles: List[str]
    classification: str = "read"
    security_level: str = "public_catalog"

    def get_parameters_json_schema(self) -> Dict[str, Any]:
        """Convert Pydantic model schema to standard parameter schema dictionary."""
        raw_schema = self.input_schema.model_json_schema()
        properties: Dict[str, Any] = {}
        for prop_name, prop_data in raw_schema.get("properties", {}).items():
            prop_type = prop_data.get("type", "string")
            p_desc = prop_data.get("description", "")
            
            prop_def: Dict[str, Any] = {
                "type": prop_type,
                "description": p_desc,
            }
            if prop_type == "array" and "items" in prop_data:
                prop_def["items"] = prop_data["items"]
            if "enum" in prop_data:
                prop_def["enum"] = prop_data["enum"]

            properties[prop_name] = prop_def

        return {
            "type": "object",
            "properties": properties,
            "required": raw_schema.get("required", []),
        }


# Define the 13 Read-Only Tools for Phase 3B Stage 1
TOOL_REGISTRY: Dict[str, ToolDefinition] = {
    "searchProducts": ToolDefinition(
        name="searchProducts",
        description="Search products in the marketplace catalog with filters for keyword, crop, category, price, organic status, MOQ, and sort order.",
        input_schema=SearchProductsInput,
        handler=search_products,
        required_roles=["farmer", "vendor", "admin"],
        classification="read",
        security_level="public_catalog",
    ),
    "getProduct": ToolDefinition(
        name="getProduct",
        description="Get full public details for a single product by product ID.",
        input_schema=GetProductInput,
        handler=get_product,
        required_roles=["farmer", "vendor", "admin"],
        classification="read",
        security_level="public_catalog",
    ),
    "getNearbyProducts": ToolDefinition(
        name="getNearbyProducts",
        description="Get products available near a location, district, state, or within a maximum radius.",
        input_schema=GetNearbyProductsInput,
        handler=get_nearby_products,
        required_roles=["farmer", "vendor", "admin"],
        classification="read",
        security_level="public_catalog",
    ),
    "getFarmerProfile": ToolDefinition(
        name="getFarmerProfile",
        description="Get the public profile and reputation for a farmer by user ID. Private security fields are scrubbed.",
        input_schema=GetFarmerProfileInput,
        handler=get_farmer_profile,
        required_roles=["farmer", "vendor", "admin"],
        classification="read",
        security_level="public_farmer_profile",
    ),
    "getFarmerProducts": ToolDefinition(
        name="getFarmerProducts",
        description="List active public products listed by a specific farmer user ID.",
        input_schema=GetFarmerProductsInput,
        handler=get_farmer_products,
        required_roles=["farmer", "vendor", "admin"],
        classification="read",
        security_level="public_catalog",
    ),
    "compareProducts": ToolDefinition(
        name="compareProducts",
        description="Compare 2 to 4 products side by side by their product IDs.",
        input_schema=CompareProductsInput,
        handler=compare_products,
        required_roles=["farmer", "vendor", "admin"],
        classification="read",
        security_level="public_catalog",
    ),
    "getPriceInsights": ToolDefinition(
        name="getPriceInsights",
        description="Get marketplace price trends, min/max/average prices, and active listing count for a crop.",
        input_schema=GetPriceInsightsInput,
        handler=get_price_insights,
        required_roles=["farmer", "vendor", "admin"],
        classification="read",
        security_level="public_analytics",
    ),
    "getDemandInsights": ToolDefinition(
        name="getDemandInsights",
        description="Get marketplace demand trends, order volumes, and fulfillment status for a crop.",
        input_schema=GetDemandInsightsInput,
        handler=get_demand_insights,
        required_roles=["farmer", "vendor", "admin"],
        classification="read",
        security_level="public_analytics",
    ),
    "getWeatherAdvisory": ToolDefinition(
        name="getWeatherAdvisory",
        description="Get agricultural weather advisory, risk assessment, and forecast for a district and crop via Open-Meteo.",
        input_schema=GetWeatherAdvisoryInput,
        handler=get_weather_advisory,
        required_roles=["farmer", "vendor", "admin"],
        classification="read",
        security_level="external_api",
    ),
    "getPriceIntelligence": ToolDefinition(
        name="getPriceIntelligence",
        description="Get current price intelligence, suggested prices, and spread for a crop in a district. Returns hasData=false if no listings exist.",
        input_schema=GetPriceIntelligenceInput,
        handler=get_price_intelligence,
        required_roles=["farmer", "vendor", "admin"],
        classification="read",
        security_level="public_analytics",
    ),
    "getDemandIntelligence": ToolDefinition(
        name="getDemandIntelligence",
        description="Get demand intelligence, momentum, and volume trends for a crop. Returns hasSufficientData=false if insufficient order data.",
        input_schema=GetDemandIntelligenceInput,
        handler=get_demand_intelligence,
        required_roles=["farmer", "vendor", "admin"],
        classification="read",
        security_level="public_analytics",
    ),
    "getMarketplaceOverview": ToolDefinition(
        name="getMarketplaceOverview",
        description="Get aggregate marketplace metrics, active counts, and category breakdown.",
        input_schema=GetMarketplaceOverviewInput,
        handler=get_marketplace_overview,
        required_roles=["farmer", "vendor", "admin"],
        classification="read",
        security_level="public_analytics",
    ),
    "getMarketplaceAnalytics": ToolDefinition(
        name="getMarketplaceAnalytics",
        description="Get high-level marketplace analytics, sales totals, and listing trends across date ranges.",
        input_schema=GetMarketplaceAnalyticsInput,
        handler=get_marketplace_analytics,
        required_roles=["farmer", "vendor", "admin"],
        classification="read",
        security_level="public_analytics",
    ),
    "getMyOrders": ToolDefinition(
        name="getMyOrders",
        description="Retrieve recent orders and fulfillment statuses for the authenticated user (purchases for vendors, sales for farmers).",
        input_schema=GetMyOrdersInput,
        handler=get_my_orders,
        required_roles=["farmer", "vendor", "admin"],
        classification="read",
        security_level="private_user",
    ),
    "getMySales": ToolDefinition(
        name="getMySales",
        description="Retrieve comprehensive sales performance metrics for the authenticated farmer: total revenue, completed orders count, quantity sold, and top selling products.",
        input_schema=GetMySalesInput,
        handler=get_my_sales,
        required_roles=["farmer", "admin"],
        classification="read",
        security_level="private_farmer",
    ),
    "getMyInventory": ToolDefinition(
        name="getMyInventory",
        description="Check the authenticated farmer's listed produce inventory, current stock levels, units, and MOQ restock thresholds.",
        input_schema=GetMyInventoryInput,
        handler=get_my_inventory,
        required_roles=["farmer", "admin"],
        classification="read",
        security_level="private_farmer",
    ),
    "getMyFarmReport": ToolDefinition(
        name="getMyFarmReport",
        description="Generate a comprehensive farm performance report for the authenticated farmer including product catalog, sales revenue, inventory health, order fulfillment rates, ASP, and weather risks.",
        input_schema=GetMyFarmReportInput,
        handler=get_farm_performance_report,
        required_roles=["farmer", "admin"],
        classification="read",
        security_level="private_farmer_report",
    ),
    "getMySalesAnalytics": ToolDefinition(
        name="getMySalesAnalytics",
        description="Retrieve comprehensive sales metrics, gross revenue, quantity sold, order count, ASP, top crops, and daily sales trend for the farmer.",
        input_schema=GetMySalesAnalyticsInput,
        handler=get_farmer_sales_analytics,
        required_roles=["farmer", "admin"],
        classification="read",
        security_level="private_farmer_report",
    ),
    "getMyInventoryAnalytics": ToolDefinition(
        name="getMyInventoryAnalytics",
        description="Analyze farmer warehouse stock, low-stock items, slow-moving crops, recently sold products, and produce category distribution.",
        input_schema=GetMyInventoryAnalyticsInput,
        handler=get_farmer_inventory_analytics,
        required_roles=["farmer", "admin"],
        classification="read",
        security_level="private_farmer_report",
    ),
    "getMyProductPerformance": ToolDefinition(
        name="getMyProductPerformance",
        description="Evaluate product-level sales velocity, realized average price, order count, and gross revenue breakdown across produce listings.",
        input_schema=GetMyProductPerformanceInput,
        handler=get_product_performance,
        required_roles=["farmer", "admin"],
        classification="read",
        security_level="private_farmer_report",
    ),
    "getNearbyBuyerOpportunities": ToolDefinition(
        name="getNearbyBuyerOpportunities",
        description="Retrieve unfulfilled buyer orders near farmer location. Private buyer credentials and personal addresses are strictly stripped.",
        input_schema=GetNearbyBuyerOpportunitiesInput,
        handler=get_nearby_buyer_opportunities,
        required_roles=["farmer", "vendor", "admin"],
        classification="read",
        security_level="regional_marketplace",
    ),
    "getSellingRecommendation": ToolDefinition(
        name="getSellingRecommendation",
        description="Generate an authoritative, fact-based selling strategy for a crop, evaluating prices, active demand, inventory, and competitive listings.",
        input_schema=GetSellingRecommendationInput,
        handler=get_selling_recommendation,
        required_roles=["farmer", "admin"],
        classification="read",
        security_level="private_farmer_report",
    ),
    "getMySellingOpportunities": ToolDefinition(
        name="getMySellingOpportunities",
        description="Detect real-time selling opportunities matching the farmer's inventory with active buyer orders, demand requests, and premium pricing windows.",
        input_schema=GetMySellingOpportunitiesInput,
        handler=get_my_selling_opportunities,
        required_roles=["farmer", "admin"],
        classification="read",
        security_level="private_farmer_report",
    ),
    "compareSellingOptions": ToolDefinition(
        name="compareSellingOptions",
        description="Compare selling channels (spot marketplace vs direct buyer orders vs holding inventory) evaluating net margin, liquidity speed, and risks.",
        input_schema=CompareSellingOptionsInput,
        handler=handle_compare_selling_options,
        required_roles=["farmer", "admin"],
        classification="read",
        security_level="private_farmer_report",
    ),
    "getSellingPlan": ToolDefinition(
        name="getSellingPlan",
        description="Generate a multi-step selling schedule across active harvest batches, balancing revenue maximization with crop perishability risks.",
        input_schema=GetSellingPlanInput,
        handler=get_selling_plan,
        required_roles=["farmer", "admin"],
        classification="read",
        security_level="private_farmer_report",
    ),
    "compareAnalyticsPeriods": ToolDefinition(
        name="compareAnalyticsPeriods",
        description="Compare business performance between two distinct date ranges, calculating revenue, volume, margin, and order changes without fabrication.",
        input_schema=CompareAnalyticsPeriodsInput,
        handler=compare_analytics_periods,
        required_roles=["farmer", "admin"],
        classification="read",
        security_level="private_farmer_analytics",
    ),
    "generateAnalyticsReport": ToolDefinition(
        name="generateAnalyticsReport",
        description="Generate comprehensive structured analytics report (sales, inventory, financial, or platform) across a specified timeframe.",
        input_schema=GenerateAnalyticsReportInput,
        handler=generate_analytics_report,
        required_roles=["farmer", "admin"],
        classification="read",
        security_level="analytics_report",
    ),
    "getMarketplaceAnalytics": ToolDefinition(
        name="getMarketplaceAnalytics",
        description="Aggregate regional or category-level marketplace analytics including trading GMV, average price trends, and demand/supply ratios.",
        input_schema=GetMarketplaceAnalyticsInput,
        handler=get_marketplace_analytics,
        required_roles=["farmer", "vendor", "admin"],
        classification="read",
        security_level="marketplace_analytics",
    ),
    "getPlatformAnalytics": ToolDefinition(
        name="getPlatformAnalytics",
        description="Retrieve platform-wide operational KPIs, user counts, total GMV, fulfillment rates, and disputed orders. Admin access only.",
        input_schema=GetPlatformAnalyticsInput,
        handler=get_platform_analytics,
        required_roles=["admin"],
        classification="read",
        security_level="platform_analytics",
    ),
    "getPlatformAnalyticsReport": ToolDefinition(
        name="getPlatformAnalyticsReport",
        description="Generate full platform-wide macro health and volume report across all districts and product categories. Admin access only.",
        input_schema=GetPlatformAnalyticsReportInput,
        handler=get_platform_wide_analytics,
        required_roles=["admin"],
        classification="read",
        security_level="platform_analytics",
    ),
    "getMyAiMemory": ToolDefinition(
        name="getMyAiMemory",
        description="Retrieve user's saved personal preferences, past crops, and copilot memory records.",
        input_schema=GetMyAiMemoryInput,
        handler=get_my_ai_memory,
        required_roles=["farmer", "vendor", "admin"],
        classification="read",
        security_level="user_memory",
    ),
    "searchMyAiMemory": ToolDefinition(
        name="searchMyAiMemory",
        description="Search user's saved personal preferences or memory records by keyword.",
        input_schema=SearchMyAiMemoryInput,
        handler=search_my_ai_memory,
        required_roles=["farmer", "vendor", "admin"],
        classification="read",
        security_level="user_memory",
    ),
    "getRelevantUserContext": ToolDefinition(
        name="getRelevantUserContext",
        description="Retrieve comprehensive summary of user profile, saved preferences, active goals, and ongoing farming context.",
        input_schema=GetRelevantUserContextInput,
        handler=get_relevant_user_context,
        required_roles=["farmer", "vendor", "admin"],
        classification="read",
        security_level="user_memory",
    ),
    "getMyFarmingGoals": ToolDefinition(
        name="getMyFarmingGoals",
        description="Retrieve farmer's active, completed, or overdue agricultural and selling goals.",
        input_schema=GetMyFarmingGoalsInput,
        handler=get_my_farming_goals,
        required_roles=["farmer", "admin"],
        classification="read",
        security_level="farmer_goals",
    ),
    "getMyFollowUps": ToolDefinition(
        name="getMyFollowUps",
        description="Retrieve pending farming tasks, weather alerts, and copilot reminders.",
        input_schema=GetMyFollowUpsInput,
        handler=get_my_follow_ups,
        required_roles=["farmer", "vendor", "admin"],
        classification="read",
        security_level="user_followups",
    ),
    "getGoalProgress": ToolDefinition(
        name="getGoalProgress",
        description="Calculate and inspect progress of a farming goal against verified platform sales and inventory data.",
        input_schema=GetGoalProgressInput,
        handler=get_goal_progress,
        required_roles=["farmer", "admin"],
        classification="read",
        security_level="farmer_goals",
    ),
    "executeCopilotPlan": ToolDefinition(
        name="executeCopilotPlan",
        description="Execute a multi-step read-only plan coordinating inventory, prices, demand, weather, and selling guidance.",
        input_schema=ExecuteCopilotPlanInput,
        handler=execute_copilot_plan,
        required_roles=["farmer", "vendor", "admin"],
        classification="read",
        security_level="copilot_planner",
    ),
    # Phase 3C-4 Action Proposal Tools
    # Python formulates structured proposals — Node executes all mutations.
    "proposeUpdateProductPrice": ToolDefinition(
        name="proposeUpdateProductPrice",
        description="Formulate a structured proposal to update a farmer's product listing price. Returns a ProposalContract for Node validation and execution. NEVER executes mutations or generates tokens.",
        input_schema=ProposeUpdateProductPriceInput,
        handler=propose_update_product_price,
        required_roles=["farmer", "admin"],
        classification="proposal",
        security_level="action_proposal",
    ),
    "proposeUpdateInventory": ToolDefinition(
        name="proposeUpdateInventory",
        description="Formulate a structured proposal to adjust a farmer's product inventory stock. Returns a ProposalContract for Node validation and execution. NEVER executes mutations or generates tokens.",
        input_schema=ProposeUpdateInventoryInput,
        handler=propose_update_inventory,
        required_roles=["farmer", "admin"],
        classification="proposal",
        security_level="action_proposal",
    ),
    "proposeCreateProductListing": ToolDefinition(
        name="proposeCreateProductListing",
        description="Formulate a structured proposal to create a new marketplace product listing. Returns a ProposalContract for Node validation and execution. NEVER executes mutations or generates tokens.",
        input_schema=ProposeCreateProductListingInput,
        handler=propose_create_product_listing,
        required_roles=["farmer", "admin"],
        classification="proposal",
        security_level="action_proposal",
    ),
    "proposeCancelOrder": ToolDefinition(
        name="proposeCancelOrder",
        description="Formulate a structured proposal to cancel a pending order. Returns a ProposalContract for Node validation and execution. NEVER executes mutations, row locks, or order state changes.",
        input_schema=ProposeCancelOrderInput,
        handler=propose_cancel_order,
        required_roles=["farmer", "vendor", "admin"],
        classification="proposal",
        security_level="action_proposal",
    ),
    "proposeSendMessage": ToolDefinition(
        name="proposeSendMessage",
        description="Formulate a structured proposal to send a marketplace message to a counterparty. Returns a ProposalContract for Node validation and execution. NEVER executes mutations or message inserts.",
        input_schema=ProposeSendMessageInput,
        handler=propose_send_message,
        required_roles=["farmer", "vendor", "admin"],
        classification="proposal",
        security_level="action_proposal",
    ),
    "getValueAdditionRecommendations": ToolDefinition(
        name="getValueAdditionRecommendations",
        description="Get value-added product recommendations for a specific harvest crop or category (e.g. Groundnut, Tomato, Rice, Millets). Returns products, processing methods, yield %, and value multipliers.",
        input_schema=GetValueAdditionRecommendationsInput,
        handler=get_value_addition_recommendations,
        required_roles=["farmer", "admin"],
        classification="read_only",
        security_level="safe_read",
    ),
    "getValueAdditionProductDetails": ToolDefinition(
        name="getValueAdditionProductDetails",
        description="Fetch complete details for a value-added product including processing guide, equipment list, packaging, storage parameters, and mapped government schemes.",
        input_schema=GetValueAdditionProductDetailsInput,
        handler=get_value_addition_product_details,
        required_roles=["farmer", "admin"],
        classification="read_only",
        security_level="safe_read",
    ),
    "getValueAdditionProcessingGuide": ToolDefinition(
        name="getValueAdditionProcessingGuide",
        description="Get step-by-step processing guide stages and equipment requirements for converting raw crop into value-added products.",
        input_schema=GetValueAdditionProcessingGuideInput,
        handler=get_value_addition_processing_guide,
        required_roles=["farmer", "admin"],
        classification="read_only",
        security_level="safe_read",
    ),
    "calculateValueAdditionEconomics": ToolDefinition(
        name="calculateValueAdditionEconomics",
        description="Calculate financial ROI and profit comparison for processing raw crop harvest into value-added products based on actual catalog yield metrics or custom inputs.",
        input_schema=CalculateValueAdditionEconomicsInput,
        handler=calculate_value_addition_economics,
        required_roles=["farmer", "admin"],
        classification="read_only",
        security_level="safe_read",
    ),
    # Phase B Farming Guide Tools
    "getCropKnowledge": ToolDefinition(
        name="getCropKnowledge",
        description="Get authoritative agronomic crop details, soil texture, pH range, and duration from verified agricultural database.",
        input_schema=GetCropKnowledgeInput,
        handler=get_crop_knowledge,
        required_roles=["farmer", "vendor", "admin"],
        classification="read_only",
        security_level="safe_read",
    ),
    "getSoilCropCompatibility": ToolDefinition(
        name="getSoilCropCompatibility",
        description="Evaluate deterministic soil compatibility score (HIGH/MEDIUM/LOW) and agronomic conditions for crops.",
        input_schema=GetSoilCropCompatibilityInput,
        handler=get_soil_crop_compatibility,
        required_roles=["farmer", "vendor", "admin"],
        classification="read_only",
        security_level="safe_read",
    ),
    "getCropCalendar": ToolDefinition(
        name="getCropCalendar",
        description="Get growth stage sequence timeline and farmer activities for a specific crop.",
        input_schema=GetCropCalendarInput,
        handler=get_crop_calendar,
        required_roles=["farmer", "vendor", "admin"],
        classification="read_only",
        security_level="safe_read",
    ),
    "getCropRotationRecommendations": ToolDefinition(
        name="getCropRotationRecommendations",
        description="Get recommended crop rotation rules, soil benefits, and crops to avoid based on previous crop.",
        input_schema=GetCropRotationRecommendationsInput,
        handler=get_crop_rotation_recommendations,
        required_roles=["farmer", "admin"],
        classification="read_only",
        security_level="safe_read",
    ),
    "getCropIrrigationGuide": ToolDefinition(
        name="getCropIrrigationGuide",
        description="Get crop water requirement, critical growth stages, and rainfall advice integration.",
        input_schema=GetCropIrrigationGuideInput,
        handler=get_crop_irrigation_guide,
        required_roles=["farmer", "admin"],
        classification="read_only",
        security_level="safe_read",
    ),
    "getCropNutrientGuide": ToolDefinition(
        name="getCropNutrientGuide",
        description="Get NPK recommendation, micronutrient management, deficiency symptoms, and soil test mandatory notice.",
        input_schema=GetCropNutrientGuideInput,
        handler=get_crop_nutrient_guide,
        required_roles=["farmer", "admin"],
        classification="read_only",
        security_level="safe_read",
    ),
    "getCropPestDiseaseGuide": ToolDefinition(
        name="getCropPestDiseaseGuide",
        description="Get major crop pests/diseases, symptoms, and integrated pest management procedures with safety disclaimer.",
        input_schema=GetCropPestDiseaseGuideInput,
        handler=get_crop_pest_disease_guide,
        required_roles=["farmer", "admin"],
        classification="read_only",
        security_level="safe_read",
    ),
    "getFarmPlannerRecommendations": ToolDefinition(
        name="getFarmPlannerRecommendations",
        description="Execute multi-factor crop ranking for signature 'What Should I Farm?' planner combining soil, water, season, and rotation.",
        input_schema=GetFarmPlannerRecommendationsInput,
        handler=get_farm_planner_recommendations,
        required_roles=["farmer", "admin"],
        classification="read_only",
        security_level="safe_read",
    ),
}



def get_tool(tool_name: str) -> Optional[ToolDefinition]:
    """Retrieve a tool definition by name."""
    return TOOL_REGISTRY.get(tool_name)


def list_tools() -> List[ToolDefinition]:
    """List all registered tools."""
    return list(TOOL_REGISTRY.values())


def get_tools_for_role(role: str) -> List[Dict[str, Any]]:
    """
    Generate tool declarations as standard Python dictionaries containing function declarations
    permitted for the given user role.
    """
    tools: List[Dict[str, Any]] = []
    for tool_name, tool_def in TOOL_REGISTRY.items():
        if role in tool_def.required_roles:
            tools.append({
                "name": tool_def.name,
                "description": tool_def.description,
                "parameters": tool_def.get_parameters_json_schema(),
            })
    return tools


def get_gemini_tools_for_role(role: str) -> List[Dict[str, Any]]:
    """
    Backward-compatible alias for get_tools_for_role.
    """
    return get_tools_for_role(role)
