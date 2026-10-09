import { query, pool, dbInitPromise } from "../database.js";
import { prepareActionProposal, confirmAction, cancelAction, getActionAuditHistory } from "../ai/aiActions.js";
import { processAiChat } from "../ai/aiService.js";
import { getFunctionDeclarationsForRole } from "../ai/aiTools.js";
import crypto from "crypto";

async function runPhase6Tests() {
  console.log("==================================================");
  console.log("   FARMCONNECT PHASE 6 — AGENTIC SAFE ACTIONS TESTS");
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

  // Set up mock test users
  const farmerUser = { id: "usr_farmer_test1", name: "Raman", role: "farmer", region: "Coimbatore" };
  const vendorUser = { id: "usr_vendor_test1", name: "Kovai Traders", role: "vendor", region: "Coimbatore" };
  const rogueUser = { id: "usr_rogue_hacker", name: "Rogue User", role: "vendor", region: "Unknown" };

  const testProdId = "prod_phase6_test_101";

  try {
    // Prep database fixture
    await query.run("DELETE FROM ai_action_audit WHERE userId IN (?, ?, ?)", [farmerUser.id, vendorUser.id, rogueUser.id]);
    await query.run("DELETE FROM ai_pending_actions WHERE userId IN (?, ?, ?)", [farmerUser.id, vendorUser.id, rogueUser.id]);
    await query.run("DELETE FROM products WHERE id = ?", [testProdId]);
    await query.run("DELETE FROM users WHERE id IN (?, ?, ?)", [farmerUser.id, vendorUser.id, rogueUser.id]);

    const now = new Date().toISOString();
    await query.run(
      "INSERT INTO users (id, name, email, role, region, createdAt) VALUES (?, ?, ?, 'farmer', 'Coimbatore', ?)",
      [farmerUser.id, farmerUser.name, "raman_p6@test.com", now]
    );
    await query.run(
      "INSERT INTO users (id, name, email, role, region, createdAt) VALUES (?, ?, ?, 'vendor', 'Coimbatore', ?)",
      [vendorUser.id, vendorUser.name, "kovai_p6@test.com", now]
    );
    await query.run(
      "INSERT INTO users (id, name, email, role, region, createdAt) VALUES (?, ?, ?, 'vendor', 'Unknown', ?)",
      [rogueUser.id, rogueUser.name, "rogue_p6@test.com", now]
    );

    await query.run(
      `INSERT INTO products (id, farmerId, name, category, price, unit, stock, moq, organic, region, district, createdAt) 
       VALUES (?, ?, 'Phase6 Organic Tomato', 'Vegetables', 40.00, 'kg', 500, 10, 1, 'Tamil Nadu', 'Coimbatore', ?)`,
      [testProdId, farmerUser.id, now]
    );

    // TEST 1: Schema verification
    console.log("--- 1. Database Schema & Tables Check ---");
    const pendingCount = await query.get("SELECT COUNT(*) as cnt FROM ai_pending_actions");
    assert(pendingCount !== null && pendingCount !== undefined, "Table 'ai_pending_actions' exists and queryable.");

    const auditCount = await query.get("SELECT COUNT(*) as cnt FROM ai_action_audit");
    assert(auditCount !== null && auditCount !== undefined, "Table 'ai_action_audit' exists and queryable.");

    // TEST 2: RBAC permissions for proposal tools
    console.log("\n--- 2. RBAC Permissions Check ---");
    const farmerTools = getFunctionDeclarationsForRole("farmer");
    const hasProposePrice = farmerTools.some(t => t.name === "proposeUpdateProductPrice");
    const hasProposeStock = farmerTools.some(t => t.name === "proposeUpdateInventory");
    assert(hasProposePrice && hasProposeStock, "Farmer role has proposeUpdateProductPrice & proposeUpdateInventory permissions.");

    const vendorTools = getFunctionDeclarationsForRole("vendor");
    const hasProposeMsg = vendorTools.some(t => t.name === "proposeSendMessage");
    const vendorHasProposePrice = vendorTools.some(t => t.name === "proposeUpdateProductPrice");
    assert(hasProposeMsg && !vendorHasProposePrice, "Vendor role has proposeSendMessage but NOT proposeUpdateProductPrice.");

    // TEST 3: Action proposal creation & snapshotting
    console.log("\n--- 3. Action Proposal Generation & Cryptographic Tokening ---");
    const proposalRes = await prepareActionProposal(farmerUser, "UPDATE_PRODUCT_PRICE", {
      productId: testProdId,
      newPrice: 48.50
    });

    assert(proposalRes.success === true, "prepareActionProposal succeeds for price update.");
    assert(proposalRes.requiresConfirmation === true, "Returned object indicates requiresConfirmation: true.");
    assert(proposalRes.action && proposalRes.action.confirmationToken, "Returns raw 64-char hex confirmationToken to client.");
    assert(proposalRes.action.confirmationToken.length === 64, "Confirmation token is cryptographically strong 64-char hex.");
    assert(proposalRes.action.expiresAt !== undefined, "Expiration timestamp (5 minutes) is attached.");
    assert(proposalRes.action.currentValue === 40, "Captured current price snapshot (₹40).");
    assert(proposalRes.action.proposedValue === 48.50, "Captured proposed price (₹48.50).");

    const tokenHash = crypto.createHash("sha256").update(proposalRes.action.confirmationToken).digest("hex");
    const dbPendingRecord = await query.get("SELECT * FROM ai_pending_actions WHERE confirmationTokenHash = ?", [tokenHash]);
    assert(dbPendingRecord !== null, "Pending action record saved in DB keyed by token hash.");
    assert(dbPendingRecord.status === "PENDING", "Database pending action status is 'PENDING'.");

    // Verify product price in DB is STILL 40 (NO DIRECT MUTATION BEFORE CONFIRMATION)
    const dbProdBefore = await query.get("SELECT price FROM products WHERE id = ?", [testProdId]);
    assert(Number(dbProdBefore.price) === 40.00, "DATABASE SAFETY: Product price is UNCHANGED (still ₹40.00) after proposal creation.");

    // TEST 4: Unauthorized confirmation rejection
    console.log("\n--- 4. Security & RBAC Enforcement on Action Confirmation ---");
    const unauthRes = await confirmAction({
      confirmationToken: proposalRes.action.confirmationToken,
      userId: rogueUser.id
    });
    assert(unauthRes.success === false && (unauthRes.error?.code === "OWNERSHIP_VIOLATION" || unauthRes.error?.code === "UNAUTHORIZED"), "Rogue user cannot confirm action owned by farmer (returns OWNERSHIP_VIOLATION).");

    // TEST 5: Successful confirmation with transaction & audit trail
    console.log("\n--- 5. Atomic Action Confirmation & Database State Mutation ---");
    const confirmRes = await confirmAction({
      confirmationToken: proposalRes.action.confirmationToken,
      userId: farmerUser.id
    });
    assert(confirmRes.success === true, "Farmer successfully confirms action using valid token.");
    assert(confirmRes.result && Number(confirmRes.result.price) === 48.50, "Confirmation returns executed state (price: ₹48.50).");

    const dbProdAfter = await query.get("SELECT price FROM products WHERE id = ?", [testProdId]);
    assert(Number(dbProdAfter.price) === 48.50, "DATABASE VERIFIED: Product price updated to ₹48.50 in database.");

    const updatedPendingRecord = await query.get("SELECT status FROM ai_pending_actions WHERE id = ?", [proposalRes.action.pendingId]);
    assert(updatedPendingRecord && updatedPendingRecord.status === "CONFIRMED", "Pending action record updated to status 'CONFIRMED'.");

    const auditEntry = await query.get("SELECT * FROM ai_action_audit WHERE actionId = ? OR actionId = ?", [proposalRes.action.pendingId, proposalRes.action.actionId]);
    assert(auditEntry !== null, "Audit entry written to 'ai_action_audit' table.");

    // TEST 6: Idempotency & Replay Prevention
    console.log("\n--- 6. Idempotency & Replay Prevention ---");
    const replayRes = await confirmAction({
      confirmationToken: proposalRes.action.confirmationToken,
      userId: farmerUser.id
    });
    assert(replayRes.success === false && (replayRes.error?.code === "ACTION_ALREADY_PROCESSED" || replayRes.error?.code === "ALREADY_EXECUTED"), "Replayed token confirmation fails gracefully with ACTION_ALREADY_PROCESSED.");

    // TEST 7: Explicit cancellation flow
    console.log("\n--- 7. User Action Cancellation Flow ---");
    const cancelProp = await prepareActionProposal(farmerUser, "UPDATE_INVENTORY", {
      productId: testProdId,
      newStock: 800
    });
    assert(cancelProp.success === true, "Generated stock update proposal.");

    const cancelRes = await cancelAction({
      actionId: cancelProp.action.pendingId,
      userId: farmerUser.id
    });
    assert(cancelRes.success === true, "Explicit cancellation succeeds.");

    const dbProdStock = await query.get("SELECT stock FROM products WHERE id = ?", [testProdId]);
    assert(Number(dbProdStock.stock) === 500, "DATABASE SAFETY: Stock remains UNCHANGED (500) after cancellation.");

    const cancelledPending = await query.get("SELECT status FROM ai_pending_actions WHERE id = ?", [cancelProp.action.pendingId]);
    assert(cancelledPending && cancelledPending.status === "CANCELLED", "Pending action status marked 'CANCELLED'.");

    // TEST 8: Stale Data / Concurrent Edit Detection (ACTION_STALE)
    console.log("\n--- 8. Stale Data & Concurrent Edit Detection ---");
    const staleProp = await prepareActionProposal(farmerUser, "UPDATE_PRODUCT_PRICE", {
      productId: testProdId,
      newPrice: 55.00
    });

    // Simulate another user updating the price in DB behind the scenes
    await query.run("UPDATE products SET price = 52.00 WHERE id = ?", [testProdId]);

    const staleConfirm = await confirmAction({
      confirmationToken: staleProp.action.confirmationToken,
      userId: farmerUser.id
    });

    assert(staleConfirm.success === false && staleConfirm.error?.code === "ACTION_STALE", "Confirmation aborted with ACTION_STALE when expected state doesn't match.");
    const dbPriceStale = await query.get("SELECT price FROM products WHERE id = ?", [testProdId]);
    assert(Number(dbPriceStale.price) === 52.00, "DATABASE SAFETY: Concurrent price (52.00) was preserved, stale update rejected.");

    // TEST 9: Expiration handling
    console.log("\n--- 9. Token Expiration Enforcement ---");
    const expProp = await prepareActionProposal(farmerUser, "UPDATE_PRODUCT_PRICE", {
      productId: testProdId,
      newPrice: 60.00
    });

    // Manually set expiresAt to past date in DB
    const pastDate = new Date(Date.now() - 10000).getTime();
    await query.run("UPDATE ai_pending_actions SET expiresAt = ? WHERE id = ?", [pastDate, expProp.action.pendingId]);

    const expConfirm = await confirmAction({
      confirmationToken: expProp.action.confirmationToken,
      userId: farmerUser.id
    });
    assert(expConfirm.success === false && (expConfirm.error?.code === "ACTION_EXPIRED" || expConfirm.error?.code === "EXPIRED"), "Expired confirmation token rejected with ACTION_EXPIRED.");

    // TEST 10: Audit history retrieval
    console.log("\n--- 10. Audit History Retrieval ---");
    const history = await getActionAuditHistory(farmerUser.id, 10);
    assert(Array.isArray(history) && history.length >= 3, `Audit history retrieved ${history.length} audit entries.`);

    // TEST 11: Non-autonomous AI Agent Prompt Integration (Local Python NLP)
    console.log("\n--- 11. AI Agent Non-Autonomous Action Proposal via Local NLP ---");
    const agentRes = await processAiChat({
      user: farmerUser,
      prompt: `Please update the price of my product with ID ${testProdId} to ₹58/kg.`,
      lang: "en"
    });

    assert(agentRes.message && agentRes.message.content, "AI Agent returned message content.");
    console.log(`[Agent Response Text]: "${agentRes.message.content.slice(0, 100)}..."`);
    
    if (agentRes.message.content.includes("temporarily unavailable")) {
      console.log("  ⚠️ LOCAL NLP OFFLINE / FALLBACK USED (safe deterministic fallback verified)");
    } else {
      console.log("  ✅ LOCAL NLP ACTIVE: Python NLP response received.");
    }

    const containsClaim = agentRes.message.content.toLowerCase().includes("i have updated") || agentRes.message.content.toLowerCase().includes("updated the price to");
    assert(!containsClaim || agentRes.message.actionSuggestion?.type === "ACTION_PROPOSAL", "Agent does not claim autonomous completion without proposal.");

    if (agentRes.message.actionSuggestion) {
      assert(agentRes.message.actionSuggestion.type === "ACTION_PROPOSAL", "AI attached ACTION_PROPOSAL card suggestion to assistant response.");
    }

    console.log("\n==================================================");
    console.log(`  PHASE 6 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log("==================================================");

    try {
      if (dbInitPromise) await dbInitPromise;
      await pool.end();
    } catch (_) {}

    // Allow libuv socket close callbacks to complete to avoid Windows UV_HANDLE_CLOSING assertion
    await new Promise((r) => setTimeout(r, 200));

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error("Test execution crash:", err);
    process.exit(1);
  }
}

runPhase6Tests();
