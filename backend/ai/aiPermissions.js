/**
 * Role-Based Access Control and Permission Scoping for AI Tools
 */

const ROLE_PERMISSIONS = {
  farmer: [
    "searchProducts",
    "getProduct",
    "getNearbyProducts",
    "getFarmerProfile",
    "getFarmerProducts",
    "compareProducts",
    "getMyOrders",
    "getMySales",
    "getMyInventory",
    "getPriceInsights",
    "getDemandInsights",
    // Phase 2 Agricultural Tools
    "getWeatherAdvisory",
    "getPriceIntelligence",
    "getDemandIntelligence",
    "getSellingRecommendation",
    "getMyProactiveInsights",
    // Phase 6 Action Proposal Tools
    "proposeUpdateProductPrice",
    "proposeUpdateInventory",
    "proposeCreateProductListing",
    "proposeCancelOrder",
    "proposeSendMessage",
    // Phase 9 Marketplace & Selling Agent Tools
    "getMySellingOpportunities",
    "compareSellingOptions",
    "getMarketplaceOverview",
    "getNearbyBuyerOpportunities",
    "getSellingPlan",
    // Phase 10 AI Reports & Advanced Analytics Tools
    "getMyFarmReport",
    "getMySalesAnalytics",
    "getMyInventoryAnalytics",
    "getMyProductPerformance",
    "getMarketplaceAnalytics",
    "compareAnalyticsPeriods",
    "generateAnalyticsReport",
    // Phase 11 AI Copilot, Memory, Goals & Follow-ups
    "getMyAiMemory",
    "searchMyAiMemory",
    "getRelevantUserContext",
    "proposeMemoryUpdate",
    "getMyFarmingGoals",
    "getGoalProgress",
    "proposeCreateFarmingGoal",
    "proposeUpdateGoalProgress",
    "getMyFollowUps",
    "proposeCreateFollowUp",
    "completeFollowUp",
    "executeCopilotPlan"
  ],
  vendor: [
    "searchProducts",
    "getProduct",
    "getNearbyProducts",
    "getFarmerProfile",
    "getFarmerProducts",
    "compareProducts",
    "getMyOrders",
    "getPriceInsights",
    "getDemandInsights",
    // Phase 2 Market Tools (read-only, no selling recommendation on private farmer inventory)
    "getWeatherAdvisory",
    "getPriceIntelligence",
    "getDemandIntelligence",
    // Phase 6 Action Proposal Tools
    "proposeCancelOrder",
    "proposeSendMessage",
    // Phase 9 Market Tools (public/district level)
    "getMarketplaceOverview",
    "getNearbyBuyerOpportunities",
    // Phase 10 Public Aggregate Marketplace Analytics
    "getMarketplaceAnalytics",
    // Phase 11 AI Copilot, Memory & Follow-ups (no farmer goals)
    "getMyAiMemory",
    "searchMyAiMemory",
    "getRelevantUserContext",
    "proposeMemoryUpdate",
    "getMyFollowUps",
    "proposeCreateFollowUp",
    "completeFollowUp",
    "executeCopilotPlan"
  ],
  admin: [
    "searchProducts",
    "getProduct",
    "getNearbyProducts",
    "getFarmerProfile",
    "getFarmerProducts",
    "compareProducts",
    "getMyOrders",
    "getMySales",
    "getMyInventory",
    "getPriceInsights",
    "getDemandInsights",
    "getPlatformAnalytics",
    // Phase 2 Tools
    "getWeatherAdvisory",
    "getPriceIntelligence",
    "getDemandIntelligence",
    "getSellingRecommendation",
    "getMyProactiveInsights",
    // Phase 6 Action Proposal Tools
    "proposeUpdateProductPrice",
    "proposeUpdateInventory",
    "proposeCreateProductListing",
    "proposeCancelOrder",
    "proposeSendMessage",
    // Phase 9 Tools
    "getMySellingOpportunities",
    "compareSellingOptions",
    "getMarketplaceOverview",
    "getNearbyBuyerOpportunities",
    "getSellingPlan",
    // Phase 10 AI Reports & Advanced Analytics Tools
    "getMyFarmReport",
    "getMySalesAnalytics",
    "getMyInventoryAnalytics",
    "getMyProductPerformance",
    "getMarketplaceAnalytics",
    "getPlatformAnalyticsReport",
    "compareAnalyticsPeriods",
    "generateAnalyticsReport",
    // Phase 11 AI Copilot, Memory, Goals & Follow-ups
    "getMyAiMemory",
    "searchMyAiMemory",
    "getRelevantUserContext",
    "proposeMemoryUpdate",
    "getMyFarmingGoals",
    "getGoalProgress",
    "proposeCreateFarmingGoal",
    "proposeUpdateGoalProgress",
    "getMyFollowUps",
    "proposeCreateFollowUp",
    "completeFollowUp",
    "executeCopilotPlan"
  ]
};

export function getAllowedToolNamesForRole(role) {
  if (!role) return [];
  return [...(ROLE_PERMISSIONS[role.toLowerCase()] || [])];
}

export function isToolAllowed(role, toolName) {
  if (!role || !toolName) return false;
  const allowed = ROLE_PERMISSIONS[role.toLowerCase()] || [];
  return allowed.includes(toolName);
}

export function sanitizeToolParams(user, toolName, params = {}) {
  const sanitized = { ...params };

  // Farmers can only query their own sales, inventory, selling recommendations/plans, and private reports
  if (user.role === "farmer") {
    if (
      toolName === "getMySales" ||
      toolName === "getMyInventory" ||
      toolName === "getSellingRecommendation" ||
      toolName === "getMySellingOpportunities" ||
      toolName === "getSellingPlan" ||
      toolName === "compareSellingOptions" ||
      toolName === "getMyFarmReport" ||
      toolName === "getMySalesAnalytics" ||
      toolName === "getMyInventoryAnalytics" ||
      toolName === "getMyProductPerformance" ||
      toolName === "compareAnalyticsPeriods" ||
      toolName === "generateAnalyticsReport"
    ) {
      sanitized.farmerId = user.id;
    }
  }

  // Vendors can only query their own order history and cannot spoof farmerId
  if (user.role === "vendor") {
    if (toolName === "getMyOrders") {
      sanitized.vendorId = user.id;
    }
    delete sanitized.farmerId;
  }

  // Admin users can optionally supply an explicit farmerId/vendorId or default to themselves
  if (user.role === "admin") {
    if (
      (toolName === "getMySales" ||
        toolName === "getMyInventory" ||
        toolName === "getSellingRecommendation" ||
        toolName === "getMySellingOpportunities" ||
        toolName === "getSellingPlan" ||
        toolName === "compareSellingOptions" ||
        toolName === "getMyFarmReport" ||
        toolName === "getMySalesAnalytics" ||
        toolName === "getMyInventoryAnalytics" ||
        toolName === "getMyProductPerformance" ||
        toolName === "compareAnalyticsPeriods" ||
        toolName === "generateAnalyticsReport") &&
      !sanitized.farmerId
    ) {
      sanitized.farmerId = user.id;
    }
  }

  // Phase 11 Personal AI Memory, Farming Goals & Follow-ups: Strictly enforce user isolation
  if (
    toolName === "getMyAiMemory" ||
    toolName === "searchMyAiMemory" ||
    toolName === "getRelevantUserContext" ||
    toolName === "proposeMemoryUpdate" ||
    toolName === "getMyFarmingGoals" ||
    toolName === "getGoalProgress" ||
    toolName === "proposeCreateFarmingGoal" ||
    toolName === "proposeUpdateGoalProgress" ||
    toolName === "getMyFollowUps" ||
    toolName === "proposeCreateFollowUp" ||
    toolName === "completeFollowUp" ||
    toolName === "executeCopilotPlan"
  ) {
    sanitized.userId = user.id;
  }

  // Inject session location context as fallback for weather advisory and marketplace tools
  if (toolName === "getWeatherAdvisory" || toolName === "getMarketplaceOverview" || toolName === "getNearbyBuyerOpportunities") {
    if (!sanitized.lat && user.lat) sanitized.lat = user.lat;
    if (!sanitized.lng && user.lng) sanitized.lng = user.lng;
    if (!sanitized.district && user.district) sanitized.district = user.district;
    if (!sanitized.region && user.region) sanitized.region = user.region;
  }

  return sanitized;
}
