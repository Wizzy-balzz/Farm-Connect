import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import crypto from "crypto";
import { query } from "../database.js";
import { sendOtpEmail, getEmailProvider } from "./emailService.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });
dotenv.config(); // fallback

const OTP_EXPIRY_SECONDS = parseInt(process.env.OTP_EXPIRY_SECONDS || "300", 10); // Default 5 mins
const MAX_ATTEMPTS = parseInt(process.env.MAX_OTP_ATTEMPTS || "5", 10);
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS_PER_WINDOW = parseInt(process.env.OTP_MAX_REQUESTS || "10", 10);

// In-memory fallback store if MySQL is offline
const memoryOtpStore = new Map();

/**
 * Standardize contact identifier (email or phone) for DB queries
 * Strips whitespace, dashes, and parentheses while preserving leading '+'
 */
export function normalizeContact(contact) {
  if (!contact) return "";
  const trimmed = contact.trim();
  if (trimmed.includes("@")) {
    return trimmed.toLowerCase();
  }
  return trimmed.replace(/[\s\-\(\)]/g, "");
}

/**
 * Mask contact for safe logging (NEVER log full mobile numbers or emails)
 */
export function maskContact(contact) {
  if (!contact) return "*****";
  const str = contact.trim();
  if (str.includes("@")) {
    const [user, domain] = str.split("@");
    return `${user.substring(0, 2)}***@${domain}`;
  }
  const clean = str.replace(/[\s\-\(\)]/g, "");
  if (clean.length <= 4) return "****";
  return `${clean.substring(0, 3)}****${clean.substring(clean.length - 3)}`;
}

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
 * Send OTP via configured provider abstraction (Gmail SMTP / Twilio / MSG91 / Fast2SMS)
 */
async function dispatchOtp(contact, otp, purpose) {
  const provider = (process.env.OTP_PROVIDER || "").toLowerCase();
  const isEmail = contact.includes("@");

  // Route email recipients through centralized emailService (Gmail SMTP / Console)
  if (isEmail) {
    return await sendOtpEmail({
      to: contact,
      otp,
      purpose
    });
  }

  // Route mobile/phone recipients through configured SMS provider or console fallback
  if (provider === "twilio") {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromPhone = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromPhone) {
      throw new Error("SMS provider not properly configured (Twilio).");
    } else {
      try {
        const body = `Your FarmConnect verification code for ${purpose} is: ${otp}. Valid for 5 minutes. Do not share it.`;
        const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
        const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
          method: "POST",
          headers: {
            "Authorization": `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: new URLSearchParams({ To: contact, From: fromPhone, Body: body })
        });
        const resData = await response.json();
        if (!response.ok) {
          throw new Error(resData.message || "Twilio dispatch failed.");
        }
      } catch (err) {
        throw err;
      }
    }
  } else if (provider === "msg91") {
    const authKey = process.env.MSG91_AUTH_KEY;
    const templateId = process.env.MSG91_TEMPLATE_ID;
    if (!authKey || !templateId) {
      throw new Error("SMS provider not properly configured (MSG91).");
    } else {
      try {
        const cleanMobile = contact.replace(/[^0-9]/g, "");
        const response = await fetch("https://api.msg91.com/api/v5/otp", {
          method: "POST",
          headers: {
            "authkey": authKey,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            template_id: templateId,
            mobile: cleanMobile,
            otp: otp
          })
        });
        const resData = await response.json();
        if (!response.ok) {
          throw new Error(resData.message || "MSG91 dispatch failed.");
        }
      } catch (err) {
        throw err;
      }
    }
  } else if (provider === "fast2sms") {
    const apiKey = process.env.FAST2SMS_API_KEY;
    if (!apiKey) {
      throw new Error("SMS provider not properly configured (Fast2SMS).");
    } else {
      try {
        const cleanMobile = contact.replace(/[^0-9]/g, "");
        const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
          method: "POST",
          headers: {
            "authorization": apiKey,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            route: "otp",
            variables_values: otp,
            numbers: cleanMobile
          })
        });
        const resData = await response.json();
        if (!response.ok) {
          throw new Error(resData.message || "Fast2SMS dispatch failed.");
        }
      } catch (err) {
        throw err;
      }
    }
  }
}

/**
 * Request and generate a secure OTP for a specified user and purpose
 */
export async function requestOtp({ userId, contact, purpose }) {
  if (!contact || !purpose) {
    throw new Error("Contact and purpose are required to request OTP.");
  }

  const normalizedContact = normalizeContact(contact);
  const masked = maskContact(contact);
  const now = new Date();
  const windowStart = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS).toISOString();

  let dbAvailable = true;
  try {
    // Enforce Rate Limiting (per 15 minutes window)
    const recentRequests = await query.get(
      `SELECT COUNT(*) as cnt FROM otp_verifications 
       WHERE contact = ? AND createdAt >= ?`,
      [normalizedContact, windowStart]
    );

    if (recentRequests && recentRequests.cnt >= MAX_REQUESTS_PER_WINDOW) {
      console.warn(`[OTP] Rate limit exceeded for contact: [${masked}]`);
      throw new Error("Too many OTP requests. Please wait a few minutes before requesting again.");
    }

    // Invalidate any existing active OTPs for this contact and purpose (generating a new code invalidates previous OTP)
    await query.run(
      `UPDATE otp_verifications SET expiresAt = ? WHERE contact = ? AND purpose = ? AND verifiedAt IS NULL`,
      [now.toISOString(), normalizedContact, purpose]
    );
  } catch (dbErr) {
    if (dbErr.message && dbErr.message.includes("Too many OTP requests")) {
      throw dbErr;
    }
    dbAvailable = false;
  }

  // Generate OTP
  const rawOtp = generateNumericOtp(6);
  const otpHash = hashOtp(rawOtp);
  const expiresAt = new Date(now.getTime() + OTP_EXPIRY_SECONDS * 1000).toISOString();
  const id = `otp_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;

  // Store hashed OTP in database or fallback in-memory store
  if (dbAvailable) {
    try {
      await query.run(
        `INSERT INTO otp_verifications (id, userId, contact, purpose, otpHash, expiresAt, attempts, verifiedAt, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, 0, NULL, ?)`,
        [id, userId || null, normalizedContact, purpose, otpHash, expiresAt, now.toISOString()]
      );
    } catch {
      dbAvailable = false;
    }
  }

  if (!dbAvailable) {
    memoryOtpStore.set(`${normalizedContact}:${purpose}`, {
      id,
      userId: userId || null,
      contact: normalizedContact,
      purpose,
      otpHash,
      expiresAt: new Date(now.getTime() + OTP_EXPIRY_SECONDS * 1000).toISOString(),
      attempts: 0,
      verifiedAt: null,
      createdAt: now.toISOString()
    });
  }

  // Dispatch OTP via configured provider (Gmail SMTP / SMS)
  let dispatchResult = null;
  try {
    dispatchResult = await dispatchOtp(normalizedContact, rawOtp, purpose);
  } catch (dispatchErr) {
    // If dispatch failed (e.g. SMTP/SMS error), clean up the un-dispatched OTP record
    if (dbAvailable) {
      await query.run(`DELETE FROM otp_verifications WHERE id = ?`, [id]).catch(() => {});
    } else {
      memoryOtpStore.delete(`${normalizedContact}:${purpose}`);
    }
    throw dispatchErr;
  }

  const isEmail = normalizedContact.includes("@");
  return {
    success: true,
    expiresInSeconds: OTP_EXPIRY_SECONDS,
    message: isEmail
      ? "OTP email sent. Please check your inbox or spam folder."
      : `Verification code sent to ${contact.trim()}.`,
    deliveryState: dispatchResult?.deliveryState || "accepted_by_smtp"
  };
}

/**
 * Verify an incoming OTP for a specific user/contact and purpose
 */
export async function verifyOtp({ userId, contact, purpose, otp }) {
  if (!contact || !purpose || !otp) {
    return { valid: false, message: "Contact, purpose, and OTP code are required." };
  }

  const normalizedContact = normalizeContact(contact);
  const masked = maskContact(contact);

  let record = null;
  let fromDb = false;

  try {
    record = await query.get(
      `SELECT * FROM otp_verifications 
       WHERE contact = ? AND purpose = ? AND verifiedAt IS NULL
       ORDER BY createdAt DESC LIMIT 1`,
      [normalizedContact, purpose]
    );
    if (record) fromDb = true;
  } catch {
    // Database unreachable, check in-memory store
  }

  if (!record) {
    const mem = memoryOtpStore.get(`${normalizedContact}:${purpose}`);
    if (mem && !mem.verifiedAt) {
      record = mem;
    }
  }

  if (!record) {
    console.warn(`[OTP] Verification failed: No active code found for contact: [${masked}]`);
    return { valid: false, message: "No active verification code found. Please request a new code." };
  }

  const now = new Date();
  if (new Date(record.expiresAt) < now) {
    console.warn(`[OTP] Verification failed: Code expired for contact: [${masked}]`);
    return { valid: false, message: "Verification code has expired. Please request a new code." };
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    console.warn(`[OTP] Verification failed: Max attempts exceeded for contact: [${masked}]`);
    return { valid: false, message: "Maximum verification attempts exceeded. Please request a new code." };
  }

  // Increment attempt counter
  record.attempts = (record.attempts || 0) + 1;
  if (fromDb) {
    await query.run(`UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = ?`, [record.id]).catch(() => {});
  }

  // Compute hash of candidate OTP
  const candidateHash = hashOtp(otp.trim());

  // Timing-safe comparison of hashes
  const bufRecord = Buffer.from(record.otpHash, "hex");
  const bufCandidate = Buffer.from(candidateHash, "hex");

  const matches = bufRecord.length === bufCandidate.length && crypto.timingSafeEqual(bufRecord, bufCandidate);

  if (!matches) {
    const remainingAttempts = MAX_ATTEMPTS - record.attempts;
    console.warn(`[OTP] Verification failed: Invalid code for contact: [${masked}]. Remaining attempts: ${Math.max(0, remainingAttempts)}`);
    return {
      valid: false,
      message: remainingAttempts > 0 
        ? `Invalid code. ${remainingAttempts} attempts remaining.`
        : "Invalid code. Attempt limit reached."
    };
  }

  // Mark OTP as verified (single use)
  record.verifiedAt = now.toISOString();
  if (fromDb) {
    await query.run(`UPDATE otp_verifications SET verifiedAt = ? WHERE id = ?`, [now.toISOString(), record.id]).catch(() => {});
  }

  console.log(`[OTP] Verification successful for contact: [${masked}]`);
  return { valid: true, message: "Verification successful." };
}

/**
 * Check whether a contact has verified OTP for a given purpose
 */
export async function isOtpVerified(contact, purpose) {
  const normalizedContact = normalizeContact(contact);
  try {
    const record = await query.get(
      `SELECT id FROM otp_verifications 
       WHERE contact = ? AND purpose = ? AND verifiedAt IS NOT NULL
       ORDER BY verifiedAt DESC LIMIT 1`,
      [normalizedContact, purpose]
    );
    if (record) return true;
  } catch {
    // Database check failed, fallback to memory
  }

  const mem = memoryOtpStore.get(`${normalizedContact}:${purpose}`);
  return Boolean(mem && mem.verifiedAt);
}

/**
 * Invalidate / consume verified OTP record upon successful registration
 */
export async function consumeVerifiedOtp(contact, purpose) {
  const normalizedContact = normalizeContact(contact);
  try {
    await query.run(
      `DELETE FROM otp_verifications WHERE contact = ? AND purpose = ?`,
      [normalizedContact, purpose]
    );
  } catch {
    // DB failure fallback
  }
  memoryOtpStore.delete(`${normalizedContact}:${purpose}`);
}

