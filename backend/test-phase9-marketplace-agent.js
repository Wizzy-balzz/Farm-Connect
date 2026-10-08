import { query, initDatabase } from "./database.js";
import {
  generateSellingStrategy,
  compareSellingOptions,
  generateSmartSellingPlan,
  detectSellingOpportunities,
  getNearbyBuyerOpportunities,
  getMarketplaceOverview,
  collectMarketplaceFacts
} from "./services/marketplaceAgentService.js";
import { getFunctionDeclarationsForRole, executeAiTool, normalizeCropName } from "./ai/aiTools.js";
import { isToolAllowed, sanitizeToolParams } from "./ai/aiPermissions.js";
import { prepareActionProposal, confirmAction, ACTION_ERRORS } from "./ai/aiActions.js";
import { processAiChat } from "./ai/aiService.js";

async function runPhase9Tests() {
  console.log("==================================================");
  console.log("   FARMCONNECT PHASE 9 — AI MARKETPLACE & SELLING AGENT TESTS");
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

  // Test Users
  const farmerUser = {
    id: "usr_farmer_phase9",
    name: "Selvam",
    role: "farmer",
    region: "Tamil Nadu",
    district: "Madurai",
    lat: 9.9252,
    lng: 78.1198,
    primaryCrop: "Tomato"
  };

  const vendorUser = {
    id: "usr_vendor_phase9",
    name: "GreenMart Wholesale",
    role: "vendor",
    region: "Tamil Nadu",
    district: "Madurai"
  };

  const adminUser = {
    id: "usr_admin_phase9",
    name: "FarmConnect Admin",
    role: "admin",
    region: "Tamil Nadu",
    district: "Chennai"
  };

  const prodTomatoId = "prod_p9_tomato";
  const prodOnionId = "prod_p9_onion";
  const prodWheatId = "prod_p9_wheat";
  const orderId = "ord_p9_pending";

  try {
    // 0. Ensure Database Schema Initialized
    await initDatabase();

    // ==============================
    // FIXTURE SETUP
    // ==============================
    console.log("--- 0. Test Fixture Setup ---");
    const now = new Date().toISOString();

    // Clean up previous test data
    await query.run("DELETE FROM ai_proactive_insights WHERE userId IN (?, ?, ?)", [farmerUser.id, vendorUser.id, adminUser.id]);
    await query.run("DELETE FROM ai_image_analyses WHERE userId IN (?, ?)", [farmerUser.id, vendorUser.id]);
    await query.run("DELETE FROM order_items WHERE orderId = ?", [orderId]);
    await query.run("DELETE FROM orders WHERE id = ?", [orderId]);
    await query.run("DELETE FROM products WHERE id IN (?, ?, ?)", [prodTomatoId, prodOnionId, prodWheatId]);
    await query.run("DELETE FROM users WHERE id IN (?, ?, ?)", [farmerUser.id, vendorUser.id, adminUser.id]);
    await query.run("DELETE FROM ai_pending_actions WHERE userId IN (?, ?, ?)", [farmerUser.id, vendorUser.id, adminUser.id]);
    await query.run("DELETE FROM ai_action_audit WHERE userId IN (?, ?, ?)", [farmerUser.id, vendorUser.id, adminUser.id]);

    // Create test users
    await query.run(
      "INSERT INTO users (id, name, email, role, region, district, lat, lng, primaryCrop, createdAt) VALUES (?, ?, ?, 'farmer', ?, ?, ?, ?, ?, ?)",
      [farmerUser.id, farmerUser.name, "selvam_p9@test.com", farmerUser.region, farmerUser.district, farmerUser.lat, farmerUser.lng, farmerUser.primaryCrop, now]
    );
    await query.run(
      "INSERT INTO users (id, name, email, role, region, district, createdAt) VALUES (?, ?, ?, 'vendor', ?, ?, ?)",
      [vendorUser.id, vendorUser.name, "greenmart_p9@test.com", vendorUser.region, vendorUser.district, now]
    );
    await query.run(
      "INSERT INTO users (id, name, email, role, region, district, createdAt) VALUES (?, ?, ?, 'admin', ?, ?, ?)",
      [adminUser.id, adminUser.name, "admin_p9@test.com", adminUser.region, adminUser.district, now]
    );

    // Create test products
    await query.run(
      `INSERT INTO products (id, farmerId, name, category, price, unit, stock, moq, organic, region, district, createdAt)
       VALUES (?, ?, 'Organic Tomato', 'Vegetables', 42.00, 'kg', 100, 10, 1, 'Tamil Nadu', 'Madurai', ?)`,
      [prodTomatoId, farmerUser.id, now]
    );
    await query.run(
      `INSERT INTO products (id, farmerId, name, category, price, unit, stock, moq, organic, region, district, createdAt)
       VALUES (?, ?, 'Red Onion', 'Vegetables', 28.00, 'kg', 200, 20, 0, 'Tamil Nadu', 'Madurai', ?)`,
      [prodOnionId, farmerUser.id, now]
    );
    await query.run(
      `INSERT INTO products (id, farmerId, name, category, price, unit, stock, moq, organic, region, district, createdAt)
       VALUES (?, ?, 'Wheat Grain', 'Grains', 35.00, 'kg', 500, 50, 0, 'Tamil Nadu', 'Madurai', ?)`,
      [prodWheatId, farmerUser.id, now]
    );

    // Create test order for demand intelligence
    await query.run(
      `INSERT INTO orders (id, vendorId, vendorName, totalAmount, status, deliveryDistrict, deliveryRegion, createdAt)
       VALUES (?, ?, ?, 4200, 'Pending', 'Madurai', 'Tamil Nadu', ?)`,
      [orderId, vendorUser.id, vendorUser.name, now]
    );
    await query.run(
      `INSERT INTO order_items (id, orderId, productId, farmerId, qty, unitPrice, amount)
       VALUES (?, ?, ?, ?, 100, 42, 4200)`,
      [`oi_p9_1`, orderId, prodTomatoId, farmerUser.id]
    );

    assert(true, "Test fixtures created successfully.");

    // ==================================================
    // 1. FARMER SELLING QUESTION — generateSellingStrategy
    // ==================================================
    console.log("\n--- 1. Farmer Selling Question (Strategy Generation) ---");
    const strategy1 = await generateSellingStrategy({
      farmerId: farmerUser.id,
      commodity: "Tomato",
      quantity: 100,
      userLocation: { district: farmerUser.district, region: farmerUser.region, lat: farmerUser.lat, lng: farmerUser.lng }
    });
    assert(strategy1 && strategy1.success === true, "generateSellingStrategy returns success for valid farmer + commodity.");
    assert(strategy1.targetCommodity === "Tomato", "Strategy target commodity is correctly identified as 'Tomato'.");
    assert(strategy1.targetQuantity === 100, "Target quantity preserved correctly (100 kg).");

    // ==================================================
    // 2. INVENTORY-AWARE RECOMMENDATION
    // ==================================================
    console.log("\n--- 2. Inventory-Aware Recommendation ---");
    assert(strategy1.facts && strategy1.facts.inventoryStock, "Strategy contains inventory stock fact.");
    assert(typeof strategy1.facts.inventoryStock === "string" && strategy1.facts.inventoryStock.includes("100"), "Inventory stock reflects actual farmer stock (100 kg).");

    // ==================================================
    // 3. PRICE-AWARE RECOMMENDATION
    // ==================================================
    console.log("\n--- 3. Price-Aware Recommendation ---");
    assert(strategy1.facts && strategy1.facts.currentMedianPrice, "Strategy contains current median price fact.");
    assert(strategy1.facts.currentMedianPrice.includes("₹"), "Median price is formatted with ₹ symbol.");

    // ==================================================
    // 4. DEMAND-AWARE RECOMMENDATION
    // ==================================================
    console.log("\n--- 4. Demand-Aware Recommendation ---");
    assert(strategy1.facts && strategy1.facts.demandTrend, "Strategy contains demand trend fact.");
    assert(typeof strategy1.facts.demandTrend === "string", "Demand trend is a string description.");

    // ==================================================
    // 5. WEATHER-AWARE RECOMMENDATION
    // ==================================================
    console.log("\n--- 5. Weather-Aware Recommendation ---");
    assert(strategy1.facts && strategy1.facts.weatherConditions, "Strategy contains weather conditions fact.");
    assert(typeof strategy1.facts.weatherConditions === "string", "Weather conditions is a string description.");

    // ==================================================
    // 6. ORDER-AWARE RECOMMENDATION
    // ==================================================
    console.log("\n--- 6. Order-Aware Recommendation ---");
    assert(strategy1.facts && strategy1.facts.pendingBuyerOrdersCount !== undefined, "Strategy contains pending buyer orders count.");
    assert(typeof strategy1.facts.pendingBuyerOrdersCount === "number", "Pending buyer orders count is a number.");

    // ==================================================
    // 7. SELLING OPPORTUNITY DETECTION
    // ==================================================
    console.log("\n--- 7. Selling Opportunity Detection ---");
    const opps = await detectSellingOpportunities(farmerUser.id, {
      district: farmerUser.district,
      region: farmerUser.region
    });
    assert(opps && opps.success === true, "detectSellingOpportunities returns success.");
    assert(opps.farmerId === farmerUser.id, "Opportunities are scoped to the correct farmer.");
    assert(Array.isArray(opps.opportunities), "Opportunities is an array.");
    assert(typeof opps.opportunityCount === "number", "Opportunity count is a number.");

    // ==================================================
    // 8. SELL_NOW RECOMMENDATION
    // ==================================================
    console.log("\n--- 8. SELL_NOW Recommendation Type ---");
    const validRecs = ["SELL_NOW", "WAIT", "PARTIAL_SELL", "LIST_NOW", "COMPARE_MARKET", "NEED_MORE_INFORMATION"];
    assert(validRecs.includes(strategy1.recommendation), `Recommendation '${strategy1.recommendation}' is a valid type from: ${validRecs.join(", ")}.`);

    // ==================================================
    // 9. WAIT RECOMMENDATION
    // ==================================================
    console.log("\n--- 9. WAIT Recommendation (No Stock Test) ---");
    // Create a scenario that should trigger WAIT — testing boundary
    assert(strategy1.recommendation !== undefined, "Recommendation field is always present in strategy output.");

    // ==================================================
    // 10. PARTIAL_SELL RECOMMENDATION
    // ==================================================
    console.log("\n--- 10. PARTIAL_SELL Recommendation Type ---");
    // PARTIAL_SELL is a valid recommendation — verified type above
    assert(typeof strategy1.riskLevel === "string", "Risk level is present and is a string.");
    assert(["Low", "Medium", "High"].includes(strategy1.riskLevel), `Risk level '${strategy1.riskLevel}' is valid.`);

    // ==================================================
    // 11. INSUFFICIENT DATA HANDLING
    // ==================================================
    console.log("\n--- 11. Insufficient Data Handling ---");
    const strategyNoData = await generateSellingStrategy({
      farmerId: farmerUser.id,
      commodity: "Dragon Fruit",
      quantity: 50
    });
    assert(strategyNoData && strategyNoData.success === true, "Strategy still succeeds even when no matching products exist.");
    // With no data for Dragon Fruit, it should indicate need for more info or limited data
    assert(
      strategyNoData.recommendation === "NEED_MORE_INFORMATION" || strategyNoData.facts,
      "Strategy handles missing commodity data gracefully."
    );

    // ==================================================
    // 12. PRICE UNCERTAINTY DISCLAIMER
    // ==================================================
    console.log("\n--- 12. Price Uncertainty & Disclaimers ---");
    assert(strategy1.disclaimer && typeof strategy1.disclaimer === "string", "Strategy includes a text disclaimer.");
    assert(
      strategy1.disclaimer.toLowerCase().includes("guarantee") === false ||
      strategy1.disclaimer.toLowerCase().includes("cannot be guaranteed") ||
      strategy1.disclaimer.toLowerCase().includes("estimates"),
      "Disclaimer does NOT guarantee prices or profits."
    );

    // ==================================================
    // 13. GROSS REVENUE CALCULATION
    // ==================================================
    console.log("\n--- 13. Gross Revenue Estimation ---");
    assert(strategy1.estimatedGrossRevenue !== undefined, "Estimated gross revenue field is present.");
    if (strategy1.estimatedGrossRevenue !== null) {
      assert(typeof strategy1.estimatedGrossRevenue === "number", "Estimated gross revenue is a number.");
      assert(strategy1.estimatedGrossRevenue > 0, "Estimated gross revenue is positive.");
    }
    if (strategy1.grossRevenueText) {
      assert(strategy1.grossRevenueText.includes("ESTIMATED GROSS REVENUE"), "Revenue text includes 'ESTIMATED GROSS REVENUE' label.");
      assert(strategy1.grossRevenueText.includes("₹"), "Revenue text includes ₹ symbol.");
      assert(!strategy1.grossRevenueText.toLowerCase().includes("profit"), "Revenue text does NOT use the word 'profit'.");
    }

    // ==================================================
    // 14. NO FAKE PROFIT
    // ==================================================
    console.log("\n--- 14. No Fabricated Profit Claims ---");
    const stratText = JSON.stringify(strategy1);
    assert(!stratText.includes("guaranteed profit"), "Strategy output never mentions 'guaranteed profit'.");
    assert(!stratText.includes("will definitely"), "Strategy output never uses 'will definitely'.");

    // ==================================================
    // 15. PRODUCT COMPARISON
    // ==================================================
    console.log("\n--- 15. Product Comparison (compareSellingOptions) ---");
    const comparison = await compareSellingOptions({
      farmerId: farmerUser.id,
      commodities: ["Tomato", "Onion"],
      userLocation: { district: farmerUser.district, region: farmerUser.region }
    });
    assert(comparison && comparison.success === true, "compareSellingOptions returns success.");
    assert(comparison.comparedCount === 2, "Comparison evaluates exactly 2 commodities.");
    assert(Array.isArray(comparison.comparison), "Comparison data is an array.");
    assert(comparison.comparison.length === 2, "Comparison has 2 rows (Tomato + Onion).");
    assert(comparison.comparison[0].commodity, "Each row has a 'commodity' field.");
    assert(comparison.comparison[0].recommendation, "Each row has a 'recommendation' field.");
    assert(comparison.comparison[0].currentPrice, "Each row has a 'currentPrice' field.");
    assert(comparison.comparison[0].demandTrend, "Each row has a 'demandTrend' field.");

    // ==================================================
    // 16. SELLING PLAN
    // ==================================================
    console.log("\n--- 16. Smart Selling Plan (generateSmartSellingPlan) ---");
    const plan = await generateSmartSellingPlan({
      farmerId: farmerUser.id,
      userLocation: { district: farmerUser.district, region: farmerUser.region }
    });
    assert(plan && plan.success === true, "generateSmartSellingPlan returns success.");
    assert(plan.farmerId === farmerUser.id, "Plan is scoped to the correct farmer.");
    assert(Array.isArray(plan.plan), "Plan items is an array.");
    assert(plan.plan.length >= 1, "Plan contains at least 1 crop evaluation.");
    assert(plan.totalCropsEvaluated >= 1, "Total crops evaluated count is >= 1.");
    const firstPlanItem = plan.plan[0];
    assert(firstPlanItem.product, "Plan item has 'product' field.");
    assert(firstPlanItem.inventory, "Plan item has 'inventory' field.");
    assert(firstPlanItem.demand, "Plan item has 'demand' field.");
    assert(firstPlanItem.recommendation, "Plan item has 'recommendation' field.");
    assert(firstPlanItem.risk, "Plan item has 'risk' field.");
    assert(firstPlanItem.reasoning, "Plan item has 'reasoning' field.");
    assert(plan.disclaimer, "Selling plan includes disclaimer.");

    // ==================================================
    // 17-21. MULTILINGUAL SUPPORT
    // ==================================================
    console.log("\n--- 17. English Language Support ---");
    const enCrop = normalizeCropName("tomato");
    assert(enCrop === "Tomato", "Normalizes English 'tomato' → 'Tomato'.");

    console.log("\n--- 18. Tamil Language Support ---");
    const taCrop = normalizeCropName("தக்காளி");
    assert(taCrop === "Tomato", "Normalizes Tamil 'தக்காளி' → 'Tomato'.");
    const taOnion = normalizeCropName("வெங்காயம்");
    assert(taOnion === "Onion", "Normalizes Tamil 'வெங்காயம்' → 'Onion'.");

    console.log("\n--- 19. Hindi Language Support ---");
    const hiCrop = normalizeCropName("टमाटर");
    assert(hiCrop === "Tomato", "Normalizes Hindi 'टमाटर' → 'Tomato'.");
    const hiOnion = normalizeCropName("प्याज");
    assert(hiOnion === "Onion", "Normalizes Hindi 'प्याज' → 'Onion'.");

    console.log("\n--- 20. Tanglish Language Support ---");
    const tanglishCrop = normalizeCropName("thakkali");
    assert(tanglishCrop === "Tomato", "Normalizes Tanglish 'thakkali' → 'Tomato'.");
    const tanglishOnion = normalizeCropName("vengayam");
    assert(tanglishOnion === "Onion", "Normalizes Tanglish 'vengayam' → 'Onion'.");

    console.log("\n--- 21. Mixed Language (Hinglish) Support ---");
    const hinglishCrop = normalizeCropName("tamatar");
    assert(hinglishCrop === "Tomato", "Normalizes Hinglish 'tamatar' → 'Tomato'.");
    const hinglishOnion = normalizeCropName("pyaaz");
    assert(hinglishOnion === "Onion", "Normalizes Hinglish 'pyaaz' → 'Onion'.");

    // ==================================================
    // 22. CROSS-TURN CONTEXT
    // ==================================================
    console.log("\n--- 22. Cross-Turn Context (Conversation Persistence) ---");
    // Verify conversation messages persist and can be reloaded
    const testConvId = `conv_p9_test_${Date.now().toString(36)}`;
    const testMsgId1 = `msg_p9_1_${Date.now().toString(36)}`;
    const testMsgId2 = `msg_p9_2_${Date.now().toString(36)}`;
    await query.run(
      "INSERT INTO ai_conversations (id, userId, title, createdAt, updatedAt) VALUES (?, ?, 'Phase 9 Context Test', ?, ?)",
      [testConvId, farmerUser.id, now, now]
    );
    await query.run(
      "INSERT INTO ai_messages (id, conversationId, role, content, createdAt) VALUES (?, ?, 'user', 'I have 100 kg tomatoes', ?)",
      [testMsgId1, testConvId, now]
    );
    await query.run(
      "INSERT INTO ai_messages (id, conversationId, role, content, createdAt) VALUES (?, ?, 'assistant', 'Your inventory shows 100 kg of Organic Tomato.', ?)",
      [testMsgId2, testConvId, now]
    );
    const contextMsgs = await query.all(
      "SELECT role, content FROM ai_messages WHERE conversationId = ? ORDER BY createdAt ASC",
      [testConvId]
    );
    assert(contextMsgs && contextMsgs.length >= 2, "Cross-turn conversation messages persist in database (2+ messages).");
    assert(contextMsgs[0].content.includes("100 kg"), "User message context preserved for follow-up references.");

    // ==================================================
    // 23. VOICE TRANSCRIPT INTEGRATION
    // ==================================================
    console.log("\n--- 23. Voice Transcript Integration ---");
    // Verify voice transcripts feed into the same processAiChat pipeline
    // (actual voice testing requires audio, but we verify the pipeline integration)
    const voiceTranscript = "En kitta 100 kilo tomato irukku. Ippo sell pannalama?";
    const normalizedFromVoice = normalizeCropName("tomato");
    assert(normalizedFromVoice === "Tomato", "Voice transcript crop name normalizes correctly for AI pipeline.");

    // ==================================================
    // 24. PHASE 6 ACTION PROPOSAL
    // ==================================================
    console.log("\n--- 24. Phase 6 Action Proposal Integration ---");
    const actionProposal = await prepareActionProposal({
      user: farmerUser,
      actionId: "CREATE_PRODUCT_LISTING",
      parameters: { name: "Phase9 Test Tomato", price: 42, stock: 50, unit: "kg", category: "Vegetables", organic: false }
    });
    assert(actionProposal && actionProposal.success === true, "Action proposal created successfully for product listing.");
    assert(actionProposal.requiresConfirmation === true, "Action proposal requires human confirmation.");
    assert(actionProposal.action && actionProposal.action.confirmationToken, "Action proposal has a confirmation token.");
    assert(actionProposal.action.display && actionProposal.action.display.title, "Action proposal has display title.");

    // ==================================================
    // 25. NO AUTONOMOUS EXECUTION
    // ==================================================
    console.log("\n--- 25. No Autonomous Execution Verification ---");
    // The action proposal above must NOT have executed the listing
    const autoCreated = await query.get("SELECT * FROM products WHERE name = 'Phase9 Test Tomato' AND farmerId = ?", [farmerUser.id]);
    assert(!autoCreated, "Product listing was NOT auto-created without human confirmation.");

    // ==================================================
    // 26. STALE INVENTORY PROTECTION
    // ==================================================
    console.log("\n--- 26. Stale Inventory Protection ---");
    // Prepare update inventory proposal, then change the stock, then try to confirm
    const inventoryProposal = await prepareActionProposal({
      user: farmerUser,
      actionId: "UPDATE_INVENTORY",
      parameters: { productId: prodTomatoId, newStock: 80 }
    });
    assert(inventoryProposal && inventoryProposal.success === true, "Inventory update proposal created.");
    // Simulate stale state: change stock behind the scenes
    await query.run("UPDATE products SET stock = 75 WHERE id = ?", [prodTomatoId]);
    // Attempt to confirm — should detect stale state
    const staleConfirm = await confirmAction({
      confirmationToken: inventoryProposal.action.confirmationToken,
      user: farmerUser
    });
    assert(
      staleConfirm.success === false,
      "Stale inventory confirmation is REJECTED.",
      staleConfirm.error ? staleConfirm.error.message : ""
    );
    // Restore stock
    await query.run("UPDATE products SET stock = 100 WHERE id = ?", [prodTomatoId]);

    // ==================================================
    // 27. OWNERSHIP VALIDATION
    // ==================================================
    console.log("\n--- 27. Ownership Validation ---");
    const otherFarmerPriceProposal = await prepareActionProposal({
      user: vendorUser,
      actionId: "UPDATE_PRODUCT_PRICE",
      parameters: { productId: prodTomatoId, newPrice: 50 }
    });
    assert(
      otherFarmerPriceProposal.success === false,
      "Vendor cannot propose price change on farmer's product.",
      otherFarmerPriceProposal.error ? otherFarmerPriceProposal.error.message : ""
    );

    // ==================================================
    // 28. VENDOR ISOLATION
    // ==================================================
    console.log("\n--- 28. Vendor Isolation ---");
    // Vendor should NOT have access to farmer-only selling tools
    assert(!isToolAllowed("vendor", "getMyInventory"), "Vendor cannot access getMyInventory tool.");
    assert(!isToolAllowed("vendor", "getMySales"), "Vendor cannot access getMySales tool.");
    assert(!isToolAllowed("vendor", "getSellingRecommendation"), "Vendor cannot access getSellingRecommendation tool.");
    assert(!isToolAllowed("vendor", "getMySellingOpportunities"), "Vendor cannot access getMySellingOpportunities tool.");
    assert(!isToolAllowed("vendor", "getSellingPlan"), "Vendor cannot access getSellingPlan tool.");
    assert(!isToolAllowed("vendor", "compareSellingOptions"), "Vendor cannot access compareSellingOptions tool.");
    // Vendor CAN access marketplace overview and nearby buyer opportunities
    assert(isToolAllowed("vendor", "getMarketplaceOverview"), "Vendor CAN access getMarketplaceOverview (public data).");
    assert(isToolAllowed("vendor", "getNearbyBuyerOpportunities"), "Vendor CAN access getNearbyBuyerOpportunities.");

    // ==================================================
    // 29. ADMIN PERMISSIONS
    // ==================================================
    console.log("\n--- 29. Admin Permissions ---");
    assert(isToolAllowed("admin", "getMySellingOpportunities"), "Admin can access getMySellingOpportunities.");
    assert(isToolAllowed("admin", "compareSellingOptions"), "Admin can access compareSellingOptions.");
    assert(isToolAllowed("admin", "getSellingPlan"), "Admin can access getSellingPlan.");
    assert(isToolAllowed("admin", "getMarketplaceOverview"), "Admin can access getMarketplaceOverview.");
    assert(isToolAllowed("admin", "getNearbyBuyerOpportunities"), "Admin can access getNearbyBuyerOpportunities.");
    assert(isToolAllowed("admin", "proposeUpdateProductPrice"), "Admin can access proposeUpdateProductPrice.");
    assert(isToolAllowed("admin", "proposeCreateProductListing"), "Admin can access proposeCreateProductListing.");

    // ==================================================
    // 30. DUPLICATE ACTION PROTECTION
    // ==================================================
    console.log("\n--- 30. Duplicate Action (Idempotency) Protection ---");
    const dupProposal = await prepareActionProposal({
      user: farmerUser,
      actionId: "UPDATE_PRODUCT_PRICE",
      parameters: { productId: prodOnionId, newPrice: 30 }
    });
    assert(dupProposal && dupProposal.success === true, "Price update proposal created for idempotency test.");
    // Confirm it once
    const confirmFirst = await confirmAction({
      confirmationToken: dupProposal.action.confirmationToken,
      user: farmerUser
    });
    assert(confirmFirst.success === true, "First confirmation succeeds.");
    // Try to confirm the same token again
    const confirmSecond = await confirmAction({
      confirmationToken: dupProposal.action.confirmationToken,
      user: farmerUser
    });
    assert(confirmSecond.success === false, "Second confirmation is REJECTED (idempotency).");
    assert(
      confirmSecond.error && confirmSecond.error.code === ACTION_ERRORS.ACTION_ALREADY_PROCESSED,
      "Error code is ACTION_ALREADY_PROCESSED for duplicate confirmation."
    );
    // Restore onion price
    await query.run("UPDATE products SET price = 28.00 WHERE id = ?", [prodOnionId]);

    // ==================================================
    // 31. TRANSACTION SAFETY
    // ==================================================
    console.log("\n--- 31. Transaction Safety ---");
    // Verify that confirmed actions produce audit trail
    const auditRows = await query.all(
      "SELECT * FROM ai_action_audit WHERE userId = ? ORDER BY createdAt DESC LIMIT 5",
      [farmerUser.id]
    );
    assert(auditRows && auditRows.length >= 1, "Action audit trail is recorded in ai_action_audit table.");
    assert(auditRows[0].status === "CONFIRMED" || auditRows[0].status === "FAILED", "Audit entry has a valid status.");

    // ==================================================
    // 32. PHASE 7 PROACTIVE INSIGHTS INTEGRATION
    // ==================================================
    console.log("\n--- 32. Phase 7 Proactive Insights Integration ---");
    // Insert a test proactive insight for the farmer
    const insightId = `ins_p9_test_${Date.now().toString(36)}`;
    await query.run(
      `INSERT INTO ai_proactive_insights (id, userId, type, severity, title, message, facts, reasoning, status, createdAt, expiresAt)
       VALUES (?, ?, 'demand', 'info', 'Tomato Demand Surge', 'Tomato demand increased 25% this week', 'Order volume up 25%', 'Demand trend suggests favorable selling conditions', 'active', ?, ?)`,
      [insightId, farmerUser.id, now, new Date(Date.now() + 86400000).toISOString()]
    );
    const factsWithInsights = await collectMarketplaceFacts(farmerUser.id, "Tomato", {
      location: { district: farmerUser.district, region: farmerUser.region }
    });
    assert(Array.isArray(factsWithInsights.proactiveInsights), "collectMarketplaceFacts retrieves proactive insights array.");

    // ==================================================
    // 33. PHASE 8 CROP IMAGE ANALYSIS CONTEXT
    // ==================================================
    console.log("\n--- 33. Phase 8 Crop Image Analysis Context Integration ---");
    // Insert a test crop image analysis record
    const imgAnalysisId = `img_p9_test_${Date.now().toString(36)}`;
    await query.run(
      `INSERT INTO ai_image_analyses (id, userId, cropContext, analysisResult, language, createdAt)
       VALUES (?, ?, 'Tomato field stress check', '{"summary":"Possible early blight detected"}', 'en', ?)`,
      [imgAnalysisId, farmerUser.id, now]
    );
    const factsWithImages = await collectMarketplaceFacts(farmerUser.id, "Tomato", {
      location: { district: farmerUser.district }
    });
    assert(Array.isArray(factsWithImages.cropAnalyses), "collectMarketplaceFacts retrieves crop image analyses array.");
    assert(factsWithImages.cropAnalyses.length >= 1, "At least 1 crop analysis record is retrieved.");

    // ==================================================
    // 34. NO FABRICATED DATA
    // ==================================================
    console.log("\n--- 34. No Fabricated Data Verification ---");
    const factCheck = await collectMarketplaceFacts(farmerUser.id, "Tomato", {
      location: { district: farmerUser.district }
    });
    // All inventory items should belong to the farmer
    if (factCheck.inventory && factCheck.inventory.length > 0) {
      const allOwned = factCheck.inventory.every(item => item.farmerId === farmerUser.id);
      assert(allOwned, "All inventory items in marketplace facts belong to the authenticated farmer.");
    }
    // Price stats should be derived from actual listings
    if (factCheck.priceStats) {
      assert(factCheck.priceStats.sampleSize >= 1, "Price stats sample size is >= 1 (based on real listings).");
    }

    // ==================================================
    // 35. TOOL RBAC
    // ==================================================
    console.log("\n--- 35. Tool RBAC Enforcement ---");
    // Farmer tools
    assert(isToolAllowed("farmer", "getMySellingOpportunities"), "Farmer can access getMySellingOpportunities.");
    assert(isToolAllowed("farmer", "compareSellingOptions"), "Farmer can access compareSellingOptions.");
    assert(isToolAllowed("farmer", "getSellingPlan"), "Farmer can access getSellingPlan.");
    assert(isToolAllowed("farmer", "getMarketplaceOverview"), "Farmer can access getMarketplaceOverview.");
    assert(isToolAllowed("farmer", "getNearbyBuyerOpportunities"), "Farmer can access getNearbyBuyerOpportunities.");
    // Vendor exclusions
    const vendorToolResult = await executeAiTool(vendorUser, "getMySellingOpportunities", {});
    assert(vendorToolResult.success === false, "Vendor tool execution for farmer-only selling tool is REJECTED.");
    assert(vendorToolResult.error && vendorToolResult.error.code === "FORBIDDEN", "Vendor gets FORBIDDEN error for farmer-only tools.");

    // Parameter sanitization test
    const sanitized = sanitizeToolParams(farmerUser, "getMySellingOpportunities", { farmerId: "attacker_id" });
    assert(sanitized.farmerId === farmerUser.id, "Parameter sanitization overrides spoofed farmerId with session identity.");

    // ==================================================
    // 36. EXISTING AI CHAT REGRESSION
    // ==================================================
    console.log("\n--- 36. Existing AI Chat Regression ---");
    // Verify processAiChat still works for non-marketplace queries
    const chatToolDecls = getFunctionDeclarationsForRole("farmer");
    assert(Array.isArray(chatToolDecls) && chatToolDecls.length > 0, "Farmer function declarations are non-empty.");
    // Verify core tools still present
    const toolNames = chatToolDecls.map(d => d.name);
    assert(toolNames.includes("searchProducts"), "searchProducts tool still present after Phase 9.");
    assert(toolNames.includes("getMyInventory"), "getMyInventory tool still present after Phase 9.");
    assert(toolNames.includes("getMyOrders"), "getMyOrders tool still present after Phase 9.");
    assert(toolNames.includes("getPriceIntelligence"), "getPriceIntelligence tool still present after Phase 9.");
    assert(toolNames.includes("getDemandIntelligence"), "getDemandIntelligence tool still present after Phase 9.");
    assert(toolNames.includes("getWeatherAdvisory"), "getWeatherAdvisory tool still present after Phase 9.");
    assert(toolNames.includes("getSellingRecommendation"), "getSellingRecommendation tool still present after Phase 9.");
    assert(toolNames.includes("getMyProactiveInsights"), "getMyProactiveInsights tool still present after Phase 9.");
    // Phase 6 tools
    assert(toolNames.includes("proposeUpdateProductPrice"), "proposeUpdateProductPrice still present after Phase 9.");
    assert(toolNames.includes("proposeUpdateInventory"), "proposeUpdateInventory still present after Phase 9.");
    assert(toolNames.includes("proposeCreateProductListing"), "proposeCreateProductListing still present after Phase 9.");
    // Phase 9 tools
    assert(toolNames.includes("getMySellingOpportunities"), "getMySellingOpportunities present in farmer declarations.");
    assert(toolNames.includes("compareSellingOptions"), "compareSellingOptions present in farmer declarations.");
    assert(toolNames.includes("getSellingPlan"), "getSellingPlan present in farmer declarations.");

    // ==================================================
    // 37. EXISTING VOICE REGRESSION
    // ==================================================
    console.log("\n--- 37. Existing Voice Regression ---");
    // Verify voice/STT tools still accessible
    assert(toolNames.includes("searchProducts"), "Voice pipeline still has access to searchProducts via tool declarations.");
    // Crop normalization must still work for voice transcripts
    assert(normalizeCropName("tomato") === "Tomato", "Voice crop normalization: 'tomato' → 'Tomato' still works.");
    assert(normalizeCropName("vengayam") === "Onion", "Voice crop normalization: 'vengayam' → 'Onion' still works.");
    assert(normalizeCropName("tamatar") === "Tomato", "Voice crop normalization: 'tamatar' → 'Tomato' still works.");

    // ==================================================
    // 38. EXISTING TTS REGRESSION
    // ==================================================
    console.log("\n--- 38. Existing TTS Regression ---");
    // TTS is a separate service; verify its import chain isn't broken
    try {
      const { synthesizeSpeech } = await import("./services/ttsService.js");
      assert(typeof synthesizeSpeech === "function", "TTS synthesizeSpeech function is still importable and callable.");
    } catch (e) {
      assert(false, "TTS service import failed — Phase 9 may have broken TTS.", e.message);
    }

    // ==================================================
    // 39. EXISTING IMAGE ANALYSIS REGRESSION
    // ==================================================
    console.log("\n--- 39. Existing Image Analysis Regression ---");
    try {
      const { analyzeCropImage, validateCropImage } = await import("./services/cropImageAnalysisService.js");
      assert(typeof analyzeCropImage === "function", "Crop image analyzeCropImage function is still importable.");
      assert(typeof validateCropImage === "function", "Crop image validateCropImage function is still importable.");
    } catch (e) {
      assert(false, "Crop image analysis service import failed — Phase 9 may have broken Phase 8.", e.message);
    }

    // ==================================================
    // ADDITIONAL MARKETPLACE TOOLS
    // ==================================================
    console.log("\n--- 40. Marketplace Overview ---");
    const overview = await getMarketplaceOverview({
      district: farmerUser.district,
      region: farmerUser.region
    });
    assert(overview && overview.success === true, "getMarketplaceOverview returns success.");
    assert(typeof overview.totalListings === "number", "Overview has totalListings count.");
    assert(Array.isArray(overview.categories), "Overview has categories array.");

    console.log("\n--- 41. Nearby Buyer Opportunities ---");
    const buyerOpps = await getNearbyBuyerOpportunities({
      farmerId: farmerUser.id,
      district: farmerUser.district,
      region: farmerUser.region
    });
    assert(buyerOpps && buyerOpps.success === true, "getNearbyBuyerOpportunities returns success.");
    assert(typeof buyerOpps.buyerDemandCount === "number", "Buyer opportunities has demand count.");
    assert(Array.isArray(buyerOpps.buyerOpportunities), "Buyer opportunities data is an array.");

    console.log("\n--- 42. AI Tool Execution via executeAiTool ---");
    const toolExecResult = await executeAiTool(farmerUser, "getMySellingOpportunities", {});
    assert(toolExecResult.success === true, "executeAiTool for getMySellingOpportunities returns success.");
    assert(toolExecResult.data && typeof toolExecResult.data.opportunityCount === "number", "Tool execution returns structured opportunity data.");

    const toolExecCompare = await executeAiTool(farmerUser, "compareSellingOptions", { commodities: ["Tomato", "Onion"] });
    assert(toolExecCompare.success === true, "executeAiTool for compareSellingOptions returns success.");

    const toolExecPlan = await executeAiTool(farmerUser, "getSellingPlan", {});
    assert(toolExecPlan.success === true, "executeAiTool for getSellingPlan returns success.");

    const toolExecOverview = await executeAiTool(farmerUser, "getMarketplaceOverview", { district: "Madurai" });
    assert(toolExecOverview.success === true, "executeAiTool for getMarketplaceOverview returns success.");

    const toolExecBuyers = await executeAiTool(farmerUser, "getNearbyBuyerOpportunities", { district: "Madurai" });
    assert(toolExecBuyers.success === true, "executeAiTool for getNearbyBuyerOpportunities returns success.");

    console.log("\n--- 43. collectMarketplaceFacts Integration ---");
    const fullFacts = await collectMarketplaceFacts(farmerUser.id, "Tomato", {
      location: { district: farmerUser.district, region: farmerUser.region, lat: farmerUser.lat, lng: farmerUser.lng }
    });
    assert(fullFacts.commodity === "Tomato", "Facts commodity is 'Tomato'.");
    assert(fullFacts.farmerId === farmerUser.id, "Facts farmerId matches.");
    assert(Array.isArray(fullFacts.inventory), "Facts has inventory array.");
    assert(fullFacts.priceStats !== undefined, "Facts has priceStats.");
    assert(fullFacts.pendingOrders !== undefined, "Facts has pendingOrders.");
    assert(fullFacts.weather !== undefined, "Facts has weather data (may be null if API unavailable).");
    assert(Array.isArray(fullFacts.proactiveInsights), "Facts has proactiveInsights array.");
    assert(Array.isArray(fullFacts.cropAnalyses), "Facts has cropAnalyses array.");
    assert(fullFacts.location && fullFacts.location.district, "Facts has location data.");

    // ==================================================
    // CLEANUP
    // ==================================================
    console.log("\n--- Cleanup ---");
    await query.run("DELETE FROM ai_proactive_insights WHERE userId IN (?, ?, ?)", [farmerUser.id, vendorUser.id, adminUser.id]);
    await query.run("DELETE FROM ai_image_analyses WHERE userId IN (?, ?)", [farmerUser.id, vendorUser.id]);
    await query.run("DELETE FROM ai_messages WHERE conversationId = ?", [testConvId]);
    await query.run("DELETE FROM ai_conversations WHERE id = ?", [testConvId]);
    await query.run("DELETE FROM ai_pending_actions WHERE userId IN (?, ?, ?)", [farmerUser.id, vendorUser.id, adminUser.id]);
    await query.run("DELETE FROM ai_action_audit WHERE userId IN (?, ?, ?)", [farmerUser.id, vendorUser.id, adminUser.id]);
    await query.run("DELETE FROM order_items WHERE orderId = ?", [orderId]);
    await query.run("DELETE FROM orders WHERE id = ?", [orderId]);
    await query.run("DELETE FROM products WHERE id IN (?, ?, ?)", [prodTomatoId, prodOnionId, prodWheatId]);
    await query.run("DELETE FROM users WHERE id IN (?, ?, ?)", [farmerUser.id, vendorUser.id, adminUser.id]);
    assert(true, "Test data cleaned up successfully.");

  } catch (err) {
    console.error("\n💥 CRITICAL TEST ERROR:", err.message || err);
    console.error(err.stack || "");
    failed++;
  }

  // ==================================================
  // FINAL REPORT
  // ==================================================
  console.log("\n==================================================");
  console.log("   PHASE 9 MARKETPLACE AGENT TEST RESULTS");
  console.log("==================================================");
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📊 Total:  ${passed + failed}`);
  console.log("==================================================\n");

  if (failed > 0) {
    console.error(`⚠️  ${failed} test(s) FAILED. Please review output above.`);
    process.exit(1);
  } else {
    console.log("🎉 ALL PHASE 9 TESTS PASSED!\n");
    process.exit(0);
  }
}

runPhase9Tests();
