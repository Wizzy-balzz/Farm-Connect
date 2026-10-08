import crypto from "crypto";
import dotenv from "dotenv";
import { query } from "../database.js";

dotenv.config();

const PAYMENT_PROVIDER = (process.env.PAYMENT_PROVIDER || "razorpay").toLowerCase();

// Safe diagnostic environment logging (never prints actual secret values)
console.log(`[Payment Gateway Init]: RAZORPAY_KEY_ID loaded: ${Boolean(process.env.RAZORPAY_KEY_ID || process.env.PAYMENT_KEY_ID) ? "YES" : "NO"}`);
console.log(`[Payment Gateway Init]: RAZORPAY_KEY_SECRET loaded: ${Boolean(process.env.RAZORPAY_KEY_SECRET || process.env.PAYMENT_KEY_SECRET) ? "YES" : "NO"}`);

export class PaymentSecurityError extends Error {
  constructor(message, { statusCode = 400, code = "PAYMENT_ERROR" } = {}) {
    super(message);
    this.name = "PaymentSecurityError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Constant-time string comparison to prevent timing side-channel attacks
 */
export function timingSafeCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Create a new payment transaction order with gateway and store in database
 * Authoritative amount is loaded from database orders table
 */
export async function createPaymentOrder({ orderId, userId, role, amount, currency = "INR", method = "upi" }) {
  if (!orderId) {
    throw new PaymentSecurityError("Order ID is required to create payment order.", {
      statusCode: 400,
      code: "INVALID_INPUT"
    });
  }

  // 1. Authoritative order lookup directly from database
  const order = await query.get("SELECT * FROM orders WHERE id = ?", [orderId]);
  if (!order) {
    throw new PaymentSecurityError(`Order not found: ${orderId}`, {
      statusCode: 404,
      code: "ORDER_NOT_FOUND"
    });
  }

  // 2. Strict order ownership authorization (IDOR prevention)
  if (userId) {
    const isOwner = order.vendorId === userId;
    const isAdmin = role === "admin";
    if (!isOwner && !isAdmin) {
      throw new PaymentSecurityError("You are not authorized to create payment for this order.", {
        statusCode: 403,
        code: "FORBIDDEN"
      });
    }
  }

  // 3. Order state validation: reject cancelled or already-paid orders
  if (order.status === "Cancelled") {
    throw new PaymentSecurityError("Cannot create payment for a cancelled order.", {
      statusCode: 400,
      code: "ORDER_CANCELLED"
    });
  }

  if (order.paymentStatus === "PAID") {
    throw new PaymentSecurityError("Order has already been paid.", {
      statusCode: 400,
      code: "ORDER_ALREADY_PAID"
    });
  }

  // 4. Authoritative amount enforcement: server DB totalAmount is source of truth
  const authoritativeAmount = Number(order.totalAmount);
  if (amount !== undefined && amount !== null) {
    const clientAmount = Number(amount);
    if (isNaN(clientAmount) || Math.abs(clientAmount - authoritativeAmount) > 0.01) {
      throw new PaymentSecurityError("Payment amount mismatch with authoritative order total.", {
        statusCode: 400,
        code: "AMOUNT_MISMATCH"
      });
    }
  }

  const effectiveCurrency = order.currency || currency || "INR";
  const now = new Date().toISOString();
  const paymentId = `pay_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
  let gatewayOrderId = `gw_ord_${Math.random().toString(36).substring(2, 9)}`;
  let isRealGatewayOrder = false;

  const keyId = (process.env.RAZORPAY_KEY_ID || process.env.PAYMENT_KEY_ID || "").trim();
  const keySecret = (process.env.RAZORPAY_KEY_SECRET || process.env.PAYMENT_KEY_SECRET || "").trim();

  // If valid Razorpay API credentials configured, create real gateway order via Razorpay API
  if (PAYMENT_PROVIDER === "razorpay" && keyId && keySecret && !keyId.includes("your_key_id") && !keyId.includes("farmconnect_2026")) {
    try {
      const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
      const res = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          "Authorization": `Basic ${auth}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          amount: Math.round(authoritativeAmount * 100), // Amount in paise using authoritative DB amount
          currency: effectiveCurrency,
          receipt: orderId,
          notes: { orderId, userId: userId || order.vendorId, method }
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.id && data.id.startsWith("order_")) {
          gatewayOrderId = data.id;
          isRealGatewayOrder = true;
          console.log(`[Payment Gateway Success]: Razorpay order created: ${gatewayOrderId}`);
        }
      } else {
        const errText = await res.text();
        console.warn("[Payment Gateway Warning]: Razorpay API order creation returned error:", res.status, errText);
      }
    } catch (err) {
      console.warn("[Payment Gateway Warning]: Razorpay API order creation network exception:", err.message);
    }
  }

  // Insert payment record into database with status 'created'
  await query.run(
    `INSERT INTO payments (id, orderId, userId, gateway, gatewayOrderId, gatewayPaymentId, amount, currency, status, method, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, NULL, ?, ?, 'created', ?, ?, ?)`,
    [paymentId, orderId, userId || order.vendorId || null, PAYMENT_PROVIDER, gatewayOrderId, authoritativeAmount, effectiveCurrency, method, now, now]
  );

  // Link payment ID to order and set status to PENDING_PAYMENT
  await query.run(
    `UPDATE orders SET paymentId = ?, paymentStatus = 'PENDING_PAYMENT' WHERE id = ?`,
    [paymentId, orderId]
  );

  isRealGatewayOrder = Boolean(gatewayOrderId && gatewayOrderId.startsWith("order_"));

  return {
    paymentId,
    orderId,
    gateway: PAYMENT_PROVIDER,
    gatewayKeyId: keyId,
    gatewayOrderId,
    isRealGatewayOrder,
    amount: authoritativeAmount,
    currency: effectiveCurrency,
    method
  };
}

/**
 * Verify payment signature and mark payment & order as PAID server-side
 * Uses strict constant-time HMAC-SHA256 verification and atomic state updates
 */
export async function verifyPayment({
  orderId,
  userId,
  role,
  gatewayOrderId,
  gatewayPaymentId,
  gatewaySignature,
  method,
  isWebhook = false
}) {
  if (!orderId) {
    throw new PaymentSecurityError("Order ID is required for payment verification.", {
      statusCode: 400,
      code: "INVALID_INPUT"
    });
  }

  // 1. Authoritative order lookup
  const order = await query.get("SELECT * FROM orders WHERE id = ?", [orderId]);
  if (!order) {
    throw new PaymentSecurityError(`Order not found: ${orderId}`, {
      statusCode: 404,
      code: "ORDER_NOT_FOUND"
    });
  }

  // 2. Strict order ownership authorization (IDOR prevention)
  if (!isWebhook && userId) {
    const isOwner = order.vendorId === userId;
    const isAdmin = role === "admin";
    if (!isOwner && !isAdmin) {
      throw new PaymentSecurityError("You are not authorized to verify payment for this order.", {
        statusCode: 403,
        code: "FORBIDDEN"
      });
    }
  }

  // 3. State check: reject cancelled orders
  if (order.status === "Cancelled") {
    throw new PaymentSecurityError("Cannot verify payment for a cancelled order.", {
      statusCode: 400,
      code: "ORDER_CANCELLED"
    });
  }

  // 4. Idempotency check: if order is already PAID, return success without duplicate processing
  if (order.paymentStatus === "PAID") {
    return {
      verified: true,
      alreadyVerified: true,
      orderId,
      status: "PAID",
      message: "Payment was already verified."
    };
  }

  // 5. Payment record lookup
  const payment = await query.get("SELECT * FROM payments WHERE orderId = ? ORDER BY createdAt DESC LIMIT 1", [orderId]);
  if (!payment) {
    throw new PaymentSecurityError(`Payment record not found for Order ID: ${orderId}`, {
      statusCode: 404,
      code: "PAYMENT_NOT_FOUND"
    });
  }

  // Idempotency check on payment record
  if (payment.status === "paid") {
    return {
      verified: true,
      alreadyVerified: true,
      orderId,
      paymentId: payment.id,
      status: "PAID",
      message: "Payment was already verified."
    };
  }

  const cleanGatewayOrderId = (gatewayOrderId || payment.gatewayOrderId || "").trim();
  const cleanGatewayPaymentId = (gatewayPaymentId || "").trim();
  const cleanGatewaySignature = (gatewaySignature || "").trim();

  // 6. Signature presence check
  if (!cleanGatewayOrderId || !cleanGatewayPaymentId || !cleanGatewaySignature) {
    const now = new Date().toISOString();
    await query.run(`UPDATE payments SET status = 'failed', updatedAt = ? WHERE id = ?`, [now, payment.id]);
    await query.run(`UPDATE orders SET paymentStatus = 'PAYMENT_FAILED' WHERE id = ?`, [orderId]);
    return {
      verified: false,
      stage: "SIGNATURE_VERIFICATION",
      code: "MISSING_SIGNATURE",
      message: "Gateway order ID, payment ID, and signature are required for verification."
    };
  }

  // 7. Replay attack prevention: verify gatewayPaymentId hasn't already been used on a different order
  const replayPayment = await query.get(
    "SELECT id, orderId FROM payments WHERE gatewayPaymentId = ? AND orderId != ? AND status = 'paid' LIMIT 1",
    [cleanGatewayPaymentId, orderId]
  );
  if (replayPayment) {
    throw new PaymentSecurityError("Payment ID has already been utilized for another transaction.", {
      statusCode: 400,
      code: "PAYMENT_REPLAY_DETECTED"
    });
  }

  // 8. Strict Dev Bypass Removal: explicitly reject known bypass strings
  if (cleanGatewaySignature === "sig_verified_dev_test" || cleanGatewayOrderId.startsWith("bypass_")) {
    const now = new Date().toISOString();
    await query.run(`UPDATE payments SET status = 'failed', updatedAt = ? WHERE id = ?`, [now, payment.id]);
    await query.run(`UPDATE orders SET paymentStatus = 'PAYMENT_FAILED' WHERE id = ?`, [orderId]);
    return {
      verified: false,
      stage: "SIGNATURE_VERIFICATION",
      code: "INVALID_SIGNATURE",
      message: "Server-side payment signature verification failed."
    };
  }

  // 9. Genuine HMAC SHA256 verification using RAZORPAY_KEY_SECRET
  const keySecret = (process.env.RAZORPAY_KEY_SECRET || process.env.PAYMENT_KEY_SECRET || "").trim();
  if (!keySecret) {
    throw new PaymentSecurityError("Payment gateway secret not configured on server.", {
      statusCode: 500,
      code: "GATEWAY_SECRET_MISSING"
    });
  }

  const payloadText = `${cleanGatewayOrderId}|${cleanGatewayPaymentId}`;
  const expectedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(payloadText)
    .digest("hex");

  const isSignatureValid = timingSafeCompare(cleanGatewaySignature, expectedSignature);

  if (!isSignatureValid) {
    console.warn(`[Payment Verification Mismatch]: HMAC digest mismatch for Order: ${orderId}, GatewayOrder: ${cleanGatewayOrderId}`);
    const now = new Date().toISOString();
    await query.run(`UPDATE payments SET status = 'failed', updatedAt = ? WHERE id = ?`, [now, payment.id]);
    await query.run(`UPDATE orders SET paymentStatus = 'PAYMENT_FAILED' WHERE id = ?`, [orderId]);
    return {
      verified: false,
      stage: "SIGNATURE_VERIFICATION",
      code: "INVALID_SIGNATURE",
      message: "Server-side payment signature verification failed."
    };
  }

  // 10. Atomic Transactional state update: both payments and orders updated atomically
  const now = new Date().toISOString();
  const conn = await query.beginTransaction();
  try {
    await query.run(
      `UPDATE payments SET status = 'paid', gatewayPaymentId = ?, gatewayOrderId = ?, method = ?, updatedAt = ? WHERE id = ?`,
      [cleanGatewayPaymentId, cleanGatewayOrderId, method || payment.method || "upi", now, payment.id],
      conn
    );

    await query.run(
      `UPDATE orders SET paymentStatus = 'PAID', status = 'Confirmed' WHERE id = ?`,
      [orderId],
      conn
    );

    await query.commit(conn);
  } catch (txErr) {
    await query.rollback(conn);
    throw new PaymentSecurityError("Failed to update payment state atomically.", {
      statusCode: 500,
      code: "TRANSACTION_ERROR"
    });
  }

  return {
    verified: true,
    paymentId: payment.id,
    orderId,
    gatewayPaymentId: cleanGatewayPaymentId,
    status: "PAID",
    message: "Payment successfully verified."
  };
}

/**
 * Handle incoming gateway webhook for async payment notifications (idempotent & hardened)
 */
export async function handleWebhook(headers, rawBody) {
  const signature = headers["x-razorpay-signature"] || headers["stripe-signature"] || headers["x-webhook-signature"];
  const webhookSecret = (process.env.PAYMENT_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET || process.env.PAYMENT_KEY_SECRET || "").trim();

  if (!signature || !webhookSecret) {
    throw new PaymentSecurityError("Webhook signature or secret is missing.", {
      statusCode: 400,
      code: "WEBHOOK_SIGNATURE_MISSING"
    });
  }

  const payload = typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody);
  const expectedSig = crypto
    .createHmac("sha256", webhookSecret)
    .update(payload)
    .digest("hex");

  const isSignatureValid = timingSafeCompare(signature, expectedSig);
  if (!isSignatureValid) {
    throw new PaymentSecurityError("Invalid webhook signature.", {
      statusCode: 400,
      code: "INVALID_WEBHOOK_SIGNATURE"
    });
  }

  let body;
  try {
    body = typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;
  } catch {
    throw new PaymentSecurityError("Malformed JSON in webhook body.", {
      statusCode: 400,
      code: "INVALID_PAYLOAD"
    });
  }

  const event = body.event || body.type;

  if (event === "payment.captured" || event === "payment.authorized" || event === "order.paid") {
    const entity = body.payload?.payment?.entity || body.data?.object || body;
    const orderId = entity.notes?.orderId || entity.metadata?.orderId || entity.receipt;
    const gatewayPaymentId = entity.id;
    const gatewayOrderId = entity.order_id;

    if (orderId) {
      const order = await query.get("SELECT * FROM orders WHERE id = ?", [orderId]);
      if (order) {
        // Idempotency: if already paid, return safely without duplicate action
        if (order.paymentStatus === "PAID") {
          return { success: true, event, alreadyProcessed: true };
        }

        // Cancelled orders cannot be paid via webhook
        if (order.status === "Cancelled") {
          return { success: true, event, skipped: "Order is cancelled" };
        }

        const now = new Date().toISOString();
        const payment = await query.get("SELECT * FROM payments WHERE orderId = ? ORDER BY createdAt DESC LIMIT 1", [orderId]);
        const paymentId = payment?.id || `pay_wh_${Date.now()}`;

        const conn = await query.beginTransaction();
        try {
          if (payment) {
            await query.run(
              `UPDATE payments SET status = 'paid', gatewayPaymentId = ?, gatewayOrderId = ?, method = ?, updatedAt = ? WHERE id = ?`,
              [gatewayPaymentId || payment.gatewayPaymentId, gatewayOrderId || payment.gatewayOrderId, entity.method || payment.method || "upi", now, payment.id],
              conn
            );
          } else {
            await query.run(
              `INSERT INTO payments (id, orderId, userId, gateway, gatewayOrderId, gatewayPaymentId, amount, currency, status, method, createdAt, updatedAt)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'paid', ?, ?, ?)`,
              [paymentId, orderId, order.vendorId, PAYMENT_PROVIDER, gatewayOrderId, gatewayPaymentId, order.totalAmount, order.currency || "INR", entity.method || "upi", now, now],
              conn
            );
          }

          await query.run(
            `UPDATE orders SET paymentStatus = 'PAID', status = 'Confirmed' WHERE id = ?`,
            [orderId],
            conn
          );

          await query.commit(conn);
        } catch (txErr) {
          await query.rollback(conn);
          throw txErr;
        }
      }
    }
  } else if (event === "payment.failed") {
    const entity = body.payload?.payment?.entity || body;
    const orderId = entity.notes?.orderId || entity.receipt;
    if (orderId) {
      const now = new Date().toISOString();
      await query.run(`UPDATE orders SET paymentStatus = 'PAYMENT_FAILED' WHERE id = ?`, [orderId]);
    }
  }

  return { success: true, event };
}
