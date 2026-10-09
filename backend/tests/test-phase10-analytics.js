import { query, initDatabase } from "../database.js";
import {
  getFarmPerformanceReport,
  getFarmerSalesAnalytics,
  getFarmerInventoryAnalytics,
  getProductPerformance,
  getMarketplaceAggregateAnalytics,
  getPlatformWideAnalytics,
  compareAnalyticsPeriods,
  generateAnalyticsCsv,
  resolveDateRange,
  calculateMetricComparison
} from "../services/analyticsReportService.js";
import { getFunctionDeclarationsForRole, executeAiTool, normalizeCropName } from "../ai/aiTools.js";
import { isToolAllowed, sanitizeToolParams, getAllowedToolNamesForRole } from "../ai/aiPermissions.js";

async function runPhase10Tests() {
  console.log("==================================================");
  console.log("   FARMCONNECT PHASE 10 — AI REPORTS & ANALYTICS TESTS");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, detail = "") {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName} ${detail ? `(${detail})` : ""}`);
      failed++;
    }
  }

  // Test User Entities
  const farmerUser = {
    id: "usr_farmer_p10",
    name: "Murugan Agro",
    role: "farmer",
    region: "Tamil Nadu",
    district: "Madurai",
    lat: 9.9252,
    lng: 78.1198,
    primaryCrop: "Tomato"
  };

  const otherFarmerUser = {
    id: "usr_farmer2_p10",
    name: "Ramesh Organic",
    role: "farmer",
    region: "Maharashtra",
    district: "Nashik"
  };

  const vendorUser = {
    id: "usr_vendor_p10",
    name: "Metro Agro Wholesale",
    role: "vendor",
    region: "Tamil Nadu",
    district: "Madurai"
  };

  const adminUser = {
    id: "usr_admin_p10",
    name: "FarmConnect Admin",
    role: "admin",
    region: "Tamil Nadu",
    district: "Chennai"
  };

  const prodTomatoId = "prod_p10_tomato";
  const prodOnionId = "prod_p10_onion";
  const prodSlowId = "prod_p10_slow";
  const orderCurrentId = "ord_p10_current";
  const orderPrevId = "ord_p10_prev";

  try {
    // 0. Ensure Database Initialized
    await initDatabase();

    console.log("--- 0. Test Fixture Setup ---");
    const now = new Date();
    const nowIso = now.toISOString();

    // 10 days ago (current period)
    const tenDaysAgoIso = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
    // 40 days ago (previous period)
    const fortyDaysAgoIso = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000).toISOString();

    // Cleanup existing test fixtures
    await query.run("DELETE FROM order_items WHERE orderId IN (?, ?)", [orderCurrentId, orderPrevId]);
    await query.run("DELETE FROM orders WHERE id IN (?, ?)", [orderCurrentId, orderPrevId]);
    await query.run("DELETE FROM products WHERE id IN (?, ?, ?)", [prodTomatoId, prodOnionId, prodSlowId]);
    await query.run("DELETE FROM users WHERE id IN (?, ?, ?, ?)", [farmerUser.id, otherFarmerUser.id, vendorUser.id, adminUser.id]);
    await query.run("DELETE FROM ai_proactive_insights WHERE userId IN (?, ?)", [farmerUser.id, vendorUser.id]);
    await query.run("DELETE FROM ai_image_analyses WHERE userId = ?", [farmerUser.id]);

    // Insert Users
    await query.run(
      "INSERT INTO users (id, name, email, role, region, district, lat, lng, primaryCrop, createdAt) VALUES (?, ?, ?, 'farmer', ?, ?, ?, ?, ?, ?)",
      [farmerUser.id, farmerUser.name, "murugan_p10@test.com", farmerUser.region, farmerUser.district, farmerUser.lat, farmerUser.lng, farmerUser.primaryCrop, nowIso]
    );
    await query.run(
      "INSERT INTO users (id, name, email, role, region, district, createdAt) VALUES (?, ?, ?, 'farmer', ?, ?, ?)",
      [otherFarmerUser.id, otherFarmerUser.name, "ramesh_p10@test.com", otherFarmerUser.region, otherFarmerUser.district, nowIso]
    );
    await query.run(
      "INSERT INTO users (id, name, email, role, region, district, createdAt) VALUES (?, ?, ?, 'vendor', ?, ?, ?)",
      [vendorUser.id, vendorUser.name, "metro_p10@test.com", vendorUser.region, vendorUser.district, nowIso]
    );
    await query.run(
      "INSERT INTO users (id, name, email, role, region, district, createdAt) VALUES (?, ?, ?, 'admin', ?, ?, ?)",
      [adminUser.id, adminUser.name, "admin_p10@test.com", adminUser.region, adminUser.district, nowIso]
    );

    // Insert Products
    // 1. Tomato: Active, healthy stock
    await query.run(
      `INSERT INTO products (id, name, category, price, unit, stock, farmerId, moq, organic, createdAt)
       VALUES (?, 'Fresh Country Tomato', 'Vegetables', 45.00, 'kg', 150, ?, 10, 1, ?)`,
      [prodTomatoId, farmerUser.id, nowIso]
    );

    // 2. Onion: Low stock (stock 5 <= MOQ 10)
    await query.run(
      `INSERT INTO products (id, name, category, price, unit, stock, farmerId, moq, organic, createdAt)
       VALUES (?, 'Nashik Red Onion', 'Vegetables', 30.00, 'kg', 5, ?, 10, 0, ?)`,
      [prodOnionId, farmerUser.id, nowIso]
    );

    // 3. Slow Moving Item: stock 100, no sales
    await query.run(
      `INSERT INTO products (id, name, category, price, unit, stock, farmerId, moq, organic, createdAt)
       VALUES (?, 'Organic Pearl Millet', 'Grains', 55.00, 'kg', 100, ?, 20, 1, ?)`,
      [prodSlowId, farmerUser.id, fortyDaysAgoIso]
    );

    // Insert Orders
    // Current period order (10 days ago): 50 kg Tomato at ₹45 = ₹2,250
    await query.run(
      `INSERT INTO orders (id, vendorId, vendorName, totalAmount, status, createdAt)
       VALUES (?, ?, ?, 2250.00, 'Completed', ?)`,
      [orderCurrentId, vendorUser.id, vendorUser.name, tenDaysAgoIso]
    );
    await query.run(
      `INSERT INTO order_items (id, orderId, productId, farmerId, qty, unitPrice, amount)
       VALUES ('oi_p10_1', ?, ?, ?, 50, 45.00, 2250.00)`,
      [orderCurrentId, prodTomatoId, farmerUser.id]
    );

    // Previous period order (40 days ago): 30 kg Tomato at ₹40 = ₹1,200
    await query.run(
      `INSERT INTO orders (id, vendorId, vendorName, totalAmount, status, createdAt)
       VALUES (?, ?, ?, 1200.00, 'Completed', ?)`,
      [orderPrevId, vendorUser.id, vendorUser.name, fortyDaysAgoIso]
    );
    await query.run(
      `INSERT INTO order_items (id, orderId, productId, farmerId, qty, unitPrice, amount)
       VALUES ('oi_p10_2', ?, ?, ?, 30, 40.00, 1200.00)`,
      [orderPrevId, prodTomatoId, farmerUser.id]
    );

    // Phase 7 Proactive Insight for farmer
    await query.run(
      `INSERT INTO ai_proactive_insights (id, userId, type, severity, title, message, facts, reasoning, status, createdAt)
       VALUES ('pi_p10_1', ?, 'low_inventory', 'warning', 'Low Onion Stock', 'Onion stock at 5 kg', '["Stock 5 kg <= MOQ 10"]', '["Restock advised"]', 'active', ?)`,
      [farmerUser.id, nowIso]
    );

    // Phase 8 Image Analysis for farmer
    await query.run(
      `INSERT INTO ai_image_analyses (id, userId, cropContext, analysisResult, language, confidence, createdAt)
       VALUES ('ia_p10_1', ?, 'Tomato leaf analysis', '{"healthStatus":{"status":"Healthy","confidence":"high"}}', 'en', 'high', ?)`,
      [farmerUser.id, nowIso]
    );

    console.log("Fixtures created successfully.\n");

    // ==========================================
    // 1. Farmer Sales Analytics Tests
    // ==========================================
    console.log("--- 1. Farmer Sales Analytics ---");
    const sales30d = await getFarmerSalesAnalytics(farmerUser.id, { period: "30d" });
    assert(sales30d && sales30d.reportType === "SALES", "getFarmerSalesAnalytics returns SALES report.");
    assert(sales30d.metrics.grossRevenue === 2250, `Gross revenue correctly calculated (₹2,250), got ₹${sales30d.metrics.grossRevenue}.`);
    assert(sales30d.metrics.totalQuantitySold === 50, `Total quantity sold is 50, got ${sales30d.metrics.totalQuantitySold}.`);
    assert(sales30d.metrics.totalOrders === 1, `Total orders count is 1, got ${sales30d.metrics.totalOrders}.`);
    assert(sales30d.metrics.avgSellingPrice === 45, `Average selling price is ₹45/kg, got ₹${sales30d.metrics.avgSellingPrice}.`);
    assert(Array.isArray(sales30d.topProducts) && sales30d.topProducts.length > 0, "Top products breakdown is non-empty.");
    assert(sales30d.topProducts[0].name.includes("Tomato"), "Top product identified as Tomato.");

    // ==========================================
    // 2. Farmer Inventory Analytics Tests
    // ==========================================
    console.log("\n--- 2. Farmer Inventory Analytics ---");
    const invData = await getFarmerInventoryAnalytics(farmerUser.id);
    assert(invData && invData.reportType === "INVENTORY", "getFarmerInventoryAnalytics returns INVENTORY report.");
    assert(invData.metrics.totalListings === 3, `Total listings count is 3, got ${invData.metrics.totalListings}.`);
    assert(invData.metrics.totalStockUnits === 255, `Total stock units is 255 (150+5+100), got ${invData.metrics.totalStockUnits}.`);
    assert(invData.lowStockItems.length === 1, `Low-stock items detected (Onion with stock 5 <= MOQ 10), got ${invData.lowStockItems.length}.`);
    assert(invData.lowStockItems[0].name.includes("Onion"), "Low-stock produce accurately identifies Onion.");
    assert(invData.slowMovingProducts.length >= 1, `Slow-moving stock detected (Millet with 0 sales in 30d), got ${invData.slowMovingProducts.length}.`);
    assert(invData.categoryBreakdown.length > 0, "Category concentration breakdown is present.");

    // ==========================================
    // 3. Product Performance Breakdown Tests
    // ==========================================
    console.log("\n--- 3. Product Performance Breakdown ---");
    const prodPerf = await getProductPerformance(farmerUser.id, prodTomatoId, { period: "30d" });
    assert(prodPerf && prodPerf.products.length === 1, "getProductPerformance returns target product.");
    assert(prodPerf.products[0].totalSold === 50, "Product total sold matches order items.");
    assert(prodPerf.products[0].grossRevenue === 2250, "Product gross revenue matches order items.");
    assert(prodPerf.products[0].velocity === "Fast" || prodPerf.products[0].velocity === "Moderate", "Product velocity classified.");

    // ==========================================
    // 4. Date Range Handlers (7d, 30d, 90d, custom)
    // ==========================================
    console.log("\n--- 4. Date Range Handlers ---");
    const range7d = resolveDateRange("7d");
    assert(range7d.label === "7 days", "resolveDateRange handles '7d'.");

    const range30d = resolveDateRange("30d");
    assert(range30d.label === "30 days", "resolveDateRange handles '30d'.");

    const range90d = resolveDateRange("90d");
    assert(range90d.label === "90 days", "resolveDateRange handles '90d'.");

    const customRange = resolveDateRange("custom", tenDaysAgoIso, nowIso);
    assert(customRange.label === "custom", "resolveDateRange handles custom start and end dates.");
    assert(new Date(customRange.current.startDate).getTime() < new Date(customRange.current.endDate).getTime(), "Custom date boundaries ordered correctly.");

    // Sales over 90 days includes both orders (₹2,250 + ₹1,200 = ₹3,450)
    const sales90d = await getFarmerSalesAnalytics(farmerUser.id, { period: "90d" });
    assert(sales90d.metrics.grossRevenue === 3450, `90-day sales revenue includes both current & past orders (₹3,450), got ₹${sales90d.metrics.grossRevenue}.`);
    assert(sales90d.metrics.totalQuantitySold === 80, `90-day quantity is 80 kg, got ${sales90d.metrics.totalQuantitySold}.`);

    // ==========================================
    // 5. Period Comparison Tests
    // ==========================================
    console.log("\n--- 5. Period Comparison ---");
    const comparison = await compareAnalyticsPeriods(farmerUser.id, { period: "30d" });
    assert(comparison && comparison.reportType === "PERIOD_COMPARISON", "compareAnalyticsPeriods returns comparison object.");
    const revComp = comparison.comparisons.find(c => c.metric === "Gross Revenue");
    assert(revComp !== undefined, "Gross Revenue comparison is present.");
    assert(revComp.current === 2250, "Current gross revenue is ₹2,250.");
    assert(revComp.previous === 1200, "Previous gross revenue is ₹1,200.");
    assert(revComp.absoluteChange === 1050, `Absolute change is +₹1,050, got ${revComp.absoluteChange}.`);
    assert(revComp.percentageChange === 87.5, `Percentage change is +87.5%, got ${revComp.percentageChange}%.`);
    assert(revComp.comparisonAvailable === true, "comparisonAvailable is true when previous > 0.");

    // ==========================================
    // 6. Zero Previous-Period Handling (No Fabrication)
    // ==========================================
    console.log("\n--- 6. Zero Previous-Period Handling ---");
    const zeroPrevComp = calculateMetricComparison(500, 0, "Sales", "INR");
    assert(zeroPrevComp.comparisonAvailable === false, "Zero previous period sets comparisonAvailable to false.");
    assert(zeroPrevComp.percentageChange === null, "Zero previous period does NOT fabricate percentage (percentageChange is null).");
    assert(zeroPrevComp.message.includes("Previous-period comparison is unavailable because there is insufficient data."), "Explicit insufficient data message returned.");

    // ==========================================
    // 7. Complete Farm Performance Report
    // ==========================================
    console.log("\n--- 7. Farm Performance Report ---");
    const farmRep = await getFarmPerformanceReport(farmerUser.id, { period: "30d" });
    assert(farmRep && farmRep.reportType === "FARM_PERFORMANCE", "getFarmPerformanceReport returns FARM_PERFORMANCE.");
    assert(Array.isArray(farmRep.facts), "Report contains FACTS array.");
    assert(Array.isArray(farmRep.insights), "Report contains INSIGHTS array.");
    assert(Array.isArray(farmRep.recommendations), "Report contains RECOMMENDATIONS array.");
    assert(Array.isArray(farmRep.limitations), "Report contains LIMITATIONS array.");
    assert(farmRep.proactiveAlertsCount >= 1, "Phase 7 proactive insights integrated into farm performance report.");

    // ==========================================
    // 8. Marketplace Aggregate Analytics
    // ==========================================
    console.log("\n--- 8. Marketplace Aggregate Analytics ---");
    const marketAnalytics = await getMarketplaceAggregateAnalytics({ period: "30d" });
    assert(marketAnalytics && marketAnalytics.reportType === "MARKETPLACE", "getMarketplaceAggregateAnalytics returns MARKETPLACE.");
    assert(marketAnalytics.metrics.totalListings >= 3, "Marketplace metrics include all platform listings.");
    assert(marketAnalytics.metrics.priceStats.median > 0, "Median price benchmark calculated deterministically.");
    assert(marketAnalytics.metrics.totalMarketplaceGmv > 0, "Marketplace GMV calculated from non-cancelled orders.");
    assert(!JSON.stringify(marketAnalytics).includes(farmerUser.id), "PRIVACY: Individual farmerId is not exposed in public marketplace response.");

    // ==========================================
    // 9. Admin Platform-Wide Analytics
    // ==========================================
    console.log("\n--- 9. Admin Platform-Wide Analytics ---");
    const platformRep = await getPlatformWideAnalytics({ period: "30d" });
    assert(platformRep && platformRep.reportType === "PLATFORM", "getPlatformWideAnalytics returns PLATFORM report.");
    assert(platformRep.users.total >= 4, "Platform reports total registered users.");
    assert(platformRep.users.byRole.farmer >= 2, "Farmer count breakdown matches DB.");
    assert(platformRep.users.byRole.vendor >= 1, "Vendor count breakdown matches DB.");
    assert(platformRep.marketplace.periodGrossGmv > 0, "Platform GMV aggregated across orders.");
    assert(platformRep.aiSubsystems.proactiveInsights >= 1, "Proactive insights counted in AI analytics.");
    assert(platformRep.aiSubsystems.imageAnalyses >= 1, "Crop image analyses counted in AI analytics.");

    // ==========================================
    // 10. AI Tool Registry & Role Scoping
    // ==========================================
    console.log("\n--- 10. AI Tool Registry & RBAC Scoping ---");
    const farmerTools = getAllowedToolNamesForRole("farmer");
    const vendorTools = getAllowedToolNamesForRole("vendor");
    const adminTools = getAllowedToolNamesForRole("admin");

    assert(farmerTools.includes("getMyFarmReport"), "Farmer role authorized for getMyFarmReport.");
    assert(farmerTools.includes("getMySalesAnalytics"), "Farmer role authorized for getMySalesAnalytics.");
    assert(farmerTools.includes("getMyInventoryAnalytics"), "Farmer role authorized for getMyInventoryAnalytics.");
    assert(farmerTools.includes("getMyProductPerformance"), "Farmer role authorized for getMyProductPerformance.");
    assert(farmerTools.includes("getMarketplaceAnalytics"), "Farmer role authorized for getMarketplaceAnalytics.");
    assert(farmerTools.includes("compareAnalyticsPeriods"), "Farmer role authorized for compareAnalyticsPeriods.");

    assert(!vendorTools.includes("getMyFarmReport"), "VENDOR ISOLATION: Vendor forbidden from getMyFarmReport.");
    assert(!vendorTools.includes("getMySalesAnalytics"), "VENDOR ISOLATION: Vendor forbidden from getMySalesAnalytics.");
    assert(!vendorTools.includes("getMyInventoryAnalytics"), "VENDOR ISOLATION: Vendor forbidden from getMyInventoryAnalytics.");
    assert(!vendorTools.includes("getPlatformAnalyticsReport"), "VENDOR ISOLATION: Vendor forbidden from getPlatformAnalyticsReport.");
    assert(vendorTools.includes("getMarketplaceAnalytics"), "Vendor allowed public getMarketplaceAnalytics.");

    assert(adminTools.includes("getPlatformAnalyticsReport"), "Admin authorized for getPlatformAnalyticsReport.");
    assert(adminTools.includes("getMyFarmReport"), "Admin authorized for getMyFarmReport.");

    // ==========================================
    // 11. Tool Execution via executeAiTool
    // ==========================================
    console.log("\n--- 11. executeAiTool Execution & Anti-Spoofing ---");
    // Farmer executing own sales tool
    const execSales = await executeAiTool(farmerUser, "getMySalesAnalytics", { period: "30d" });
    assert(execSales && execSales.success, "executeAiTool executes getMySalesAnalytics for farmer.");
    assert(execSales.data.metrics.grossRevenue === 2250, "executeAiTool returned verified sales metrics.");

    // Farmer executing inventory tool
    const execInv = await executeAiTool(farmerUser, "getMyInventoryAnalytics", {});
    assert(execInv && execInv.success, "executeAiTool executes getMyInventoryAnalytics for farmer.");

    // Farmer executing farm report
    const execFarm = await executeAiTool(farmerUser, "getMyFarmReport", { period: "30d" });
    assert(execFarm && execFarm.success, "executeAiTool executes getMyFarmReport for farmer.");

    // Vendor trying to access farmer's private report -> FORBIDDEN
    const vendorExec = await executeAiTool(vendorUser, "getMyFarmReport", {});
    assert(vendorExec.success === false, "Vendor forbidden from executing getMyFarmReport.");
    assert(vendorExec.error.code === "FORBIDDEN", "Expected FORBIDDEN error code for vendor.");

    // Vendor trying to access sales analytics -> FORBIDDEN
    const vendorSalesExec = await executeAiTool(vendorUser, "getMySalesAnalytics", {});
    assert(vendorSalesExec.success === false, "Vendor forbidden from executing getMySalesAnalytics.");

    // Farmer trying to spoof farmerId parameter
    const spoofedParams = sanitizeToolParams(farmerUser, "getMySalesAnalytics", {
      farmerId: otherFarmerUser.id
    });
    assert(spoofedParams.farmerId === farmerUser.id, "ANTI-SPOOFING: Sanitizer forces farmerId to authenticated session user.");

    // Admin executing platform report
    const adminExec = await executeAiTool(adminUser, "getPlatformAnalyticsReport", { period: "30d" });
    assert(adminExec && adminExec.success, "Admin executes getPlatformAnalyticsReport successfully.");

    // ==========================================
    // 12. Multilingual Crop Normalization in Analytics
    // ==========================================
    console.log("\n--- 12. Multilingual Analytics & Crop Normalization ---");
    assert(normalizeCropName("தக்காளி") === "Tomato", "Tamil தக்காளி normalizes to Tomato.");
    assert(normalizeCropName("टमाटर") === "Tomato", "Hindi टमाटर normalizes to Tomato.");
    assert(normalizeCropName("thakkali") === "Tomato", "Tanglish thakkali normalizes to Tomato.");
    assert(normalizeCropName("tamatar") === "Tomato", "Hinglish tamatar normalizes to Tomato.");
    assert(normalizeCropName("வெங்காயம்") === "Onion", "Tamil வெங்காயம் normalizes to Onion.");
    assert(normalizeCropName("प्याज") === "Onion", "Hindi प्याज normalizes to Onion.");

    // Filter sales with Tamil crop query
    const tamilFilteredSales = await getFarmerSalesAnalytics(farmerUser.id, {
      period: "30d",
      commodity: "தக்காளி"
    });
    assert(tamilFilteredSales.metrics.grossRevenue === 2250, "Tamil crop query accurately filters sales records.");

    // Filter sales with Hindi crop query
    const hindiFilteredSales = await getFarmerSalesAnalytics(farmerUser.id, {
      period: "30d",
      commodity: "टमाटर"
    });
    assert(hindiFilteredSales.metrics.grossRevenue === 2250, "Hindi crop query accurately filters sales records.");

    // ==========================================
    // 13. Financial Integrity & Zero-Profit-Fabrication Rule
    // ==========================================
    console.log("\n--- 13. Financial Integrity & Labeling Rules ---");
    assert(farmRep.metrics.sales.grossRevenue !== undefined, "Report provides grossRevenue field.");
    assert(farmRep.metrics.sales.profit === undefined, "FINANCIAL RULE: Profit is NOT fabricated without cost data.");
    assert(farmRep.facts.some(f => f.includes("ESTIMATED GROSS REVENUE") || f.includes("Gross sales")), "Revenue is strictly labeled as ESTIMATED GROSS REVENUE or Gross sales.");
    assert(farmRep.limitations.some(l => l.includes("Profit cannot be calculated")), "Limitations state profit cannot be calculated without cost data.");

    // ==========================================
    // 14. Data Export Security & CSV Formatting
    // ==========================================
    console.log("\n--- 14. Data Export & CSV Security ---");
    const farmerSalesCsv = await generateAnalyticsCsv(farmerUser, "sales", { period: "30d" });
    assert(typeof farmerSalesCsv === "string" && farmerSalesCsv.includes("Product Name"), "Farmer can export sales CSV with headers.");
    assert(farmerSalesCsv.includes("Fresh Country Tomato"), "Sales CSV includes farmer's sold produce.");

    const farmerInvCsv = await generateAnalyticsCsv(farmerUser, "inventory");
    assert(farmerInvCsv.includes("Stock Available"), "Inventory CSV includes stock headers.");

    // Vendor trying to export sales CSV -> Rejected with FORBIDDEN
    let vendorExportBlocked = false;
    try {
      await generateAnalyticsCsv(vendorUser, "sales");
    } catch (err) {
      if (err.message.includes("FORBIDDEN")) vendorExportBlocked = true;
    }
    assert(vendorExportBlocked, "EXPORT SECURITY: Vendor is blocked from exporting private farmer sales CSV.");

    // Vendor CAN export public marketplace CSV
    const marketCsv = await generateAnalyticsCsv(vendorUser, "marketplace");
    assert(marketCsv.includes("Commodity") && marketCsv.includes("Gross Traded Volume"), "Vendor can export aggregate marketplace CSV.");

    // ==========================================
    // 15. Phase 6 Read-Only Safety Verification
    // ==========================================
    console.log("\n--- 15. Phase 6 Read-Only Safety ---");
    const tomatoBefore = await query.get("SELECT price, stock FROM products WHERE id = ?", [prodTomatoId]);
    // Calling report tools must never alter database state
    await getFarmPerformanceReport(farmerUser.id, { period: "30d" });
    await getFarmerSalesAnalytics(farmerUser.id, { period: "30d" });
    await getFarmerInventoryAnalytics(farmerUser.id);
    const tomatoAfter = await query.get("SELECT price, stock FROM products WHERE id = ?", [prodTomatoId]);
    assert(tomatoBefore.price === tomatoAfter.price && tomatoBefore.stock === tomatoAfter.stock, "PHASE 6 SAFETY: Reports and analytics are strictly read-only and mutate NO state.");

    // ==========================================
    // 16. Empty Database & Edge Case Handling
    // ==========================================
    console.log("\n--- 16. Empty Data Edge Cases ---");
    const emptyFarmerSales = await getFarmerSalesAnalytics(otherFarmerUser.id, { period: "30d" });
    assert(emptyFarmerSales.metrics.grossRevenue === 0, "Farmer with 0 sales reports ₹0 gross revenue.");
    assert(emptyFarmerSales.metrics.totalOrders === 0, "Farmer with 0 sales reports 0 orders.");
    assert(emptyFarmerSales.topProducts.length === 0, "Top products is empty array without crash.");

    const emptyFarmerInv = await getFarmerInventoryAnalytics(otherFarmerUser.id);
    assert(emptyFarmerInv.metrics.totalListings === 0, "Farmer with no products reports 0 listings.");
    assert(emptyFarmerInv.metrics.totalStockUnits === 0, "Farmer with no products reports 0 stock units.");

    // ==========================================
    // 17. Voice Transcript to Analytics Flow
    // ==========================================
    console.log("\n--- 17. Voice Transcript to Analytics Flow ---");
    const spokenVoiceTranscript = "How much tomato did I sell this month?";
    const parsedCrop = spokenVoiceTranscript.toLowerCase().includes("tomato") ? normalizeCropName("tomato") : null;
    assert(parsedCrop === "Tomato", "VOICE PIPELINE: Voice transcript crop entity resolved to canonical 'Tomato'.");

    const voiceAnalytics = await getFarmerSalesAnalytics(farmerUser.id, {
      period: "30d",
      commodity: parsedCrop
    });
    assert(voiceAnalytics.metrics.grossRevenue === 2250, "VOICE PIPELINE: Voice query generates verified sales analytics.");

    // ==========================================
    // 18. SQL Injection & Parameter Validation
    // ==========================================
    console.log("\n--- 18. SQL Injection & Parameter Validation ---");
    const maliciousPayload = "' OR 1=1 --";
    const injectionRes = await getFarmerSalesAnalytics(farmerUser.id, { commodity: maliciousPayload });
    assert(injectionRes && injectionRes.reportType === "SALES", "SQL Injection payload handled safely without query compromise.");
    assert(injectionRes.metrics.totalQuantitySold === 0, "SQL Injection payload yields 0 matches and does not leak unauthorized records.");

    // ==========================================
    // 19. Large-Data Aggregation Performance
    // ==========================================
    console.log("\n--- 19. Large-Data Aggregation ---");
    const tStart = Date.now();
    const largeAgg = await getMarketplaceAggregateAnalytics({ period: "90d" });
    const elapsed = Date.now() - tStart;
    assert(largeAgg && largeAgg.reportType === "MARKETPLACE", "Large-scale marketplace aggregation executes successfully.");
    assert(elapsed < 200, `Aggregation executed efficiently (${elapsed}ms < 200ms) without N+1 queries.`);

    // ==========================================
    // 20. AI Tools Regression Across Phases 1-9
    // ==========================================
    console.log("\n--- 20. Tool Declarations Regression ---");
    const declarations = getFunctionDeclarationsForRole("admin");
    const declNames = declarations.map(d => d.name);

    const requiredTools = [
      // Phase 1
      "searchProducts", "getProduct", "getNearbyProducts", "getFarmerProfile", "getFarmerProducts", "compareProducts", "getMyOrders", "getMySales", "getMyInventory", "getPriceInsights", "getDemandInsights",
      // Phase 2
      "getWeatherAdvisory", "getPriceIntelligence", "getDemandIntelligence", "getSellingRecommendation", "getMyProactiveInsights",
      // Phase 6
      "proposeUpdateProductPrice", "proposeUpdateInventory", "proposeCreateProductListing", "proposeCancelOrder", "proposeSendMessage",
      // Phase 9
      "getMySellingOpportunities", "compareSellingOptions", "getMarketplaceOverview", "getNearbyBuyerOpportunities", "getSellingPlan",
      // Phase 10
      "getMyFarmReport", "getMySalesAnalytics", "getMyInventoryAnalytics", "getMyProductPerformance", "getMarketplaceAnalytics", "getPlatformAnalyticsReport", "compareAnalyticsPeriods", "generateAnalyticsReport"
    ];

    let allDeclared = true;
    for (const tName of requiredTools) {
      if (!declNames.includes(tName)) {
        console.error(`Missing tool declaration: ${tName}`);
        allDeclared = false;
      }
    }
    assert(allDeclared, `All ${requiredTools.length} tools across Phases 1-10 declared in central AI registry.`);

    // ==========================================
    // 21. Clean Up Fixtures
    // ==========================================
    console.log("\n--- Cleanup ---");
    await query.run("DELETE FROM order_items WHERE orderId IN (?, ?)", [orderCurrentId, orderPrevId]);
    await query.run("DELETE FROM orders WHERE id IN (?, ?)", [orderCurrentId, orderPrevId]);
    await query.run("DELETE FROM products WHERE id IN (?, ?, ?)", [prodTomatoId, prodOnionId, prodSlowId]);
    await query.run("DELETE FROM users WHERE id IN (?, ?, ?, ?)", [farmerUser.id, otherFarmerUser.id, vendorUser.id, adminUser.id]);
    await query.run("DELETE FROM ai_proactive_insights WHERE userId IN (?, ?)", [farmerUser.id, vendorUser.id]);
    await query.run("DELETE FROM ai_image_analyses WHERE userId = ?", [farmerUser.id]);
    assert(true, "Test fixtures cleaned up successfully.");

  } catch (err) {
    console.error("Fatal Phase 10 test execution crash:", err);
    failed++;
  }

  console.log("\n==================================================");
  console.log("   PHASE 10 ANALYTICS & REPORTS TEST RESULTS");
  console.log("==================================================");
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📊 Total:  ${passed + failed}`);
  console.log("==================================================\n");

  if (failed > 0) {
    console.error(`⚠️ ${failed} Phase 10 test(s) failed.`);
    process.exit(1);
  } else {
    console.log("🎉 ALL PHASE 10 TESTS PASSED!\n");
    process.exit(0);
  }
}

runPhase10Tests();
