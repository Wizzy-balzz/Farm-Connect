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
    "getDemandInsights"
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
    "getDemandInsights"
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
    "getPlatformAnalytics"
  ]
};

export function isToolAllowed(role, toolName) {
  if (!role || !toolName) return false;
  const allowed = ROLE_PERMISSIONS[role.toLowerCase()] || [];
  return allowed.includes(toolName);
}

export function sanitizeToolParams(user, toolName, params = {}) {
  const sanitized = { ...params };

  // Farmers can only query their own sales & inventory
  if (user.role === "farmer") {
    if (toolName === "getMySales" || toolName === "getMyInventory") {
      sanitized.farmerId = user.id;
    }
  }

  // Vendors can only query their own order history
  if (user.role === "vendor" && toolName === "getMyOrders") {
    sanitized.vendorId = user.id;
  }

  return sanitized;
}
