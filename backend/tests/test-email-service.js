/**
 * FarmConnect Email Service & Gmail SMTP Verification Test Suite
 *
 * Verifies:
 * 1. Safe diagnostic status inspection (no secrets leaked).
 * 2. Safe SMTP authentication against Gmail smtp.gmail.com:465 without printing credentials.
 * 3. Successful real email delivery via Gmail SMTP.
 * 4. Provider-based switching (gmail, console fallback).
 * 5. OTP generation and dispatch integration via otpService.
 * 6. Email address normalization and safe masking.
 */

import dotenv from "dotenv";
import {
  verifySmtpConnection,
  sendEmail,
  sendOtpEmail,
  getEmailServiceStatus,
  maskEmail
} from "../services/emailService.js";
import { requestOtp, verifyOtp, normalizeContact } from "../services/otpService.js";
import { query, pool, dbInitPromise } from "../database.js";

dotenv.config();

async function runEmailServiceTests() {
  console.log("================================================================================");
  console.log("       FARMCONNECT EMAIL SERVICE & GMAIL SMTP VALIDATION TEST SUITE             ");
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

  try {
    if (dbInitPromise) await dbInitPromise;

    // =========================================================================
    // TEST 1: Safe Status & Diagnostic Inspection
    // =========================================================================
    console.log("--- 1. Safe Diagnostic Configuration Inspection ---");
    const status = getEmailServiceStatus();
    assert(status.provider === "gmail", `Email provider resolved to 'gmail' (got: ${status.provider})`);
    assert(status.gmailConfigured === true, "Gmail credentials configured in environment");

    const statusStr = JSON.stringify(status);
    const pass = (process.env.GMAIL_APP_PASSWORD || "").trim();
    assert(
      !statusStr.includes(pass) && !statusStr.includes("tytd"),
      "Sensitive App Password is NOT exposed in status diagnostics"
    );
    assert(
      status.gmailUser.includes("***@"),
      `Email is safely masked in diagnostics: ${status.gmailUser}`
    );

    // =========================================================================
    // TEST 2: Email Masking & Normalization Helper
    // =========================================================================
    console.log("\n--- 2. Email Masking & Normalization ---");
    assert(maskEmail("farmconnect226@gmail.com") === "fa***@gmail.com", "Email masking formats correctly");
    assert(maskEmail(null) === "*****", "Null email masked safely");
    assert(normalizeContact("  FarmConnect226@Gmail.COM  ") === "farmconnect226@gmail.com", "Email normalization cleans whitespace and casing");

    // =========================================================================
    // TEST 3: Safe Gmail SMTP Connection & Authentication Verification
    // =========================================================================
    console.log("\n--- 3. Gmail SMTP Connection & Authentication Verification ---");
    const verifyResult = await verifySmtpConnection();
    console.log(`   • SMTP Verification Message: ${verifyResult.message || verifyResult.error}`);
    assert(
      verifyResult.success === true,
      "Gmail SMTP connection and authentication verified successfully with smtp.gmail.com:465",
      verifyResult.error
    );

    // =========================================================================
    // TEST 4: Real Email Delivery via Gmail SMTP
    // =========================================================================
    console.log("\n--- 4. Real Email Delivery via Gmail SMTP ---");
    const targetRecipient = process.env.GMAIL_USER || "farmconnect226@gmail.com";
    const testOtp = Math.floor(100000 + Math.random() * 900000).toString();

    const emailSendResult = await sendOtpEmail({
      to: targetRecipient,
      otp: testOtp,
      purpose: "registration_verification"
    });

    assert(emailSendResult.success === true, "OTP email dispatched successfully via Gmail SMTP");
    assert(emailSendResult.provider === "gmail", "Email dispatched using 'gmail' provider");
    assert(Boolean(emailSendResult.messageId), `Valid messageId returned from Gmail: ${emailSendResult.messageId}`);

    // =========================================================================
    // TEST 5: Full End-to-End OTP Service Integration
    // =========================================================================
    console.log("\n--- 5. Full OTP Service Integration with Gmail SMTP ---");
    const otpRequestResult = await requestOtp({
      contact: targetRecipient,
      purpose: "password_reset"
    });

    assert(otpRequestResult && otpRequestResult.success === true, "requestOtp() dispatched email OTP via Gmail SMTP successfully");
    const dbOtpRecord = await query.get("SELECT * FROM otp_verifications WHERE contact = ? AND purpose = 'password_reset' ORDER BY createdAt DESC LIMIT 1", [targetRecipient]);
    assert(Boolean(dbOtpRecord && dbOtpRecord.id), "OTP verification record created in database with valid hash");

    // =========================================================================
    // TEST 6: Provider Fallback Flexibility
    // =========================================================================
    console.log("\n--- 6. Provider Flexibility (Console Mode Simulation) ---");
    const originalProvider = process.env.EMAIL_PROVIDER;
    try {
      process.env.EMAIL_PROVIDER = "console";
      const consoleSendResult = await sendEmail({
        to: "mockuser@example.com",
        subject: "FarmConnect Test Console Notification",
        html: "<p>Test notification</p>"
      });
      assert(
        consoleSendResult.success === true && consoleSendResult.provider === "console",
        "Console fallback provider operates cleanly without external network calls"
      );
    } finally {
      process.env.EMAIL_PROVIDER = originalProvider;
    }

  } catch (err) {
    console.error("Test execution exception:", err);
    failed++;
  } finally {
    try {
      if (dbInitPromise) await dbInitPromise;
      await pool.end();
    } catch (_) {}
  }

  console.log("\n================================================================================");
  console.log(`   EMAIL SERVICE VALIDATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("================================================================================\n");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runEmailServiceTests();
