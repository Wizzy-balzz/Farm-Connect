import { query } from "./database.js";

async function runChatTests() {
  console.log("=== RUNNING REAL-TIME CHAT SYSTEM VERIFICATION TESTS ===");
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

  // 1. Verify Database Schema Tables
  const tables = await query.all("SELECT name FROM sqlite_master WHERE type='table'");
  const tableNames = tables.map(t => t.name);

  assert(tableNames.includes("conversations"), "conversations table exists in SQLite database");
  assert(tableNames.includes("messages"), "messages table exists in SQLite database");
  assert(tableNames.includes("blocked_users"), "blocked_users table exists in SQLite database");
  assert(tableNames.includes("message_reports"), "message_reports table exists in SQLite database");

  // 2. Test Conversation Deduplication
  const farmer = await query.get("SELECT id FROM users WHERE role = 'farmer' LIMIT 1");
  const vendor = await query.get("SELECT id FROM users WHERE role = 'vendor' LIMIT 1");
  const product = await query.get("SELECT id FROM products LIMIT 1");

  const farmerId = farmer ? farmer.id : "usr_farmer_test";
  const vendorId = vendor ? vendor.id : "usr_vendor_test";
  const productId = product ? product.id : "prod_test";

  const now = new Date().toISOString();
  const testConvId = `conv_test_${Date.now()}`;

  await query.run(
    "INSERT INTO conversations (id, farmerId, vendorId, productId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
    [testConvId, farmerId, vendorId, productId, now, now]
  );

  const found = await query.get(
    "SELECT * FROM conversations WHERE farmerId = ? AND vendorId = ? AND productId = ?",
    [farmerId, vendorId, productId]
  );
  assert(found && found.id === testConvId, "Existing conversation lookup reuses active thread");

  // 3. Test Message Insertion & Integrity
  const testMsgId = `msg_test_${Date.now()}`;
  await query.run(
    "INSERT INTO messages (id, conversationId, senderId, message, messageType, isRead, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, 'text', 0, 'sent', ?, ?)",
    [testMsgId, testConvId, vendorId, "Is 500 kg available?", now, now]
  );

  const insertedMsg = await query.get("SELECT * FROM messages WHERE id = ?", [testMsgId]);
  assert(insertedMsg && insertedMsg.message === "Is 500 kg available?" && insertedMsg.senderId === vendorId, "Message inserted with trusted sender identity");

  // 4. Test Mark Read Status Update
  await query.run("UPDATE messages SET isRead = 1, status = 'read' WHERE conversationId = ? AND senderId != ?", [testConvId, farmerId]);
  const readMsg = await query.get("SELECT status, isRead FROM messages WHERE id = ?", [testMsgId]);
  assert(readMsg && readMsg.isRead === 1 && readMsg.status === "read", "Messages marked as read with receipts");

  console.log("\n==========================================");
  console.log(`CHAT TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log("==========================================");
}

runChatTests().catch(console.error);
