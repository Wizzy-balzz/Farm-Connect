import { query } from "../database.js";
import { getLiveWeatherForecast } from "./weatherService.js";
import { getUserProactiveInsights } from "./proactiveInsightService.js";
import { normalizeCropName } from "../ai/aiTools.js";

/**
 * FarmConnect Phase 9 — AI Marketplace & Farmer Selling Agent Service
 * Synthesizes inventory, live/historical prices, demand trends, weather forecasts,
 * pending buyer orders, location, Phase 7 proactive insights, and Phase 8 crop image analyses.
 */

/**
 * Collects verified database and service facts for a farmer's crop or produce category
 */
export async function collectMarketplaceFacts(farmerId, rawCommodity = null, options = {}) {
  const commodity = rawCommodity ? normalizeCropName(rawCommodity) : null;
  const userLocation = options.location || {};

  // 1. Farmer Details & Inventory
  let farmer = null;
  if (farmerId) {
    farmer = await query.get(
      "SELECT id, name, role, region, district, city, lat, lng, primaryCrop FROM users WHERE id = ?",
      [farmerId]
    );
  }

  const district = userLocation.district || (farmer ? farmer.district : null);
  const region = userLocation.region || (farmer ? farmer.region : null);
  const lat = userLocation.lat || (farmer ? farmer.lat : null);
  const lng = userLocation.lng || (farmer ? farmer.lng : null);

  let inventory = [];
  if (farmerId) {
    if (commodity) {
      const rawTerm = `%${commodity.toLowerCase()}%`;
      inventory = await query.all(
        "SELECT * FROM products WHERE farmerId = ? AND (LOWER(name) LIKE ? OR LOWER(category) LIKE ?)",
        [farmerId, rawTerm, rawTerm]
      );
    } else {
      inventory = await query.all(
        "SELECT * FROM products WHERE farmerId = ? ORDER BY createdAt DESC",
        [farmerId]
      );
    }
  }

  // 2. Price Intelligence
  let priceStats = null;
  let priceListings = [];
  if (commodity) {
    const term = `%${commodity.toLowerCase()}%`;
    priceListings = await query.all(
      "SELECT * FROM products WHERE LOWER(name) LIKE ? OR LOWER(category) LIKE ?",
      [term, term]
    );
  } else {
    priceListings = await query.all("SELECT * FROM products LIMIT 50");
  }

  if (priceListings && priceListings.length > 0) {
    const validPrices = priceListings.map(p => parseFloat(p.price)).filter(p => !isNaN(p)).sort((a, b) => a - b);
    if (validPrices.length > 0) {
      const min = validPrices[0];
      const max = validPrices[validPrices.length - 1];
      const sum = validPrices.reduce((a, b) => a + b, 0);
      const avg = parseFloat((sum / validPrices.length).toFixed(1));
      const mid = Math.floor(validPrices.length / 2);
      const median = validPrices.length % 2 !== 0 ? validPrices[mid] : parseFloat(((validPrices[mid - 1] + validPrices[mid]) / 2).toFixed(1));

      const organic = priceListings.filter(p => p.organic === 1 || p.organic === true);
      const conventional = priceListings.filter(p => p.organic !== 1 && p.organic !== true);

      priceStats = {
        sampleSize: validPrices.length,
        unit: priceListings[0].unit || "kg",
        minPrice: min,
        maxPrice: max,
        avgPrice: avg,
        medianPrice: median,
        organicCount: organic.length,
        conventionalCount: conventional.length,
        organicAvg: organic.length > 0 ? parseFloat((organic.reduce((a, p) => a + parseFloat(p.price), 0) / organic.length).toFixed(1)) : null,
        conventionalAvg: conventional.length > 0 ? parseFloat((conventional.reduce((a, p) => a + parseFloat(p.price), 0) / conventional.length).toFixed(1)) : null
      };
    }
  }

  // 3. Demand Intelligence (Orders in last 7, 30, 90 days)
  let demandStats = null;
  const totalOrdersRow = await query.get("SELECT COUNT(*) as count FROM orders");
  const totalOrdersCount = totalOrdersRow ? totalOrdersRow.count : 0;

  if (totalOrdersCount >= 1) {
    let orderItemsSql = `
      SELECT oi.qty, oi.unitPrice, oi.amount, o.createdAt, p.name as productName, p.category
      FROM order_items oi
      JOIN orders o ON oi.orderId = o.id
      JOIN products p ON oi.productId = p.id
    `;
    const orderParams = [];
    if (commodity) {
      const term = `%${commodity.toLowerCase()}%`;
      orderItemsSql += " WHERE LOWER(p.name) LIKE ? OR LOWER(p.category) LIKE ?";
      orderParams.push(term, term);
    }

    const orderItems = await query.all(orderItemsSql, orderParams);
    if (orderItems && orderItems.length > 0) {
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;

      const items7d = orderItems.filter(i => (now - new Date(i.createdAt).getTime()) <= 7 * dayMs);
      const items30d = orderItems.filter(i => (now - new Date(i.createdAt).getTime()) <= 30 * dayMs);
      const items90d = orderItems.filter(i => (now - new Date(i.createdAt).getTime()) <= 90 * dayMs);

      const qty7d = items7d.reduce((sum, i) => sum + (parseInt(i.qty, 10) || 0), 0);
      const qty30d = items30d.reduce((sum, i) => sum + (parseInt(i.qty, 10) || 0), 0);
      const qty90d = items90d.reduce((sum, i) => sum + (parseInt(i.qty, 10) || 0), 0);

      let trend = "stable";
      if (qty7d > (qty30d / 4) * 1.2) {
        trend = "increasing";
      } else if (qty7d < (qty30d / 4) * 0.8) {
        trend = "decreasing";
      }

      demandStats = {
        totalOrdersSampled: orderItems.length,
        qty7d,
        qty30d,
        qty90d,
        trend,
        demandSurge: trend === "increasing"
      };
    }
  }

  // 4. Pending / Unfulfilled Buyer Orders
  let pendingOrders = [];
  if (commodity) {
    const term = `%${commodity.toLowerCase()}%`;
    pendingOrders = await query.all(
      `SELECT o.id, o.vendorName, o.deliveryDistrict, o.deliveryRegion, oi.qty, oi.unitPrice, p.name as productName
       FROM orders o
       JOIN order_items oi ON o.id = oi.orderId
       JOIN products p ON oi.productId = p.id
       WHERE o.status IN ('Pending', 'Processing') AND (LOWER(p.name) LIKE ? OR LOWER(p.category) LIKE ?)`,
      [term, term]
    );
  } else {
    pendingOrders = await query.all(
      `SELECT o.id, o.vendorName, o.deliveryDistrict, o.deliveryRegion, oi.qty, oi.unitPrice, p.name as productName
       FROM orders o
       JOIN order_items oi ON o.id = oi.orderId
       JOIN products p ON oi.productId = p.id
       WHERE o.status IN ('Pending', 'Processing') LIMIT 10`
    );
  }

  // 5. Weather Forecast
  let weather = null;
  if ((lat && lng) || district || region) {
    const wRes = await getLiveWeatherForecast({ lat, lng, district, region, crop: commodity });
    if (wRes && wRes.success) {
      weather = wRes.data;
    }
  }

  // 6. Phase 7 Proactive Insights
  let proactiveInsights = [];
  if (farmerId) {
    try {
      const insightsRes = await getUserProactiveInsights(farmerId, { status: "active" });
      if (insightsRes && insightsRes.success) {
        proactiveInsights = insightsRes.data || [];
      }
    } catch (e) {
      // safe fallback
    }
  }

  // 7. Phase 8 Crop Image Analyses
  let cropAnalyses = [];
  if (farmerId) {
    try {
      cropAnalyses = await query.all(
        "SELECT * FROM ai_image_analyses WHERE userId = ? ORDER BY createdAt DESC LIMIT 3",
        [farmerId]
      );
    } catch (e) {
      // safe fallback
    }
  }

  return {
    commodity: commodity || "All Crops",
    farmerId,
    location: { district, region, lat, lng },
    inventory,
    priceStats,
    demandStats,
    pendingOrders: pendingOrders || [],
    weather,
    proactiveInsights,
    cropAnalyses
  };
}

/**
 * Generates a comprehensive selling strategy with strict FACTS vs REASONING separation,
 * recommendation badge, revenue estimation, and disclaimers.
 */
export async function generateSellingStrategy({ farmerId, commodity = null, quantity = null, userLocation = null, lang = "en" }) {
  const facts = await collectMarketplaceFacts(farmerId, commodity, { location: userLocation });

  const canonical = commodity ? normalizeCropName(commodity) : (facts.inventory.length > 0 ? facts.inventory[0].name : "Crop");
  const farmerStock = facts.inventory.reduce((sum, item) => sum + (parseInt(item.stock, 10) || 0), 0);
  const targetQty = quantity !== null && !isNaN(Number(quantity)) && Number(quantity) > 0
    ? Number(quantity)
    : (farmerStock > 0 ? farmerStock : null);

  // Check if data is completely insufficient
  if (!facts.priceStats && farmerStock === 0 && facts.pendingOrders.length === 0) {
    return {
      success: true,
      recommendation: "NEED_MORE_INFORMATION",
      targetCommodity: canonical,
      targetQuantity: targetQty,
      facts: {
        inventory: "No stock listed in inventory.",
        priceData: "No active platform listings found for " + canonical + ".",
        demandData: "No recent procurement order history.",
        weatherData: facts.weather ? `${facts.weather.current.temperatureC}°C, ${facts.weather.current.condition}` : "Unavailable"
      },
      reasoning: `Insufficient platform data is available to generate a reliable selling decision for ${canonical}. Please update your inventory stock or check back when market listings are active.`,
      estimatedGrossRevenue: null,
      riskLevel: "Low",
      disclaimer: "Agricultural selling recommendations are decision-support estimates based on current platform data and weather forecasts."
    };
  }

  // Evaluate Decision Parameters
  const price = facts.priceStats ? facts.priceStats.medianPrice : null;
  const avgPrice = facts.priceStats ? facts.priceStats.avgPrice : null;
  const trend = facts.demandStats ? facts.demandStats.trend : "stable";
  const rainRisk = facts.weather && facts.weather.agriculturalIndicators ? facts.weather.agriculturalIndicators.rainExpectedNext48h : false;

  let recommendation = "WAIT";
  let reasoningPoints = [];
  let riskLevel = "Medium";

  if (farmerStock === 0 && facts.priceStats) {
    recommendation = "LIST_NOW";
    riskLevel = "Low";
    reasoningPoints.push(`You currently have no listed stock for ${canonical}. Platform demand and prices average ₹${avgPrice}/kg. Listing your crop now allows prospective buyers to view your produce.`);
  } else if (rainRisk && (trend === "increasing" || price)) {
    recommendation = "PARTIAL_SELL";
    riskLevel = "Medium";
    reasoningPoints.push(`Rainfall is anticipated within the next 48 hours, posing harvest and transit risk. However, current market demand is ${trend} at ~₹${price || avgPrice}/kg. Selling part of your stock (e.g. 50%) now locks in immediate revenue while mitigating crop weather risk.`);
  } else if (trend === "increasing" && price && price >= avgPrice) {
    recommendation = "SELL_NOW";
    riskLevel = "Low";
    reasoningPoints.push(`Market demand is surging and current median price (₹${price}/kg) is strong. Capitalizing on high buyer activity reduces inventory holding costs.`);
  } else if (trend === "decreasing" && price) {
    recommendation = "PARTIAL_SELL";
    riskLevel = "High";
    reasoningPoints.push(`Demand has slowed recently. Consider selling a portion of mature stock now to maintain cash flow while holding the remainder for price recovery.`);
  } else {
    recommendation = "WAIT";
    riskLevel = "Medium";
    reasoningPoints.push(`Market prices (₹${price || avgPrice}/kg) and demand are stable. Holding inventory under safe storage conditions may yield better price realization as demand builds.`);
  }

  // Factor in Phase 8 Crop Analyses if available
  if (facts.cropAnalyses && facts.cropAnalyses.length > 0) {
    const latestAnalysis = facts.cropAnalyses[0];
    if (latestAnalysis.crop && latestAnalysis.crop.toLowerCase().includes(canonical.toLowerCase())) {
      reasoningPoints.push(`Recent AI crop image analysis noted potential plant health observations. Accelerating sale of mature produce helps avoid disease degradation in field.`);
    }
  }

  // Factor in Phase 7 Proactive Insights if available
  if (facts.proactiveInsights && facts.proactiveInsights.length > 0) {
    const relevantInsight = facts.proactiveInsights.find(i => i.title.toLowerCase().includes(canonical.toLowerCase()) || i.type === "demand" || i.type === "price");
    if (relevantInsight) {
      reasoningPoints.push(`Active Smart Alert: ${relevantInsight.title} — ${relevantInsight.message}`);
    }
  }

  // Calculate Estimated Gross Revenue if quantity & price available
  let estimatedGrossRevenue = null;
  let grossRevenueText = null;
  const unitPriceToUse = price || avgPrice;

  if (targetQty && unitPriceToUse) {
    const totalRev = targetQty * unitPriceToUse;
    estimatedGrossRevenue = totalRev;
    const unit = facts.priceStats ? facts.priceStats.unit : "kg";
    grossRevenueText = `ESTIMATED GROSS REVENUE: ₹${totalRev.toLocaleString('en-IN')} (${targetQty} ${unit} × ₹${unitPriceToUse}/${unit})`;
  }

  // Format Structured FACTS
  const formattedFacts = {
    commodity: canonical,
    inventoryStock: farmerStock > 0 ? `${farmerStock} ${facts.priceStats ? facts.priceStats.unit : "kg"}` : "None listed",
    currentMedianPrice: price ? `₹${price}/${facts.priceStats.unit}` : (avgPrice ? `₹${avgPrice}/${facts.priceStats.unit}` : "N/A"),
    priceRange: facts.priceStats ? `₹${facts.priceStats.minPrice} – ₹${facts.priceStats.maxPrice}/${facts.priceStats.unit}` : "N/A",
    demandTrend: facts.demandStats ? facts.demandStats.trend : "Insufficient order data",
    recentOrderVolume: facts.demandStats ? `${facts.demandStats.qty30d || 0} units in 30 days` : "0 orders",
    weatherConditions: facts.weather && facts.weather.current ? `${facts.weather.current.temperatureC}°C, ${facts.weather.current.condition}, Rain Risk: ${rainRisk ? "Yes" : "No"}` : "Weather unavailable",
    pendingBuyerOrdersCount: facts.pendingOrders.length,
    location: facts.location.district ? `${facts.location.district}, ${facts.location.region || ""}` : (facts.location.region || "Regional")
  };

  return {
    success: true,
    recommendation,
    targetCommodity: canonical,
    targetQuantity: targetQty,
    facts: formattedFacts,
    reasoning: reasoningPoints.join(" "),
    estimatedGrossRevenue,
    grossRevenueText,
    riskLevel,
    disclaimer: "Recommendations are decision-support estimates based on platform data and weather forecasts. Future market prices and profits cannot be guaranteed."
  };
}

/**
 * Compares 2 or more crops side-by-side for selling decisions
 */
export async function compareSellingOptions({ farmerId, commodities = [], userLocation = null }) {
  if (!Array.isArray(commodities) || commodities.length === 0) {
    commodities = ["Tomato", "Onion"];
  }

  const comparisonRows = [];

  for (const item of commodities) {
    const strategy = await generateSellingStrategy({
      farmerId,
      commodity: item,
      userLocation
    });

    comparisonRows.push({
      commodity: strategy.targetCommodity,
      inventory: strategy.facts.inventoryStock,
      currentPrice: strategy.facts.currentMedianPrice,
      demandTrend: strategy.facts.demandTrend,
      weatherRisk: strategy.facts.weatherConditions.includes("Rain Risk: Yes") ? "High Rain Risk" : "Normal",
      recommendation: strategy.recommendation,
      riskLevel: strategy.riskLevel,
      estimatedRevenue: strategy.grossRevenueText || "N/A"
    });
  }

  return {
    success: true,
    comparedCount: comparisonRows.length,
    comparison: comparisonRows,
    disclaimer: "Comparative recommendations analyze platform price and demand data side-by-side to assist harvest prioritization."
  };
}

/**
 * Generates a comprehensive smart selling plan for all crops listed or grown by the farmer
 */
export async function generateSmartSellingPlan({ farmerId, userLocation = null }) {
  if (!farmerId) {
    throw new Error("Farmer ID is required to generate a selling plan.");
  }

  const products = await query.all("SELECT * FROM products WHERE farmerId = ?", [farmerId]);

  let targetCrops = [];
  if (products && products.length > 0) {
    targetCrops = [...new Set(products.map(p => p.name))];
  } else {
    const user = await query.get("SELECT primaryCrop, cropsGrown FROM users WHERE id = ?", [farmerId]);
    if (user && user.primaryCrop) {
      targetCrops.push(user.primaryCrop);
    } else {
      targetCrops = ["Tomato", "Onion"];
    }
  }

  const planItems = [];

  for (const crop of targetCrops) {
    const strat = await generateSellingStrategy({ farmerId, commodity: crop, userLocation });
    planItems.push({
      product: strat.targetCommodity,
      inventory: strat.facts.inventoryStock,
      marketSituation: strat.facts.currentMedianPrice !== "N/A" ? `Median price ${strat.facts.currentMedianPrice}` : "Limited market listings",
      demand: strat.facts.demandTrend,
      weatherConsiderations: strat.facts.weatherConditions,
      suggestedQuantity: strat.targetQuantity ? `${Math.round(strat.targetQuantity * (strat.recommendation === "PARTIAL_SELL" ? 0.5 : 1))} kg` : "N/A",
      suggestedPriceRange: strat.facts.priceRange,
      suggestedTiming: strat.recommendation === "SELL_NOW" ? "Immediate (Next 24-48h)" : (strat.recommendation === "PARTIAL_SELL" ? "Partial sale now" : "Hold for 7-14 days"),
      recommendation: strat.recommendation,
      risk: strat.riskLevel,
      reasoning: strat.reasoning,
      estimatedGrossRevenue: strat.grossRevenueText
    });
  }

  return {
    success: true,
    farmerId,
    totalCropsEvaluated: planItems.length,
    plan: planItems,
    disclaimer: "Suggested quantities and price ranges are recommendations, not guarantees. Review local market conditions before executing sales."
  };
}

/**
 * Detects data-driven selling opportunities for the farmer
 */
export async function detectSellingOpportunities(farmerId, userLocation = null) {
  const opportunities = [];
  const products = await query.all("SELECT * FROM products WHERE farmerId = ?", [farmerId]);

  for (const prod of (products || [])) {
    const facts = await collectMarketplaceFacts(farmerId, prod.name, { location: userLocation });
    if (facts.demandStats && facts.demandStats.trend === "increasing") {
      opportunities.push({
        id: `opp_demand_${prod.id}`,
        type: "HIGH_DEMAND",
        title: `Demand Surge for ${prod.name}`,
        commodity: prod.name,
        description: `High procurement demand detected for ${prod.name} with ${facts.demandStats.qty30d} units ordered recently.`,
        action: "SELL_NOW",
        productId: prod.id,
        currentStock: prod.stock,
        currentPrice: prod.price
      });
    }

    if (facts.weather && facts.weather.agriculturalIndicators && facts.weather.agriculturalIndicators.rainExpectedNext48h) {
      opportunities.push({
        id: `opp_weather_${prod.id}`,
        type: "WEATHER_RISK",
        title: `Weather Harvest Risk for ${prod.name}`,
        commodity: prod.name,
        description: `Rainfall forecasted within 48h. Selling part of your ${prod.name} stock protects harvested produce.`,
        action: "PARTIAL_SELL",
        productId: prod.id,
        currentStock: prod.stock,
        currentPrice: prod.price
      });
    }

    if (facts.priceStats && prod.price < facts.priceStats.avgPrice) {
      opportunities.push({
        id: `opp_price_${prod.id}`,
        type: "PRICE_OPPORTUNITY",
        title: `Price Adjustment Opportunity for ${prod.name}`,
        commodity: prod.name,
        description: `Your listed price (₹${prod.price}/kg) is below platform average (₹${facts.priceStats.avgPrice}/kg). Updating your price may increase revenue.`,
        action: "UPDATE_PRICE",
        productId: prod.id,
        suggestedPrice: facts.priceStats.avgPrice,
        currentPrice: prod.price
      });
    }
  }

  return {
    success: true,
    farmerId,
    opportunityCount: opportunities.length,
    opportunities
  };
}

/**
 * Retrieves unfulfilled buyer orders near farmer location
 */
export async function getNearbyBuyerOpportunities({ farmerId, district = null, region = null }) {
  let farmer = null;
  if (farmerId) {
    farmer = await query.get("SELECT district, region FROM users WHERE id = ?", [farmerId]);
  }

  const targetDistrict = district || (farmer ? farmer.district : null);
  const targetRegion = region || (farmer ? farmer.region : null);

  let sql = `
    SELECT o.id as orderId, o.vendorName, o.deliveryDistrict, o.deliveryRegion, o.totalAmount, o.status, o.createdAt,
           oi.qty, oi.unitPrice, p.name as productName, p.category
    FROM orders o
    JOIN order_items oi ON o.id = oi.orderId
    JOIN products p ON oi.productId = p.id
    WHERE o.status IN ('Pending', 'Processing')
  `;
  const params = [];

  if (targetDistrict) {
    sql += " AND LOWER(o.deliveryDistrict) = LOWER(?)";
    params.push(targetDistrict);
  } else if (targetRegion) {
    sql += " AND LOWER(o.deliveryRegion) = LOWER(?)";
    params.push(targetRegion);
  }

  sql += " ORDER BY o.createdAt DESC LIMIT 15";
  const rows = await query.all(sql, params);

  return {
    success: true,
    location: { district: targetDistrict, region: targetRegion },
    buyerDemandCount: (rows || []).length,
    buyerOpportunities: rows || []
  };
}

/**
 * Returns overall marketplace overview for a district/region
 */
export async function getMarketplaceOverview({ district = null, region = null }) {
  let productSql = "SELECT * FROM products WHERE 1=1";
  const productParams = [];

  if (district) {
    productSql += " AND LOWER(district) = LOWER(?)";
    productParams.push(district);
  } else if (region) {
    productSql += " AND LOWER(region) = LOWER(?)";
    productParams.push(region);
  }

  productSql += " ORDER BY createdAt DESC LIMIT 30";
  const listings = await query.all(productSql, productParams);

  const totalListings = listings ? listings.length : 0;
  const categories = [...new Set((listings || []).map(l => l.category))];

  return {
    success: true,
    location: { district, region },
    totalListings,
    categories,
    recentListings: (listings || []).slice(0, 10)
  };
}
