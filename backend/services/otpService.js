import crypto from "crypto";
import { query } from "../database.js";

const OTP_EXPIRY_SECONDS = parseInt(process.env.OTP_EXPIRY_SECONDS || "300", 10); // Default 5 mins
const MAX_ATTEMPTS = parseInt(process.env.MAX_OTP_ATTEMPTS || "5", 10);
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS_PER_WINDOW = 3;

/**
 * Generate a cryptographically secure 6-digit numeric OTP string
 */
export function generateNumericOtp(length = 6) {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  const num = crypto.randomInt(min, max + 1);
  return num.toString();
}

/**
 * Hash an OTP using SHA-256 with a salt
 */
export function hashOtp(otp, salt = "farmconnect_otp_salt_2026") {
  return crypto.createHmac("sha256", salt).update(otp).digest("hex");
}

/**
 * Send OTP via configured provider abstraction (Twilio / MSG91 / Console log for dev)
 */
async function dispatchOtp(contact, otp, purpose) {
  const provider = (process.env.OTP_PROVIDER || "console").toLowerCase();
  
  if (provider === "twilio") {
    // Standard Twilio SMS integration structure
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromPhone = process.env.TWILIO_PHONE_NUMBER;
    
    if (accountSid && authToken && fromPhone) {
      try {
        const body = `Your FarmConnect verification code for ${purpose} is: ${otp}. Valid for 5 minutes. Do not share it.`;
        const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
        await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
          method: "POST",
          headers: {
            "Authorization": `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: new URLSearchParams({ To: contact, From: fromPhone, Body: body })
        });
      } catch (err) {
        console.error("Twilio SMS send error:", err.message);
      }
    }
  } else if (provider === "msg91") {
    // MSG91 Indian SMS Gateway Integration
    const authKey = process.env.MSG91_AUTH_KEY;
    const templateId = process.env.MSG91_TEMPLATE_ID;
    if (authKey && templateId) {
      try {
        await fetch("https://api.msg91.com/api/v5/otp", {
          method: "POST",
          headers: {
            "authkey": authKey,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            template_id: templateId,
            mobile: contact.replace(/[^0-9]/g, ""),
            otp: otp
          })
        });
      } catch (err) {
        console.error("MSG91 SMS send error:", err.message);
      }
    }
  }

  // Development / fallback logging (in production without provider set, logs redacted note)
  if (process.env.NODE_ENV !== "production") {
    console.log(`[OTP SERVICE DEV LOG] Dispatched OTP [${otp}] to [${contact}] for [${purpose}]`);
  }
}

/**
 * Request and generate a secure OTP for a specified user and purpose
 */
export async function requestOtp({ userId, contact, purpose }) {
  if (!contact || !purpose) {
    throw new Error("Contact and purpose are required to request OTP.");
  }

  const normalizedContact = contact.trim().toLowerCase();
  const now = new Date();
  const windowStart = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS).toISOString();

  // Enforce Rate Limiting (max 3 requests per 15 minutes)
  const recentRequests = await query.get(
    `SELECT COUNT(*) as cnt FROM otp_verifications 
     WHERE contact = ? AND createdAt >= ?`,
    [normalizedContact, windowStart]
  );

  if (recentRequests && recentRequests.cnt >= MAX_REQUESTS_PER_WINDOW) {
    throw new Error("Too many OTP requests. Please wait 15 minutes before requesting again.");
  }

  // Invalidate any existing active OTPs for this contact and purpose
  await query.run(
    `UPDATE otp_verifications SET expiresAt = ? WHERE contact = ? AND purpose = ? AND verifiedAt IS NULL`,
    [now.toISOString(), normalizedContact, purpose]
  );

  // Generate OTP
  const rawOtp = generateNumericOtp(6);
  const otpHash = hashOtp(rawOtp);
  const expiresAt = new Date(now.getTime() + OTP_EXPIRY_SECONDS * 1000).toISOString();
  const id = `otp_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;

  // Store hashed OTP in database
  await query.run(
    `INSERT INTO otp_verifications (id, userId, contact, purpose, otpHash, expiresAt, attempts, verifiedAt, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, 0, NULL, ?)`,
    [id, userId || null, normalizedContact, purpose, otpHash, expiresAt, now.toISOString()]
  );

  // Dispatch OTP via provider
  await dispatchOtp(contact, rawOtp, purpose);

  return {
    success: true,
    expiresInSeconds: OTP_EXPIRY_SECONDS,
    message: `Verification code sent to ${contact}.`
  };
}

/**
 * Verify an incoming OTP for a specific user/contact and purpose
 */
export async function verifyOtp({ userId, contact, purpose, otp }) {
  if (!contact || !purpose || !otp) {
    return { valid: false, message: "Contact, purpose, and OTP code are required." };
  }

  const normalizedContact = contact.trim().toLowerCase();
  const record = await query.get(
    `SELECT * FROM otp_verifications 
     WHERE contact = ? AND purpose = ? AND verifiedAt IS NULL
     ORDER BY createdAt DESC LIMIT 1`,
    [normalizedContact, purpose]
  );

  if (!record) {
    return { valid: false, message: "No active verification code found. Please request a new code." };
  }

  const now = new Date();
  if (new Date(record.expiresAt) < now) {
    return { valid: false, message: "Verification code has expired. Please request a new code." };
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    return { valid: false, message: "Maximum verification attempts exceeded. Please request a new code." };
  }

  // Increment attempt counter
  await query.run(`UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = ?`, [record.id]);

  // Compute hash of candidate OTP
  const candidateHash = hashOtp(otp.trim());

  // Timing-safe comparison of hashes
  const bufRecord = Buffer.from(record.otpHash, "hex");
  const bufCandidate = Buffer.from(candidateHash, "hex");

  const matches = bufRecord.length === bufCandidate.length && crypto.timingSafeEqual(bufRecord, bufCandidate);

  if (!matches) {
    const remainingAttempts = MAX_ATTEMPTS - (record.attempts + 1);
    return {
      valid: false,
      message: remainingAttempts > 0 
        ? `Invalid code. ${remainingAttempts} attempts remaining.`
        : "Invalid code. Attempt limit reached."
    };
  }

  // Mark OTP as verified (single use)
  await query.run(`UPDATE otp_verifications SET verifiedAt = ? WHERE id = ?`, [now.toISOString(), record.id]);

  return { valid: true, message: "Verification successful." };
}
