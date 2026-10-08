from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


class ToolExecutionResult(BaseModel):
    """Standardized tool execution envelope returned by tool dispatcher."""
    success: bool
    tool_name: str
    data: Optional[Any] = None
    error: Optional[Dict[str, str]] = None
    note: Optional[str] = None


# 1. searchProducts
class SearchProductsInput(BaseModel):
    queryText: Optional[str] = Field(default="", description="Crop or product name to search, e.g. 'Tomato', 'Onion'.")
    category: Optional[str] = Field(default="All", description="Produce category: 'Vegetables', 'Grains', 'Spices', 'Fruits', or 'All'.")
    organic: Optional[bool] = Field(default=False, description="Filter for certified organic produce.")
    maxPrice: Optional[float] = Field(default=None, ge=0, le=100000, description="Maximum price ceiling in INR per unit.")
    moq: Optional[float] = Field(default=None, ge=0, le=100000, description="Maximum acceptable Minimum Order Quantity.")


# 2. getProduct
class GetProductInput(BaseModel):
    id: str = Field(..., min_length=1, max_length=100, description="Unique product ID (e.g. 'p1', 'p2').")


# 3. getNearbyProducts
class GetNearbyProductsInput(BaseModel):
    district: Optional[str] = Field(default=None, max_length=100, description="District name (e.g. 'Nashik', 'Madurai').")
    region: Optional[str] = Field(default=None, max_length=100, description="State or administrative region (e.g. 'Tamil Nadu').")
    countryCode: Optional[str] = Field(default="IN", max_length=10, description="Two-letter country code (default 'IN').")


# 4. getFarmerProfile
class GetFarmerProfileInput(BaseModel):
    farmerId: str = Field(..., min_length=1, max_length=100, description="Unique ID of the farmer (e.g. 'f1', 'f2').")


# 5. getFarmerProducts
class GetFarmerProductsInput(BaseModel):
    farmerId: str = Field(..., min_length=1, max_length=100, description="Unique ID of the farmer.")


# 6. compareProducts
class CompareProductsInput(BaseModel):
    productIds: List[str] = Field(..., min_length=1, max_length=10, description="List of product IDs to compare.")

    @field_validator("productIds")
    @classmethod
    def validate_ids(cls, v: List[str]) -> List[str]:
        if not v:
            raise ValueError("productIds must contain at least one ID")
        return list(dict.fromkeys(str(pid).strip() for pid in v if str(pid).strip()))



# 7. getPriceInsights
class GetPriceInsightsInput(BaseModel):
    productId: Optional[str] = Field(default=None, max_length=100, description="Optional product ID to benchmark.")


# 8. getDemandInsights
class GetDemandInsightsInput(BaseModel):
    category: Optional[str] = Field(default="All", max_length=100, description="Produce category: 'Vegetables', 'Grains', etc.")


# 9. getWeatherAdvisory
class GetWeatherAdvisoryInput(BaseModel):
    district: Optional[str] = Field(default=None, max_length=100, description="District name.")
    region: Optional[str] = Field(default=None, max_length=100, description="State or administrative region.")
    crop: Optional[str] = Field(default=None, max_length=100, description="Target crop to contextualize weather risks.")
    lat: Optional[float] = Field(default=None, ge=-90.0, le=90.0, description="Latitude.")
    lng: Optional[float] = Field(default=None, ge=-180.0, le=180.0, description="Longitude.")


# 10. getPriceIntelligence
class GetPriceIntelligenceInput(BaseModel):
    commodity: Optional[str] = Field(default=None, max_length=100, description="Specific crop name (e.g. 'Tomato').")
    category: Optional[str] = Field(default=None, max_length=100, description="Category filter.")
    productId: Optional[str] = Field(default=None, max_length=100, description="Optional specific product ID.")


# 11. getDemandIntelligence
class GetDemandIntelligenceInput(BaseModel):
    category: Optional[str] = Field(default=None, max_length=100, description="Commodity category.")
    commodity: Optional[str] = Field(default=None, max_length=100, description="Specific crop name.")
    days: Optional[int] = Field(default=30, ge=1, le=365, description="Historical analysis window in days.")


# 12. getMarketplaceOverview
class GetMarketplaceOverviewInput(BaseModel):
    district: Optional[str] = Field(default=None, max_length=100, description="District name.")
    region: Optional[str] = Field(default=None, max_length=100, description="State or region.")


# 13. getMarketplaceAnalytics
class GetMarketplaceAnalyticsInput(BaseModel):
    commodity: Optional[str] = Field(default=None, max_length=100, description="Optional commodity or crop name.")
    period: Optional[str] = Field(default="30d", max_length=50, description="Time period ('7d', '30d', '90d', 'month').")
    startDate: Optional[str] = Field(default=None, max_length=50, description="Custom start date.")
    endDate: Optional[str] = Field(default=None, max_length=50, description="Custom end date.")


# -------------------------------------------------------------
# Phase 3B Stage 2: Authenticated Read-Only User & Analytics Schemas
# -------------------------------------------------------------

# 14. getMyOrders
class GetMyOrdersInput(BaseModel):
    limit: Optional[int] = Field(default=30, ge=1, le=100, description="Max recent orders to return.")
    vendorId: Optional[str] = Field(default=None, max_length=100, description="User ID (overridden by auth context).")
    farmerId: Optional[str] = Field(default=None, max_length=100, description="User ID (overridden by auth context).")


# 15. getMySales
class GetMySalesInput(BaseModel):
    farmerId: Optional[str] = Field(default=None, max_length=100, description="Farmer user ID (overridden by auth context).")


# 16. getMyInventory
class GetMyInventoryInput(BaseModel):
    farmerId: Optional[str] = Field(default=None, max_length=100, description="Farmer user ID (overridden by auth context).")


# 17. getMyFarmReport
class GetMyFarmReportInput(BaseModel):
    period: Optional[str] = Field(default="30d", max_length=50, description="Reporting period ('7d', '30d', '90d', 'month', 'last month').")
    startDate: Optional[str] = Field(default=None, max_length=50, description="Optional custom start date in ISO format.")
    endDate: Optional[str] = Field(default=None, max_length=50, description="Optional custom end date in ISO format.")
    farmerId: Optional[str] = Field(default=None, max_length=100, description="Farmer user ID (overridden by auth context).")


# 18. getMySalesAnalytics
class GetMySalesAnalyticsInput(BaseModel):
    period: Optional[str] = Field(default="30d", max_length=50, description="Time window ('7d', '30d', '90d', 'month', 'last month').")
    commodity: Optional[str] = Field(default=None, max_length=100, description="Optional produce or crop name to filter by.")
    startDate: Optional[str] = Field(default=None, max_length=50, description="Optional custom start date.")
    endDate: Optional[str] = Field(default=None, max_length=50, description="Optional custom end date.")
    farmerId: Optional[str] = Field(default=None, max_length=100, description="Farmer user ID (overridden by auth context).")


# 19. getMyInventoryAnalytics
class GetMyInventoryAnalyticsInput(BaseModel):
    farmerId: Optional[str] = Field(default=None, max_length=100, description="Farmer user ID (overridden by auth context).")


# 20. getMyProductPerformance
class GetMyProductPerformanceInput(BaseModel):
    productId: Optional[str] = Field(default=None, max_length=100, description="Optional specific product ID to evaluate.")
    period: Optional[str] = Field(default="30d", max_length=50, description="Time period ('7d', '30d', '90d', 'month').")
    startDate: Optional[str] = Field(default=None, max_length=50, description="Optional custom start date.")
    endDate: Optional[str] = Field(default=None, max_length=50, description="Optional custom end date.")
    farmerId: Optional[str] = Field(default=None, max_length=100, description="Farmer user ID (overridden by auth context).")


# -------------------------------------------------------------
# Phase 3B Stage 3A: Public & Regional Read-Only Schemas
# -------------------------------------------------------------

# 21. getNearbyBuyerOpportunities
class GetNearbyBuyerOpportunitiesInput(BaseModel):
    district: Optional[str] = Field(default=None, max_length=100, description="District name to filter unfulfilled buyer demand (e.g. 'Nashik', 'Madurai').")
    region: Optional[str] = Field(default=None, max_length=100, description="State or administrative region (e.g. 'Maharashtra', 'Tamil Nadu').")
    farmerId: Optional[str] = Field(default=None, max_length=100, description="Farmer user ID for fallback location (overridden by auth context).")


# -------------------------------------------------------------
# Phase 3B Stage 3B: Farmer Selling Strategy & Advanced Analytics Schemas
# -------------------------------------------------------------

# 22. getSellingRecommendation
class GetSellingRecommendationInput(BaseModel):
    commodity: Optional[str] = Field(default=None, max_length=100, description="Target crop or produce name (e.g. 'Tomato', 'Onion').")
    crop: Optional[str] = Field(default=None, max_length=100, description="Target crop or produce name alias (e.g. 'Tomato', 'Onion').")
    quantity: Optional[float] = Field(default=None, ge=0, le=1000000, description="Optional quantity in units to evaluate.")
    district: Optional[str] = Field(default=None, max_length=100, description="District name.")
    region: Optional[str] = Field(default=None, max_length=100, description="State or administrative region.")
    lat: Optional[float] = Field(default=None, ge=-90.0, le=90.0, description="Latitude.")
    lng: Optional[float] = Field(default=None, ge=-180.0, le=180.0, description="Longitude.")
    farmerId: Optional[str] = Field(default=None, max_length=100, description="Farmer user ID (overridden by auth context).")


# 23. getMySellingOpportunities
class GetMySellingOpportunitiesInput(BaseModel):
    district: Optional[str] = Field(default=None, max_length=100, description="District name.")
    region: Optional[str] = Field(default=None, max_length=100, description="State or administrative region.")
    limit: Optional[int] = Field(default=10, ge=1, le=50, description="Maximum opportunities to return.")
    farmerId: Optional[str] = Field(default=None, max_length=100, description="Farmer user ID (overridden by auth context).")


# 24. compareSellingOptions
class CompareSellingOptionsInput(BaseModel):
    commodities: Optional[List[str]] = Field(default=None, max_length=10, description="List of commodities to compare side-by-side (e.g. ['Tomato', 'Onion']).")
    crop: Optional[str] = Field(default=None, max_length=100, description="Single crop to compare.")
    district: Optional[str] = Field(default=None, max_length=100, description="District name.")
    region: Optional[str] = Field(default=None, max_length=100, description="State or administrative region.")
    farmerId: Optional[str] = Field(default=None, max_length=100, description="Farmer user ID (overridden by auth context).")


# 25. getSellingPlan
class GetSellingPlanInput(BaseModel):
    crop: Optional[str] = Field(default=None, max_length=100, description="Target crop to prioritize.")
    district: Optional[str] = Field(default=None, max_length=100, description="District name.")
    region: Optional[str] = Field(default=None, max_length=100, description="State or administrative region.")
    farmerId: Optional[str] = Field(default=None, max_length=100, description="Farmer user ID (overridden by auth context).")


# 26. compareAnalyticsPeriods
class CompareAnalyticsPeriodsInput(BaseModel):
    period: Optional[str] = Field(default="30d", max_length=50, description="Benchmark duration ('7d', '30d', '90d', 'month').")
    commodity: Optional[str] = Field(default=None, max_length=100, description="Optional crop filter.")
    period1: Optional[str] = Field(default=None, max_length=50, description="Optional custom period 1.")
    period2: Optional[str] = Field(default=None, max_length=50, description="Optional custom period 2.")
    farmerId: Optional[str] = Field(default=None, max_length=100, description="Farmer user ID (overridden by auth context).")


# 27. generateAnalyticsReport
class GenerateAnalyticsReportInput(BaseModel):
    reportType: Optional[str] = Field(default="FARM_PERFORMANCE", max_length=50, description="Report type ('FARM_PERFORMANCE', 'SALES', 'INVENTORY', 'MARKETPLACE', 'PLATFORM').")
    period: Optional[str] = Field(default="30d", max_length=50, description="Time duration ('7d', '30d', '90d', 'month').")
    commodity: Optional[str] = Field(default=None, max_length=100, description="Optional commodity filter.")
    startDate: Optional[str] = Field(default=None, max_length=50, description="Optional custom start date.")
    endDate: Optional[str] = Field(default=None, max_length=50, description="Optional custom end date.")
    farmerId: Optional[str] = Field(default=None, max_length=100, description="Farmer user ID (overridden by auth context).")


# 28. getPlatformAnalytics
class GetPlatformAnalyticsInput(BaseModel):
    pass


# 29. getPlatformAnalyticsReport
class GetPlatformAnalyticsReportInput(BaseModel):
    period: Optional[str] = Field(default="30d", max_length=50, description="Time window ('7d', '30d', '90d', 'month').")
    startDate: Optional[str] = Field(default=None, max_length=50, description="Optional custom start date.")
    endDate: Optional[str] = Field(default=None, max_length=50, description="Optional custom end date.")


# 30. getMyAiMemory
class GetMyAiMemoryInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    memoryType: Optional[str] = Field(
        default=None,
        max_length=50,
        description="Optional filter by memory type ('preference', 'crop_history', 'strategy', 'language', 'unit', 'general')."
    )


# 31. searchMyAiMemory
class SearchMyAiMemoryInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    query: str = Field(
        ...,
        min_length=1,
        max_length=200,
        description="Keyword or search query for memory lookup."
    )


# 32. getRelevantUserContext
class GetRelevantUserContextInput(BaseModel):
    model_config = ConfigDict(extra="ignore")


# 33. getMyFarmingGoals
class GetMyFarmingGoalsInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    status: Optional[str] = Field(
        default=None,
        max_length=50,
        description="Filter by goal status ('active', 'completed', 'overdue', 'cancelled')."
    )
    category: Optional[str] = Field(
        default=None,
        max_length=50,
        description="Filter by goal category ('selling', 'production', 'revenue', 'inventory')."
    )


# 34. getMyFollowUps
class GetMyFollowUpsInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    status: Optional[str] = Field(
        default="pending",
        max_length=50,
        description="Filter by status ('pending', 'completed', 'all')."
    )


# 35. getGoalProgress
class GetGoalProgressInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    goalId: str = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Unique ID of the farming goal to evaluate."
    )


# 36. executeCopilotPlan
class PlanStepInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    toolName: str = Field(..., min_length=1, max_length=100, description="Name of the tool to execute.")
    params: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Parameters for the tool.")
    description: Optional[str] = Field(default="", max_length=255, description="Description of the step.")


class ExecuteCopilotPlanInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    query: Optional[str] = Field(default="", max_length=500, description="User question or objective to plan, e.g. 'Should I sell my tomatoes this week?'")
    workflowIntent: Optional[str] = Field(default=None, max_length=100, description="Intent template ('SHOULD_I_SELL', 'FARM_HEALTH_AND_OPPORTUNITY', 'GOAL_PROGRESS_CHECK').")
    commodity: Optional[str] = Field(default=None, max_length=100, description="Target crop name.")
    crop: Optional[str] = Field(default=None, max_length=100, description="Alias for commodity.")
    customSteps: Optional[List[PlanStepInput]] = Field(default=None, description="Optional custom list of plan steps (max 10).")

    @field_validator("customSteps")
    @classmethod
    def validate_custom_steps_count(cls, v: Optional[List[PlanStepInput]]) -> Optional[List[PlanStepInput]]:
        if v is not None and len(v) > 10:
            raise ValueError("PLAN_STEP_LIMIT_EXCEEDED: Plan cannot exceed 10 steps.")
        return v


# ===========================================================================
# Phase 3C-4: Action Proposal Contract Tool Schemas
# Python FORMULATES proposals only — never executes mutations.
# ===========================================================================

# 37. proposeUpdateProductPrice
class ProposeUpdateProductPriceInput(BaseModel):
    """
    Proposal schema for updating a product's selling price.
    Python formulates proposal; Node validates, tokens, persists, and executes.
    """
    model_config = ConfigDict(extra="ignore")
    commodity: Optional[str] = Field(
        default=None, max_length=100,
        description="Produce name (e.g. 'Tomato', 'Onion'). Used to locate product if productId not supplied."
    )
    productId: Optional[str] = Field(
        default=None, max_length=100,
        description="Specific product ID. If provided, takes precedence over commodity."
    )
    newPrice: Optional[float] = Field(
        default=None, gt=0, le=100000,
        description="Proposed new price in INR per unit."
    )
    price: Optional[float] = Field(
        default=None, gt=0, le=100000,
        description="Alias for newPrice."
    )


# 38. proposeUpdateInventory
class ProposeUpdateInventoryInput(BaseModel):
    """
    Proposal schema for adjusting a product's inventory stock.
    Python formulates proposal; Node validates, tokens, persists, and executes.
    """
    model_config = ConfigDict(extra="ignore")
    commodity: Optional[str] = Field(
        default=None, max_length=100,
        description="Produce name to locate product if productId not supplied."
    )
    productId: Optional[str] = Field(
        default=None, max_length=100,
        description="Specific product ID."
    )
    quantityDelta: Optional[float] = Field(
        default=None,
        description="Relative change in stock (e.g. +20 or -10). Applied to current stock."
    )
    newStock: Optional[float] = Field(
        default=None, ge=0, le=1000000,
        description="Absolute new total stock quantity."
    )
    stock: Optional[float] = Field(
        default=None, ge=0, le=1000000,
        description="Alias for newStock."
    )


# 39. proposeCreateProductListing
class ProposeCreateProductListingInput(BaseModel):
    """
    Proposal schema for creating a new product listing.
    Python formulates proposal; Node validates, tokens, persists, and executes the INSERT.
    farmerId is ALWAYS derived from authenticated session in Node — not from parameters.
    """
    model_config = ConfigDict(extra="ignore")
    name: str = Field(
        ..., min_length=1, max_length=200,
        description="Crop or produce title (e.g. 'Organic Tomatoes')."
    )
    category: Optional[str] = Field(
        default="Vegetables", max_length=100,
        description="Produce category: 'Vegetables', 'Grains', 'Spices', 'Fruits'."
    )
    price: float = Field(
        ..., gt=0, le=100000,
        description="Price in INR per unit."
    )
    stock: float = Field(
        ..., gt=0, le=1000000,
        description="Available quantity to list."
    )
    unit: Optional[str] = Field(
        default="kg", max_length=50,
        description="Produce unit (default 'kg')."
    )
    organic: Optional[bool] = Field(
        default=False,
        description="Whether the produce is certified organic."
    )
    description: Optional[str] = Field(
        default=None, max_length=1000,
        description="Optional produce description."
    )
    moq: Optional[float] = Field(
        default=10, ge=1, le=10000,
        description="Minimum order quantity."
    )


# 40. proposeCancelOrder
class ProposeCancelOrderInput(BaseModel):
    """
    Proposal schema for cancelling a pending order.
    Python formulates proposal; Node validates, tokens, persists, and executes with transaction.
    """
    model_config = ConfigDict(extra="ignore")
    orderId: str = Field(
        ..., min_length=1, max_length=100,
        description="Order ID to cancel."
    )
    reason: Optional[str] = Field(
        default=None, max_length=500,
        description="Reason for cancellation."
    )


# 41. proposeSendMessage
class ProposeSendMessageInput(BaseModel):
    """
    Proposal schema for sending a marketplace message.
    Python formulates proposal; Node validates, tokens, persists, and executes the INSERT.
    senderId is ALWAYS derived from authenticated session in Node — not from parameters.
    """
    model_config = ConfigDict(extra="ignore")
    message: str = Field(
        ..., min_length=1, max_length=2000,
        description="Message text to send."
    )
    conversationId: Optional[str] = Field(
        default=None, max_length=100,
        description="Active conversation ID. If not provided, recipientId is used to locate conversation."
    )
    recipientId: Optional[str] = Field(
        default=None, max_length=100,
        description="Recipient user ID. Used if conversationId not supplied."
    )


# 42. getValueAdditionRecommendations
class GetValueAdditionRecommendationsInput(BaseModel):
    crop_name: Optional[str] = Field(default=None, max_length=100, description="Harvest crop name (e.g. 'Groundnut', 'Tomato', 'Rice').")
    category: Optional[str] = Field(default=None, max_length=100, description="Product category (e.g. 'Edible Oils', 'Flour & Milling').")


# 43. getValueAdditionProductDetails
class GetValueAdditionProductDetailsInput(BaseModel):
    product_id: Optional[str] = Field(default=None, max_length=100, description="Value addition product ID.")
    product_name: Optional[str] = Field(default=None, max_length=255, description="Value addition product name.")


# 44. getValueAdditionProcessingGuide
class GetValueAdditionProcessingGuideInput(BaseModel):
    product_id: Optional[str] = Field(default=None, max_length=100, description="Value addition product ID.")
    product_name: Optional[str] = Field(default=None, max_length=255, description="Value addition product name.")
    crop_name: Optional[str] = Field(default=None, max_length=100, description="Harvest crop name.")


# 45. calculateValueAdditionEconomics
class CalculateValueAdditionEconomicsInput(BaseModel):
    raw_quantity: float = Field(..., ge=0, description="Raw crop harvest quantity in kg.")
    raw_unit_price: float = Field(..., ge=0, description="Raw crop selling price per kg in INR.")
    product_id: Optional[str] = Field(default=None, max_length=100, description="Optional target value addition product ID.")
    processing_cost: Optional[float] = Field(default=0.0, ge=0, description="Processing machinery/energy cost in INR.")
    labour_cost: Optional[float] = Field(default=0.0, ge=0, description="Labour cost in INR.")
    packaging_cost: Optional[float] = Field(default=0.0, ge=0, description="Packaging material cost in INR.")
    transport_cost: Optional[float] = Field(default=0.0, ge=0, description="Transport cost in INR.")
    other_costs: Optional[float] = Field(default=0.0, ge=0, description="Other miscellaneous costs in INR.")
    expected_output_quantity: Optional[float] = Field(default=None, ge=0, description="Expected processed output quantity in kg.")
    expected_selling_price: Optional[float] = Field(default=None, ge=0, description="Expected selling price of processed product per kg in INR.")


# 46. getCropKnowledge
class GetCropKnowledgeInput(BaseModel):
    crop_name: Optional[str] = Field(default=None, max_length=100, description="Crop name (e.g. 'Rice', 'Maize', 'Tomato').")
    category: Optional[str] = Field(default=None, max_length=100, description="Crop category (e.g. 'Cereals', 'Vegetables').")


# 47. getSoilCropCompatibility
class GetSoilCropCompatibilityInput(BaseModel):
    soil_type: Optional[str] = Field(default=None, max_length=100, description="Soil texture type (e.g. 'Clay Loam', 'Sandy Loam').")
    ph: Optional[float] = Field(default=None, description="Soil pH value.")
    season: Optional[str] = Field(default=None, max_length=50, description="Target cultivation season.")
    water_availability: Optional[str] = Field(default=None, max_length=100, description="Water availability level.")


# 48. getCropCalendar
class GetCropCalendarInput(BaseModel):
    crop_name: str = Field(..., min_length=1, max_length=100, description="Crop name (e.g. 'Rice', 'Groundnut').")


# 49. getCropRotationRecommendations
class GetCropRotationRecommendationsInput(BaseModel):
    previous_crop: str = Field(..., min_length=1, max_length=100, description="Previous crop harvested.")


# 50. getCropIrrigationGuide
class GetCropIrrigationGuideInput(BaseModel):
    crop_name: str = Field(..., min_length=1, max_length=100, description="Target crop name.")


# 51. getCropNutrientGuide
class GetCropNutrientGuideInput(BaseModel):
    crop_name: str = Field(..., min_length=1, max_length=100, description="Target crop name.")


# 52. getCropPestDiseaseGuide
class GetCropPestDiseaseGuideInput(BaseModel):
    crop_name: str = Field(..., min_length=1, max_length=100, description="Target crop name.")


# 53. getFarmPlannerRecommendations
class GetFarmPlannerRecommendationsInput(BaseModel):
    district: Optional[str] = Field(default=None, max_length=100, description="District location.")
    soil_type: Optional[str] = Field(default=None, max_length=100, description="Soil texture type.")
    season: Optional[str] = Field(default=None, max_length=50, description="Target season.")
    water_availability: Optional[str] = Field(default=None, max_length=100, description="Water availability level.")
    previous_crop: Optional[str] = Field(default=None, max_length=100, description="Previous crop.")

