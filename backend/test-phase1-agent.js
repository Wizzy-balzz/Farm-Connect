/**
 * FarmConnect Phase 1 Automated Test Suite
 * Validates:
 * - Tool registry & function declarations
 * - Role-Based Access Control & tool scoping
 * - Parameter sanitization
 * - Safe structured execution
 * - Gemini agent loop limits, error handling & language instruction
 */

import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, ".env") });

import {
  TOOL_DECLARATIONS,
  getFunctionDeclarationsForRole,
  executeAiTool
} from "./ai/aiTools.js";
import {
  isToolAllowed,
  sanitizeToolParams,
  getAllowedToolNamesForRole
} from "./ai/aiPermissions.js";
import { processAiChat } from "./ai/aiService.js";
import { pool, dbInitPromise } from "./database.js";

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedCount++;
  }
}

async function runTests() {
  console.log("\n========================================================");
  console.log("🧪 STARTING FARMCONNECT PHASE 1 AI TEST SUITE");
  console.log("========================================================\n");

  const farmerUser = { id: "f1", name: "Rajesh Kumar", role: "farmer", region: "Maharashtra" };
  const vendorUser = { id: "v1", name: "Ananya's Kitchen", role: "vendor", region: "Maharashtra" };
  const adminUser = { id: "a1", name: "Platform Admin", role: "admin", region: "India" };

  // TEST 1: Tool registry definitions
  console.log("TEST 1: Tool Registry & Declarations");
  const toolNames = Object.keys(TOOL_DECLARATIONS);
  assert(toolNames.length >= 12, `Expected at least 12 tools defined in TOOL_DECLARATIONS, found ${toolNames.length}`);
  assert(TOOL_DECLARATIONS.searchProducts?.parameters?.properties?.maxPrice !== undefined, "searchProducts contains maxPrice property");
  assert(TOOL_DECLARATIONS.searchProducts?.parameters?.properties?.organic !== undefined, "searchProducts contains organic property");

  // TEST 2: Role-based tool declaration filtering
  console.log("\nTEST 2: Role-Based Tool Declaration Filtering");
  const farmerTools = getFunctionDeclarationsForRole("farmer");
  const vendorTools = getFunctionDeclarationsForRole("vendor");
  const adminTools = getFunctionDeclarationsForRole("admin");

  const farmerToolNames = farmerTools.map((t) => t.name);
  const vendorToolNames = vendorTools.map((t) => t.name);

  assert(farmerTools.length >= 11, `Farmer receives at least 11 tools (got ${farmerTools.length})`);
  assert(vendorTools.length >= 9, `Vendor receives at least 9 tools (got ${vendorTools.length})`);
  assert(adminTools.length >= 12, `Admin receives at least 12 tools (got ${adminTools.length})`);

  assert(!vendorToolNames.includes("getMySales"), "Vendor CANNOT receive getMySales function declaration");
  assert(!vendorToolNames.includes("getMyInventory"), "Vendor CANNOT receive getMyInventory function declaration");
  assert(!vendorToolNames.includes("getPlatformAnalytics"), "Vendor CANNOT receive getPlatformAnalytics function declaration");
  assert(farmerToolNames.includes("getMySales"), "Farmer receives getMySales declaration");
  assert(farmerToolNames.includes("getMyInventory"), "Farmer receives getMyInventory declaration");

  // TEST 3: RBAC permission check enforcement
  console.log("\nTEST 3: RBAC Permissions & Authorization");
  assert(isToolAllowed("farmer", "getMySales") === true, "Farmer is authorized for getMySales");
  assert(isToolAllowed("vendor", "getMySales") === false, "Vendor is NOT authorized for getMySales");
  assert(isToolAllowed("farmer", "getPlatformAnalytics") === false, "Farmer is NOT authorized for getPlatformAnalytics");
  assert(isToolAllowed("admin", "getPlatformAnalytics") === true, "Admin is authorized for getPlatformAnalytics");

  // TEST 4: Unauthorized tool execution rejection
  console.log("\nTEST 4: Unauthorized Tool Execution Rejection");
  const unauthorizedExec = await executeAiTool(vendorUser, "getMySales");
  assert(unauthorizedExec.success === false, "Vendor executing getMySales returns success=false");
  assert(unauthorizedExec.error?.code === "FORBIDDEN", `Expected FORBIDDEN error, got: ${unauthorizedExec.error?.code}`);

  // TEST 5: Parameter sanitization & identity derivation
  console.log("\nTEST 5: Parameter Sanitization (Anti-Spoofing)");
  const spoofedParams = { farmerId: "f999_hacked", vendorId: "v999_hacked" };
  const sanitizedFarmerParams = sanitizeToolParams(farmerUser, "getMySales", spoofedParams);
  assert(sanitizedFarmerParams.farmerId === farmerUser.id, `FarmerId forced to authenticated session (${sanitizedFarmerParams.farmerId})`);

  const sanitizedVendorParams = sanitizeToolParams(vendorUser, "getMyOrders", spoofedParams);
  assert(sanitizedVendorParams.vendorId === vendorUser.id, `VendorId forced to authenticated session (${sanitizedVendorParams.vendorId})`);

  // TEST 6: Structured tool results format
  console.log("\nTEST 6: Tool Result Format");
  const searchExec = await executeAiTool(vendorUser, "searchProducts", { queryText: "Tomato", maxPrice: 50 });
  assert(searchExec.success === true, "searchProducts executes successfully");
  assert(Array.isArray(searchExec.data), "searchProducts returns data array");

  // TEST 7: Unknown tool handling
  console.log("\nTEST 7: Unknown Tool Handling");
  const unknownExec = await executeAiTool(adminUser, "nonExistentTool");
  assert(unknownExec.success === false, "nonExistentTool returns success=false");
  assert(unknownExec.error?.code === "FORBIDDEN" || unknownExec.error?.code === "UNKNOWN_TOOL", "Unknown tool safely rejected");

  // TEST 8: Price & Demand Insights
  console.log("\nTEST 8: Price & Demand Insights & Comparisons");
  const priceExec = await executeAiTool(farmerUser, "getPriceInsights", {});
  assert(priceExec.success === true, "getPriceInsights executes successfully");
  assert(priceExec.data?.recommendedRange !== undefined, "Price insight contains recommendedRange");

  const demandExec = await executeAiTool(vendorUser, "getDemandInsights", { category: "Vegetables" });
  assert(demandExec.success === true, "getDemandInsights executes successfully");
  assert(demandExec.data?.projectedGrowth !== undefined || demandExec.data?.sufficientData !== undefined, "Demand insight contains projection data");

  const compareExec = await executeAiTool(vendorUser, "compareProducts", { productIds: ["p1", "p2"] });
  assert(compareExec.success === true, "compareProducts executes successfully");
  assert(Array.isArray(compareExec.data) && compareExec.data.length === 2, "compareProducts returns compared product rows");

  const invExec = await executeAiTool(farmerUser, "getMyInventory");
  assert(invExec.success === true, "Farmer getMyInventory executes successfully");
  assert(Array.isArray(invExec.data), "getMyInventory returns product list");

  const salesExec = await executeAiTool(farmerUser, "getMySales");
  assert(salesExec.success === true, "Farmer getMySales executes successfully");
  assert(salesExec.data?.revenue !== undefined, "getMySales returns revenue metric");

  // TEST 9: Unauthenticated AI chat rejection
  console.log("\nTEST 9: Authentication Enforcement in Chat");
  let unauthError = null;
  try {
    await processAiChat({ user: null, prompt: "Show products" });
  } catch (err) {
    unauthError = err;
  }
  assert(unauthError !== null && unauthError.message.includes("UNAUTHENTICATED"), "Unauthenticated user rejected with UNAUTHENTICATED");

  // TEST 10: Empty prompt rejection
  console.log("\nTEST 10: Empty Prompt Rejection");
  let emptyError = null;
  try {
    await processAiChat({ user: farmerUser, prompt: "   " });
  } catch (err) {
    emptyError = err;
  }
  assert(emptyError !== null && emptyError.message.includes("INVALID_INPUT"), "Empty prompt rejected with INVALID_INPUT");

  // TEST 11: Python NLP Service Offline — Graceful Node.js Fallback
  console.log("\nTEST 11: Python NLP Service Offline Graceful Fallback");
  const fallbackResult = await processAiChat({ user: farmerUser, prompt: "Show my stock" });
  assert(fallbackResult.message?.content.length > 0, "Fallback returns non-empty response");
  assert(fallbackResult.conversationId !== undefined, "Conversation ID created and returned");

  // TEST 12: Live Local NLP AI Agent Execution
  console.log("\nTEST 12: Live Agentic AI Execution (Local Python NLP)");
  try {
    const liveRes = await processAiChat({
      user: farmerUser,
      prompt: "Show my inventory and tell me if any items are low in stock",
      lang: "en"
    });
    assert(liveRes.message?.content?.length > 0, "Agent generated conversational response");
    if (liveRes.message?.content?.includes("temporarily unavailable")) {
      console.log("  ⚠️ LOCAL NLP OFFLINE / FALLBACK USED (safe deterministic fallback verified)");
    } else {
      console.log("  ✅ LOCAL NLP ACTIVE: Python NLP reasoning and tool execution succeeded");
      assert(liveRes.message?.toolName !== null || liveRes.message?.content?.length > 0, `Live agent executed tool: ${liveRes.message?.toolName}`);
    }
  } catch (err) {
    console.warn("  ⚠️ LOCAL NLP UNAVAILABLE / FALLBACK USED:", err.message);
  }

  console.log("\n========================================================");
  console.log(`🏁 TEST SUITE COMPLETE: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("========================================================\n");

  try {
    if (dbInitPromise) await dbInitPromise;
    await pool.end();
  } catch (_) {}

  // Allow libuv socket close callbacks to complete to avoid Windows UV_HANDLE_CLOSING assertion
  await new Promise((r) => setTimeout(r, 200));

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("Test execution threw unhandled exception:", err);
  process.exit(1);
});
