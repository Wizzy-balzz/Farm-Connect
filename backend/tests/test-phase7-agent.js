import { query, initDatabase } from "../database.js";
import { generateProactiveInsightsForUser, getUserProactiveInsights, markInsightAsRead } from "../services/proactiveInsightService.js";
import { getFunctionDeclarationsForRole, executeAiTool } from "../ai/aiTools.js";
import { isToolAllowed } from "../ai/aiPermissions.js";

async function runPhase7Tests() {
  console.log("==================================================");
  console.log("   FARMCONNECT PHASE 7 — PROACTIVE AGRICULTURAL AI TESTS");
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

  const farmerUser = {
    id: "usr_farmer_phase7",
    name: "Murugan",
    role: "farmer",
    region: "Tamil Nadu",
    district: "Coimbatore",
    lat: 11.0168,
    lng: 76.9558,
    countryName: "India"
  };

  const vendorUser = {
    id: "usr_vendor_phase7",
    name: "Salem Wholesale",
    role: "vendor",
    region: "Tamil Nadu",
    district: "Salem"
  };

  const prodLowStockId = "prod_p7_lowstock";
  const prodPriceShiftId = "prod_p7_priceshift";
  const competitorProdId = "prod_p7_competitor";

  try {
    // 0. Ensure Database Schema Initialized
    await initDatabase();

    // 1. Fixture Setup
    const now = new Date().toISOString();
    await query.run("DELETE FROM ai_proactive_insights WHERE userId IN (?, ?)", [farmerUser.id, vendorUser.id]);
    await query.run("DELETE FROM notifications WHERE userId IN (?, ?)", [farmerUser.id, vendorUser.id]);
    await query.run("DELETE FROM products WHERE id IN (?, ?, ?)", [prodLowStockId, prodPriceShiftId, competitorProdId]);
    await query.run("DELETE FROM users WHERE id IN (?, ?)", [farmerUser.id, vendorUser.id]);

    await query.run(
      "INSERT INTO users (id, name, email, role, region, district, lat, lng, createdAt) VALUES (?, ?, ?, 'farmer', ?, ?, ?, ?, ?)",
      [farmerUser.id, farmerUser.name, "murugan_p7@test.com", farmerUser.region, farmerUser.district, farmerUser.lat, farmerUser.lng, now]
    );
    await query.run(
      "INSERT INTO users (id, name, email, role, region, district, createdAt) VALUES (?, ?, ?, 'vendor', ?, ?, ?)",
      [vendorUser.id, vendorUser.name, "salem_p7@test.com", vendorUser.region, vendorUser.district, now]
    );

    // Insert Low Stock Product (stock = 4 kg, MOQ = 10 kg)
    await query.run(
      `INSERT INTO products (id, farmerId, name, category, price, unit, stock, moq, organic, region, district, createdAt)
       VALUES (?, ?, 'Phase7 Organic Tomato', 'Vegetables', 45.00, 'kg', 4, 10, 1, 'Tamil Nadu', 'Coimbatore', ?)`,
      [prodLowStockId, farmerUser.id, now]
    );

    // Insert Underpriced Product (price = ₹20 vs competitor price = ₹50)
    await query.run(
      `INSERT INTO products (id, farmerId, name, category, price, unit, stock, moq, organic, region, district, createdAt)
       VALUES (?, ?, 'Phase7 Green Chili', 'Vegetables', 20.00, 'kg', 200, 10, 0, 'Tamil Nadu', 'Coimbatore', ?)`,
      [prodPriceShiftId, farmerUser.id, now]
    );

    // Insert Competitor Product for Price Benchmark
    await query.run(
      `INSERT INTO products (id, farmerId, name, category, price, unit, stock, moq, organic, region, district, createdAt)
       VALUES (?, ?, 'Phase7 Benchmark Chili', 'Vegetables', 50.00, 'kg', 500, 10, 0, 'Tamil Nadu', 'Coimbatore', ?)`,
      [competitorProdId, vendorUser.id, now]
    );

    // TEST 1: Database Schema Verification
    console.log("--- 1. Database Table Check ---");
    const countCheck = await query.get("SELECT COUNT(*) as cnt FROM ai_proactive_insights");
    assert(countCheck !== null && countCheck !== undefined, "Table 'ai_proactive_insights' exists and is queryable.");

    // TEST 2: Low Inventory Detection
    console.log("\n--- 2. Low Inventory Detection Test ---");
    const genRes = await generateProactiveInsightsForUser(farmerUser, { forceRefresh: true });
    assert(genRes.success === true && genRes.count > 0, "generateProactiveInsightsForUser executes successfully.");

    const activeInsights = await getUserProactiveInsights(farmerUser.id, "en", "active");
    const lowStockAlert = activeInsights.insights.find(i => i.type === "inventory");
    assert(lowStockAlert !== undefined, "Low inventory alert generated for stock (4 kg) <= MOQ (10 kg).");
    assert(lowStockAlert && lowStockAlert.severity === "critical", "Low inventory alert assigned 'critical' severity when stock <= 5.");

    // TEST 3: Facts vs Reasoning Separation
    console.log("\n--- 3. Facts vs Reasoning Separation Test ---");
    assert(lowStockAlert && Array.isArray(lowStockAlert.facts) && lowStockAlert.facts.length > 0, "Alert contains explicit FACTS array from DB observations.");
    assert(lowStockAlert && Array.isArray(lowStockAlert.reasoning) && lowStockAlert.reasoning.length > 0, "Alert contains explicit REASONING array from AI analysis.");
    assert(lowStockAlert && lowStockAlert.facts[0].includes("Phase7 Organic Tomato"), "FACTS accurately reference real DB product name.");

    // TEST 4: Price Movement Alert Calculation
    console.log("\n--- 4. Price Movement Detection Test ---");
    const priceAlert = activeInsights.insights.find(i => i.type === "price");
    assert(priceAlert !== undefined, "Price movement alert generated when listed price (₹20) differs from market average (₹50).");

    // TEST 5: Weather Advisory Integration
    console.log("\n--- 5. Weather Advisory & Selling Opportunity Test ---");
    const weatherOrSellingAlert = activeInsights.insights.find(i => i.type === "weather" || i.type === "selling");
    assert(weatherOrSellingAlert !== undefined, "Weather/Selling opportunity insight generated from Open-Meteo integration.");

    // TEST 6: Duplicate Prevention Logic
    console.log("\n--- 6. Duplicate Prevention Test ---");
    const duplicateGenRes = await generateProactiveInsightsForUser(farmerUser, { forceRefresh: false });
    const activeAfterDedupe = await getUserProactiveInsights(farmerUser.id, "en", "active");
    assert(activeAfterDedupe.count === activeInsights.count, "Duplicate prevention prevents re-inserting identical active insights within 24h.");

    // TEST 7: Expiration Logic
    console.log("\n--- 7. Expiration Logic Test ---");
    // Manually set an insight's expiresAt to 1 hour ago
    const testExpId = activeInsights.insights[0].id;
    const pastTime = new Date(Date.now() - 3600 * 1000).toISOString();
    await query.run("UPDATE ai_proactive_insights SET expiresAt = ? WHERE id = ?", [pastTime, testExpId]);

    const activeAfterExpiry = await getUserProactiveInsights(farmerUser.id, "en", "active");
    const expiredRecord = await query.get("SELECT status FROM ai_proactive_insights WHERE id = ?", [testExpId]);
    assert(expiredRecord && expiredRecord.status === "expired", "Outdated insight automatically updated to 'expired' status upon query.");

    // TEST 8: Read / Unread State Toggle
    console.log("\n--- 8. Read / Unread State Toggle Test ---");
    if (activeAfterExpiry.insights.length > 0) {
      const targetId = activeAfterExpiry.insights[0].id;
      const readRes = await markInsightAsRead(farmerUser.id, targetId);
      assert(readRes.success === true && readRes.status === "read", "markInsightAsRead successfully sets status to 'read'.");

      const readInDb = await query.get("SELECT status FROM ai_proactive_insights WHERE id = ?", [targetId]);
      assert(readInDb && readInDb.status === "read", "Database state confirms status updated to 'read'.");
    }

    // TEST 9: Multilingual Insight Output
    console.log("\n--- 9. Multilingual Support Test ---");
    const taInsights = await getUserProactiveInsights(farmerUser.id, "ta", "all");
    const hiInsights = await getUserProactiveInsights(farmerUser.id, "hi", "all");
    const tanglishInsights = await getUserProactiveInsights(farmerUser.id, "tanglish", "all");

    assert(taInsights.insights.length > 0 && taInsights.insights.some(i => i.title.includes("குறைந்த") || i.title.includes("சந்தை") || i.title.includes("எச்சரிக்கை") || i.title.includes("வாய்ப்பு")), "Tamil translation output verified.");
    assert(hiInsights.insights.length > 0 && hiInsights.insights.some(i => i.title.includes("चेतावनी") || i.title.includes("मूल्य") || i.title.includes("मांग") || i.title.includes("अवसर")), "Hindi translation output verified.");
    assert(tanglishInsights.insights.length > 0, "Tanglish translation output verified.");

    // TEST 10: Non-Autonomous Action Guardrails (Phase 6 Safety)
    console.log("\n--- 10. Phase 6 Non-Autonomous Action Safety Check ---");
    const dbProdBefore = await query.get("SELECT price, stock FROM products WHERE id = ?", [prodLowStockId]);
    assert(parseFloat(dbProdBefore.price) === 45 && parseInt(dbProdBefore.stock, 10) === 4, "Product price and stock remain unchanged after insight generation (No autonomous write mutations).");

    // TEST 11: AI Chat Tool Integration (getMyProactiveInsights)
    console.log("\n--- 11. AI Tool Integration (getMyProactiveInsights) Test ---");
    const farmerHasTool = isToolAllowed("farmer", "getMyProactiveInsights");
    const vendorHasTool = isToolAllowed("vendor", "getMyProactiveInsights");
    assert(farmerHasTool === true, "Farmer role has permission for getMyProactiveInsights.");
    assert(vendorHasTool === false, "Vendor role is DENIED permission for getMyProactiveInsights.");

    const toolResult = await executeAiTool(farmerUser, "getMyProactiveInsights", { lang: "en", status: "all" });
    assert(toolResult.success === true && toolResult.data && Array.isArray(toolResult.data.insights), "executeAiTool executes getMyProactiveInsights tool successfully.");

    // Clean up test fixtures
    await query.run("DELETE FROM ai_proactive_insights WHERE userId IN (?, ?)", [farmerUser.id, vendorUser.id]);
    await query.run("DELETE FROM notifications WHERE userId IN (?, ?)", [farmerUser.id, vendorUser.id]);
    await query.run("DELETE FROM products WHERE id IN (?, ?, ?)", [prodLowStockId, prodPriceShiftId, competitorProdId]);
    await query.run("DELETE FROM users WHERE id IN (?, ?)", [farmerUser.id, vendorUser.id]);

  } catch (err) {
    console.error("Test execution error:", err);
    failed++;
  }

  console.log("\n==================================================");
  console.log(`   PHASE 7 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================\n");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase7Tests();
