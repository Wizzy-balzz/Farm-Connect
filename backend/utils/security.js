import crypto from "crypto";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("FATAL ERROR: JWT_SECRET environment variable is not set. Refusing to start without a secure secret.");
  throw new Error("JWT_SECRET environment variable is not set.");
}
const DEFAULT_EXPIRATION_SECONDS = 24 * 60 * 60; // 24 hours

/**
 * Validate password requirements
 */
export function validatePassword(password) {
  if (typeof password !== "string") {
    return { valid: false, message: "Password must be a string." };
  }
  const trimmed = password.trim();
  if (!trimmed) {
    return { valid: false, message: "Password cannot be empty or blank." };
  }
  if (password.length < 6) {
    return { valid: false, message: "Password must be at least 6 characters long." };
  }
  return { valid: true };
}

/**
 * Hash a password using PBKDF2 with SHA-512 and random salt
 */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return `pbkdf2:sha512:100000:${salt}:${hash}`;
}

/**
 * Verify password against stored hash (with legacy plaintext fallback support for smooth migration)
 */
export function verifyPassword(password, storedHash) {
  if (!password || !storedHash) {
    return { verified: false, needsRehash: false };
  }

  // Format check: pbkdf2:sha512:iterations:salt:hash
  if (storedHash.startsWith("pbkdf2:sha512:")) {
    const parts = storedHash.split(":");
    if (parts.length !== 5) {
      return { verified: false, needsRehash: false };
    }
    const iterations = parseInt(parts[2], 10);
    const salt = parts[3];
    const originalHashHex = parts[4];

    const computedHash = crypto.pbkdf2Sync(password, salt, iterations, 64, "sha512").toString("hex");
    
    const bufOriginal = Buffer.from(originalHashHex, "hex");
    const bufComputed = Buffer.from(computedHash, "hex");

    if (bufOriginal.length !== bufComputed.length) {
      return { verified: false, needsRehash: false };
    }

    const verified = crypto.timingSafeEqual(bufOriginal, bufComputed);
    return { verified, needsRehash: false };
  }

  // Legacy fallback check for unhashed initial demo/seeded passwords
  if (password === storedHash) {
    return { verified: true, needsRehash: true };
  }

  return { verified: false, needsRehash: false };
}

/**
 * Helper to encode Base64Url
 */
function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/**
 * Helper to decode Base64Url
 */
function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString("utf8");
}

/**
 * Sign JWT token using HMAC SHA-256
 */
export function signJwt(payload, secret = (process.env.JWT_SECRET || JWT_SECRET), expiresInSeconds = DEFAULT_EXPIRATION_SECONDS) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));

  const dataToSign = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(dataToSign)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Verify JWT token signature and expiration
 */
export function verifyJwt(token, secret = (process.env.JWT_SECRET || JWT_SECRET)) {
  if (!token || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(dataToSign)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSignature);

  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null; // Invalid signature
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // Expired
    }
    return payload;
  } catch {
    return null;
  }
}
