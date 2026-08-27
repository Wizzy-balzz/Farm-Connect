import { query } from "./database.js";
import { isToolAllowed } from "./ai/aiPermissions.js";
import { parseNaturalMarketplaceQuery } from "./ai/aiService.js";
import { broadcastEventToUser } from "./services/realtimeService.js";

async function runPhase2Tests() {
  console.log("=== RUNNING PHASE 2 VERIFICATION TESTS ===");
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  // 1. Check DB Tables Exist
  const tables = await query.all("SELECT name FROM sqlite_master WHERE type='table'");
  const tableNames = tables.map(t => t.name);

  assert(tableNames.includes("ai_conversations"), "ai_conversations table exists in SQLite database");
  assert(tableNames.includes("ai_messages"), "ai_messages table exists in SQLite database");
  assert(tableNames.includes("ai_insights"), "ai_insights table exists in SQLite database");
  assert(tableNames.includes("real_time_events"), "real_time_events table exists in SQLite database");

  // 2. Test Role-Aware AI Tool Permissions
  assert(isToolAllowed("farmer", "getMySales") === true, "Farmer can access getMySales tool");
  assert(isToolAllowed("vendor", "getMySales") === false, "Vendor BLOCKED from accessing getMySales tool");
  assert(isToolAllowed("vendor", "getPlatformAnalytics") === false, "Vendor BLOCKED from accessing getPlatformAnalytics tool");
  assert(isToolAllowed("admin", "getPlatformAnalytics") === true, "Admin can access getPlatformAnalytics tool");

  // 3. Test Natural Language Query Parsing
  const parsedEng = parseNaturalMarketplaceQuery("Show organic tomatoes under 50 near me");
  assert(parsedEng.organic === true, "English natural search extracts organic=true");
  assert(parsedEng.maxPrice === 50, "English natural search extracts maxPrice=50");
  assert(parsedEng.category === "Vegetables", "English natural search extracts category=Vegetables");

  const parsedTa = parseNaturalMarketplaceQuery("எனக்கு அருகில் ஆர்கானிக் தக்காளி வேண்டும்");
  assert(parsedTa.organic === true, "Tamil natural search extracts organic=true");
  assert(parsedTa.category === "Vegetables", "Tamil natural search extracts category=Vegetables");

  const parsedHi = parseNaturalMarketplaceQuery("ऑर्गेनिक प्याज चाहिए");
  assert(parsedHi.organic === true, "Hindi natural search extracts organic=true");
  assert(parsedHi.category === "Vegetables", "Hindi natural search extracts category=Vegetables");

  // 4. Test Real-Time Event Storage
  const testUserId = "usr_test_rt";
  await broadcastEventToUser(testUserId, "new_order", { orderId: "FC-TEST-100", amount: 500 });
  const storedEvent = await query.get("SELECT * FROM real_time_events WHERE userId = ? ORDER BY createdAt DESC LIMIT 1", [testUserId]);
  assert(storedEvent && storedEvent.event === "new_order", "Real-time event recorded in database correctly");

  console.log("\n==========================================");
  console.log(`PHASE 2 TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log("==========================================");
}

runPhase2Tests().catch(console.error);
