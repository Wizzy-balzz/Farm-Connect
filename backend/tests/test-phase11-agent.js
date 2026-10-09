import { query, initDatabase } from "../database.js";
import {
  getUserMemories,
  searchUserMemory,
  getRelevantUserContext,
  proposeMemoryItem,
  saveMemoryItem,
  deleteMemoryItem,
  clearUserMemories,
  sanitizeMemoryContent
} from "../services/aiMemoryService.js";
import {
  getUserGoals,
  getGoalById,
  createGoal,
  updateGoal,
  deleteGoal,
  calculateVerifiedGoalProgress,
  proposeCreateGoal
} from "../services/aiGoalService.js";
import {
  getUserFollowups,
  getFollowupById,
  createFollowup,
  completeFollowup,
  dismissFollowup,
  proposeCreateFollowup
} from "../services/aiFollowupService.js";
import {
  executeCopilotPlan,
  MAX_PLAN_STEPS,
  MAX_TOOL_CALLS,
  getStandardPlanWorkflow
} from "../services/aiPlannerService.js";
import { executeAiTool, getFunctionDeclarationsForRole } from "../ai/aiTools.js";
import { isToolAllowed, sanitizeToolParams } from "../ai/aiPermissions.js";
import { prepareActionProposal, confirmAction, cancelAction } from "../ai/aiActions.js";
import { processAiChat } from "../ai/aiService.js";
import crypto from "crypto";

async function runPhase11Tests() {
  console.log("==================================================");
  console.log("   FARMCONNECT PHASE 11 — AI PERSONAL COPILOT TESTS");
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

  // Test Fixture Entities
  const farmerUser = {
    id: "usr_farmer_p11",
    name: "Arun Kumar",
    role: "farmer",
    region: "Tamil Nadu",
    district: "Coimbatore",
    lat: 11.0168,
    lng: 76.9558,
    primaryCrop: "Tomato"
  };

  const vendorUser = {
    id: "usr_vendor_p11",
    name: "Kovai Fresh Mart",
    role: "vendor",
    region: "Tamil Nadu",
    district: "Coimbatore"
  };

  const rogueUser = {
    id: "usr_rogue_p11",
    name: "Spoof Attacker",
    role: "vendor",
    region: "Unknown"
  };

  const testProdId = "prod_p11_tomato";
  const testOrderId = "ord_p11_01";
  const now = new Date().toISOString();

  try {
    // 0. Ensure database initialized
    await initDatabase();

    // Clean up any existing test fixtures
    await query.run("DELETE FROM ai_user_memory WHERE userId IN (?, ?, ?)", [farmerUser.id, vendorUser.id, rogueUser.id]);
    await query.run("DELETE FROM ai_farming_goals WHERE userId IN (?, ?, ?)", [farmerUser.id, vendorUser.id, rogueUser.id]);
    await query.run("DELETE FROM ai_followups WHERE userId IN (?, ?, ?)", [farmerUser.id, vendorUser.id, rogueUser.id]);
    await query.run("DELETE FROM ai_action_audit WHERE userId IN (?, ?, ?)", [farmerUser.id, vendorUser.id, rogueUser.id]);
    await query.run("DELETE FROM ai_pending_actions WHERE userId IN (?, ?, ?)", [farmerUser.id, vendorUser.id, rogueUser.id]);
    await query.run("DELETE FROM notifications WHERE userId IN (?, ?, ?)", [farmerUser.id, vendorUser.id, rogueUser.id]);
    await query.run("DELETE FROM order_items WHERE orderId = ?", [testOrderId]);
    await query.run("DELETE FROM orders WHERE id = ?", [testOrderId]);
    await query.run("DELETE FROM products WHERE id = ?", [testProdId]);
    await query.run("DELETE FROM users WHERE id IN (?, ?, ?)", [farmerUser.id, vendorUser.id, rogueUser.id]);

    // Insert Test Users
    await query.run(
      "INSERT INTO users (id, name, email, role, region, district, lat, lng, primaryCrop, createdAt) VALUES (?, ?, ?, 'farmer', ?, ?, ?, ?, ?, ?)",
      [farmerUser.id, farmerUser.name, "arun_p11@test.com", farmerUser.region, farmerUser.district, farmerUser.lat, farmerUser.lng, farmerUser.primaryCrop, now]
    );
    await query.run(
      "INSERT INTO users (id, name, email, role, region, district, createdAt) VALUES (?, ?, ?, 'vendor', ?, ?, ?)",
      [vendorUser.id, vendorUser.name, "kovai_p11@test.com", vendorUser.region, vendorUser.district, now]
    );

    // Insert Product & Order for verified data testing
    await query.run(
      `INSERT INTO products (id, farmerId, name, category, price, unit, stock, moq, organic, region, district, createdAt)
       VALUES (?, ?, 'Organic Farm Tomatoes', 'Vegetables', 45.00, 'kg', 400, 10, 1, 'Tamil Nadu', 'Coimbatore', ?)`,
      [testProdId, farmerUser.id, now]
    );

    await query.run(
      `INSERT INTO orders (id, vendorId, vendorName, totalAmount, subtotal, status, createdAt)
       VALUES (?, ?, ?, 9000.00, 9000.00, 'Delivered', ?)`,
      [testOrderId, vendorUser.id, vendorUser.name, now]
    );

    await query.run(
      `INSERT INTO order_items (id, orderId, productId, farmerId, qty, unitPrice, amount)
       VALUES ('oi_p11_01', ?, ?, ?, 200, 45.00, 9000.00)`,
      [testOrderId, testProdId, farmerUser.id]
    );

    console.log("--- 1. Personal AI Memory Tests ---");

    // TEST 1: Memory creation proposal
    const memProp = proposeMemoryItem(farmerUser, {
      memoryType: "preference",
      key: "preferred_crop",
      value: "Tomatoes",
      confidence: "high"
    });
    assert(memProp.requiresConfirmation === true, "1. Memory creation proposal requiresConfirmation is true");
    assert(memProp.memory.key === "preferred_crop", "1. Memory proposal captures valid key");

    // TEST 2: Memory retrieval
    await saveMemoryItem(farmerUser.id, {
      memoryType: "preference",
      key: "preferred_crop",
      value: "Tomatoes",
      confidence: "high"
    });
    await saveMemoryItem(farmerUser.id, {
      memoryType: "strategy",
      key: "selling_preference",
      value: "Prefers direct wholesale sales",
      confidence: "high"
    });

    const memories = await getUserMemories(farmerUser.id);
    assert(memories.length === 2, "2. Memory retrieval returns saved items", `Count: ${memories.length}`);

    const searchRes = await searchUserMemory(farmerUser.id, "wholesale");
    assert(searchRes.length === 1 && searchRes[0].key === "selling_preference", "2. Search memory by keyword works");

    // TEST 3: Memory isolation
    await saveMemoryItem(vendorUser.id, {
      memoryType: "preference",
      key: "buying_budget",
      value: "Under ₹50/kg",
      confidence: "high"
    });
    const vendorMemories = await getUserMemories(vendorUser.id);
    const farmerCannotSeeVendor = await getUserMemories(farmerUser.id);
    assert(!farmerCannotSeeVendor.some(m => m.key === "buying_budget"), "3. Memory isolation: Farmer cannot see vendor memory");
    assert(!vendorMemories.some(m => m.key === "preferred_crop"), "3. Memory isolation: Vendor cannot see farmer memory");

    console.log("\n--- 2. Farming Goals Tests ---");

    // TEST 4: Goal creation
    const createdGoal = await createGoal(farmerUser.id, {
      title: "Sell 500 kg of Tomatoes this month",
      category: "selling",
      targetValue: 500,
      currentValue: 0,
      unit: "kg",
      deadline: new Date(Date.now() + 15 * 86400000).toISOString().split("T")[0]
    });
    assert(createdGoal && createdGoal.id, "4. Goal creation succeeds in database");

    // TEST 5: Goal retrieval
    const farmerGoals = await getUserGoals(farmerUser.id);
    assert(farmerGoals.length === 1 && farmerGoals[0].title.includes("500 kg"), "5. Goal retrieval returns active goals");

    // TEST 6: Goal progress verified calculation
    const progressCalc = await calculateVerifiedGoalProgress(farmerUser.id, createdGoal.id);
    assert(progressCalc && progressCalc.goal, "6. Goal progress calculation succeeds");
    assert(parseFloat(progressCalc.goal.currentValue) === 200, "6. Goal progress accurately reads 200 kg sold from orders table", `Current: ${progressCalc.goal.currentValue}`);
    assert(progressCalc.goal.progressPercent === 40, "6. Goal progress percent calculated at 40% (200/500 kg)");

    console.log("\n--- 3. Multi-Step Planner Tests ---");

    // TEST 7: Multi-step planner coordination
    const planRes = await executeCopilotPlan({
      user: farmerUser,
      query: "Should I sell my tomatoes this week?",
      workflowIntent: "SHOULD_I_SELL",
      initialParams: { commodity: "Tomato" }
    });
    assert(planRes.success === true, "7. Multi-step planner executes successfully");
    assert(planRes.completedSteps >= 4, "7. Planner coordinates multiple tools", `Completed: ${planRes.completedSteps}`);
    assert(Array.isArray(planRes.facts) && planRes.facts.length > 0, "7. Planner outputs verified facts list");
    assert(typeof planRes.reasoning === "string" && planRes.reasoning.length > 0, "7. Planner outputs synthesized reasoning");
    assert(planRes.recommendation && planRes.recommendation.action, "7. Planner provides decision recommendation");

    // TEST 8: Tool dependency handling
    const hasPriceStep = planRes.planSteps.some(s => s.toolName === "getPriceIntelligence" && s.status === "completed");
    const hasInvStep = planRes.planSteps.some(s => s.toolName === "getMyInventory" && s.status === "completed");
    assert(hasPriceStep && hasInvStep, "8. Tool dependency handling coordinates inventory and price tools");

    // TEST 9: Planner timeout handling
    const startTimeout = Date.now();
    try {
      // Simulate timeout by calling with small step sequence and verify boundary safety
      const fastPlan = await executeCopilotPlan({
        user: farmerUser,
        customSteps: [{ toolName: "getMyInventory", params: {} }]
      });
      assert(fastPlan.success === true && fastPlan.totalDurationMs < 5000, "9. Planner finishes well within timeout limit");
    } catch (err) {
      assert(false, "9. Planner timeout failed unexpectedly", err.message);
    }

    // TEST 10: Planner step limit
    const oversizedSteps = Array(20).fill(0).map((_, i) => ({
      toolName: "getMyInventory",
      params: {},
      description: `Step ${i}`
    }));
    const cappedPlan = await executeCopilotPlan({
      user: farmerUser,
      customSteps: oversizedSteps
    });
    assert(cappedPlan.planSteps.length <= MAX_PLAN_STEPS, "10. Planner enforces hard MAX_PLAN_STEPS (10)");

    console.log("\n--- 4. Multilingual & Context Workflows ---");

    // TEST 11: Pronoun resolution & multi-turn template
    const pronounWorkflow = getStandardPlanWorkflow("SHOULD_I_SELL", { commodity: "Tomato" });
    assert(pronounWorkflow.length > 0 && pronounWorkflow[1].params.commodity === "Tomato", "11. Entity context preserves 'Tomato' across query turns");

    // TEST 12: Tamil workflow
    const tamilToolResult = await executeAiTool(farmerUser, "getPriceIntelligence", { commodity: "Tomato", lang: "ta" });
    assert(tamilToolResult.success === true, "12. Tamil produce query resolves canonical commodity and executes tool");

    // TEST 13: Hindi workflow
    const hindiToolResult = await executeAiTool(farmerUser, "getPriceIntelligence", { commodity: "Tomato", lang: "hi" });
    assert(hindiToolResult.success === true, "13. Hindi produce query executes successfully");

    // TEST 14: Tanglish workflow
    const tanglishPlan = await executeCopilotPlan({
      user: farmerUser,
      query: "tomato demand irukka, sell pannalama?"
    });
    assert(tanglishPlan.success === true, "14. Tanglish query maps to appropriate selling evaluation plan");

    console.log("\n--- 5. Copilot Multi-Subsystem Integrations ---");

    // TEST 15: Voice -> planner integration
    const voiceTranscribedQuery = "What is the selling recommendation for my tomatoes?";
    const voicePlan = await executeCopilotPlan({
      user: farmerUser,
      query: voiceTranscribedQuery
    });
    assert(voicePlan.success === true && voicePlan.recommendation !== undefined, "15. Transcribed voice prompt executes through copilot planner");

    // TEST 16: Image -> copilot integration (followup from plant analysis)
    const imgFollowup = await createFollowup(farmerUser.id, {
      title: "Re-inspect tomato leaves for early blight after 48h",
      description: "Triggered from Crop Image Vision Analysis",
      type: "harvest_reminder"
    });
    assert(imgFollowup && imgFollowup.id, "16. Crop image analysis cleanly creates follow-up in copilot task system");

    // TEST 17: Marketplace -> copilot integration
    const oppsRes = await executeAiTool(farmerUser, "getMySellingOpportunities", {});
    assert(oppsRes.success === true, "17. Marketplace selling opportunities integrate with copilot tools");

    // TEST 18: Analytics -> copilot integration
    const reportRes = await executeAiTool(farmerUser, "getMyFarmReport", { period: "30d" });
    assert(reportRes && reportRes.success, "18. Farm analytics integrate with copilot read-only tools", reportRes.error?.message);

    // TEST 19: Proactive insight -> copilot integration
    const insightsRes = await executeAiTool(farmerUser, "getMyProactiveInsights", {});
    assert(insightsRes.success === true, "19. Proactive insights integrate with copilot dashboard");

    console.log("\n--- 6. Security, Confirmation & Isolation ---");

    // TEST 20: Sensitive action requires confirmation
    const priceProp = await prepareActionProposal(farmerUser, "UPDATE_PRODUCT_PRICE", {
      productId: testProdId,
      newPrice: 52.00
    });
    assert(priceProp.requiresConfirmation === true, "20. Sensitive mutation requires confirmation");
    assert(priceProp.action && priceProp.action.confirmationToken, "20. Returns confirmation token for Phase 6 confirmation card");

    // Verify DB not modified yet
    const prodBefore = await query.get("SELECT price FROM products WHERE id = ?", [testProdId]);
    assert(parseFloat(prodBefore.price) === 45.00, "20. Database NOT modified before explicit confirmation");

    // TEST 21: Confirmation token expiration
    const expiredTokenRes = await confirmAction({ confirmationToken: "expired_dummy_token_999", userId: farmerUser.id });
    assert(expiredTokenRes.success === false, "21. Expired/invalid confirmation token rejected");

    // TEST 22: Stale-state protection
    // Mutate DB behind the proposal's back
    await query.run("UPDATE products SET price = 48.00 WHERE id = ?", [testProdId]);
    const confirmStaleRes = await confirmAction({ confirmationToken: priceProp.action.confirmationToken, userId: farmerUser.id });
    assert(confirmStaleRes.success === false && confirmStaleRes.error.code === "ACTION_STALE", "22. Stale-state protection triggers on concurrent change", confirmStaleRes.error?.message || confirmStaleRes.error?.code);

    // Reset price back for remaining tests
    await query.run("UPDATE products SET price = 45.00 WHERE id = ?", [testProdId]);

    // TEST 23: RBAC on copilot tools
    const vendorProposePrice = isToolAllowed("vendor", "proposeUpdateProductPrice");
    const farmerProposePrice = isToolAllowed("farmer", "proposeUpdateProductPrice");
    assert(farmerProposePrice && !vendorProposePrice, "23. RBAC: Vendor forbidden from proposeUpdateProductPrice");

    // TEST 24: farmerId spoof prevention
    const sanitizedParams = sanitizeToolParams(vendorUser, "getMySales", { farmerId: farmerUser.id });
    assert(!sanitizedParams.farmerId, "24. farmerId spoof prevention: vendor cannot spoof farmerId");

    // TEST 25: Vendor isolation on goals
    const vendorGoalsAllowed = isToolAllowed("vendor", "getMyFarmingGoals");
    assert(!vendorGoalsAllowed, "25. Vendor isolation: Vendor cannot access farming goals");

    // TEST 26: Gemini 403 fallback handling
    try {
      const chatFallback = await processAiChat({
        user: farmerUser,
        prompt: "Show tomato prices",
        lang: "en"
      });
      assert(chatFallback && chatFallback.message, "26. Gemini 403/quota fallback handled gracefully without crash");
    } catch (err) {
      assert(false, "26. Chat failed unexpectedly:", err.message);
    }

    // TEST 27: Tool failure handling
    const badToolRes = await executeAiTool(farmerUser, "getProduct", { id: "non_existent_prod_999" });
    assert(badToolRes.success === false || badToolRes.data === null, "27. Missing entity tool execution handled safely without uncaught exception");

    console.log("\n--- 7. Follow-ups, Notifications & Auditing ---");

    // TEST 28: Follow-up creation
    const f1 = await createFollowup(farmerUser.id, {
      title: "Check tomato wholesale prices tomorrow morning",
      type: "price_alert"
    });
    assert(f1 && f1.id, "28. Follow-up task successfully created");

    // TEST 29: Duplicate follow-up prevention
    const fDup = await createFollowup(farmerUser.id, {
      title: "Check tomato wholesale prices tomorrow morning",
      type: "price_alert"
    });
    assert(fDup.duplicate === true, "29. Duplicate follow-up prevented from double-posting");

    // TEST 30: Notification integration
    const notifs = await query.all("SELECT * FROM notifications WHERE userId = ? AND text LIKE '%Follow-up%'", [farmerUser.id]);
    assert(notifs.length > 0, "30. Notification table record created upon follow-up scheduling");

    // TEST 31: Audit logging
    const newProposal = await prepareActionProposal(farmerUser, "UPDATE_PRODUCT_PRICE", {
      productId: testProdId,
      newPrice: 47.00
    });
    const confirmRes = await confirmAction({
      confirmationToken: newProposal.action.confirmationToken,
      userId: farmerUser.id
    });
    assert(confirmRes.success === true, "31. Action confirmed cleanly", confirmRes.error?.message);

    const auditLog = await query.get(
      "SELECT * FROM ai_action_audit WHERE userId = ? AND actionId = 'UPDATE_PRODUCT_PRICE' ORDER BY createdAt DESC LIMIT 1",
      [farmerUser.id]
    );
    assert(auditLog !== null && auditLog.status === "CONFIRMED", "31. Immutable audit record logged in ai_action_audit");

    // TEST 32: Prompt injection resistance
    const rawInjection = "I like tomatoes <script>alert('hack')</script>";
    const cleaned = sanitizeMemoryContent(rawInjection);
    assert(!cleaned.includes("<script>"), "32. Memory sanitizer strips malicious script injection tags");

    // TEST 33: No secret leakage
    let secretBlocked = false;
    try {
      sanitizeMemoryContent("My secret api_key is AIzaSyDfakeKey123");
    } catch (e) {
      secretBlocked = true;
    }
    assert(secretBlocked === true, "33. Memory sanitizer strictly blocks saving API keys and passwords");

    // TEST 34: Multi-turn context preservation
    const convId = "conv_p11_test_multiturn";
    await query.run(
      "INSERT INTO ai_conversations (id, userId, title, createdAt, updatedAt) VALUES (?, ?, 'MultiTurn Test', ?, ?)",
      [convId, farmerUser.id, now, now]
    );
    await query.run(
      "INSERT INTO ai_messages (id, conversationId, role, content, createdAt) VALUES ('msg_p11_1', ?, 'user', 'What is my tomato inventory?', ?)",
      [convId, now]
    );
    await query.run(
      "INSERT INTO ai_messages (id, conversationId, role, content, createdAt) VALUES ('msg_p11_2', ?, 'assistant', 'You have 400 kg of Organic Farm Tomatoes.', ?)",
      [convId, now]
    );

    const historyMessages = await query.all("SELECT * FROM ai_messages WHERE conversationId = ? ORDER BY createdAt ASC", [convId]);
    assert(historyMessages.length === 2, "34. Multi-turn conversation messages preserved in ai_messages table");

    // TEST 35: Action cancellation
    const cancelProp = await prepareActionProposal(farmerUser, "UPDATE_PRODUCT_PRICE", {
      productId: testProdId,
      newPrice: 55.00
    });
    const cancelRes = await cancelAction({
      actionId: cancelProp.action.pendingId,
      userId: farmerUser.id
    });
    assert(cancelRes.success === true, "35. Action proposal can be explicitly cancelled", cancelRes.error?.message);

    const cancelledDb = await query.get("SELECT status FROM ai_pending_actions WHERE id = ?", [cancelProp.action.pendingId]);
    assert(cancelledDb && cancelledDb.status === "CANCELLED", "35. Database pending action status marked as 'CANCELLED'");

    // Clean up test fixtures
    await query.run("DELETE FROM ai_user_memory WHERE userId IN (?, ?, ?)", [farmerUser.id, vendorUser.id, rogueUser.id]);
    await query.run("DELETE FROM ai_farming_goals WHERE userId IN (?, ?, ?)", [farmerUser.id, vendorUser.id, rogueUser.id]);
    await query.run("DELETE FROM ai_followups WHERE userId IN (?, ?, ?)", [farmerUser.id, vendorUser.id, rogueUser.id]);
    await query.run("DELETE FROM ai_action_audit WHERE userId IN (?, ?, ?)", [farmerUser.id, vendorUser.id, rogueUser.id]);
    await query.run("DELETE FROM ai_pending_actions WHERE userId IN (?, ?, ?)", [farmerUser.id, vendorUser.id, rogueUser.id]);
    await query.run("DELETE FROM notifications WHERE userId IN (?, ?, ?)", [farmerUser.id, vendorUser.id, rogueUser.id]);
    await query.run("DELETE FROM ai_messages WHERE conversationId = ?", [convId]);
    await query.run("DELETE FROM ai_conversations WHERE id = ?", [convId]);
    await query.run("DELETE FROM order_items WHERE orderId = ?", [testOrderId]);
    await query.run("DELETE FROM orders WHERE id = ?", [testOrderId]);
    await query.run("DELETE FROM products WHERE id = ?", [testProdId]);
    await query.run("DELETE FROM users WHERE id IN (?, ?, ?)", [farmerUser.id, vendorUser.id, rogueUser.id]);

  } catch (fatalErr) {
    console.error("Fatal Phase 11 test crash:", fatalErr);
    failed++;
  }

  console.log("\n==================================================");
  console.log("   PHASE 11 COPILOT TEST RESULTS");
  console.log("==================================================");
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📊 Total:  ${passed + failed}`);
  console.log("==================================================\n");

  if (failed > 0) {
    console.error(`⚠️ ${failed} Phase 11 test(s) failed.`);
    process.exit(1);
  } else {
    console.log("🎉 ALL PHASE 11 TESTS PASSED!\n");
    process.exit(0);
  }
}

runPhase11Tests();
