import express from "express";
import { createPaymentOrder, verifyPayment, handleWebhook, PaymentSecurityError } from "../services/paymentService.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

function sendError(res, statusCode, code, message) {
  return res.status(statusCode).json({
    success: false,
    error: { code, message }
  });
}

// POST /api/payments/create-order (Initialize payment gateway order with server-authoritative amount)
router.post("/create-order", requireAuth, async (req, res) => {
  const { orderId, amount, currency, method } = req.body || {};

  if (!orderId) {
    return sendError(res, 400, "INVALID_INPUT", "orderId is required to create payment order.");
  }

  try {
    const paymentOrder = await createPaymentOrder({
      orderId,
      userId: req.user?.id,
      role: req.user?.role,
      amount: amount !== undefined && amount !== null ? parseFloat(amount) : undefined,
      currency: currency || "INR",
      method: method || "upi"
    });
    res.json({ success: true, paymentOrder });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    const code = err.code || "PAYMENT_CREATION_FAILED";
    const message = statusCode < 500 ? err.message : "Internal payment creation error.";
    if (statusCode >= 500) {
      console.error("[Payment Route Error - create-order]:", err);
    }
    sendError(res, statusCode, code, message);
  }
});

// POST /api/payments/verify (Verify payment signature server-side with strict ownership)
router.post("/verify", requireAuth, async (req, res) => {
  const { orderId, gatewayOrderId, gatewayPaymentId, gatewaySignature, method } = req.body || {};

  if (!orderId) {
    return sendError(res, 400, "INVALID_INPUT", "orderId is required to verify payment.");
  }

  try {
    const verification = await verifyPayment({
      orderId,
      userId: req.user?.id,
      role: req.user?.role,
      gatewayOrderId,
      gatewayPaymentId,
      gatewaySignature,
      method
    });

    if (!verification.verified) {
      return sendError(res, 400, verification.code || "PAYMENT_VERIFICATION_FAILED", verification.message);
    }

    res.json({ success: true, verification });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    const code = err.code || "PAYMENT_VERIFICATION_ERROR";
    const message = statusCode < 500 ? err.message : "Internal error verifying payment.";
    if (statusCode >= 500) {
      console.error("[Payment Route Error - verify]:", err);
    }
    sendError(res, statusCode, code, message);
  }
});

// POST /api/payments/webhook (Gateway async webhook handler with HMAC verification)
router.post(
  "/webhook",
  express.json({
    type: "*/*",
    verify: (req, res, buf) => {
      req.rawBody = buf.toString("utf8");
    }
  }),
  async (req, res) => {
    try {
      const payload = req.rawBody || req.body;
      const result = await handleWebhook(req.headers, payload);
      res.json({ received: true, ...result });
    } catch (err) {
      const statusCode = err.statusCode || 400;
      const code = err.code || "WEBHOOK_VERIFICATION_FAILED";
      const message = statusCode < 500 ? err.message : "Webhook processing error.";
      if (statusCode >= 500) {
        console.error("[Payment Route Error - webhook]:", err);
      }
      sendError(res, statusCode, code, message);
    }
  }
);

export default router;
