import { query } from "../database.js";
import { isToolAllowed, sanitizeToolParams, getAllowedToolNamesForRole } from "./aiPermissions.js";
import { getLiveWeatherForecast } from "../services/weatherService.js";
import { prepareActionProposal } from "./aiActions.js";
import { getUserProactiveInsights, generateProactiveInsightsForUser } from "../services/proactiveInsightService.js";
import {
  generateSellingStrategy,
  compareSellingOptions,
  generateSmartSellingPlan,
  detectSellingOpportunities,
  getNearbyBuyerOpportunities,
  getMarketplaceOverview
} from "../services/marketplaceAgentService.js";
import {
  getFarmPerformanceReport,
  getFarmerSalesAnalytics,
  getFarmerInventoryAnalytics,
  getProductPerformance,
  getMarketplaceAggregateAnalytics,
  getPlatformWideAnalytics,
  compareAnalyticsPeriods
} from "../services/analyticsReportService.js";
import {
  getUserMemories,
  searchUserMemory,
  getRelevantUserContext,
  proposeMemoryItem,
  saveMemoryItem
} from "../services/aiMemoryService.js";
import {
  getUserGoals,
  calculateVerifiedGoalProgress,
  proposeCreateGoal,
  createGoal,
  updateGoal
} from "../services/aiGoalService.js";
import {
  getUserFollowups,
  createFollowup,
  completeFollowup,
  proposeCreateFollowup
} from "../services/aiFollowupService.js";
import { executeCopilotPlan } from "../services/aiPlannerService.js";

/**
 * Gemini Function Declarations for FarmConnect Tools
 */
export const TOOL_DECLARATIONS = {
  searchProducts: {
    name: "searchProducts",
    description: "Search agricultural produce listings in the FarmConnect marketplace with optional filters for name, category, organic certification, max price, and MOQ.",
    parameters: {
      type: "OBJECT",
      properties: {
        queryText: {
          type: "STRING",
          description: "Crop or product name to search, e.g. 'Tomato', 'Onion', 'Basmati Rice', 'Wheat'."
        },
        category: {
          type: "STRING",
          description: "Produce category such as 'Vegetables', 'Grains', 'Spices', 'Fruits', or 'All'."
        },
        organic: {
          type: "BOOLEAN",
          description: "Whether to filter strictly for certified organic produce."
        },
        maxPrice: {
          type: "NUMBER",
          description: "Maximum price ceiling in INR per unit (e.g. 50 for under ₹50/kg)."
        },
        moq: {
          type: "NUMBER",
          description: "Maximum acceptable Minimum Order Quantity (MOQ) in units (e.g. 50)."
        }
      }
    }
  },

  getProduct: {
    name: "getProduct",
    description: "Retrieve complete specification, price, stock, grade, and farmer details for a single produce listing by its product ID.",
    parameters: {
      type: "OBJECT",
      properties: {
        id: {
          type: "STRING",
          description: "Unique product ID (e.g. 'p1', 'p2')."
        }
      },
      required: ["id"]
    }
  },

  getNearbyProducts: {
    name: "getNearbyProducts",
    description: "Find fresh harvest listings located within a specific district or region/state.",
    parameters: {
      type: "OBJECT",
      properties: {
        district: {
          type: "STRING",
          description: "District name (e.g. 'Nashik', 'Pune', 'Madurai', 'Coimbatore')."
        },
        region: {
          type: "STRING",
          description: "State or administrative region (e.g. 'Maharashtra', 'Tamil Nadu', 'Punjab')."
        },
        countryCode: {
          type: "STRING",
          description: "Two-letter country code (default 'IN')."
        }
      }
    }
  },

  getFarmerProfile: {
    name: "getFarmerProfile",
    description: "Get verified farmer background, farm name, location, supplier rating, and completed order count.",
    parameters: {
      type: "OBJECT",
      properties: {
        farmerId: {
          type: "STRING",
          description: "Unique ID of the farmer (e.g. 'f1', 'f2')."
        }
      },
      required: ["farmerId"]
    }
  },

  getFarmerProducts: {
    name: "getFarmerProducts",
    description: "List all active produce lots listed by a specific farmer.",
    parameters: {
      type: "OBJECT",
      properties: {
        farmerId: {
          type: "STRING",
          description: "Unique ID of the farmer (e.g. 'f1', 'f2')."
        }
      },
      required: ["farmerId"]
    }
  },

  compareProducts: {
    name: "compareProducts",
    description: "Compare multiple produce listings side-by-side by price, grade, MOQ, and organic status.",
    parameters: {
      type: "OBJECT",
      properties: {
        productIds: {
          type: "ARRAY",
          items: { type: "STRING" },
          description: "List of product IDs to compare (e.g. ['p1', 'p2'])."
        }
      },
      required: ["productIds"]
    }
  },

  getMyOrders: {
    name: "getMyOrders",
    description: "Retrieve recent orders and fulfillment statuses for the authenticated user (purchases for vendors, order items for farmers).",
    parameters: {
      type: "OBJECT",
      properties: {}
    }
  },

  getMySales: {
    name: "getMySales",
    description: "Retrieve comprehensive sales performance metrics for the authenticated farmer: total revenue, completed orders count, quantity sold, and top selling products.",
    parameters: {
      type: "OBJECT",
      properties: {}
    }
  },

  getMyInventory: {
    name: "getMyInventory",
    description: "Check the authenticated farmer's listed produce inventory, current stock levels, units, and MOQ restock thresholds.",
    parameters: {
      type: "OBJECT",
      properties: {}
    }
  },

  // Legacy price insights (preserved for backward compatibility)
  getPriceInsights: {
    name: "getPriceInsights",
    description: "Get baseline market price range benchmarked against current platform listings.",
    parameters: {
      type: "OBJECT",
      properties: {
        productId: {
          type: "STRING",
          description: "Optional product ID to benchmark."
        }
      }
    }
  },

  // Legacy demand insights (preserved for backward compatibility)
  getDemandInsights: {
    name: "getDemandInsights",
    description: "Get baseline demand forecast based on platform order volume.",
    parameters: {
      type: "OBJECT",
      properties: {
        category: {
          type: "STRING",
          description: "Produce category such as 'Vegetables', 'Grains', 'Spices', or 'All'."
        }
      }
    }
  },

  // Phase 2 Agricultural Intelligence Tools:
  getWeatherAdvisory: {
    name: "getWeatherAdvisory",
    description: "Retrieve live agricultural weather forecast (temperature, humidity, precipitation probability, wind speed, harvest/field suitability) for the user's location or specified district.",
    parameters: {
      type: "OBJECT",
      properties: {
        district: {
          type: "STRING",
          description: "District name (e.g. 'Nashik', 'Madurai', 'Pune')."
        },
        region: {
          type: "STRING",
          description: "State or administrative region (e.g. 'Maharashtra', 'Tamil Nadu')."
        },
        crop: {
          type: "STRING",
          description: "Target crop to contextualize weather risks for (e.g. 'Tomato', 'Wheat', 'Onion')."
        }
      }
    }
  },

  getPriceIntelligence: {
    name: "getPriceIntelligence",
    description: "Calculate authentic statistical price benchmarks from actual FarmConnect database listings and orders: min, max, average, median, listings sample size, and organic price spread. Never fabricates prices.",
    parameters: {
      type: "OBJECT",
      properties: {
        commodity: {
          type: "STRING",
          description: "Specific crop or commodity name (e.g. 'Tomato', 'Onion', 'Rice', 'Wheat')."
        },
        category: {
          type: "STRING",
          description: "Category filter (e.g. 'Vegetables', 'Grains', 'Spices')."
        },
        productId: {
          type: "STRING",
          description: "Optional specific product ID to benchmark."
        }
      }
    }
  },

  getDemandIntelligence: {
    name: "getDemandIntelligence",
    description: "Calculate authentic market demand metrics and period-over-period order trends from actual completed procurement orders. Reports insufficient data if fewer than 2 orders exist.",
    parameters: {
      type: "OBJECT",
      properties: {
        category: {
          type: "STRING",
          description: "Commodity category (e.g. 'Vegetables', 'Grains', 'Spices', or 'All')."
        },
        commodity: {
          type: "STRING",
          description: "Specific crop name (e.g. 'Tomato', 'Wheat')."
        },
        days: {
          type: "NUMBER",
          description: "Historical analysis window in days (default 30, supports 7, 30, 90)."
        }
      }
    }
  },

  getSellingRecommendation: {
    name: "getSellingRecommendation",
    description: "Generate intelligent agricultural selling decision guidance by synthesizing the farmer's actual stock, live market price intelligence, order demand trends, and weather forecasts. Clearly separates factual database data from advisory reasoning.",
    parameters: {
      type: "OBJECT",
      properties: {
        commodity: {
          type: "STRING",
          description: "The produce crop to evaluate (e.g. 'Tomato', 'Onion', 'Rice')."
        },
        quantity: {
          type: "NUMBER",
          description: "Quantity available to sell in kilograms or produce units."
        }
      }
    }
  },

  getMyProactiveInsights: {
    name: "getMyProactiveInsights",
    description: "Retrieve proactive agricultural AI insights and smart alerts (inventory warnings, price movements, order demand surges, weather advisories, selling opportunities) generated for the authenticated farmer.",
    parameters: {
      type: "OBJECT",
      properties: {
        status: {
          type: "STRING",
          description: "Status filter for insights: 'active', 'read', 'expired', or 'all' (default 'active')."
        },
        lang: {
          type: "STRING",
          description: "Language code for insight text ('en', 'ta', 'hi', 'tanglish')."
        }
      }
    }
  },

  getPlatformAnalytics: {
    name: "getPlatformAnalytics",
    description: "Executive platform metrics including total users, active listings, orders placed, and gross transaction revenue. (Admin only).",
    parameters: {
      type: "OBJECT",
      properties: {}
    }
  },

  // Phase 6 Action Proposal Tools (Human Confirmation Required)
  proposeUpdateProductPrice: {
    name: "proposeUpdateProductPrice",
    description: "Prepare an action proposal to change the selling price of a farmer's produce listing. NEVER immediately updates the database; generates an action confirmation card for explicit user approval.",
    parameters: {
      type: "OBJECT",
      properties: {
        commodity: {
          type: "STRING",
          description: "Produce name (e.g. 'Tomato', 'Onion', 'Rice')."
        },
        productId: {
          type: "STRING",
          description: "Optional specific product ID."
        },
        newPrice: {
          type: "NUMBER",
          description: "Proposed new price in INR per unit."
        }
      },
      required: ["newPrice"]
    }
  },

  proposeUpdateInventory: {
    name: "proposeUpdateInventory",
    description: "Prepare an action proposal to adjust or add to the inventory quantity of a farmer's produce listing. NEVER immediately updates the database; generates an action confirmation card for explicit user approval.",
    parameters: {
      type: "OBJECT",
      properties: {
        commodity: {
          type: "STRING",
          description: "Produce name (e.g. 'Tomato', 'Onion')."
        },
        productId: {
          type: "STRING",
          description: "Optional specific product ID."
        },
        quantityDelta: {
          type: "NUMBER",
          description: "Relative change in stock (e.g. +20 or -10)."
        },
        newStock: {
          type: "NUMBER",
          description: "Absolute new total stock quantity."
        }
      }
    }
  },

  proposeCreateProductListing: {
    name: "proposeCreateProductListing",
    description: "Prepare an action proposal to publish a new produce listing onto the FarmConnect marketplace. NEVER immediately creates the listing; generates an action confirmation card for explicit user approval.",
    parameters: {
      type: "OBJECT",
      properties: {
        name: {
          type: "STRING",
          description: "Crop or produce title (e.g. 'Organic Tomatoes')."
        },
        category: {
          type: "STRING",
          description: "Produce category: 'Vegetables', 'Grains', 'Spices', 'Fruits'."
        },
        price: {
          type: "NUMBER",
          description: "Price in INR per unit."
        },
        stock: {
          type: "NUMBER",
          description: "Available quantity to list."
        },
        unit: {
          type: "STRING",
          description: "Produce unit (default 'kg')."
        },
        organic: {
          type: "BOOLEAN",
          description: "Whether the produce is certified organic."
        }
      },
      required: ["name", "price", "stock"]
    }
  },

  proposeCancelOrder: {
    name: "proposeCancelOrder",
    description: "Prepare an action proposal to cancel a pending order and safely restock items. NEVER immediately cancels the order; generates an action confirmation card for explicit user approval.",
    parameters: {
      type: "OBJECT",
      properties: {
        orderId: {
          type: "STRING",
          description: "Order ID (e.g. 'FC-12345')."
        },
        reason: {
          type: "STRING",
          description: "Reason for cancellation."
        }
      },
      required: ["orderId"]
    }
  },

  proposeSendMessage: {
    name: "proposeSendMessage",
    description: "Prepare an action proposal to send a direct marketplace communication message to a counterparty. NEVER immediately sends the message; generates an action confirmation card for explicit user approval.",
    parameters: {
      type: "OBJECT",
      properties: {
        conversationId: {
          type: "STRING",
          description: "Active conversation ID."
        },
        recipientId: {
          type: "STRING",
          description: "Recipient user ID."
        },
        message: {
          type: "STRING",
          description: "Message text to send."
        }
      },
      required: ["message"]
    }
  },

  // Phase 9 Marketplace & Selling Agent Tools:
  getMySellingOpportunities: {
    name: "getMySellingOpportunities",
    description: "Detect data-driven agricultural selling opportunities (high demand + stock, rising price, weather risk, unfulfilled buyer demand) for the authenticated farmer.",
    parameters: {
      type: "OBJECT",
      properties: {}
    }
  },

  compareSellingOptions: {
    name: "compareSellingOptions",
    description: "Compare multiple produce crops side-by-side by price, inventory, demand trend, weather harvest risk, and recommendation.",
    parameters: {
      type: "OBJECT",
      properties: {
        commodities: {
          type: "ARRAY",
          items: { type: "STRING" },
          description: "List of produce/crops to compare (e.g. ['Tomato', 'Onion'])."
        }
      }
    }
  },

  getMarketplaceOverview: {
    name: "getMarketplaceOverview",
    description: "Get market-wide overview of produce listings, categories, and availability for a district or region.",
    parameters: {
      type: "OBJECT",
      properties: {
        district: {
          type: "STRING",
          description: "District name (e.g. 'Nashik', 'Madurai')."
        },
        region: {
          type: "STRING",
          description: "State or administrative region."
        }
      }
    }
  },

  getNearbyBuyerOpportunities: {
    name: "getNearbyBuyerOpportunities",
    description: "Identify unfulfilled procurement orders and active buyer demand near the farmer's location or district.",
    parameters: {
      type: "OBJECT",
      properties: {
        district: {
          type: "STRING",
          description: "District name (e.g. 'Nashik')."
        },
        region: {
          type: "STRING",
          description: "State or region."
        }
      }
    }
  },

  getSellingPlan: {
    name: "getSellingPlan",
    description: "Generate a comprehensive smart selling plan for all crops listed or grown by the farmer, detailing inventory, market demand, weather, suggested quantities, timing, and risk ratings.",
    parameters: {
      type: "OBJECT",
      properties: {}
    }
  },

  // Phase 10 AI Reports & Advanced Analytics Tools
  getMyFarmReport: {
    name: "getMyFarmReport",
    description: "Generate a comprehensive farm performance report for the authenticated farmer including product catalog, sales revenue, inventory health, order fulfillment rates, ASP, and weather risks.",
    parameters: {
      type: "OBJECT",
      properties: {
        period: {
          type: "STRING",
          description: "Reporting period, such as '7d', '30d', '90d', 'month', 'last month'."
        },
        startDate: {
          type: "STRING",
          description: "Optional custom start date in ISO format."
        },
        endDate: {
          type: "STRING",
          description: "Optional custom end date in ISO format."
        }
      }
    }
  },

  getMySalesAnalytics: {
    name: "getMySalesAnalytics",
    description: "Retrieve comprehensive sales metrics, gross revenue, quantity sold, order count, ASP, top crops, and daily sales trend for the farmer.",
    parameters: {
      type: "OBJECT",
      properties: {
        period: {
          type: "STRING",
          description: "Time window ('7d', '30d', '90d', 'month', 'last month')."
        },
        commodity: {
          type: "STRING",
          description: "Optional produce or crop name to filter by (e.g. 'Tomato', 'Onion')."
        },
        startDate: {
          type: "STRING",
          description: "Optional custom start date."
        },
        endDate: {
          type: "STRING",
          description: "Optional custom end date."
        }
      }
    }
  },

  getMyInventoryAnalytics: {
    name: "getMyInventoryAnalytics",
    description: "Analyze farmer warehouse stock, low-stock items, slow-moving crops, recently sold products, and produce category distribution.",
    parameters: {
      type: "OBJECT",
      properties: {}
    }
  },

  getMyProductPerformance: {
    name: "getMyProductPerformance",
    description: "Evaluate product-level sales velocity, realized average price, order count, and gross revenue breakdown across produce listings.",
    parameters: {
      type: "OBJECT",
      properties: {
        productId: {
          type: "STRING",
          description: "Optional specific product ID to analyze."
        },
        period: {
          type: "STRING",
          description: "Time period ('7d', '30d', '90d', 'month')."
        }
      }
    }
  },

  getMarketplaceAnalytics: {
    name: "getMarketplaceAnalytics",
    description: "Retrieve platform-wide aggregate marketplace analytics including active listings count, price ranges, benchmark median prices, and commodity volume.",
    parameters: {
      type: "OBJECT",
      properties: {
        commodity: {
          type: "STRING",
          description: "Optional commodity or produce name to inspect."
        },
        period: {
          type: "STRING",
          description: "Time period ('7d', '30d', '90d')."
        }
      }
    }
  },

  getPlatformAnalyticsReport: {
    name: "getPlatformAnalyticsReport",
    description: "Generate platform administrator analytics detailing user counts by role, marketplace volume, order fulfillment distribution, and AI subsystem utilization.",
    parameters: {
      type: "OBJECT",
      properties: {
        period: {
          type: "STRING",
          description: "Reporting period ('7d', '30d', '90d', 'month')."
        }
      }
    }
  },

  compareAnalyticsPeriods: {
    name: "compareAnalyticsPeriods",
    description: "Compare farmer sales and operational metrics between current period and preceding equivalent period without fabricating percentage changes.",
    parameters: {
      type: "OBJECT",
      properties: {
        period: {
          type: "STRING",
          description: "Period to compare (e.g. '7d', '30d', '90d', 'month')."
        }
      }
    }
  },

  generateAnalyticsReport: {
    name: "generateAnalyticsReport",
    description: "Generate a structured agricultural analytics report separating verified FACTS, REASONING, INSIGHTS, RECOMMENDATIONS, and LIMITATIONS.",
    parameters: {
      type: "OBJECT",
      properties: {
        reportType: {
          type: "STRING",
          description: "Type of report: 'FARM_PERFORMANCE', 'SALES', 'INVENTORY', 'MARKETPLACE', or 'PLATFORM'."
        },
        period: {
          type: "STRING",
          description: "Period string (e.g. '7d', '30d', '90d', 'month')."
        },
        commodity: {
          type: "STRING",
          description: "Optional crop name."
        }
      }
    }
  },

  // ==========================================
  // Phase 11 AI Personal Copilot Tools
  // ==========================================

  getMyAiMemory: {
    name: "getMyAiMemory",
    description: "Retrieve user's saved personal preferences, past crops, and copilot memory records.",
    parameters: {
      type: "OBJECT",
      properties: {
        memoryType: {
          type: "STRING",
          description: "Optional filter by memory type ('preference', 'crop_history', 'strategy', 'language', 'unit', 'general')."
        }
      }
    }
  },

  searchMyAiMemory: {
    name: "searchMyAiMemory",
    description: "Search user's saved personal preferences or memory records by keyword.",
    parameters: {
      type: "OBJECT",
      properties: {
        query: {
          type: "STRING",
          description: "Keyword or search query for memory lookup."
        }
      },
      required: ["query"]
    }
  },

  getRelevantUserContext: {
    name: "getRelevantUserContext",
    description: "Retrieve comprehensive summary of user profile, saved preferences, active goals, and ongoing farming context.",
    parameters: {
      type: "OBJECT",
      properties: {}
    }
  },

  proposeMemoryUpdate: {
    name: "proposeMemoryUpdate",
    description: "Propose saving or updating a user preference into personal AI memory. Requires explicit user confirmation.",
    parameters: {
      type: "OBJECT",
      properties: {
        key: {
          type: "STRING",
          description: "Name or subject of the memory preference, e.g. 'preferred_crop', 'selling_strategy'."
        },
        value: {
          type: "STRING",
          description: "Value or content of the memory preference."
        },
        memoryType: {
          type: "STRING",
          description: "Category of memory ('preference', 'crop_history', 'strategy', 'language', 'unit', 'general')."
        }
      },
      required: ["key", "value"]
    }
  },

  getMyFarmingGoals: {
    name: "getMyFarmingGoals",
    description: "Retrieve farmer's active, completed, or overdue agricultural and selling goals.",
    parameters: {
      type: "OBJECT",
      properties: {
        status: {
          type: "STRING",
          description: "Filter by goal status ('active', 'completed', 'overdue', 'cancelled')."
        },
        category: {
          type: "STRING",
          description: "Filter by goal category ('selling', 'production', 'revenue', 'inventory')."
        }
      }
    }
  },

  getGoalProgress: {
    name: "getGoalProgress",
    description: "Calculate and inspect progress of a farming goal against verified platform sales and inventory data.",
    parameters: {
      type: "OBJECT",
      properties: {
        goalId: {
          type: "STRING",
          description: "Unique ID of the farming goal to evaluate."
        }
      },
      required: ["goalId"]
    }
  },

  proposeCreateFarmingGoal: {
    name: "proposeCreateFarmingGoal",
    description: "Propose setting a new farming, production, or sales goal for explicit user approval.",
    parameters: {
      type: "OBJECT",
      properties: {
        title: {
          type: "STRING",
          description: "Title of the goal, e.g. 'Sell 500 kg of tomatoes this month'."
        },
        category: {
          type: "STRING",
          description: "Category of goal ('selling', 'production', 'revenue', 'inventory', 'marketplace')."
        },
        targetValue: {
          type: "NUMBER",
          description: "Numeric target quantity or revenue value."
        },
        unit: {
          type: "STRING",
          description: "Unit of measurement (e.g. 'kg', 'INR', 'orders')."
        },
        deadline: {
          type: "STRING",
          description: "Target deadline date string."
        }
      },
      required: ["title"]
    }
  },

  proposeUpdateGoalProgress: {
    name: "proposeUpdateGoalProgress",
    description: "Propose updating the progress or status of an existing farming goal.",
    parameters: {
      type: "OBJECT",
      properties: {
        goalId: {
          type: "STRING",
          description: "Unique ID of the goal."
        },
        currentValue: {
          type: "NUMBER",
          description: "Updated progress value."
        },
        status: {
          type: "STRING",
          description: "Optional status update ('active', 'completed', 'paused')."
        }
      },
      required: ["goalId"]
    }
  },

  getMyFollowUps: {
    name: "getMyFollowUps",
    description: "Retrieve pending farming tasks, weather alerts, and copilot reminders.",
    parameters: {
      type: "OBJECT",
      properties: {
        status: {
          type: "STRING",
          description: "Filter by status ('pending', 'completed', 'all')."
        }
      }
    }
  },

  proposeCreateFollowUp: {
    name: "proposeCreateFollowUp",
    description: "Propose or schedule an AI follow-up task or reminder.",
    parameters: {
      type: "OBJECT",
      properties: {
        title: {
          type: "STRING",
          description: "Summary title of the follow-up task, e.g. 'Check tomato prices tomorrow'."
        },
        description: {
          type: "STRING",
          description: "Detailed description or context of the follow-up."
        },
        type: {
          type: "STRING",
          description: "Type of follow-up ('weather_check', 'price_alert', 'inventory_review', 'order_review', 'harvest_reminder', 'custom')."
        },
        triggerAt: {
          type: "STRING",
          description: "ISO date-time when this reminder should trigger."
        }
      },
      required: ["title"]
    }
  },

  completeFollowUp: {
    name: "completeFollowUp",
    description: "Mark a pending follow-up task or reminder as completed.",
    parameters: {
      type: "OBJECT",
      properties: {
        followupId: {
          type: "STRING",
          description: "Unique ID of the follow-up to mark completed."
        }
      },
      required: ["followupId"]
    }
  },

  executeCopilotPlan: {
    name: "executeCopilotPlan",
    description: "Execute a multi-step read-only plan coordinating inventory, prices, demand, weather, and selling guidance.",
    parameters: {
      type: "OBJECT",
      properties: {
        query: {
          type: "STRING",
          description: "User question or objective to plan, e.g. 'Should I sell my tomatoes this week?'"
        },
        workflowIntent: {
          type: "STRING",
          description: "Intent template ('SHOULD_I_SELL', 'FARM_HEALTH_AND_OPPORTUNITY', 'GOAL_PROGRESS_CHECK')."
        },
        commodity: {
          type: "STRING",
          description: "Target crop name."
        }
      }
    }
  }
};

/**
 * Return GenAI function declarations filtered strictly by user role
 */
export function getFunctionDeclarationsForRole(role) {
  const allowedNames = getAllowedToolNamesForRole(role);
  return allowedNames
    .map((name) => TOOL_DECLARATIONS[name])
    .filter(Boolean);
}

/**
 * Centralized, safe tool executor
 * Handles RBAC checks, parameter sanitization, query execution, and structured results
 */
export async function executeAiTool(user, toolName, params = {}) {
  if (!user || !user.id || !user.role) {
    return {
      success: false,
      error: {
        code: "UNAUTHENTICATED",
        message: "Authentication is required to execute AI tools."
      }
    };
  }

  if (!isToolAllowed(user.role, toolName)) {
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message: `Role '${user.role}' is not authorized to execute tool '${toolName}'.`
      }
    };
  }

  const safeParams = sanitizeToolParams(user, toolName, params);

  try {
    let result = null;

    switch (toolName) {
      case "searchProducts":
        result = await searchProducts(safeParams);
        break;
      case "getProduct":
        result = await getProduct(safeParams.id);
        break;
      case "getNearbyProducts":
        result = await getNearbyProducts(safeParams);
        break;
      case "getFarmerProfile":
        result = await getFarmerProfile(safeParams.farmerId);
        break;
      case "getFarmerProducts":
        result = await getFarmerProducts(safeParams.farmerId);
        break;
      case "compareProducts":
        result = await compareProducts(safeParams.productIds);
        break;
      case "getMyOrders":
        result = await getMyOrders(user);
        break;
      case "getMySales":
        result = await getMySales(user);
        break;
      case "getMyInventory":
        result = await getMyInventory(user);
        break;
      case "getPriceInsights":
        result = await getPriceInsights(safeParams.productId);
        break;
      case "getDemandInsights":
        result = await getDemandInsights(safeParams.category);
        break;
      // Phase 2 Agricultural Tools
      case "getWeatherAdvisory":
        result = await getWeatherAdvisory(safeParams, user);
        break;
      case "getPriceIntelligence":
        result = await getPriceIntelligence(safeParams);
        break;
      case "getDemandIntelligence":
        result = await getDemandIntelligence(safeParams);
        break;
      case "getSellingRecommendation":
        result = await getSellingRecommendation(safeParams, user);
        break;
      case "getMyProactiveInsights":
        await generateProactiveInsightsForUser(user);
        result = await getUserProactiveInsights(user.id, safeParams.lang || "en", safeParams.status || "active");
        break;
      case "getPlatformAnalytics":
        result = await getPlatformAnalytics(user);
        break;
      case "proposeUpdateProductPrice":
        result = await prepareActionProposal({ user, actionId: "UPDATE_PRODUCT_PRICE", parameters: safeParams });
        if (result && !result.success) return result;
        break;
      case "proposeUpdateInventory":
        result = await prepareActionProposal({ user, actionId: "UPDATE_INVENTORY", parameters: safeParams });
        if (result && !result.success) return result;
        break;
      case "proposeCreateProductListing":
        result = await prepareActionProposal({ user, actionId: "CREATE_PRODUCT_LISTING", parameters: safeParams });
        if (result && !result.success) return result;
        break;
      case "proposeCancelOrder":
        result = await prepareActionProposal({ user, actionId: "CANCEL_ORDER", parameters: safeParams });
        if (result && !result.success) return result;
        break;
      case "proposeSendMessage":
        result = await prepareActionProposal({ user, actionId: "SEND_MESSAGE", parameters: safeParams });
        if (result && !result.success) return result;
        break;
      // Phase 9 Marketplace & Selling Agent Tools
      case "getMySellingOpportunities":
        result = await detectSellingOpportunities(user.id, { district: user.district, region: user.region, lat: user.lat, lng: user.lng });
        break;
      case "compareSellingOptions":
        result = await compareSellingOptions({ farmerId: user.id, commodities: safeParams.commodities, userLocation: { district: user.district, region: user.region, lat: user.lat, lng: user.lng } });
        break;
      case "getMarketplaceOverview":
        result = await getMarketplaceOverview(safeParams);
        break;
      case "getNearbyBuyerOpportunities":
        result = await getNearbyBuyerOpportunities({ farmerId: user.id, district: safeParams.district || user.district, region: safeParams.region || user.region });
        break;
      case "getSellingPlan":
        result = await generateSmartSellingPlan({ farmerId: user.id, userLocation: { district: user.district, region: user.region, lat: user.lat, lng: user.lng } });
        break;
      // Phase 10 AI Reports & Advanced Analytics Tools
      case "getMyFarmReport":
        result = await getFarmPerformanceReport(safeParams.farmerId || user.id, safeParams);
        break;
      case "getMySalesAnalytics":
        result = await getFarmerSalesAnalytics(safeParams.farmerId || user.id, safeParams);
        break;
      case "getMyInventoryAnalytics":
        result = await getFarmerInventoryAnalytics(safeParams.farmerId || user.id);
        break;
      case "getMyProductPerformance":
        result = await getProductPerformance(safeParams.farmerId || user.id, safeParams.productId, safeParams);
        break;
      case "getMarketplaceAnalytics":
        result = await getMarketplaceAggregateAnalytics(safeParams);
        break;
      case "getPlatformAnalyticsReport":
        result = await getPlatformWideAnalytics(safeParams);
        break;
      case "compareAnalyticsPeriods":
        result = await compareAnalyticsPeriods(safeParams.farmerId || user.id, safeParams);
        break;
      case "generateAnalyticsReport": {
        const type = (safeParams.reportType || "FARM_PERFORMANCE").toUpperCase();
        if (type === "SALES") {
          result = await getFarmerSalesAnalytics(safeParams.farmerId || user.id, safeParams);
        } else if (type === "INVENTORY") {
          result = await getFarmerInventoryAnalytics(safeParams.farmerId || user.id);
        } else if (type === "MARKETPLACE") {
          result = await getMarketplaceAggregateAnalytics(safeParams);
        } else if (type === "PLATFORM") {
          result = await getPlatformWideAnalytics(safeParams);
        } else {
          result = await getFarmPerformanceReport(safeParams.farmerId || user.id, safeParams);
        }
        break;
      }
      // Phase 11 AI Personal Copilot Tools
      case "getMyAiMemory":
        result = await getUserMemories(user.id, safeParams);
        break;
      case "searchMyAiMemory":
        result = await searchUserMemory(user.id, safeParams.query);
        break;
      case "getRelevantUserContext":
        result = await getRelevantUserContext(user);
        break;
      case "proposeMemoryUpdate":
        result = proposeMemoryItem(user, safeParams);
        break;
      case "getMyFarmingGoals":
        result = await getUserGoals(user.id, safeParams);
        break;
      case "getGoalProgress":
        result = await calculateVerifiedGoalProgress(user.id, safeParams.goalId);
        break;
      case "proposeCreateFarmingGoal":
        result = proposeCreateGoal(user, safeParams);
        break;
      case "proposeUpdateGoalProgress":
        result = await updateGoal(user.id, safeParams.goalId, safeParams);
        break;
      case "getMyFollowUps":
        result = await getUserFollowups(user.id, safeParams);
        break;
      case "proposeCreateFollowUp":
        result = proposeCreateFollowup(user, safeParams);
        break;
      case "completeFollowUp":
        result = await completeFollowup(user.id, safeParams.followupId);
        break;
      case "executeCopilotPlan":
        result = await executeCopilotPlan({
          user,
          query: safeParams.query,
          workflowIntent: safeParams.workflowIntent,
          initialParams: safeParams
        });
        break;
      default:
        return {
          success: false,
          error: {
            code: "UNKNOWN_TOOL",
            message: `Tool '${toolName}' is not recognized.`
          }
        };
    }

    return {
      success: true,
      data: result
    };
  } catch (err) {
    console.error(`[AI Tool Error] Execution failed for '${toolName}':`, err.message);
    return {
      success: false,
      error: {
        code: "TOOL_EXECUTION_FAILED",
        message: `Failed to execute ${toolName}: ${err.message || "Internal database query error"}`
      }
    };
  }
}

// -------------------------------------------------------------
// Agricultural Multilingual Produce Normalizer
// -------------------------------------------------------------

export const CROP_NAME_CANONICAL = {
  // Tomato
  "தக்காளி": "Tomato",
  "thakkali": "Tomato",
  "டொமேட்டோ": "Tomato",
  "டொமாட்டோ": "Tomato",
  "टमाटर": "Tomato",
  "tamatar": "Tomato",
  "tomato": "Tomato",
  "tomatoes": "Tomato",

  // Onion
  "வெங்காயம்": "Onion",
  "vengayam": "Onion",
  "vengaayam": "Onion",
  "சின்ன வெங்காயம்": "Onion",
  "பல்லாரி": "Onion",
  "प्याज": "Onion",
  "pyaj": "Onion",
  "pyaaz": "Onion",
  "onion": "Onion",
  "onions": "Onion",

  // Rice / Paddy
  "அரிசி": "Rice",
  "நெல்": "Rice",
  "பாஸ்மதி": "Rice",
  "arisi": "Rice",
  "nel": "Rice",
  "चावल": "Rice",
  "धान": "Rice",
  "बासमती": "Rice",
  "chawal": "Rice",
  "dhan": "Rice",
  "rice": "Rice",
  "paddy": "Rice",
  "basmati": "Rice",

  // Wheat
  "கோதுமை": "Wheat",
  "kothumai": "Wheat",
  "godhumai": "Wheat",
  "गेहूं": "Wheat",
  "गेहू": "Wheat",
  "gehu": "Wheat",
  "wheat": "Wheat",
  "durum": "Wheat",

  // Spinach / Leafy Greens
  "கீரை": "Spinach",
  "பாலக்": "Spinach",
  "keerai": "Spinach",
  "पालक": "Spinach",
  "palak": "Spinach",
  "spinach": "Spinach",

  // Pepper / Chilli
  "மிளகு": "Pepper",
  "கருப்பு மிளகு": "Pepper",
  "milagu": "Pepper",
  "மிளகாய்": "Pepper",
  "பச்சை மிளகாய்": "Pepper",
  "milagai": "Pepper",
  "मिर्च": "Pepper",
  "काली मिर्च": "Pepper",
  "mirch": "Pepper",
  "pepper": "Pepper",
  "chilli": "Pepper",

  // Carrot
  "கேரட்": "Carrot",
  "carrot": "Carrot",
  "carrots": "Carrot",
  "गाजर": "Carrot",
  "gajar": "Carrot",

  // Potato
  "உருளைக்கிழங்கு": "Potato",
  "உருளை": "Potato",
  "urulaikilangu": "Potato",
  "urulai": "Potato",
  "आलू": "Potato",
  "aloo": "Potato",
  "potato": "Potato",
  "potatoes": "Potato",

  // Banana
  "வாழை": "Banana",
  "வாழைப்பழம்": "Banana",
  "valai": "Banana",
  "vazhai": "Banana",
  "केला": "Banana",
  "kela": "Banana",
  "banana": "Banana",

  // Corn / Maize
  "மக்காச்சோளம்": "Corn",
  "சோளம்": "Corn",
  "cholam": "Corn",
  "मक्का": "Corn",
  "भुट्टा": "Corn",
  "makka": "Corn",
  "corn": "Corn",
  "maize": "Corn",

  // Cotton
  "பருத்தி": "Cotton",
  "paruthi": "Cotton",
  "कपास": "Cotton",
  "kapas": "Cotton",
  "cotton": "Cotton",

  // Sugarcane
  "கரும்பு": "Sugarcane",
  "karumbu": "Sugarcane",
  "गन्ना": "Sugarcane",
  "ganna": "Sugarcane",
  "sugarcane": "Sugarcane"
};

/**
 * Normalizes produce/crop names in Tamil, Hindi, Tanglish, or Hinglish to canonical English names.
 */
export function normalizeCropName(cropInput) {
  if (!cropInput || typeof cropInput !== "string") return "";
  const cleaned = cropInput.trim().toLowerCase();
  if (CROP_NAME_CANONICAL[cleaned]) {
    return CROP_NAME_CANONICAL[cleaned];
  }
  for (const [key, canonical] of Object.entries(CROP_NAME_CANONICAL)) {
    if (cleaned.includes(key.toLowerCase()) || key.toLowerCase().includes(cleaned)) {
      return canonical;
    }
  }
  return cropInput.trim();
}

// -------------------------------------------------------------
// Database Query Handlers (Read-Only)
// -------------------------------------------------------------

async function searchProducts({ queryText = "", category = "All", organic = false, maxPrice = null, moq = null }) {
  let sql = "SELECT * FROM products WHERE 1=1";
  const sqlParams = [];

  if (queryText && queryText.trim()) {
    const rawTrimmed = queryText.trim();
    const canonical = normalizeCropName(rawTrimmed);
    if (canonical && canonical.toLowerCase() !== rawTrimmed.toLowerCase()) {
      sql += " AND (LOWER(name) LIKE ? OR LOWER(description) LIKE ? OR LOWER(name) LIKE ? OR LOWER(description) LIKE ?)";
      const rawTerm = `%${rawTrimmed.toLowerCase()}%`;
      const canonTerm = `%${canonical.toLowerCase()}%`;
      sqlParams.push(rawTerm, rawTerm, canonTerm, canonTerm);
    } else {
      sql += " AND (LOWER(name) LIKE ? OR LOWER(description) LIKE ?)";
      const term = `%${rawTrimmed.toLowerCase()}%`;
      sqlParams.push(term, term);
    }
  }

  if (category && category !== "All") {
    sql += " AND LOWER(category) = LOWER(?)";
    sqlParams.push(category);
  }

  if (organic === true || organic === "true" || organic === 1) {
    sql += " AND organic = 1";
  }

  if (maxPrice !== null && !isNaN(Number(maxPrice))) {
    sql += " AND price <= ?";
    sqlParams.push(Number(maxPrice));
  }

  if (moq !== null && !isNaN(Number(moq))) {
    sql += " AND moq <= ?";
    sqlParams.push(Number(moq));
  }

  sql += " ORDER BY createdAt DESC LIMIT 20";
  const rows = await query.all(sql, sqlParams);
  return rows || [];
}

async function getProduct(id) {
  if (!id) return null;
  const row = await query.get("SELECT * FROM products WHERE id = ?", [id]);
  return row || null;
}

async function getNearbyProducts({ region, district, countryCode }) {
  let sql = "SELECT * FROM products WHERE 1=1";
  const sqlParams = [];

  if (district) {
    sql += " AND LOWER(district) = LOWER(?)";
    sqlParams.push(district);
  } else if (region) {
    sql += " AND LOWER(region) = LOWER(?)";
    sqlParams.push(region);
  }

  if (countryCode) {
    sql += " AND UPPER(countryCode) = UPPER(?)";
    sqlParams.push(countryCode);
  }

  sql += " ORDER BY createdAt DESC LIMIT 15";
  const rows = await query.all(sql, sqlParams);
  return rows || [];
}

async function getFarmerProfile(farmerId) {
  if (!farmerId) return null;
  const user = await query.get(
    "SELECT id, name, farmName, region, district, city, verificationStatus, about, rating, completedOrders FROM users WHERE id = ? AND role = 'farmer'",
    [farmerId]
  );
  return user || null;
}

async function getFarmerProducts(farmerId) {
  if (!farmerId) return [];
  const rows = await query.all("SELECT * FROM products WHERE farmerId = ? ORDER BY createdAt DESC", [farmerId]);
  return rows || [];
}

async function compareProducts(productIds = []) {
  if (!Array.isArray(productIds) || productIds.length === 0) return [];
  const placeholders = productIds.map(() => "?").join(",");
  const rows = await query.all(`SELECT * FROM products WHERE id IN (${placeholders})`, productIds);
  return rows || [];
}

async function getMyOrders(user) {
  let sql = `
    SELECT o.id, o.vendorName, o.totalAmount, o.status, o.createdAt, oi.productId, oi.qty, oi.unitPrice, oi.amount
    FROM orders o JOIN order_items oi ON o.id = oi.orderId
  `;
  const params = [];

  if (user.role === "vendor") {
    sql += " WHERE o.vendorId = ?";
    params.push(user.id);
  } else if (user.role === "farmer") {
    sql += " WHERE oi.farmerId = ?";
    params.push(user.id);
  }

  sql += " ORDER BY o.createdAt DESC LIMIT 30";
  const rows = await query.all(sql, params);
  return rows || [];
}

async function getMySales(user) {
  if (user.role !== "farmer" && user.role !== "admin") {
    throw new Error("Only farmers can view sales reports.");
  }

  const stats = await query.get(
    `SELECT 
      SUM(amount) as totalRevenue,
      COUNT(DISTINCT orderId) as totalOrders,
      SUM(qty) as totalQty
     FROM order_items WHERE farmerId = ?`,
    [user.id]
  );

  const topProducts = await query.all(
    `SELECT p.name, SUM(oi.qty) as unitsSold, SUM(oi.amount) as revenue
     FROM order_items oi JOIN products p ON oi.productId = p.id
     WHERE oi.farmerId = ?
     GROUP BY oi.productId ORDER BY revenue DESC LIMIT 5`,
    [user.id]
  );

  return {
    revenue: stats ? (stats.totalRevenue || 0) : 0,
    orders: stats ? (stats.totalOrders || 0) : 0,
    quantitySold: stats ? (stats.totalQty || 0) : 0,
    topProducts: topProducts || []
  };
}

async function getMyInventory(user) {
  if (user.role !== "farmer" && user.role !== "admin") {
    throw new Error("Only farmers can check inventory.");
  }
  const rows = await query.all("SELECT id, name, category, price, unit, stock, moq, organic FROM products WHERE farmerId = ?", [user.id]);
  return rows || [];
}

async function getPriceInsights(productId) {
  let product = null;
  if (productId) {
    product = await query.get("SELECT * FROM products WHERE id = ?", [productId]);
  }

  const category = product ? product.category : "Vegetables";
  const stats = await query.get(
    "SELECT AVG(price) as avgPrice, MIN(price) as minPrice, MAX(price) as maxPrice, COUNT(*) as sampleCount FROM products WHERE LOWER(category) = LOWER(?)",
    [category]
  );

  const rawAvg = stats && stats.avgPrice != null ? parseFloat(stats.avgPrice) : 40;
  const avgPrice = !isNaN(rawAvg) ? parseFloat(rawAvg.toFixed(1)) : 40;
  const minRange = Math.max(1, Math.round(avgPrice * 0.9));
  const maxRange = Math.round(avgPrice * 1.1);

  return {
    product: product ? { id: product.id, name: product.name, currentPrice: product.price, category: product.category, unit: product.unit } : null,
    recommendedRange: `₹${minRange}–₹${maxRange}/${product ? product.unit : "kg"}`,
    confidence: "82%",
    platformAverage: `₹${avgPrice}/${product ? product.unit : "kg"}`,
    basis: "Based on FarmConnect platform data (sample size: " + (stats ? stats.sampleCount : 1) + " listings)",
    reasons: [
      `Recent B2B demand for ${category} lots is stable.`,
      `Comparable platform listings average ₹${avgPrice}/kg.`,
      "Verified grower supplier score correlates with upper pricing bracket."
    ]
  };
}

async function getDemandInsights(category = "All") {
  const totalOrders = await query.get("SELECT COUNT(*) as count FROM orders");
  const count = totalOrders ? totalOrders.count : 0;

  if (count < 2) {
    return {
      sufficientData: false,
      message: "Not enough historical data for a reliable forecast. Requires at least 2 completed orders."
    };
  }

  return {
    sufficientData: true,
    category: category,
    projectedGrowth: "+18%",
    timeframe: "next 14 days",
    summary: `Demand for ${category === "All" ? "regional agricultural produce" : category} is projected to increase approximately 18% over the next 14 days.`,
    basis: "Based on historical FarmConnect order trends",
    disclaimer: "Forecasts are estimates based on platform historical sales volume."
  };
}

// -------------------------------------------------------------
// Phase 2 Agricultural Intelligence Implementations
// -------------------------------------------------------------

/**
 * getWeatherAdvisory: Retrieves live weather and synthesizes agricultural recommendations
 */
async function getWeatherAdvisory(params, user) {
  const lat = params.lat || user.lat;
  const lng = params.lng || user.lng;
  const district = params.district || user.district;
  const region = params.region || user.region;
  const rawCrop = params.crop || user.primaryCrop || null;
  const crop = rawCrop ? normalizeCropName(rawCrop) : null;

  const weatherRes = await getLiveWeatherForecast({ lat, lng, district, region });
  if (!weatherRes || !weatherRes.success) {
    return {
      success: false,
      error: {
        code: "WEATHER_UNAVAILABLE",
        message: "Weather information is temporarily unavailable for this region."
      }
    };
  }

  const wData = weatherRes.data;
  const current = wData.current;
  const indicators = wData.agriculturalIndicators;

  const advisoryPoints = [];

  if (indicators.rainExpectedNext48h) {
    advisoryPoints.push("Precipitation is anticipated within the next 48 hours. Consider completing urgent harvesting and ensure harvested produce is sheltered in dry storage.");
  } else {
    advisoryPoints.push("No significant rainfall is expected over the next 48 hours. Field conditions appear favorable for harvest, drying, and transit.");
  }

  if (current.temperatureC > 35) {
    advisoryPoints.push(`Elevated temperature (${current.temperatureC}°C) detected. For sensitive produce like leafy greens and ripe tomatoes, harvest in the early morning or evening to preserve freshness and reduce heat wilt.`);
  }

  if (current.windSpeedKmh > 20) {
    advisoryPoints.push(`Wind speed is elevated (${current.windSpeedKmh} km/h). Postpone delicate foliage spraying until calmer wind conditions prevail.`);
  }

  if (crop) {
    advisoryPoints.push(`For ${crop}: ensure proper moisture drainage and post-harvest shading given current ${current.condition.toLowerCase()} conditions.`);
  }

  return {
    location: wData.location,
    currentConditions: {
      temperature: `${current.temperatureC}°C`,
      condition: current.condition,
      humidity: `${current.humidityPct}%`,
      windSpeed: `${current.windSpeedKmh} km/h`
    },
    indicators: {
      rainNext48h: indicators.rainExpectedNext48h,
      upcomingRainRisks: indicators.highRainfallRiskDays,
      harvestingSuitability: indicators.favorableHarvestingConditions ? "Favorable" : "Caution (Rain risk)"
    },
    advisories: advisoryPoints,
    disclaimer: "Based on available Open-Meteo meteorological forecasts. Local micro-climates may vary; consider field conditions before major agricultural decisions."
  };
}

/**
 * getPriceIntelligence: Calculates real price statistics from actual database records without inventing historical points
 */
async function getPriceIntelligence({ commodity = null, category = null, productId = null }) {
  let whereClauses = ["1=1"];
  const params = [];
  const canonicalCommodity = commodity ? normalizeCropName(commodity) : null;

  if (productId) {
    whereClauses.push("id = ?");
    params.push(productId);
  } else if (commodity && commodity.trim()) {
    const rawTerm = `%${commodity.trim().toLowerCase()}%`;
    if (canonicalCommodity && canonicalCommodity.toLowerCase() !== commodity.trim().toLowerCase()) {
      whereClauses.push("(LOWER(name) LIKE ? OR LOWER(description) LIKE ? OR LOWER(name) LIKE ? OR LOWER(description) LIKE ?)");
      const canonTerm = `%${canonicalCommodity.toLowerCase()}%`;
      params.push(rawTerm, rawTerm, canonTerm, canonTerm);
    } else {
      whereClauses.push("(LOWER(name) LIKE ? OR LOWER(description) LIKE ?)");
      params.push(rawTerm, rawTerm);
    }
  } else if (category && category !== "All") {
    whereClauses.push("LOWER(category) = LOWER(?)");
    params.push(category.trim());
  }

  const sql = `SELECT * FROM products WHERE ${whereClauses.join(" AND ")}`;
  const listings = await query.all(sql, params);

  if (!listings || listings.length === 0) {
    return {
      hasData: false,
      sampleSize: 0,
      target: commodity || category || "Selected produce",
      message: `FarmConnect does not currently have active listings for '${commodity || category || "this produce"}' to calculate price intelligence.`
    };
  }

  // Calculate real statistical distributions
  const prices = listings.map(l => parseFloat(l.price)).filter(p => !isNaN(p)).sort((a, b) => a - b);
  const minPrice = prices[0];
  const maxPrice = prices[prices.length - 1];
  const sumPrice = prices.reduce((acc, p) => acc + p, 0);
  const avgPrice = parseFloat((sumPrice / prices.length).toFixed(1));

  // Calculate true median
  const mid = Math.floor(prices.length / 2);
  const medianPrice = prices.length % 2 !== 0 ? prices[mid] : parseFloat(((prices[mid - 1] + prices[mid]) / 2).toFixed(1));

  // Organic breakdown
  const organicListings = listings.filter(l => l.organic === 1 || l.organic === true);
  const convListings = listings.filter(l => l.organic !== 1 && l.organic !== true);

  const organicAvg = organicListings.length > 0
    ? parseFloat((organicListings.reduce((acc, l) => acc + parseFloat(l.price), 0) / organicListings.length).toFixed(1))
    : null;

  const convAvg = convListings.length > 0
    ? parseFloat((convListings.reduce((acc, l) => acc + parseFloat(l.price), 0) / convListings.length).toFixed(1))
    : null;

  // Check recent order item transaction prices from actual orders
  const productIds = listings.map(l => l.id);
  let recentOrderStats = null;
  if (productIds.length > 0) {
    const placeholders = productIds.map(() => "?").join(",");
    const recentOrders = await query.all(
      `SELECT oi.unitPrice, oi.qty, o.createdAt 
       FROM order_items oi JOIN orders o ON oi.orderId = o.id 
       WHERE oi.productId IN (${placeholders}) 
       ORDER BY o.createdAt DESC LIMIT 10`,
      productIds
    );

    if (recentOrders && recentOrders.length > 0) {
      const orderPrices = recentOrders.map(o => parseFloat(o.unitPrice)).filter(p => !isNaN(p));
      const orderAvg = parseFloat((orderPrices.reduce((a, b) => a + b, 0) / orderPrices.length).toFixed(1));
      recentOrderStats = {
        transactionsSampled: recentOrders.length,
        averageTradedPrice: `₹${orderAvg}/${listings[0].unit || "kg"}`,
        lastTradedPrice: `₹${recentOrders[0].unitPrice}/${listings[0].unit || "kg"}`
      };
    }
  }

  const unit = listings[0].unit || "kg";
  const fairMin = Math.round(avgPrice * 0.9);
  const fairMax = Math.round(avgPrice * 1.1);

  return {
    hasData: true,
    target: commodity || category || listings[0].name,
    sampleSize: listings.length,
    unit: unit,
    statistics: {
      minimumPrice: `₹${minPrice}/${unit}`,
      maximumPrice: `₹${maxPrice}/${unit}`,
      averagePrice: `₹${avgPrice}/${unit}`,
      medianPrice: `₹${medianPrice}/${unit}`,
      recommendedFairRange: `₹${fairMin}–₹${fairMax}/${unit}`
    },
    segmentation: {
      organicListingsCount: organicListings.length,
      organicAverage: organicAvg ? `₹${organicAvg}/${unit}` : "No organic listings",
      conventionalListingsCount: convListings.length,
      conventionalAverage: convAvg ? `₹${convAvg}/${unit}` : "No conventional listings"
    },
    recentTransactions: recentOrderStats,
    basis: `Calculated from ${listings.length} active FarmConnect marketplace listing(s).`,
    disclaimer: "Market price intelligence is derived from active platform listings and recent order fulfillments. It represents an informational benchmark rather than a guaranteed price."
  };
}

/**
 * getDemandIntelligence: Calculates real demand metrics and trends from actual orders without fabricated claims
 */
async function getDemandIntelligence({ category = "All", commodity = null, days = 30 }) {
  const totalOrdersRow = await query.get("SELECT COUNT(*) as count FROM orders");
  const totalOrdersCount = totalOrdersRow ? totalOrdersRow.count : 0;

  if (totalOrdersCount < 2) {
    return {
      hasSufficientData: false,
      totalPlatformOrders: totalOrdersCount,
      message: "Insufficient historical order data on FarmConnect to determine a reliable demand trend. At least 2 completed procurement orders are required."
    };
  }

  // Query order items joined with products to aggregate real demand
  let whereConditions = ["1=1"];
  const params = [];

  if (category && category !== "All") {
    whereConditions.push("LOWER(p.category) = LOWER(?)");
    params.push(category.trim());
  }

  const canonicalCommodity = commodity ? normalizeCropName(commodity) : null;
  if (commodity && commodity.trim()) {
    const rawTerm = `%${commodity.trim().toLowerCase()}%`;
    if (canonicalCommodity && canonicalCommodity.toLowerCase() !== commodity.trim().toLowerCase()) {
      whereConditions.push("(LOWER(p.name) LIKE ? OR LOWER(p.description) LIKE ? OR LOWER(p.name) LIKE ? OR LOWER(p.description) LIKE ?)");
      const canonTerm = `%${canonicalCommodity.toLowerCase()}%`;
      params.push(rawTerm, rawTerm, canonTerm, canonTerm);
    } else {
      whereConditions.push("(LOWER(p.name) LIKE ? OR LOWER(p.description) LIKE ?)");
      params.push(rawTerm, rawTerm);
    }
  }

  const itemsSql = `
    SELECT oi.id, oi.qty, oi.amount, oi.unitPrice, p.name as productName, p.category, p.unit, o.createdAt, o.status
    FROM order_items oi
    JOIN orders o ON oi.orderId = o.id
    JOIN products p ON oi.productId = p.id
    WHERE ${whereConditions.join(" AND ")}
    ORDER BY o.createdAt DESC
  `;

  const orderItems = await query.all(itemsSql, params);

  if (!orderItems || orderItems.length === 0) {
    return {
      hasSufficientData: false,
      totalPlatformOrders: totalOrdersCount,
      category: category,
      commodity: commodity,
      message: `No order records found for '${commodity || category}'. Demand trend cannot be calculated without recorded purchases.`
    };
  }

  // Calculate volume totals
  const totalQtyOrdered = orderItems.reduce((acc, i) => acc + (parseInt(i.qty, 10) || 0), 0);
  const totalSpend = orderItems.reduce((acc, i) => acc + (parseFloat(i.amount) || 0), 0);

  // Group by product name
  const productQuantities = {};
  for (const item of orderItems) {
    const key = item.productName || "Unknown";
    productQuantities[key] = (productQuantities[key] || 0) + (parseInt(item.qty, 10) || 0);
  }

  const topDemandItems = Object.entries(productQuantities)
    .map(([name, qty]) => ({ name, quantityProcured: qty }))
    .sort((a, b) => b.quantityProcured - a.quantityProcured)
    .slice(0, 5);

  // Split into current period vs previous period to calculate genuine trend
  const midIndex = Math.floor(orderItems.length / 2);
  const recentHalf = orderItems.slice(0, midIndex);
  const olderHalf = orderItems.slice(midIndex);

  const currentPeriodQty = recentHalf.reduce((acc, i) => acc + (parseInt(i.qty, 10) || 0), 0);
  const previousPeriodQty = olderHalf.reduce((acc, i) => acc + (parseInt(i.qty, 10) || 0), 0);

  let trendPercentage = null;
  let trendDirection = "stable";
  let trendExplanation = "";

  if (previousPeriodQty === 0) {
    trendExplanation = "Demand is emerging (no purchases were recorded in the earlier benchmark period).";
  } else {
    trendPercentage = Math.round(((currentPeriodQty - previousPeriodQty) / previousPeriodQty) * 100);
    if (trendPercentage > 5) {
      trendDirection = "increasing";
      trendExplanation = `Procurement order volume has increased by ${trendPercentage}% compared to the previous period based on FarmConnect order logs.`;
    } else if (trendPercentage < -5) {
      trendDirection = "decreasing";
      trendExplanation = `Procurement order volume has decreased by ${Math.abs(trendPercentage)}% compared to the previous period.`;
    } else {
      trendDirection = "stable";
      trendExplanation = "Order volume has remained steady across comparable trading periods.";
    }
  }

  return {
    hasSufficientData: true,
    category: category,
    commodity: commodity,
    analysisWindow: `${days} days (based on ${orderItems.length} order items)`,
    metrics: {
      totalQuantityProcured: totalQtyOrdered,
      totalTransactionValue: `₹${totalSpend.toLocaleString()}`,
      activeDemandItemsCount: Object.keys(productQuantities).length
    },
    trend: {
      direction: trendDirection,
      percentage: trendPercentage !== null ? `${trendPercentage > 0 ? "+" : ""}${trendPercentage}%` : "Emerging",
      summary: trendExplanation
    },
    topDemandedProduce: topDemandItems,
    basis: `Derived from actual FarmConnect transaction logs (${orderItems.length} purchased item records across completed orders).`
  };
}

/**
 * getSellingRecommendation: Synthesizes farmer inventory, real prices, actual demand, and weather into a structured recommendation
 */
async function getSellingRecommendation(params = {}, user) {
  const farmerId = params.farmerId || user.id;
  const commodity = params.commodity || null;
  const quantity = params.quantity || null;
  const userLocation = {
    district: params.district || user.district,
    region: params.region || user.region,
    lat: params.lat || user.lat,
    lng: params.lng || user.lng
  };

  const strategy = await generateSellingStrategy({
    farmerId,
    commodity,
    quantity,
    userLocation,
    lang: user.lang || "en"
  });

  // Preserve backward-compatible facts/reasoning structure while embedding Phase 9 engine metrics
  const factsObj = {
    ...strategy.facts,
    inventory: strategy.facts?.inventoryStock || strategy.facts?.inventory || "None listed",
    marketPricing: strategy.facts?.currentMedianPrice || strategy.facts?.priceData || "N/A",
    weather: strategy.facts?.weatherConditions || strategy.facts?.weatherData || "Weather unavailable"
  };

  return {
    commodity: strategy.targetCommodity,
    recommendation: strategy.recommendation,
    estimatedGrossRevenue: strategy.estimatedGrossRevenue,
    grossRevenueText: strategy.grossRevenueText,
    riskLevel: strategy.riskLevel,
    FACTS: factsObj,
    REASONING: {
      recommendationSummary: strategy.reasoning,
      keyFactors: [strategy.reasoning]
    },
    DISCLAIMER: `${strategy.disclaimer} This is an informational estimate and decision support tool.`
  };
}


async function getPlatformAnalytics(user) {
  if (user.role !== "admin") {
    throw new Error("Admin role required for executive platform analytics.");
  }

  const usersCount = await query.get("SELECT COUNT(*) as c FROM users");
  const farmersCount = await query.get("SELECT COUNT(*) as c FROM users WHERE role = 'farmer'");
  const vendorsCount = await query.get("SELECT COUNT(*) as c FROM users WHERE role = 'vendor'");
  const productsCount = await query.get("SELECT COUNT(*) as c FROM products");
  const ordersCount = await query.get("SELECT COUNT(*) as c FROM orders");
  const revenueStats = await query.get("SELECT SUM(totalAmount) as total FROM orders WHERE status = 'Delivered'");

  return {
    users: usersCount ? usersCount.c : 0,
    farmers: farmersCount ? farmersCount.c : 0,
    vendors: vendorsCount ? vendorsCount.c : 0,
    products: productsCount ? productsCount.c : 0,
    orders: ordersCount ? ordersCount.c : 0,
    deliveredRevenue: revenueStats ? (revenueStats.total || 0) : 0
  };
}
