import express from "express";
import { createPaymentOrder, verifyPayment, handleWebhook } from "../services/paymentService.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

function sendError(res, statusCode, code, message) {
  return res.status(statusCode).json({
    success: false,
    error: { code, message }
  });
}

// POST /api/payments/create-order (Initialize payment gateway order)
router.post("/create-order", requireAuth, async (req, res) => {
  const { orderId, amount, currency, method } = req.body || {};

  if (!orderId || !amount) {
    return sendError(res, 400, "INVALID_INPUT", "orderId and amount are required to create payment order.");
  }

  try {
    const paymentOrder = await createPaymentOrder({
      orderId,
      userId: req.user.id,
      amount: parseFloat(amount),
      currency: currency || "INR",
      method: method || "upi"
    });
    res.json({ success: true, paymentOrder });
  } catch (err) {
    console.error("Create payment order error:", err.message);
    sendError(res, 500, "PAYMENT_CREATION_FAILED", err.message || "Failed to create payment order.");
  }
});

// POST /api/payments/verify (Verify payment signature server-side)
router.post("/verify", requireAuth, async (req, res) => {
  const { orderId, gatewayOrderId, gatewayPaymentId, gatewaySignature, method } = req.body || {};

  if (!orderId) {
    return sendError(res, 400, "INVALID_INPUT", "orderId is required to verify payment.");
  }

  try {
    const verification = await verifyPayment({
      orderId,
      gatewayOrderId,
      gatewayPaymentId,
      gatewaySignature,
      method
    });

    if (!verification.verified) {
      return sendError(res, 400, "PAYMENT_VERIFICATION_FAILED", verification.message);
    }

    res.json({ success: true, verification });
  } catch (err) {
    console.error("Verify payment error:", err.message);
    sendError(res, 500, "SERVER_ERROR", err.message || "Failed to verify payment.");
  }
});

// POST /api/payments/webhook (Gateway async webhook handler with HMAC verification)
router.post("/webhook", express.json({ type: "*/*" }), async (req, res) => {
  try {
    const result = await handleWebhook(req.headers, req.body);
    res.json({ received: true, ...result });
  } catch (err) {
    console.error("Webhook processing error:", err.message);
    sendError(res, 400, "WEBHOOK_VERIFICATION_FAILED", err.message || "Webhook processing error.");
  }
});

export default router;
