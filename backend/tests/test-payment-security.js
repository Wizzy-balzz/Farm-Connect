import crypto from "crypto";
import dotenv from "dotenv";
import { query, pool } from "../database.js";
import {
  createPaymentOrder,
  verifyPayment,
  handleWebhook,
  timingSafeCompare,
  PaymentSecurityError
} from "../services/paymentService.js";

dotenv.config();

async function runPaymentSecurityTests() {
  console.log("================================================================================");
  console.log("   FARMCONNECT — STEP 1 PAYMENT SECURITY AUDIT & HARDENING TEST SUITE           ");
  console.log("================================================================================\n");

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

  const keySecret = (process.env.RAZORPAY_KEY_SECRET || process.env.PAYMENT_KEY_SECRET || "").trim();

  // Test Fixture IDs
  const userAlice = { id: "usr_sec_alice", name: "Alice Vendor", role: "vendor", email: "alice_sec@test.com" };
  const userBob = { id: "usr_sec_bob", name: "Bob Vendor", role: "vendor", email: "bob_sec@test.com" };
  const userAdmin = { id: "usr_sec_admin", name: "Admin Officer", role: "admin", email: "admin_sec@test.com" };

  const orderA = "ord_sec_test_A";
  const orderB = "ord_sec_test_B";
  const orderCancelled = "ord_sec_test_cancelled";
  const orderReplay1 = "ord_sec_replay_1";
  const orderReplay2 = "ord_sec_replay_2";
  const orderWebhook = "ord_sec_webhook_test";

  const allOrderIds = [orderA, orderB, orderCancelled, orderReplay1, orderReplay2, orderWebhook];
  const allUserIds = [userAlice.id, userBob.id, userAdmin.id];

  try {
    // 0. Clean up any previous fixtures
    for (const oid of allOrderIds) {
      await query.run("DELETE FROM payments WHERE orderId = ?", [oid]);
      await query.run("DELETE FROM order_items WHERE orderId = ?", [oid]);
      await query.run("DELETE FROM orders WHERE id = ?", [oid]);
    }
    for (const uid of allUserIds) {
      await query.run("DELETE FROM users WHERE id = ?", [uid]);
    }

    const now = new Date().toISOString();

    // Insert Users
    await query.run(
      "INSERT INTO users (id, name, email, role, region, createdAt) VALUES (?, ?, ?, 'vendor', 'Pune', ?)",
      [userAlice.id, userAlice.name, userAlice.email, now]
    );
    await query.run(
      "INSERT INTO users (id, name, email, role, region, createdAt) VALUES (?, ?, ?, 'vendor', 'Mumbai', ?)",
      [userBob.id, userBob.name, userBob.email, now]
    );
    await query.run(
      "INSERT INTO users (id, name, email, role, region, createdAt) VALUES (?, ?, ?, 'admin', 'Headquarters', ?)",
      [userAdmin.id, userAdmin.name, userAdmin.email, now]
    );

    // Insert Orders
    await query.run(
      `INSERT INTO orders (id, vendorId, vendorName, totalAmount, subtotal, deliveryCharge, paymentMethod, paymentStatus, currency, status, createdAt)
       VALUES (?, ?, ?, 1500.00, 1400.00, 100.00, 'upi', 'PENDING_PAYMENT', 'INR', 'Pending', ?)`,
      [orderA, userAlice.id, userAlice.name, now]
    );

    await query.run(
      `INSERT INTO orders (id, vendorId, vendorName, totalAmount, subtotal, deliveryCharge, paymentMethod, paymentStatus, currency, status, createdAt)
       VALUES (?, ?, ?, 3200.00, 3000.00, 200.00, 'card', 'PENDING_PAYMENT', 'INR', 'Pending', ?)`,
      [orderB, userBob.id, userBob.name, now]
    );

    await query.run(
      `INSERT INTO orders (id, vendorId, vendorName, totalAmount, subtotal, deliveryCharge, paymentMethod, paymentStatus, currency, status, createdAt)
       VALUES (?, ?, ?, 800.00, 750.00, 50.00, 'upi', 'PENDING_PAYMENT', 'INR', 'Cancelled', ?)`,
      [orderCancelled, userAlice.id, userAlice.name, now]
    );

    await query.run(
      `INSERT INTO orders (id, vendorId, vendorName, totalAmount, subtotal, deliveryCharge, paymentMethod, paymentStatus, currency, status, createdAt)
       VALUES (?, ?, ?, 1000.00, 950.00, 50.00, 'upi', 'PENDING_PAYMENT', 'INR', 'Pending', ?)`,
      [orderReplay1, userAlice.id, userAlice.name, now]
    );

    await query.run(
      `INSERT INTO orders (id, vendorId, vendorName, totalAmount, subtotal, deliveryCharge, paymentMethod, paymentStatus, currency, status, createdAt)
       VALUES (?, ?, ?, 1000.00, 950.00, 50.00, 'upi', 'PENDING_PAYMENT', 'INR', 'Pending', ?)`,
      [orderReplay2, userBob.id, userBob.name, now]
    );

    await query.run(
      `INSERT INTO orders (id, vendorId, vendorName, totalAmount, subtotal, deliveryCharge, paymentMethod, paymentStatus, currency, status, createdAt)
       VALUES (?, ?, ?, 2200.00, 2100.00, 100.00, 'upi', 'PENDING_PAYMENT', 'INR', 'Pending', ?)`,
      [orderWebhook, userAlice.id, userAlice.name, now]
    );

    // =========================================================================
    // SCENARIO A: Amount Tampering Prevention
    // =========================================================================
    console.log("\n--- Scenario A: Amount Tampering Prevention ---");
    let tamperedUnderRejected = false;
    try {
      await createPaymentOrder({
        orderId: orderA,
        userId: userAlice.id,
        role: userAlice.role,
        amount: 100.00 // Real total is 1500.00
      });
    } catch (err) {
      if (err instanceof PaymentSecurityError && err.code === "AMOUNT_MISMATCH" && err.statusCode === 400) {
        tamperedUnderRejected = true;
      }
    }
    assert(tamperedUnderRejected, "A.1: Client amount lower than DB order total rejected with 400 AMOUNT_MISMATCH");

    let tamperedOverRejected = false;
    try {
      await createPaymentOrder({
        orderId: orderA,
        userId: userAlice.id,
        role: userAlice.role,
        amount: 5000.00
      });
    } catch (err) {
      if (err instanceof PaymentSecurityError && err.code === "AMOUNT_MISMATCH") {
        tamperedOverRejected = true;
      }
    }
    assert(tamperedOverRejected, "A.2: Client amount higher than DB order total rejected with 400 AMOUNT_MISMATCH");

    const validOrderCreation = await createPaymentOrder({
      orderId: orderA,
      userId: userAlice.id,
      role: userAlice.role,
      amount: 1500.00
    });
    assert(
      validOrderCreation && validOrderCreation.amount === 1500.00 && validOrderCreation.paymentId,
      "A.3: Authoritative matching amount successfully initializes payment order with DB amount"
    );

    // =========================================================================
    // SCENARIO B: IDOR Prevention on Create Payment Order
    // =========================================================================
    console.log("\n--- Scenario B: IDOR Prevention on Create ---");
    let idorCreateRejected = false;
    try {
      // Bob tries to create payment for Alice's orderA
      await createPaymentOrder({
        orderId: orderA,
        userId: userBob.id,
        role: userBob.role
      });
    } catch (err) {
      if (err instanceof PaymentSecurityError && err.statusCode === 403 && err.code === "FORBIDDEN") {
        idorCreateRejected = true;
      }
    }
    assert(idorCreateRejected, "B.1: User Bob cannot create payment for User Alice's order (403 FORBIDDEN)");

    let adminOverrideAllowed = false;
    try {
      const adminOrder = await createPaymentOrder({
        orderId: orderA,
        userId: userAdmin.id,
        role: userAdmin.role
      });
      if (adminOrder && adminOrder.paymentId) {
        adminOverrideAllowed = true;
      }
    } catch (err) {
      console.error(err);
    }
    assert(adminOverrideAllowed, "B.2: Admin role authorized to initialize payment for administrative resolution");

    // =========================================================================
    // SCENARIO C: IDOR Prevention on Verify Payment
    // =========================================================================
    console.log("\n--- Scenario C: IDOR Prevention on Verify ---");
    let idorVerifyRejected = false;
    try {
      // Bob tries to verify payment for Alice's orderA
      await verifyPayment({
        orderId: orderA,
        userId: userBob.id,
        role: userBob.role,
        gatewayOrderId: validOrderCreation.gatewayOrderId,
        gatewayPaymentId: "pay_fake_bob_123",
        gatewaySignature: "sig_fake_bob_123"
      });
    } catch (err) {
      if (err instanceof PaymentSecurityError && err.statusCode === 403 && err.code === "FORBIDDEN") {
        idorVerifyRejected = true;
      }
    }
    assert(idorVerifyRejected, "C.1: User Bob cannot verify payment for User Alice's order (403 FORBIDDEN)");

    // =========================================================================
    // SCENARIO D: Missing Signature Rejection
    // =========================================================================
    console.log("\n--- Scenario D: Missing Signature Rejection ---");
    const orderForMissing = await createPaymentOrder({
      orderId: orderA,
      userId: userAlice.id,
      role: userAlice.role
    });

    const missingSigRes = await verifyPayment({
      orderId: orderA,
      userId: userAlice.id,
      role: userAlice.role,
      gatewayOrderId: orderForMissing.gatewayOrderId,
      gatewayPaymentId: "pay_test_no_sig",
      gatewaySignature: "" // Empty signature
    });
    assert(
      missingSigRes && missingSigRes.verified === false && missingSigRes.code === "MISSING_SIGNATURE",
      "D.1: Verification with empty/missing signature rejected with MISSING_SIGNATURE"
    );

    const payStatusAfterMissing = await query.get("SELECT status FROM payments WHERE id = ?", [orderForMissing.paymentId]);
    const orderStatusAfterMissing = await query.get("SELECT paymentStatus FROM orders WHERE id = ?", [orderA]);
    assert(
      payStatusAfterMissing?.status === "failed" && orderStatusAfterMissing?.paymentStatus === "PAYMENT_FAILED",
      "D.2: Missing signature updates payment status to 'failed' and order to 'PAYMENT_FAILED'"
    );

    // =========================================================================
    // SCENARIO E: Invalid / Tampered Signature Rejection
    // =========================================================================
    console.log("\n--- Scenario E: Invalid / Tampered Signature Rejection ---");
    // Re-create payment order for fresh state
    const orderForTamper = await createPaymentOrder({
      orderId: orderA,
      userId: userAlice.id,
      role: userAlice.role
    });

    const tamperedSignature = crypto.createHmac("sha256", "WRONG_SECRET_KEY_FOR_TESTING")
      .update(`${orderForTamper.gatewayOrderId}|pay_tamper_attempt_1`)
      .digest("hex");

    const tamperedRes = await verifyPayment({
      orderId: orderA,
      userId: userAlice.id,
      role: userAlice.role,
      gatewayOrderId: orderForTamper.gatewayOrderId,
      gatewayPaymentId: "pay_tamper_attempt_1",
      gatewaySignature: tamperedSignature
    });
    assert(
      tamperedRes && tamperedRes.verified === false && tamperedRes.code === "INVALID_SIGNATURE",
      "E.1: Tampered/invalid HMAC signature strictly rejected with INVALID_SIGNATURE"
    );

    // =========================================================================
    // SCENARIO F: Dev Bypass Removal Verification
    // =========================================================================
    console.log("\n--- Scenario F: Dev Bypass Removal Verification ---");
    const orderForBypass = await createPaymentOrder({
      orderId: orderA,
      userId: userAlice.id,
      role: userAlice.role
    });

    const bypassDevTestRes = await verifyPayment({
      orderId: orderA,
      userId: userAlice.id,
      role: userAlice.role,
      gatewayOrderId: orderForBypass.gatewayOrderId,
      gatewayPaymentId: "pay_bypass_attempt",
      gatewaySignature: "sig_verified_dev_test" // Former dev bypass string
    });
    assert(
      bypassDevTestRes && bypassDevTestRes.verified === false && bypassDevTestRes.code === "INVALID_SIGNATURE",
      "F.1: Former 'sig_verified_dev_test' bypass string is strictly REJECTED"
    );

    const bypassGwOrdRes = await verifyPayment({
      orderId: orderA,
      userId: userAlice.id,
      role: userAlice.role,
      gatewayOrderId: "gw_ord_fake_bypass",
      gatewayPaymentId: "pay_gw_ord_bypass",
      gatewaySignature: "unverified_random_string"
    });
    assert(
      bypassGwOrdRes && bypassGwOrdRes.verified === false && bypassGwOrdRes.code === "INVALID_SIGNATURE",
      "F.2: gw_ord_ prefixes with invalid signatures are strictly REJECTED"
    );

    // =========================================================================
    // SCENARIO G: Replay Attack Prevention
    // =========================================================================
    console.log("\n--- Scenario G: Replay Attack Prevention ---");
    const replayOrder1Init = await createPaymentOrder({
      orderId: orderReplay1,
      userId: userAlice.id,
      role: userAlice.role
    });

    const sharedGatewayPaymentId = `pay_replay_token_${Date.now()}`;
    const validSigOrder1 = crypto.createHmac("sha256", keySecret)
      .update(`${replayOrder1Init.gatewayOrderId}|${sharedGatewayPaymentId}`)
      .digest("hex");

    // Legitimate verification for orderReplay1
    const verifyOrder1 = await verifyPayment({
      orderId: orderReplay1,
      userId: userAlice.id,
      role: userAlice.role,
      gatewayOrderId: replayOrder1Init.gatewayOrderId,
      gatewayPaymentId: sharedGatewayPaymentId,
      gatewaySignature: validSigOrder1
    });
    assert(verifyOrder1 && verifyOrder1.verified === true, "G.1: Initial legitimate payment verified for order 1");

    // Attacker Bob creates payment for orderReplay2 and attempts to replay sharedGatewayPaymentId
    const replayOrder2Init = await createPaymentOrder({
      orderId: orderReplay2,
      userId: userBob.id,
      role: userBob.role
    });

    const forgedSigForOrder2 = crypto.createHmac("sha256", keySecret)
      .update(`${replayOrder2Init.gatewayOrderId}|${sharedGatewayPaymentId}`)
      .digest("hex");

    let replayCaught = false;
    try {
      await verifyPayment({
        orderId: orderReplay2,
        userId: userBob.id,
        role: userBob.role,
        gatewayOrderId: replayOrder2Init.gatewayOrderId,
        gatewayPaymentId: sharedGatewayPaymentId, // REPLAYED ID
        gatewaySignature: forgedSigForOrder2
      });
    } catch (err) {
      if (err instanceof PaymentSecurityError && err.code === "PAYMENT_REPLAY_DETECTED" && err.statusCode === 400) {
        replayCaught = true;
      }
    }
    assert(replayCaught, "G.2: Replay attack with previously consumed gatewayPaymentId blocked with PAYMENT_REPLAY_DETECTED");

    // =========================================================================
    // SCENARIO H: Cancelled Order Payment Rejection
    // =========================================================================
    console.log("\n--- Scenario H: Cancelled Order Payment Rejection ---");
    let cancelledCreateRejected = false;
    try {
      await createPaymentOrder({
        orderId: orderCancelled,
        userId: userAlice.id,
        role: userAlice.role
      });
    } catch (err) {
      if (err instanceof PaymentSecurityError && err.code === "ORDER_CANCELLED" && err.statusCode === 400) {
        cancelledCreateRejected = true;
      }
    }
    assert(cancelledCreateRejected, "H.1: createPaymentOrder on cancelled order rejected with ORDER_CANCELLED");

    let cancelledVerifyRejected = false;
    try {
      await verifyPayment({
        orderId: orderCancelled,
        userId: userAlice.id,
        role: userAlice.role,
        gatewayOrderId: "gw_ord_cancelled",
        gatewayPaymentId: "pay_cancelled",
        gatewaySignature: "sig_cancelled"
      });
    } catch (err) {
      if (err instanceof PaymentSecurityError && err.code === "ORDER_CANCELLED" && err.statusCode === 400) {
        cancelledVerifyRejected = true;
      }
    }
    assert(cancelledVerifyRejected, "H.2: verifyPayment on cancelled order rejected with ORDER_CANCELLED");

    // =========================================================================
    // SCENARIO I: Already-Paid Order Idempotency
    // =========================================================================
    console.log("\n--- Scenario I: Already-Paid Order Idempotency ---");
    // orderReplay1 is already PAID from Scenario G
    const duplicateVerify = await verifyPayment({
      orderId: orderReplay1,
      userId: userAlice.id,
      role: userAlice.role,
      gatewayOrderId: replayOrder1Init.gatewayOrderId,
      gatewayPaymentId: sharedGatewayPaymentId,
      gatewaySignature: validSigOrder1
    });
    assert(
      duplicateVerify && duplicateVerify.verified === true && duplicateVerify.alreadyVerified === true,
      "I.1: Duplicate verify on already-paid order returns idempotent success without reprocessing"
    );

    // =========================================================================
    // SCENARIO J: Timing-Safe Comparison
    // =========================================================================
    console.log("\n--- Scenario J: Timing-Safe Comparison ---");
    const sigA = "a".repeat(64);
    const sigB = "a".repeat(63) + "b";
    const sigC = "a".repeat(64);
    const sigShort = "a".repeat(32);

    assert(timingSafeCompare(sigA, sigC) === true, "J.1: Identical strings evaluate to true in constant time");
    assert(timingSafeCompare(sigA, sigB) === false, "J.2: Single-character difference evaluates to false in constant time");
    assert(timingSafeCompare(sigA, sigShort) === false, "J.3: Length mismatch evaluated safely without throwing");
    assert(timingSafeCompare(null, sigA) === false, "J.4: Null or non-string inputs evaluated safely");

    // =========================================================================
    // SCENARIO K: Atomic State Transition
    // =========================================================================
    console.log("\n--- Scenario K: Atomic State Transition ---");
    const atomicPaymentOrder = await createPaymentOrder({
      orderId: orderB,
      userId: userBob.id,
      role: userBob.role
    });

    const legitimatePaymentId = `pay_atomic_${Date.now()}`;
    const validSignatureB = crypto.createHmac("sha256", keySecret)
      .update(`${atomicPaymentOrder.gatewayOrderId}|${legitimatePaymentId}`)
      .digest("hex");

    const atomicVerifyRes = await verifyPayment({
      orderId: orderB,
      userId: userBob.id,
      role: userBob.role,
      gatewayOrderId: atomicPaymentOrder.gatewayOrderId,
      gatewayPaymentId: legitimatePaymentId,
      gatewaySignature: validSignatureB
    });

    assert(atomicVerifyRes && atomicVerifyRes.verified === true, "K.1: Verification returned verified: true");

    const paymentRecordInDb = await query.get("SELECT * FROM payments WHERE id = ?", [atomicPaymentOrder.paymentId]);
    const orderRecordInDb = await query.get("SELECT * FROM orders WHERE id = ?", [orderB]);

    assert(
      paymentRecordInDb?.status === "paid" &&
      paymentRecordInDb?.gatewayPaymentId === legitimatePaymentId &&
      orderRecordInDb?.paymentStatus === "PAID" &&
      orderRecordInDb?.status === "Confirmed",
      "K.2: Both payments and orders tables atomically updated to 'paid' and 'PAID' / 'Confirmed'"
    );

    // =========================================================================
    // SCENARIO L: Non-Existent Order
    // =========================================================================
    console.log("\n--- Scenario L: Non-Existent Order (404) ---");
    let nonExistentCreate404 = false;
    try {
      await createPaymentOrder({
        orderId: "ord_fake_nonexistent_999",
        userId: userAlice.id,
        role: userAlice.role
      });
    } catch (err) {
      if (err instanceof PaymentSecurityError && err.statusCode === 404 && err.code === "ORDER_NOT_FOUND") {
        nonExistentCreate404 = true;
      }
    }
    assert(nonExistentCreate404, "L.1: createPaymentOrder with non-existent orderId returns 404 ORDER_NOT_FOUND");

    let nonExistentVerify404 = false;
    try {
      await verifyPayment({
        orderId: "ord_fake_nonexistent_999",
        userId: userAlice.id,
        role: userAlice.role,
        gatewayOrderId: "gw_ord_fake",
        gatewayPaymentId: "pay_fake",
        gatewaySignature: "sig_fake"
      });
    } catch (err) {
      if (err instanceof PaymentSecurityError && err.statusCode === 404 && err.code === "ORDER_NOT_FOUND") {
        nonExistentVerify404 = true;
      }
    }
    assert(nonExistentVerify404, "L.2: verifyPayment with non-existent orderId returns 404 ORDER_NOT_FOUND");

    // =========================================================================
    // SCENARIO M: Webhook Signature Verification
    // =========================================================================
    console.log("\n--- Scenario M: Webhook Signature Verification ---");
    const webhookSecret = (process.env.PAYMENT_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET || process.env.PAYMENT_KEY_SECRET || "").trim();

    const webhookPayloadObj = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: `pay_webhook_${Date.now()}`,
            order_id: "order_wh_12345",
            amount: 220000,
            currency: "INR",
            method: "upi",
            notes: {
              orderId: orderWebhook
            }
          }
        }
      }
    };
    const webhookPayloadStr = JSON.stringify(webhookPayloadObj);

    let badWebhookRejected = false;
    try {
      await handleWebhook(
        { "x-razorpay-signature": "forged_invalid_webhook_signature" },
        webhookPayloadStr
      );
    } catch (err) {
      if (err instanceof PaymentSecurityError && err.code === "INVALID_WEBHOOK_SIGNATURE") {
        badWebhookRejected = true;
      }
    }
    assert(badWebhookRejected, "M.1: Invalid webhook signature strictly rejected with INVALID_WEBHOOK_SIGNATURE");

    const validWebhookSig = crypto.createHmac("sha256", webhookSecret)
      .update(webhookPayloadStr)
      .digest("hex");

    const webhookSuccessRes = await handleWebhook(
      { "x-razorpay-signature": validWebhookSig },
      webhookPayloadStr
    );
    assert(
      webhookSuccessRes && webhookSuccessRes.success === true && webhookSuccessRes.event === "payment.captured",
      "M.2: Valid HMAC-signed webhook parsed, validated, and processed"
    );

    const orderAfterWebhook = await query.get("SELECT paymentStatus, status FROM orders WHERE id = ?", [orderWebhook]);
    assert(
      orderAfterWebhook?.paymentStatus === "PAID" && orderAfterWebhook?.status === "Confirmed",
      "M.3: Webhook event successfully transitioned order to PAID and Confirmed"
    );

    // =========================================================================
    // SCENARIO N: Webhook Replay / Duplicate Handling
    // =========================================================================
    console.log("\n--- Scenario N: Webhook Replay / Duplicate Handling ---");
    const duplicateWebhookRes = await handleWebhook(
      { "x-razorpay-signature": validWebhookSig },
      webhookPayloadStr
    );
    assert(
      duplicateWebhookRes && duplicateWebhookRes.success === true && duplicateWebhookRes.alreadyProcessed === true,
      "N.1: Replayed webhook event handled idempotently without duplicate side-effects"
    );

    // =========================================================================
    // SCENARIO O: Information Disclosure Prevention
    // =========================================================================
    console.log("\n--- Scenario O: Information Disclosure Prevention ---");
    let safeErrorStructure = false;
    try {
      await createPaymentOrder({ orderId: null });
    } catch (err) {
      const errStr = JSON.stringify(err.message);
      // Ensure no database credentials, table schemas, or secrets are leaked
      const noSecrets = !errStr.includes("BALa@") && !errStr.includes(keySecret) && !errStr.includes("root@127.0.0.1");
      const hasCode = Boolean(err.code);
      const hasStatusCode = Boolean(err.statusCode);
      if (noSecrets && hasCode && hasStatusCode) {
        safeErrorStructure = true;
      }
    }
    assert(safeErrorStructure, "O.1: Error responses contain sanitized error codes and do not leak DB credentials or secret keys");

    // Clean up test records
    for (const oid of allOrderIds) {
      await query.run("DELETE FROM payments WHERE orderId = ?", [oid]);
      await query.run("DELETE FROM order_items WHERE orderId = ?", [oid]);
      await query.run("DELETE FROM orders WHERE id = ?", [oid]);
    }
    for (const uid of allUserIds) {
      await query.run("DELETE FROM users WHERE id = ?", [uid]);
    }

  } catch (err) {
    console.error("Test Suite Execution Error:", err);
    failed++;
  }

  console.log("\n================================================================================");
  console.log(`   PAYMENT SECURITY AUDIT SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("================================================================================\n");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPaymentSecurityTests();
