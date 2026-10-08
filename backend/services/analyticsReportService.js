import { query } from "../database.js";
import { normalizeCropName } from "../ai/aiTools.js";
import { getLiveWeatherForecast } from "./weatherService.js";
import { getUserProactiveInsights } from "./proactiveInsightService.js";
import { detectSellingOpportunities } from "./marketplaceAgentService.js";

/**
 * FarmConnect Phase 10 — AI Analytics & Report Service
 * Collects verified database facts, computes deterministic metrics,
 * performs period comparisons without data fabrication, and structures
 * reports into FACTS, REASONING, INSIGHTS, RECOMMENDATIONS, and LIMITATIONS.
 */

// ==========================================
// DATE & RANGE UTILITIES
// ==========================================

export function resolveDateRange(rangeStr = "30d", customStart = null, customEnd = null) {
  const now = new Date();
  let endDate = customEnd ? new Date(customEnd) : now;
  if (isNaN(endDate.getTime())) endDate = now;

  let startDate;
  let label = "30 days";

  if (customStart) {
    startDate = new Date(customStart);
    if (isNaN(startDate.getTime())) {
      startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    label = "custom";
  } else {
    const range = (rangeStr || "30d").toLowerCase();
    if (range === "7d" || range === "7 days" || range === "week") {
      startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      label = "7 days";
    } else if (range === "90d" || range === "90 days" || range === "quarter") {
      startDate = new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);
      label = "90 days";
    } else if (range === "month" || range === "this month") {
      startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
      label = "this month";
    } else if (range === "last month") {
      startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 1, 1);
      endDate = new Date(endDate.getFullYear(), endDate.getMonth(), 0, 23, 59, 59, 999);
      label = "last month";
    } else {
      startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      label = "30 days";
    }
  }

  const durationMs = endDate.getTime() - startDate.getTime();
  const prevEndDate = new Date(startDate.getTime() - 1);
  const prevStartDate = new Date(prevEndDate.getTime() - durationMs);

  return {
    label,
    current: {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      startMs: startDate.getTime(),
      endMs: endDate.getTime()
    },
    previous: {
      startDate: prevStartDate.toISOString(),
      endDate: prevEndDate.toISOString(),
      startMs: prevStartDate.getTime(),
      endMs: prevEndDate.getTime()
    }
  };
}

/**
 * Computes deterministic change between current and previous periods.
 * Strictly avoids fabricating percentage when previous metric is 0 or unavailable.
 */
export function calculateMetricComparison(currentVal = 0, previousVal = 0, metricName = "metric", unit = "") {
  const curr = parseFloat(currentVal) || 0;
  const prev = parseFloat(previousVal) || 0;
  const absChange = parseFloat((curr - prev).toFixed(2));

  if (prev <= 0) {
    return {
      metric: metricName,
      current: curr,
      previous: prev,
      absoluteChange: absChange,
      percentageChange: null,
      unit,
      comparisonAvailable: false,
      message: "Previous-period comparison is unavailable because there is insufficient data."
    };
  }

  const pctChange = parseFloat((((curr - prev) / prev) * 100).toFixed(1));
  const trend = pctChange > 0 ? "up" : pctChange < 0 ? "down" : "flat";

  return {
    metric: metricName,
    current: curr,
    previous: prev,
    absoluteChange: absChange,
    percentageChange: pctChange,
    unit,
    trend,
    comparisonAvailable: true,
    message: `${pctChange >= 0 ? "+" : ""}${pctChange}% compared to previous period.`
  };
}

// ==========================================
// 1. FARMER SALES ANALYTICS
// ==========================================

export async function getFarmerSalesAnalytics(farmerId, options = {}) {
  if (!farmerId) throw new Error("farmerId is required for sales analytics.");

  const dates = resolveDateRange(options.period || "30d", options.startDate, options.endDate);
  const cropFilter = options.commodity ? normalizeCropName(options.commodity) : null;

  // Retrieve current period orders for this farmer
  let currSql = `
    SELECT oi.id, oi.orderId, oi.productId, oi.qty, oi.unitPrice, oi.amount,
           o.status, o.createdAt, o.vendorName, o.deliveryDistrict,
           p.name as productName, p.category, p.unit
    FROM order_items oi
    JOIN orders o ON oi.orderId = o.id
    JOIN products p ON oi.productId = p.id
    WHERE oi.farmerId = ?
      AND o.createdAt >= ?
      AND o.createdAt <= ?
  `;
  const currParams = [farmerId, dates.current.startDate, dates.current.endDate];
  if (cropFilter) {
    currSql += " AND (LOWER(p.name) LIKE ? OR LOWER(p.category) LIKE ?)";
    currParams.push(`%${cropFilter.toLowerCase()}%`, `%${cropFilter.toLowerCase()}%`);
  }
  currSql += " ORDER BY o.createdAt ASC";

  const currentItems = await query.all(currSql, currParams);

  // Retrieve previous period orders for comparison
  let prevSql = `
    SELECT oi.qty, oi.amount, o.status, o.createdAt
    FROM order_items oi
    JOIN orders o ON oi.orderId = o.id
    JOIN products p ON oi.productId = p.id
    WHERE oi.farmerId = ?
      AND o.createdAt >= ?
      AND o.createdAt <= ?
  `;
  const prevParams = [farmerId, dates.previous.startDate, dates.previous.endDate];
  if (cropFilter) {
    prevSql += " AND (LOWER(p.name) LIKE ? OR LOWER(p.category) LIKE ?)";
    prevParams.push(`%${cropFilter.toLowerCase()}%`, `%${cropFilter.toLowerCase()}%`);
  }
  const prevItems = await query.all(prevSql, prevParams);

  // Filter out cancelled orders from gross revenue
  const validCurrentItems = currentItems.filter(i => i.status !== "Cancelled");
  const validPrevItems = prevItems.filter(i => i.status !== "Cancelled");

  // Metric calculations
  const totalQuantitySold = validCurrentItems.reduce((sum, i) => sum + (parseFloat(i.qty) || 0), 0);
  const grossRevenue = parseFloat(validCurrentItems.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0).toFixed(2));
  const distinctOrderIds = new Set(validCurrentItems.map(i => i.orderId));
  const totalOrders = distinctOrderIds.size;
  const avgOrderValue = totalOrders > 0 ? parseFloat((grossRevenue / totalOrders).toFixed(2)) : 0;
  const avgSellingPrice = totalQuantitySold > 0 ? parseFloat((grossRevenue / totalQuantitySold).toFixed(2)) : 0;

  // Previous metrics
  const prevQuantitySold = validPrevItems.reduce((sum, i) => sum + (parseFloat(i.qty) || 0), 0);
  const prevGrossRevenue = parseFloat(validPrevItems.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0).toFixed(2));
  const prevDistinctOrders = new Set(validPrevItems.map(i => i.orderId)).size;

  // Status breakdown
  const statusCounts = { Pending: 0, Processing: 0, Completed: 0, Cancelled: 0 };
  for (const item of currentItems) {
    const s = item.status || "Pending";
    if (statusCounts[s] !== undefined) statusCounts[s]++;
    else statusCounts[s] = 1;
  }

  // Group by Product
  const productMap = {};
  for (const item of validCurrentItems) {
    const pName = item.productName || "Unknown Crop";
    if (!productMap[pName]) {
      productMap[pName] = {
        name: pName,
        category: item.category || "General",
        unit: item.unit || "kg",
        quantitySold: 0,
        grossSales: 0,
        ordersCount: 0,
        unitPrices: []
      };
    }
    productMap[pName].quantitySold += parseFloat(item.qty) || 0;
    productMap[pName].grossSales += parseFloat(item.amount) || 0;
    productMap[pName].ordersCount += 1;
    if (item.unitPrice) productMap[pName].unitPrices.push(parseFloat(item.unitPrice));
  }

  const topProducts = Object.values(productMap)
    .map(p => ({
      ...p,
      grossSales: parseFloat(p.grossSales.toFixed(2)),
      avgPrice: p.unitPrices.length > 0 ? parseFloat((p.grossSales / p.quantitySold).toFixed(2)) : 0
    }))
    .sort((a, b) => b.grossSales - a.grossSales);

  // Group by Date for Sales Trend (day by day)
  const salesByDate = {};
  for (const item of validCurrentItems) {
    const dateKey = item.createdAt ? item.createdAt.substring(0, 10) : "unknown";
    if (!salesByDate[dateKey]) {
      salesByDate[dateKey] = { date: dateKey, sales: 0, quantity: 0, orders: 0 };
    }
    salesByDate[dateKey].sales += parseFloat(item.amount) || 0;
    salesByDate[dateKey].quantity += parseFloat(item.qty) || 0;
    salesByDate[dateKey].orders += 1;
  }
  const salesTrend = Object.values(salesByDate)
    .map(d => ({ ...d, sales: parseFloat(d.sales.toFixed(2)) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Comparisons
  const comparisons = [
    calculateMetricComparison(grossRevenue, prevGrossRevenue, "Gross Revenue", "INR"),
    calculateMetricComparison(totalQuantitySold, prevQuantitySold, "Quantity Sold", "units"),
    calculateMetricComparison(totalOrders, prevDistinctOrders, "Order Count", "orders")
  ];

  // Facts
  const facts = [
    `Total items sold: ${totalQuantitySold} units`,
    `Gross sales: ₹${grossRevenue.toLocaleString("en-IN")}`,
    `Order count: ${totalOrders} order(s)`,
    `Average order value: ₹${avgOrderValue.toLocaleString("en-IN")}`,
    `Average selling price: ₹${avgSellingPrice}/unit`,
    `Completed orders: ${statusCounts.Completed || 0}`,
    `Pending/Processing orders: ${(statusCounts.Pending || 0) + (statusCounts.Processing || 0)}`,
    `Cancelled orders: ${statusCounts.Cancelled || 0}`
  ];
  if (topProducts.length > 0) {
    facts.push(`Top performing crop: ${topProducts[0].name} (₹${topProducts[0].grossSales.toLocaleString("en-IN")} from ${topProducts[0].quantitySold} ${topProducts[0].unit})`);
  }

  // Reasoning & Insights
  const insights = [];
  if (totalOrders === 0) {
    insights.push("No order volume recorded during this period.");
  } else {
    insights.push(`Sales revenue is concentrated across ${topProducts.length} crop(s).`);
    if (topProducts.length > 0) {
      const topShare = grossRevenue > 0 ? ((topProducts[0].grossSales / grossRevenue) * 100).toFixed(1) : 0;
      insights.push(`${topProducts[0].name} generated ${topShare}% of total period sales.`);
    }
    if (comparisons[0].comparisonAvailable) {
      insights.push(`Revenue changed by ${comparisons[0].percentageChange >= 0 ? "+" : ""}${comparisons[0].percentageChange}% compared to the prior period.`);
    } else {
      insights.push("Previous-period comparison is unavailable because there is insufficient data.");
    }
  }

  // Recommendations
  const recommendations = [];
  if (topProducts.length > 0 && topProducts[0].quantitySold > 50) {
    recommendations.push(`Maintain stable supply for ${topProducts[0].name} as it demonstrated steady buyer demand.`);
  }
  if (statusCounts.Cancelled > 0 && statusCounts.Cancelled > totalOrders * 0.2) {
    recommendations.push("Review order fulfilment and confirmation responsiveness to reduce cancellation rate.");
  }
  if (totalOrders === 0) {
    recommendations.push("Consider reviewing active listing prices against current marketplace averages to attract buyer orders.");
  }

  // Limitations
  const limitations = [
    "Gross sales represent total transaction value and do NOT represent net profit.",
    "Net profit cannot be calculated without reliable on-farm input and cultivation cost data.",
    "Future market demand and prices are subject to seasonal volatility and are not guaranteed."
  ];

  return {
    reportType: "SALES",
    period: {
      label: dates.label,
      startDate: dates.current.startDate,
      endDate: dates.current.endDate
    },
    generatedAt: new Date().toISOString(),
    metrics: {
      grossRevenue,
      totalQuantitySold,
      totalOrders,
      avgOrderValue,
      avgSellingPrice,
      statusCounts
    },
    topProducts,
    salesTrend,
    comparisons,
    facts,
    insights,
    recommendations,
    limitations
  };
}

// ==========================================
// 2. FARMER INVENTORY ANALYTICS
// ==========================================

export async function getFarmerInventoryAnalytics(farmerId) {
  if (!farmerId) throw new Error("farmerId is required for inventory analytics.");

  const products = await query.all(
    "SELECT id, name, category, price, stock, moq, unit, organic, harvestDate, createdAt FROM products WHERE farmerId = ? ORDER BY stock DESC",
    [farmerId]
  );

  const totalListings = products.length;
  const totalStockUnits = products.reduce((sum, p) => sum + (parseInt(p.stock, 10) || 0), 0);
  const totalInventoryValue = parseFloat(products.reduce((sum, p) => sum + ((parseFloat(p.price) || 0) * (parseInt(p.stock, 10) || 0)), 0).toFixed(2));

  // Identify low-stock items (stock <= moq or stock <= 10)
  const lowStockItems = products.filter(p => (parseInt(p.stock, 10) <= (parseInt(p.moq, 10) || 10) || parseInt(p.stock, 10) <= 10));
  // Out of stock
  const outOfStockItems = products.filter(p => parseInt(p.stock, 10) <= 0);

  // Highest stock items
  const highestStockItems = [...products].sort((a, b) => b.stock - a.stock).slice(0, 5);

  // Check sales movement in last 30 days to detect slow-moving stock
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const recentSoldRows = await query.all(
    `SELECT oi.productId, SUM(oi.qty) as totalSold, MAX(o.createdAt) as lastSoldAt
     FROM order_items oi
     JOIN orders o ON oi.orderId = o.id
     WHERE oi.farmerId = ? AND o.createdAt >= ? AND o.status != 'Cancelled'
     GROUP BY oi.productId`,
    [farmerId, thirtyDaysAgo]
  );

  const salesMap = {};
  for (const r of recentSoldRows) {
    salesMap[r.productId] = {
      totalSold: parseFloat(r.totalSold) || 0,
      lastSoldAt: r.lastSoldAt
    };
  }

  // Slow moving: has stock > 20, but sold 0 or < 10% in last 30 days
  const slowMovingProducts = [];
  const recentlySoldProducts = [];

  for (const p of products) {
    const soldData = salesMap[p.id];
    const soldQty = soldData ? soldData.totalSold : 0;
    const stockQty = parseInt(p.stock, 10) || 0;

    if (soldQty > 0) {
      recentlySoldProducts.push({
        ...p,
        soldQty,
        lastSoldAt: soldData.lastSoldAt
      });
    }

    if (stockQty > 20 && soldQty === 0) {
      slowMovingProducts.push({
        ...p,
        stockQty,
        daysWithoutSale: "30+ days",
        soldLast30d: 0
      });
    }
  }

  // Category concentration
  const categoryConcentration = {};
  for (const p of products) {
    const cat = p.category || "Other";
    if (!categoryConcentration[cat]) categoryConcentration[cat] = { category: cat, stock: 0, value: 0, count: 0 };
    categoryConcentration[cat].stock += parseInt(p.stock, 10) || 0;
    categoryConcentration[cat].value += (parseFloat(p.price) || 0) * (parseInt(p.stock, 10) || 0);
    categoryConcentration[cat].count += 1;
  }
  const categoryBreakdown = Object.values(categoryConcentration).map(c => ({
    ...c,
    value: parseFloat(c.value.toFixed(2)),
    stockPct: totalStockUnits > 0 ? parseFloat(((c.stock / totalStockUnits) * 100).toFixed(1)) : 0
  }));

  const facts = [
    `Total active listings: ${totalListings}`,
    `Total available inventory: ${totalStockUnits} units`,
    `Total estimated inventory value: ₹${totalInventoryValue.toLocaleString("en-IN")}`,
    `Low-stock listings: ${lowStockItems.length}`,
    `Out-of-stock listings: ${outOfStockItems.length}`,
    `Slow-moving products: ${slowMovingProducts.length}`,
    `Recently sold products: ${recentlySoldProducts.length}`
  ];

  const insights = [];
  if (lowStockItems.length > 0) {
    insights.push(`${lowStockItems.length} product(s) have stock at or below Minimum Order Quantity.`);
  }
  if (slowMovingProducts.length > 0) {
    insights.push(`${slowMovingProducts.length} product(s) with high inventory have had zero sales in the last 30 days.`);
  }
  if (categoryBreakdown.length > 0) {
    const dominant = [...categoryBreakdown].sort((a, b) => b.stockPct - a.stockPct)[0];
    insights.push(`Inventory is predominantly concentrated in ${dominant.category} (${dominant.stockPct}% of stock).`);
  }

  const recommendations = [];
  if (lowStockItems.length > 0) {
    recommendations.push(`Restock ${lowStockItems.map(i => i.name).slice(0, 3).join(", ")} to avoid missed orders.`);
  }
  if (slowMovingProducts.length > 0) {
    recommendations.push(`Evaluate pricing or listing descriptions for slow-moving items like ${slowMovingProducts.map(i => i.name).slice(0, 2).join(", ")}.`);
  }

  const limitations = [
    "Inventory values are calculated from active listing prices and do not reflect storage or spoilage costs.",
    "Stock levels are based solely on database records."
  ];

  return {
    reportType: "INVENTORY",
    generatedAt: new Date().toISOString(),
    metrics: {
      totalListings,
      totalStockUnits,
      totalInventoryValue,
      lowStockCount: lowStockItems.length,
      outOfStockCount: outOfStockItems.length,
      slowMovingCount: slowMovingProducts.length
    },
    products,
    lowStockItems,
    highestStockItems,
    slowMovingProducts,
    recentlySoldProducts,
    categoryBreakdown,
    facts,
    insights,
    recommendations,
    limitations
  };
}

// ==========================================
// 3. COMPLETE FARM PERFORMANCE REPORT
// ==========================================

export async function getFarmPerformanceReport(farmerId, options = {}) {
  if (!farmerId) throw new Error("farmerId is required for farm performance report.");

  // Fetch sales, inventory, weather, and selling opportunities in parallel
  const [salesAnalytics, inventoryAnalytics] = await Promise.all([
    getFarmerSalesAnalytics(farmerId, options),
    getFarmerInventoryAnalytics(farmerId)
  ]);

  // Farmer profile & location
  const farmer = await query.get(
    "SELECT id, name, role, region, district, city, lat, lng, primaryCrop FROM users WHERE id = ?",
    [farmerId]
  );

  // Weather context
  let weatherRisk = null;
  if (farmer && (farmer.lat || farmer.district)) {
    try {
      const wRes = await getLiveWeatherForecast({
        lat: farmer.lat,
        lng: farmer.lng,
        district: farmer.district,
        region: farmer.region,
        crop: farmer.primaryCrop
      });
      if (wRes && wRes.success && wRes.data) {
        weatherRisk = {
          temperature: wRes.data.currentConditions?.temperature,
          condition: wRes.data.currentConditions?.condition,
          advisory: wRes.data.advisorySummary || wRes.data.weatherAdvisory
        };
      }
    } catch {
      /* weather fallback */
    }
  }

  // Phase 7 Proactive Insights
  let proactiveAlerts = [];
  try {
    const alertsRes = await getUserProactiveInsights(farmerId, "en", "active");
    if (alertsRes && alertsRes.success) {
      proactiveAlerts = alertsRes.insights || [];
    }
  } catch {
    /* insights fallback */
  }

  // Phase 9 Selling Opportunities
  let sellingOpportunities = [];
  try {
    const oppRes = await detectSellingOpportunities(farmerId, {
      district: farmer?.district,
      region: farmer?.region,
      lat: farmer?.lat,
      lng: farmer?.lng
    });
    if (oppRes && oppRes.opportunities) {
      sellingOpportunities = oppRes.opportunities;
    }
  } catch {
    /* opp fallback */
  }

  // Aggregate FACTS
  const facts = [
    `Total active produce listings: ${inventoryAnalytics.metrics.totalListings}`,
    `Available warehouse stock: ${inventoryAnalytics.metrics.totalStockUnits} units`,
    `Quantities sold (${salesAnalytics.period.label}): ${salesAnalytics.metrics.totalQuantitySold} units`,
    `Order count: ${salesAnalytics.metrics.totalOrders}`,
    `ESTIMATED GROSS REVENUE: ₹${salesAnalytics.metrics.grossRevenue.toLocaleString("en-IN")}`,
    `Average selling price: ₹${salesAnalytics.metrics.avgSellingPrice}/unit`,
    `Completed orders: ${salesAnalytics.metrics.statusCounts.Completed || 0}`,
    `Pending/Processing orders: ${(salesAnalytics.metrics.statusCounts.Pending || 0) + (salesAnalytics.metrics.statusCounts.Processing || 0)}`,
    `Cancelled orders: ${salesAnalytics.metrics.statusCounts.Cancelled || 0}`,
    `Low stock warnings: ${inventoryAnalytics.metrics.lowStockCount} item(s)`,
    `Slow moving items: ${inventoryAnalytics.metrics.slowMovingCount} item(s)`
  ];

  if (salesAnalytics.topProducts.length > 0) {
    facts.push(`Best-selling crop: ${salesAnalytics.topProducts[0].name} (₹${salesAnalytics.topProducts[0].grossSales.toLocaleString("en-IN")})`);
  }
  if (weatherRisk) {
    facts.push(`Local Weather (${farmer?.district || "Farm"}): ${weatherRisk.temperature}, ${weatherRisk.condition}`);
  }

  // REASONING / INSIGHTS
  const insights = [
    ...salesAnalytics.insights,
    ...inventoryAnalytics.insights
  ];
  if (weatherRisk && weatherRisk.advisory) {
    insights.push(`Weather Context: ${weatherRisk.advisory}`);
  }

  // RECOMMENDATIONS
  const recommendations = [
    ...salesAnalytics.recommendations,
    ...inventoryAnalytics.recommendations
  ];
  if (sellingOpportunities.length > 0) {
    recommendations.push(`Marketplace opportunity: High buyer interest observed for ${sellingOpportunities[0].commodity}.`);
  }

  // LIMITATIONS
  const limitations = [
    "ESTIMATED GROSS REVENUE represents sales volume before production, labor, transportation, and commission costs.",
    "Profit cannot be calculated without reliable cost data.",
    "Future market prices and weather patterns remain subject to change and are not guaranteed."
  ];

  return {
    reportType: "FARM_PERFORMANCE",
    farmerId,
    farmerName: farmer ? farmer.name : "Farmer",
    period: salesAnalytics.period,
    generatedAt: new Date().toISOString(),
    metrics: {
      sales: salesAnalytics.metrics,
      inventory: inventoryAnalytics.metrics,
      topProducts: salesAnalytics.topProducts,
      lowStockItems: inventoryAnalytics.lowStockItems,
      slowMovingProducts: inventoryAnalytics.slowMovingProducts
    },
    comparisons: salesAnalytics.comparisons,
    weatherRisk,
    proactiveAlertsCount: proactiveAlerts.length,
    sellingOpportunitiesCount: sellingOpportunities.length,
    facts,
    insights,
    recommendations,
    limitations
  };
}

// ==========================================
// 4. PRODUCT PERFORMANCE GRANULAR METRICS
// ==========================================

export async function getProductPerformance(farmerId, productId = null, options = {}) {
  if (!farmerId) throw new Error("farmerId is required.");

  const dates = resolveDateRange(options.period || "30d", options.startDate, options.endDate);

  let sql = `
    SELECT p.id as productId, p.name, p.category, p.price, p.stock, p.unit, p.moq,
           COALESCE(SUM(CASE WHEN o.id IS NOT NULL THEN oi.qty ELSE 0 END), 0) as totalSold,
           COALESCE(SUM(CASE WHEN o.id IS NOT NULL THEN oi.amount ELSE 0 END), 0) as grossRevenue,
           COUNT(DISTINCT o.id) as orderCount,
           AVG(CASE WHEN o.id IS NOT NULL THEN oi.unitPrice ELSE NULL END) as realizedAvgPrice
    FROM products p
    LEFT JOIN order_items oi ON p.id = oi.productId AND oi.farmerId = ?
    LEFT JOIN orders o ON oi.orderId = o.id AND o.status != 'Cancelled' AND o.createdAt >= ? AND o.createdAt <= ?
    WHERE p.farmerId = ?
  `;
  const params = [farmerId, dates.current.startDate, dates.current.endDate, farmerId];

  if (productId) {
    sql += " AND p.id = ?";
    params.push(productId);
  }

  sql += " GROUP BY p.id ORDER BY grossRevenue DESC";

  const rows = await query.all(sql, params);

  const productPerformance = rows.map(r => ({
    productId: r.productId,
    name: r.name,
    category: r.category,
    currentPrice: parseFloat(r.price) || 0,
    stock: parseInt(r.stock, 10) || 0,
    unit: r.unit || "kg",
    moq: parseInt(r.moq, 10) || 10,
    totalSold: parseFloat(r.totalSold) || 0,
    grossRevenue: parseFloat(parseFloat(r.grossRevenue).toFixed(2)),
    orderCount: parseInt(r.orderCount, 10) || 0,
    realizedAvgPrice: r.realizedAvgPrice ? parseFloat(parseFloat(r.realizedAvgPrice).toFixed(2)) : parseFloat(r.price) || 0,
    velocity: parseFloat(r.totalSold) > 50 ? "Fast" : parseFloat(r.totalSold) > 10 ? "Moderate" : "Slow"
  }));

  const facts = productPerformance.map(p =>
    `${p.name}: ${p.totalSold} ${p.unit} sold across ${p.orderCount} order(s) (Gross Revenue: ₹${p.grossRevenue.toLocaleString("en-IN")}, Stock: ${p.stock} ${p.unit})`
  );

  return {
    reportType: "PRODUCT_PERFORMANCE",
    period: dates.label,
    generatedAt: new Date().toISOString(),
    products: productPerformance,
    facts,
    insights: [
      `Evaluated ${productPerformance.length} product(s) for the period.`,
      productPerformance.length > 0 ? `Top product by volume: ${productPerformance[0].name}` : "No products available."
    ],
    recommendations: productPerformance.filter(p => p.stock <= p.moq).map(p => `Restock ${p.name} (stock ${p.stock} <= MOQ ${p.moq}).`),
    limitations: ["Gross revenue does not deduct production or handling costs."]
  };
}

// ==========================================
// 5. MARKETPLACE AGGREGATE ANALYTICS
// ==========================================

export async function getMarketplaceAggregateAnalytics(options = {}) {
  const dates = resolveDateRange(options.period || "30d", options.startDate, options.endDate);
  const commodity = options.commodity ? normalizeCropName(options.commodity) : null;

  // Active listings summary
  let listingSql = "SELECT category, name, price, stock, unit, organic, region, district FROM products WHERE 1=1";
  const listingParams = [];
  if (commodity) {
    listingSql += " AND (LOWER(name) LIKE ? OR LOWER(category) LIKE ?)";
    listingParams.push(`%${commodity.toLowerCase()}%`, `%${commodity.toLowerCase()}%`);
  }

  const listings = await query.all(listingSql, listingParams);
  const totalListings = listings.length;

  // Prices
  const validPrices = listings.map(l => parseFloat(l.price)).filter(p => !isNaN(p)).sort((a, b) => a - b);
  let priceStats = { min: 0, max: 0, avg: 0, median: 0 };
  if (validPrices.length > 0) {
    const min = validPrices[0];
    const max = validPrices[validPrices.length - 1];
    const sum = validPrices.reduce((a, b) => a + b, 0);
    const avg = parseFloat((sum / validPrices.length).toFixed(2));
    const mid = Math.floor(validPrices.length / 2);
    const median = validPrices.length % 2 !== 0 ? validPrices[mid] : parseFloat(((validPrices[mid - 1] + validPrices[mid]) / 2).toFixed(2));
    priceStats = { min, max, avg, median };
  }

  // Category counts
  const categoryCounts = {};
  for (const l of listings) {
    const cat = l.category || "General";
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  }

  // Geographic marketplace distribution (by district)
  const districtCounts = {};
  for (const l of listings) {
    const dist = l.district || "Regional";
    districtCounts[dist] = (districtCounts[dist] || 0) + 1;
  }

  // Order volume & demand
  let orderSql = `
    SELECT p.name as cropName, p.category, SUM(oi.qty) as totalSold, COUNT(DISTINCT o.id) as orderCount, SUM(oi.amount) as volumeAmount
    FROM order_items oi
    JOIN orders o ON oi.orderId = o.id
    JOIN products p ON oi.productId = p.id
    WHERE o.status != 'Cancelled' AND o.createdAt >= ? AND o.createdAt <= ?
  `;
  const orderParams = [dates.current.startDate, dates.current.endDate];
  if (commodity) {
    orderSql += " AND (LOWER(p.name) LIKE ? OR LOWER(p.category) LIKE ?)";
    orderParams.push(`%${commodity.toLowerCase()}%`, `%${commodity.toLowerCase()}%`);
  }
  orderSql += " GROUP BY p.name, p.category ORDER BY totalSold DESC";

  const commoditySales = await query.all(orderSql, orderParams);
  const totalMarketplaceGmv = parseFloat(commoditySales.reduce((sum, c) => sum + (parseFloat(c.volumeAmount) || 0), 0).toFixed(2));
  const totalQuantityTraded = commoditySales.reduce((sum, c) => sum + (parseFloat(c.totalSold) || 0), 0);

  // Fast vs Slow Moving commodities
  const fastMoving = commoditySales.slice(0, 3).map(c => ({
    commodity: c.cropName,
    quantityTraded: parseFloat(c.totalSold),
    orderCount: parseInt(c.orderCount, 10)
  }));

  const slowMoving = commoditySales.slice(-3).reverse().map(c => ({
    commodity: c.cropName,
    quantityTraded: parseFloat(c.totalSold),
    orderCount: parseInt(c.orderCount, 10)
  }));

  const facts = [
    `Total marketplace listings: ${totalListings}`,
    `Marketplace price range: ₹${priceStats.min} - ₹${priceStats.max} (Average: ₹${priceStats.avg}, Median: ₹${priceStats.median})`,
    `Total volume traded (${dates.label}): ${totalQuantityTraded} units`,
    `Gross marketplace transaction volume: ₹${totalMarketplaceGmv.toLocaleString("en-IN")}`
  ];
  if (fastMoving.length > 0) {
    facts.push(`Most traded commodity: ${fastMoving[0].commodity} (${fastMoving[0].quantityTraded} units)`);
  }

  const insights = [
    `Active listings span ${Object.keys(categoryCounts).length} produce categories across ${Object.keys(districtCounts).length} district(s).`,
    priceStats.median > 0 ? `Median benchmark price across active listings is ₹${priceStats.median}/unit.` : "No active price benchmark."
  ];

  const recommendations = [
    "Marketplace participants can use median price benchmarks for transparent price negotiation."
  ];

  const limitations = [
    "Marketplace analytics aggregate publicly visible produce listings and historical order data only.",
    "Individual farmer inventories and private transaction details are strictly excluded to preserve privacy."
  ];

  return {
    reportType: "MARKETPLACE",
    period: { label: dates.label, startDate: dates.current.startDate, endDate: dates.current.endDate },
    generatedAt: new Date().toISOString(),
    metrics: {
      totalListings,
      totalQuantityTraded,
      totalMarketplaceGmv,
      priceStats,
      categoryCounts,
      districtCounts
    },
    fastMoving,
    slowMoving,
    commoditySales,
    facts,
    insights,
    recommendations,
    limitations
  };
}

// ==========================================
// 6. ADMIN PLATFORM-WIDE ANALYTICS
// ==========================================

export async function getPlatformWideAnalytics(options = {}) {
  const dates = resolveDateRange(options.period || "30d", options.startDate, options.endDate);

  // 1. User breakdown
  const userRows = await query.all("SELECT role, COUNT(*) as count FROM users GROUP BY role");
  const usersByRole = { farmer: 0, vendor: 0, admin: 0 };
  for (const r of userRows) {
    if (r.role) usersByRole[r.role.toLowerCase()] = parseInt(r.count, 10);
  }
  const totalUsers = Object.values(usersByRole).reduce((a, b) => a + b, 0);

  // 2. Active farmers/vendors with listings or orders
  const activeFarmersRow = await query.get("SELECT COUNT(DISTINCT farmerId) as count FROM products");
  const activeVendorsRow = await query.get("SELECT COUNT(DISTINCT vendorId) as count FROM orders WHERE vendorId IS NOT NULL");
  const activeFarmers = activeFarmersRow ? activeFarmersRow.count : 0;
  const activeVendors = activeVendorsRow ? activeVendorsRow.count : 0;

  // 3. Listings
  const totalProductsRow = await query.get("SELECT COUNT(*) as count, SUM(stock) as totalStock FROM products");
  const totalProducts = totalProductsRow ? totalProductsRow.count : 0;
  const totalStock = totalProductsRow ? (totalProductsRow.totalStock || 0) : 0;

  // 4. Orders in period
  const ordersInPeriod = await query.all(
    "SELECT id, totalAmount, status, createdAt FROM orders WHERE createdAt >= ? AND createdAt <= ?",
    [dates.current.startDate, dates.current.endDate]
  );
  const totalPeriodOrders = ordersInPeriod.length;
  const orderStatusDistribution = { Pending: 0, Processing: 0, Completed: 0, Cancelled: 0 };
  let periodGrossGmv = 0;

  for (const o of ordersInPeriod) {
    const s = o.status || "Pending";
    orderStatusDistribution[s] = (orderStatusDistribution[s] || 0) + 1;
    if (s !== "Cancelled") {
      periodGrossGmv += parseFloat(o.totalAmount) || 0;
    }
  }
  periodGrossGmv = parseFloat(periodGrossGmv.toFixed(2));

  // 5. AI Subsystem Usage Statistics
  let aiStats = {
    conversations: 0,
    messages: 0,
    insights: 0,
    proactiveInsights: 0,
    imageAnalyses: 0,
    pendingActions: 0,
    actionAudit: 0
  };

  try {
    const [cRow, mRow, piRow, iaRow, paRow, aaRow] = await Promise.all([
      query.get("SELECT COUNT(*) as count FROM ai_conversations"),
      query.get("SELECT COUNT(*) as count FROM ai_messages"),
      query.get("SELECT COUNT(*) as count FROM ai_proactive_insights"),
      query.get("SELECT COUNT(*) as count FROM ai_image_analyses"),
      query.get("SELECT COUNT(*) as count FROM ai_pending_actions"),
      query.get("SELECT COUNT(*) as count FROM ai_action_audit")
    ]);

    aiStats = {
      conversations: cRow ? cRow.count : 0,
      messages: mRow ? mRow.count : 0,
      insights: 0,
      proactiveInsights: piRow ? piRow.count : 0,
      imageAnalyses: iaRow ? iaRow.count : 0,
      pendingActions: paRow ? paRow.count : 0,
      actionAudit: aaRow ? aaRow.count : 0
    };
  } catch {
    /* safe fallback */
  }

  // Facts
  const facts = [
    `Total platform users: ${totalUsers} (Farmers: ${usersByRole.farmer || 0}, Vendors: ${usersByRole.vendor || 0}, Admins: ${usersByRole.admin || 0})`,
    `Active farmers with listings: ${activeFarmers}`,
    `Active purchasing vendors: ${activeVendors}`,
    `Total marketplace listings: ${totalProducts} (${totalStock} units available)`,
    `Period orders (${dates.label}): ${totalPeriodOrders}`,
    `Period gross transaction volume: ₹${periodGrossGmv.toLocaleString("en-IN")}`,
    `Order fulfillment status: ${orderStatusDistribution.Completed || 0} completed, ${(orderStatusDistribution.Pending || 0) + (orderStatusDistribution.Processing || 0)} in-flight, ${orderStatusDistribution.Cancelled || 0} cancelled`,
    `AI conversations: ${aiStats.conversations} (${aiStats.messages} messages exchanged)`,
    `Proactive agricultural alerts issued: ${aiStats.proactiveInsights}`,
    `Crop vision health analyses conducted: ${aiStats.imageAnalyses}`,
    `Safe action audit entries recorded: ${aiStats.actionAudit}`
  ];

  const insights = [
    `Platform ecosystem health: ${totalUsers} registered users across ${activeFarmers} supplying farmers and ${activeVendors} active procurement buyers.`,
    `AI adoption: FarmConnect AI has serviced ${aiStats.conversations} sessions with ${aiStats.proactiveInsights} proactive alerts and ${aiStats.imageAnalyses} plant image diagnoses.`
  ];

  const recommendations = [
    "Continue monitoring unfulfilled and cancelled orders to optimize platform fulfillment rates."
  ];

  const limitations = [
    "Platform GMV represents gross transacted order amounts without subtracting supplier disbursements, courier fees, or operational refunds.",
    "User identities and sensitive transaction credentials are strictly obscured in aggregate reports."
  ];

  return {
    reportType: "PLATFORM",
    period: { label: dates.label, startDate: dates.current.startDate, endDate: dates.current.endDate },
    generatedAt: new Date().toISOString(),
    users: { total: totalUsers, byRole: usersByRole, activeFarmers, activeVendors },
    marketplace: { totalProducts, totalStock, periodGrossGmv, totalPeriodOrders, orderStatusDistribution },
    aiSubsystems: aiStats,
    facts,
    insights,
    recommendations,
    limitations
  };
}

// ==========================================
// 7. PERIOD COMPARISON UTILITY
// ==========================================

export async function compareAnalyticsPeriods(farmerId, options = {}) {
  const period = options.period || "30d";
  const dates = resolveDateRange(period);

  // Current period sales
  const currentSales = await getFarmerSalesAnalytics(farmerId, {
    startDate: dates.current.startDate,
    endDate: dates.current.endDate
  });

  // Previous period sales
  const prevSales = await getFarmerSalesAnalytics(farmerId, {
    startDate: dates.previous.startDate,
    endDate: dates.previous.endDate
  });

  const comparisons = [
    calculateMetricComparison(currentSales.metrics.grossRevenue, prevSales.metrics.grossRevenue, "Gross Revenue", "INR"),
    calculateMetricComparison(currentSales.metrics.totalQuantitySold, prevSales.metrics.totalQuantitySold, "Total Quantity Sold", "units"),
    calculateMetricComparison(currentSales.metrics.totalOrders, prevSales.metrics.totalOrders, "Order Count", "orders"),
    calculateMetricComparison(currentSales.metrics.avgSellingPrice, prevSales.metrics.avgSellingPrice, "Average Selling Price", "INR/unit")
  ];

  const facts = comparisons.map(c => {
    if (c.comparisonAvailable) {
      return `${c.metric}: Current ${c.current} ${c.unit}, Previous ${c.previous} ${c.unit} (Change: ${c.absoluteChange >= 0 ? "+" : ""}${c.absoluteChange} ${c.unit}, ${c.percentageChange >= 0 ? "+" : ""}${c.percentageChange}%)`;
    }
    return `${c.metric}: Current ${c.current} ${c.unit}, Previous ${c.previous} ${c.unit} (Previous-period comparison is unavailable because there is insufficient data.)`;
  });

  return {
    reportType: "PERIOD_COMPARISON",
    period: {
      current: dates.current,
      previous: dates.previous,
      label: dates.label
    },
    generatedAt: new Date().toISOString(),
    comparisons,
    facts,
    insights: comparisons.filter(c => c.comparisonAvailable).map(c => `${c.metric} shifted by ${c.percentageChange}% between periods.`),
    recommendations: ["Use multi-period trends to adjust planting cycles and inventory allocations."],
    limitations: ["Zero previous-period values do not yield fabricated percentage changes."]
  };
}

// ==========================================
// 8. DATA EXPORT GENERATOR (CSV)
// ==========================================

export async function generateAnalyticsCsv(user, type = "sales", options = {}) {
  if (!user) throw new Error("Authentication required.");

  if (type === "sales") {
    if (user.role !== "farmer" && user.role !== "admin") {
      throw new Error("FORBIDDEN: Only farmers and admins can export sales analytics.");
    }
    const targetFarmerId = user.role === "farmer" ? user.id : (options.farmerId || user.id);
    const data = await getFarmerSalesAnalytics(targetFarmerId, options);

    const headers = ["Product Name", "Category", "Quantity Sold", "Unit", "Gross Sales (INR)", "Orders Count", "Average Price (INR)"];
    const rows = (data.topProducts || []).map(p => [
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.category.replace(/"/g, '""')}"`,
      p.quantitySold,
      `"${p.unit}"`,
      p.grossSales,
      p.ordersCount,
      p.avgPrice
    ]);

    return [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  }

  // Support platform analytics CSV export
  if (type === "platform") {
    if (user.role !== "admin") {
      throw new Error("FORBIDDEN: Only admins can export platform analytics.");
    }
    const platform = await getPlatformWideAnalytics({ period: options.period });
    const headers = ["Metric", "Value"];
    const rows = Object.entries(platform).map(([k, v]) => [
      `"${String(k).replace(/"/g, '""')}"`,
      `"${typeof v === "object" ? JSON.stringify(v).replace(/"/g, '""') : String(v).replace(/"/g, '""')}"`
    ]);
    return [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  } else if (type === "inventory") {
    if (user.role !== "farmer" && user.role !== "admin") {
      throw new Error("FORBIDDEN: Only farmers and admins can export inventory analytics.");
    }
    const targetFarmerId = user.role === "farmer" ? user.id : (options.farmerId || user.id);
    const data = await getFarmerInventoryAnalytics(targetFarmerId);

    const headers = ["Product ID", "Product Name", "Category", "Current Price (INR)", "Stock Available", "Unit", "MOQ", "Organic"];
    const rows = (data.products || []).map(p => [
      `"${p.id}"`,
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.category.replace(/"/g, '""')}"`,
      p.price,
      p.stock,
      `"${p.unit}"`,
      p.moq,
      p.organic ? "Yes" : "No"
    ]);

    return [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  }

  if (type === "marketplace") {
    const data = await getMarketplaceAggregateAnalytics(options);

    const headers = ["Commodity", "Category", "Total Units Traded", "Orders Count", "Gross Traded Volume (INR)"];
    const rows = (data.commoditySales || []).map(c => [
      `"${c.cropName.replace(/"/g, '""')}"`,
      `"${c.category.replace(/"/g, '""')}"`,
      c.totalSold,
      c.orderCount,
      parseFloat(c.volumeAmount).toFixed(2)
    ]);

    return [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  }

  throw new Error(`Unsupported export type: ${type}`);
}
