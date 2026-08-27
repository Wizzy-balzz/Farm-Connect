import express from "express";
import { requestOtp, verifyOtp } from "../services/otpService.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

function sendError(res, statusCode, code, message) {
  return res.status(statusCode).json({
    success: false,
    error: { code, message }
  });
}

// POST /api/otp/request (Request OTP code for password change, reset, or sensitive action)
router.post("/request", async (req, res) => {
  const { contact, purpose } = req.body || {};
  let targetContact = contact;

  // If user is authenticated and no contact passed, default to user's registered email/phone
  if (!targetContact && req.user) {
    targetContact = req.user.email;
  }

  if (!targetContact || !purpose) {
    return sendError(res, 400, "INVALID_INPUT", "Contact and purpose are required to send OTP.");
  }

  const validPurposes = ["password_change", "password_reset", "order_confirmation", "sensitive_action"];
  if (!validPurposes.includes(purpose)) {
    return sendError(res, 400, "INVALID_PURPOSE", `Invalid OTP purpose. Must be one of: ${validPurposes.join(", ")}`);
  }

  try {
    const result = await requestOtp({
      userId: req.user ? req.user.id : null,
      contact: targetContact,
      purpose
    });
    res.json(result);
  } catch (err) {
    console.error("OTP request error:", err.message);
    sendError(res, 400, "OTP_REQUEST_FAILED", err.message || "Failed to generate OTP.");
  }
});

// POST /api/otp/verify (Verify 6-digit OTP code)
router.post("/verify", async (req, res) => {
  const { contact, purpose, otp } = req.body || {};
  let targetContact = contact;

  if (!targetContact && req.user) {
    targetContact = req.user.email;
  }

  if (!targetContact || !purpose || !otp) {
    return sendError(res, 400, "INVALID_INPUT", "Contact, purpose, and OTP code are required.");
  }

  try {
    const result = await verifyOtp({
      userId: req.user ? req.user.id : null,
      contact: targetContact,
      purpose,
      otp
    });

    if (!result.valid) {
      return sendError(res, 400, "OTP_VERIFICATION_FAILED", result.message);
    }

    res.json({ success: true, message: result.message });
  } catch (err) {
    console.error("OTP verify error:", err.message);
    sendError(res, 500, "SERVER_ERROR", "Internal error verifying OTP.");
  }
});

export default router;
