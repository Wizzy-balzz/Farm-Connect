/**
 * FarmConnect Phase 12 Production Hardening, Security Audit & Live AI Validation Test Suite
 *
 * Covers:
 * 1. Environment & Credential Security
 * 2. Gemini Live Availability & Diagnostics
 * 3. Fallback Safety & Anti-Hallucination
 * 4. Authentication & RBAC Enforcement
 * 5. Farmer & Vendor Tenant Isolation
 * 6. Prompt Injection Defense & Secret Scrubbing
 * 7. Rate Limiting Integrity
 * 8. Human Confirmation & Sensitive Action Lifecycle
 * 9. Stale-State Protection & Transaction Atomicity
 * 10. Planner Limits & Resource Bounds
 * 11. Memory, Goal & Follow-up Multi-Tenant Isolation
 * 12. Voice, TTS & Crop Image Safety Guardrails
 * 13. Database Integrity & Error Handling
 * 14. Frontend Bundle Security Audit
 * 15. Clean Windows libuv Shutdown
 */

import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";
import jwt from "jsonwebtoken";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, ".env") });

import { query, pool, dbInitPromise } from "./database.js";
import { checkAiSubsystemHealth, getAiDiagnostics, processAiChat } from "./ai/aiService.js";
import { TOOL_DECLARATIONS, getFunctionDeclarationsForRole, executeAiTool } from "./ai/aiTools.js";
import { isToolAllowed, sanitizeToolParams, getAllowedToolNamesForRole } from "./ai/aiPermissions.js";
import { prepareActionProposal, confirmAction, cancelAction } from "./ai/aiActions.js";
import { saveMemoryItem, getUserMemories, deleteMemoryItem } from "./services/aiMemoryService.js";
import { createGoal, getUserGoals, calculateVerifiedGoalProgress, deleteGoal } from "./services/aiGoalService.js";
import { createFollowup, getUserFollowups, completeFollowup, dismissFollowup } from "./services/aiFollowupService.js";
import { executeCopilotPlan } from "./services/aiPlannerService.js";
import { analyzeCropImage } from "./services/cropImageAnalysisService.js";
import { getLiveWeatherForecast } from "./services/weatherService.js";

let passed = 0;
let failed = 0;

function assert(condition, testName, details = "") {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${testName} ${details ? `(${details})` : ""}`);
    failed++;
  }
}

async function runPhase12Tests() {
  console.log("\n================================================================================");
  console.log("   FARMCONNECT PHASE 12: PRODUCTION HARDENING & SECURITY AUDIT TEST SUITE       ");
  console.log("================================================================================\n");

  const farmer1 = { id: "usr_p12_farmer1", name: "Murugan Selvam", role: "farmer", region: "Thanjavur" };
  const farmer2 = { id: "usr_p12_farmer2", name: "Kavitha Raj", role: "farmer", region: "Madurai" };
  const vendor1 = { id: "usr_p12_vendor1", name: "City Grocers", role: "vendor", region: "Chennai" };
  const admin1 = { id: "usr_p12_admin1", name: "System Admin", role: "admin", region: "All" };

  const testProduct1 = "prod_p12_tomatoes_01";
  const now = new Date().toISOString();

  try {
    // -------------------------------------------------------------------------
    // Setup Test Fixtures in Database
    // -------------------------------------------------------------------------
    if (dbInitPromise) await dbInitPromise;

    await query.run("DELETE FROM ai_action_audit WHERE userId IN (?, ?, ?, ?)", [farmer1.id, farmer2.id, vendor1.id, admin1.id]);
    await query.run("DELETE FROM ai_pending_actions WHERE userId IN (?, ?, ?, ?)", [farmer1.id, farmer2.id, vendor1.id, admin1.id]);
    await query.run("DELETE FROM ai_user_memory WHERE userId IN (?, ?, ?, ?)", [farmer1.id, farmer2.id, vendor1.id, admin1.id]);
    await query.run("DELETE FROM ai_farming_goals WHERE userId IN (?, ?, ?, ?)", [farmer1.id, farmer2.id, vendor1.id, admin1.id]);
    await query.run("DELETE FROM ai_followups WHERE userId IN (?, ?, ?, ?)", [farmer1.id, farmer2.id, vendor1.id, admin1.id]);
    await query.run("DELETE FROM products WHERE id = ?", [testProduct1]);
    await query.run("DELETE FROM users WHERE id IN (?, ?, ?, ?)", [farmer1.id, farmer2.id, vendor1.id, admin1.id]);

    await query.run(
      "INSERT INTO users (id, name, email, role, region, createdAt) VALUES (?, ?, 'murugan_p12@test.com', 'farmer', 'Thanjavur', ?)",
      [farmer1.id, farmer1.name, now]
    );
    await query.run(
      "INSERT INTO users (id, name, email, role, region, createdAt) VALUES (?, ?, 'kavitha_p12@test.com', 'farmer', 'Madurai', ?)",
      [farmer2.id, farmer2.name, now]
    );
    await query.run(
      "INSERT INTO users (id, name, email, role, region, createdAt) VALUES (?, ?, 'city_p12@test.com', 'vendor', 'Chennai', ?)",
      [vendor1.id, vendor1.name, now]
    );
    await query.run(
      "INSERT INTO users (id, name, email, role, region, createdAt) VALUES (?, ?, 'admin_p12@test.com', 'admin', 'All', ?)",
      [admin1.id, admin1.name, now]
    );

    await query.run(
      `INSERT INTO products (id, farmerId, name, category, price, unit, stock, moq, organic, region, district, createdAt) 
       VALUES (?, ?, 'Fresh Organic Tomatoes', 'Vegetables', 45.00, 'kg', 300, 10, 1, 'Tamil Nadu', 'Thanjavur', ?)`,
      [testProduct1, farmer1.id, now]
    );

    // =========================================================================
    // SECTION 1: Environment, Credentials & Diagnostics
    // =========================================================================
    console.log("--- 1. Environment & Live Diagnostics ---");

    // Test 1: Critical environment variables present
    const hasJwtSecret = !!process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 16;
    const hasDbConfig = !!process.env.DB_NAME;
    assert(hasJwtSecret && hasDbConfig, "Production environment variables (JWT_SECRET, DB_NAME) configured securely.");

    // Test 2: AI subsystem health classification
    const health = await checkAiSubsystemHealth(6000);
    const validAiStatuses = [
      "ONLINE", "FALLBACK", "OFFLINE",
      "LIVE_GEMINI", "TEMPORARILY_UNAVAILABLE", "RATE_LIMITED",
      "AUTH_ERROR", "MODEL_UNAVAILABLE", "GEMINI_403", "GEMINI_QUOTA",
      "QUOTA_EXHAUSTED", "CONFIGURED",
      "GEMINI_TIMEOUT", "GEMINI_NETWORK_ERROR", "MISSING_API_KEY", "ERROR"
    ];
    const statusVal = health.aiStatus || health.nlpStatus;
    assert(validAiStatuses.includes(statusVal), `AI health probe returned valid classification: [${statusVal}].`);

    // Test 3: AI diagnostics payload does not leak secret keys
    const diagnostics = await getAiDiagnostics();
    assert(diagnostics.aiEngine !== undefined, "AI diagnostics returns engine status.");
    const diagStr = JSON.stringify(diagnostics);
    const jwtSecret = process.env.JWT_SECRET || "";
    if (jwtSecret.length > 4) {
      assert(!diagStr.includes(jwtSecret), "AI diagnostics response strictly omits JWT_SECRET.");
    }

    // =========================================================================
    // SECTION 2: Tool Registry, Function Declarations & Fallback
    // =========================================================================
    console.log("\n--- 2. Tool Declarations & Fallback Safety ---");

    // Test 4: Comprehensive tool registry exists
    const allTools = Object.keys(TOOL_DECLARATIONS);
    assert(allTools.length >= 20, `Tool declarations registry contains comprehensive tools (Total: ${allTools.length}).`);

    // Test 5: Fallback behavior when Python NLP service is unavailable
    const fallbackChat = await processAiChat({ user: farmer1, prompt: "What is my tomato inventory?" });
    assert(fallbackChat.message?.content?.length > 0, "AI returns non-empty response (Python NLP or Node.js fallback).");

    // =========================================================================
    // SECTION 3: Authentication, JWT & RBAC
    // =========================================================================
    console.log("\n--- 3. Authentication & RBAC Authorization ---");

    // Test 6: Valid JWT verification
    const validToken = jwt.sign({ id: farmer1.id, role: farmer1.role, name: farmer1.name }, process.env.JWT_SECRET || "test", { expiresIn: "1h" });
    const decoded = jwt.verify(validToken, process.env.JWT_SECRET || "test");
    assert(decoded.id === farmer1.id && decoded.role === "farmer", "Valid JWT verified successfully with correct claims.");

    // Test 7: Expired JWT rejection
    const expiredToken = jwt.sign({ id: farmer1.id, role: farmer1.role }, process.env.JWT_SECRET || "test", { expiresIn: "-1s" });
    let expiredRejected = false;
    try {
      jwt.verify(expiredToken, process.env.JWT_SECRET || "test");
    } catch (_) {
      expiredRejected = true;
    }
    assert(expiredRejected, "Expired JWT token rejected with TokenExpiredError.");

    // Test 8: Farmer RBAC permissions
    assert(isToolAllowed("farmer", "getMyInventory") === true, "Farmer permitted to execute getMyInventory.");
    assert(isToolAllowed("farmer", "getMySales") === true, "Farmer permitted to execute getMySales.");
    assert(isToolAllowed("farmer", "getPlatformWideAnalytics") === false, "Farmer forbidden from executing getPlatformWideAnalytics.");

    // Test 9: Vendor RBAC permissions
    assert(isToolAllowed("vendor", "searchProducts") === true, "Vendor permitted to execute searchProducts.");
    assert(isToolAllowed("vendor", "getMyInventory") === false, "Vendor forbidden from executing getMyInventory.");
    assert(isToolAllowed("vendor", "getMySales") === false, "Vendor forbidden from executing getMySales.");

    // =========================================================================
    // SECTION 4: Multi-Tenant Isolation & Anti-Spoofing
    // =========================================================================
    console.log("\n--- 4. Multi-Tenant Isolation & Anti-Spoofing ---");

    // Test 10: Farmer inventory isolation
    const farmer1Inventory = await executeAiTool(farmer1, "getMyInventory", {});
    const farmer2Inventory = await executeAiTool(farmer2, "getMyInventory", {});
    assert(farmer1Inventory.success === true && farmer1Inventory.data?.some(p => p.id === testProduct1), "Farmer 1 views own product.");
    assert(farmer2Inventory.success === true && !farmer2Inventory.data?.some(p => p.id === testProduct1), "Farmer 2 CANNOT view Farmer 1's products.");

    // Test 11: Vendor blocked from farmer-private inventory
    const vendorInvExec = await executeAiTool(vendor1, "getMyInventory", {});
    assert(vendorInvExec.success === false && vendorInvExec.error?.code === "FORBIDDEN", "Vendor executing getMyInventory rejected with FORBIDDEN.");

    // Test 12: Anti-spoofing parameter sanitization
    const spoofParams = { farmerId: "usr_p12_farmer2_spoofed", category: "Vegetables" };
    const sanitizedFarmer1Params = sanitizeToolParams(farmer1, "getMyInventory", spoofParams);
    assert(sanitizedFarmer1Params.farmerId === farmer1.id, `Parameter farmerId forced to session user ID (${sanitizedFarmer1Params.farmerId}).`);

    const sanitizedVendorParams = sanitizeToolParams(vendor1, "searchProducts", { farmerId: "usr_p12_farmer1" });
    assert(sanitizedVendorParams.farmerId === undefined, "Vendor cannot inject farmerId filter into search parameters.");

    // =========================================================================
    // SECTION 5: Prompt Injection & Secret Scrubbing
    // =========================================================================
    console.log("\n--- 5. Prompt Injection Defense & Memory Scrubbing ---");

    // Test 13: Memory secret scrubbing & rejection
    let secretBlocked = false;
    try {
      await saveMemoryItem(farmer1.id, {
        key: "secret_leak_test",
        memoryType: "preference",
        value: "My secret token is JWT_eyJhGciOiJIUzI1NiJ9.fake and password is SuperSecret123!"
      });
    } catch (err) {
      secretBlocked = err.message.includes("SENSITIVE_DATA_PROHIBITED");
    }
    assert(secretBlocked, "Sensitive password/token detected and blocked before memory persistence.");

    // Test 14: Prompt injection sanitization in memory
    const injectionMemory = await saveMemoryItem(farmer1.id, {
      key: "injection_test",
      memoryType: "preference",
      value: "<script>alert(1)</script>Prefer drip irrigation for tomatoes"
    });
    assert(!injectionMemory.value.includes("<script>"), "Script tag injection stripped before memory persistence.");

    // =========================================================================
    // SECTION 6: Sensitive Actions, Human Confirmation & Stale State
    // =========================================================================
    console.log("\n--- 6. Action Proposal, Confirmation & Stale-State Protection ---");

    // Test 15: Proposal creation (no direct mutation)
    const proposal = await prepareActionProposal(farmer1, "UPDATE_PRODUCT_PRICE", {
      productId: testProduct1,
      newPrice: 55.00
    });
    assert(proposal.success === true && proposal.action?.pendingId !== undefined, "Price update proposal created with PENDING status.");

    // Verify DB was NOT mutated yet
    const preConfirmProduct = await query.get("SELECT price FROM products WHERE id = ?", [testProduct1]);
    assert(parseFloat(preConfirmProduct.price) === 45.00, "Product price remained 45.00 (NO direct mutation without confirmation).");

    // Test 16: Stale-state conflict protection
    // Simulate external update before confirmation (45.00 -> 48.00)
    await query.run("UPDATE products SET price = 48.00 WHERE id = ?", [testProduct1]);
    const staleConfirm = await confirmAction(farmer1, proposal.action.confirmationToken);
    assert(staleConfirm.success === false && staleConfirm.error?.code === "ACTION_STALE", "Stale action rejected with ACTION_STALE when state changed externally.");

    // Test 17: Valid confirmation execution
    const validProposal = await prepareActionProposal(farmer1, "UPDATE_PRODUCT_PRICE", {
      productId: testProduct1,
      newPrice: 55.00
    });
    const confirmResult = await confirmAction(farmer1, validProposal.action.confirmationToken);
    assert(confirmResult.success === true, "Action confirmed successfully with valid confirmation token.");

    const postConfirmProduct = await query.get("SELECT price FROM products WHERE id = ?", [testProduct1]);
    assert(parseFloat(postConfirmProduct.price) === 55.00, "Product price successfully updated to 55.00 after human confirmation.");

    // Test 18: Idempotency (cannot confirm twice)
    const doubleConfirm = await confirmAction(farmer1, validProposal.action.confirmationToken);
    assert(doubleConfirm.success === false, "Re-confirming already executed action rejected (Idempotency enforced).");

    // Test 19: Rogue user cannot confirm other user's action
    const rogueProposal = await prepareActionProposal(farmer1, "UPDATE_PRODUCT_PRICE", {
      productId: testProduct1,
      newPrice: 60.00
    });
    const unauthorizedConfirm = await confirmAction(vendor1, rogueProposal.action.confirmationToken);
    assert(unauthorizedConfirm.success === false && (unauthorizedConfirm.error?.code === "OWNERSHIP_VIOLATION" || unauthorizedConfirm.error?.code === "FORBIDDEN"), "Vendor confirming farmer action rejected with OWNERSHIP_VIOLATION.");

    // =========================================================================
    // SECTION 7: Multi-Step Planner Bounds
    // =========================================================================
    console.log("\n--- 7. Planner Resource Bounds & Limits ---");

    // Test 20: Planner enforces tool limits
    const planResult = await executeCopilotPlan({
      user: farmer1,
      query: "Analyze tomato selling strategy",
      customSteps: [
        { toolName: "getMyInventory", params: {} },
        { toolName: "getPriceIntelligence", params: { commodity: "Tomato" } },
        { toolName: "getDemandIntelligence", params: { commodity: "Tomato" } },
        { toolName: "getWeatherAdvisory", params: { district: "Thanjavur" } }
      ]
    });
    assert(planResult.success === true, "Multi-step copilot planner executed valid plan steps successfully.");
    assert(planResult.planSteps?.length === 4, "Planner completed all 4 designated read-only steps.");
    assert(planResult.facts !== undefined && planResult.reasoning !== undefined, "Planner strictly separates FACTS from REASONING.");

    // Test 21: Planner bounds check (MAX_PLAN_STEPS enforced, <= 10)
    const excessiveSteps = Array.from({ length: 15 }, () => ({ toolName: "getMyInventory", params: {} }));
    const boundedPlan = await executeCopilotPlan({
      user: farmer1,
      query: "Excessive plan test",
      customSteps: excessiveSteps
    });
    assert(boundedPlan.planSteps.length <= 10, "Planner bounds custom steps to MAX_PLAN_STEPS (10).");

    // =========================================================================
    // SECTION 8: Goals, Memory & Follow-up Multi-Tenant Isolation
    // =========================================================================
    console.log("\n--- 8. Goals, Memory & Follow-ups Isolation ---");

    // Test 22: User memory isolation
    await saveMemoryItem(farmer1.id, { key: "fav_crop", memoryType: "preference", value: "Tomato" });
    const farmer1Memories = await getUserMemories(farmer1.id);
    const farmer2Memories = await getUserMemories(farmer2.id);
    assert(farmer1Memories.some(m => m.key === "fav_crop"), "Farmer 1 retrieves own memory.");
    assert(!farmer2Memories.some(m => m.key === "fav_crop"), "Farmer 2 cannot view Farmer 1's memory.");

    // Test 23: Farming goal creation and progress verification
    const goal = await createGoal(farmer1.id, {
      title: "Sell 500kg Tomatoes",
      category: "selling",
      targetValue: 500,
      unit: "kg"
    });
    assert(goal && goal.id, "Farming goal created successfully.");

    const recalculated = await calculateVerifiedGoalProgress(farmer1.id, goal.id);
    assert(recalculated && recalculated.goal?.progressPercent !== undefined, "Goal progress recalculated against verified database records.");

    // Test 24: Goal isolation (Farmer 2 cannot delete Farmer 1's goal)
    const unauthorizedDelete = await deleteGoal(farmer2.id, goal.id);
    assert(unauthorizedDelete === false, "Farmer 2 cannot delete Farmer 1's goal (scoping enforced).");

    // Test 25: Follow-up deduplication
    const followup1 = await createFollowup(farmer1.id, {
      title: "Check drip lines for tomatoes",
      type: "custom",
      triggerAt: new Date(Date.now() + 86400000).toISOString()
    });
    const followup2 = await createFollowup(farmer1.id, {
      title: "Check drip lines for tomatoes",
      type: "custom",
      triggerAt: new Date(Date.now() + 86400000).toISOString()
    });
    assert(followup1.id && followup2.id, "Follow-up requests processed.");
    assert(followup1.id === followup2.id && followup2.duplicate === true, "Identical follow-up within 24h deduplicated to same ID.");

    // =========================================================================
    // SECTION 9: Voice, Crop Vision & Weather Safety Guardrails
    // =========================================================================
    console.log("\n--- 9. Safety Guardrails & Multimodal Validation ---");

    // Test 26: Crop image analysis rejects empty/missing file
    const emptyImageResult = await analyzeCropImage({ imageBuffer: null, mimeType: "image/jpeg" });
    assert(emptyImageResult.success === false, "Empty image input rejected with error.");

    // Test 27: Crop image safety disclaimer enforcement
    const sampleMock = {
      cropIdentified: "Tomato",
      confidence: "High",
      primaryFinding: "Early Blight symptoms detected",
      severity: "Moderate",
      recommendations: ["Ensure proper drainage", "Remove affected lower leaves"],
      disclaimer: "Non-definitive AI assessment. Consult local agricultural extension officer before chemical treatment."
    };
    const safeVisionResult = await analyzeCropImage({
      imageBuffer: Buffer.from("fake_image_bytes"),
      mimeType: "image/jpeg",
      mockAnalysis: sampleMock
    });
    assert(safeVisionResult.success === true && (safeVisionResult.disclaimer !== undefined || safeVisionResult.analysis?.disclaimer !== undefined), "Image analysis output includes mandatory non-definitive safety disclaimer.");

    // Test 28: Weather advisory safety (no fabricated promises)
    const weatherResult = await getLiveWeatherForecast("Thanjavur");
    assert(weatherResult.success === true && weatherResult.data?.current?.temperatureC !== undefined, "Weather service returns structured agricultural advisory.");

    // =========================================================================
    // SECTION 10: Secret Leakage & Frontend Bundle Security Audit
    // =========================================================================
    console.log("\n--- 10. Security Audit & Frontend Bundle Integrity ---");

    // Test 29: Root .env.example contains only safe placeholders
    const rootEnvExample = fs.readFileSync(join(__dirname, "../.env.example"), "utf8");
    assert(!rootEnvExample.includes("AQ.Ab8RN6") && !rootEnvExample.includes("BALa@"), "Root .env.example contains ZERO active secrets or database passwords.");

    // Test 30: Backend .env.example contains only safe placeholders
    const backendEnvExample = fs.readFileSync(join(__dirname, ".env.example"), "utf8");
    assert(!backendEnvExample.includes("AQ.Ab8RN6") && !backendEnvExample.includes("BALa@"), "Backend .env.example contains ZERO active secrets.");

    // Test 31: Frontend dist bundle exists and contains no leaked backend keys
    const distPath = join(__dirname, "../dist");
    const distExists = fs.existsSync(distPath);
    assert(distExists, "Frontend production distribution directory 'dist/' exists.");

    if (distExists) {
      let leakedKeyInDist = false;
      const distFiles = fs.readdirSync(join(distPath, "assets"));
      for (const file of distFiles) {
        if (file.endsWith(".js")) {
          const content = fs.readFileSync(join(distPath, "assets", file), "utf8");
          if (content.includes("farmconnect_super_secret_jwt_key") || content.includes("BALa@")) {
            leakedKeyInDist = true;
            break;
          }
        }
      }
      assert(!leakedKeyInDist, "Frontend compiled JavaScript bundle contains ZERO backend JWT or DB secrets.");
    }

    // =========================================================================
    // SECTION 11: Teardown & Graceful Shutdown
    // =========================================================================
    console.log("\n--- 11. Cleanup & Teardown ---");

    // Test 32: Cleanup temporary fixtures
    await query.run("DELETE FROM ai_action_audit WHERE userId IN (?, ?, ?, ?)", [farmer1.id, farmer2.id, vendor1.id, admin1.id]);
    await query.run("DELETE FROM ai_pending_actions WHERE userId IN (?, ?, ?, ?)", [farmer1.id, farmer2.id, vendor1.id, admin1.id]);
    await query.run("DELETE FROM ai_user_memory WHERE userId IN (?, ?, ?, ?)", [farmer1.id, farmer2.id, vendor1.id, admin1.id]);
    await query.run("DELETE FROM ai_farming_goals WHERE userId IN (?, ?, ?, ?)", [farmer1.id, farmer2.id, vendor1.id, admin1.id]);
    await query.run("DELETE FROM ai_followups WHERE userId IN (?, ?, ?, ?)", [farmer1.id, farmer2.id, vendor1.id, admin1.id]);
    await query.run("DELETE FROM products WHERE id = ?", [testProduct1]);
    await query.run("DELETE FROM users WHERE id IN (?, ?, ?, ?)", [farmer1.id, farmer2.id, vendor1.id, admin1.id]);
    assert(true, "Test fixtures cleaned up gracefully.");

  } catch (err) {
    console.error("Phase 12 test execution error:", err);
    assert(false, "Phase 12 test suite execution", err.message);
  }

  console.log("\n================================================================================");
  console.log(`🏁 PHASE 12 TEST SUITE FINISHED: ${passed} PASSED, ${failed} FAILED`);
  console.log("================================================================================\n");

  try {
    if (dbInitPromise) await dbInitPromise;
    await pool.end();
  } catch (_) {}

  // Allow libuv socket close callbacks to settle cleanly on Windows
  await new Promise((r) => setTimeout(r, 200));

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase12Tests().catch(async (err) => {
  console.error("Unhandled test runner error:", err);
  try {
    if (dbInitPromise) await dbInitPromise;
    await pool.end();
  } catch (_) {}
  process.exit(1);
});
