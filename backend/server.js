import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, ".env") });
dotenv.config(); // fallback

import express from "express";
import cors from "cors";
import { OAuth2Client } from "google-auth-library";
import { query, pool, getDatabaseStatus } from "./database.js";
import { getAiDiagnostics } from "./ai/aiService.js";
import {
  validatePassword,
  hashPassword,
  verifyPassword,
  signJwt
} from "./utils/security.js";
import {
  requireAuth,
  requireRole,
  parseCookies
} from "./middleware/auth.js";
import {
  getCountries,
  getRegions,
  getDistricts,
  getPlaces,
  searchLocations,
  reverseGeocode
} from "./services/locationService.js";
import {
  handleSseStream,
  broadcastEventToUser,
  broadcastEventToRole
} from "./services/realtimeService.js";
import aiRouter from "./ai/aiRouter.js";
import chatRouter from "./routes/chatRouter.js";
import otpRouter from "./routes/otpRouter.js";
import paymentRouter from "./routes/paymentRouter.js";
import deliveryRouter from "./routes/deliveryRouter.js";
import trackingRouter from "./routes/trackingRouter.js";
import parcelRouter from "./routes/parcelRouter.js";
import valueAdditionRouter from "./routes/valueAdditionRouter.js";
import farmingGuideRouter from "./routes/farmingGuideRouter.js";
import { calculateDeliveryCharge } from "./services/deliveryPricingService.js";
import { verifyOtp, normalizeContact, isOtpVerified, consumeVerifiedOtp } from "./services/otpService.js";
import { verifySmtpConnection } from "./services/emailService.js";
import { translateCategory, translateUnit, translateGrade } from "./utils/controlledVocabulary.js";

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5000",
  "http://127.0.0.1:5000"
];

app.disable("x-powered-by");

// Defense-in-depth HTTP security headers middleware
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: "2mb" }));

// Custom cookie-parser middleware logic
app.use((req, res, next) => {
  req.cookies = parseCookies(req);
  next();
});

// Root & Health Monitoring Endpoints
app.get("/", (req, res) => {
  const dbStatus = getDatabaseStatus();
  res.json({
    name: "FarmConnect Secure Backend API",
    version: "2.0.0",
    status: dbStatus.connected ? "HEALTHY" : "DEGRADED",
    uptimeSeconds: Math.floor(process.uptime()),
    database: dbStatus
  });
});

app.get("/api/health", (req, res) => {
  const dbStatus = getDatabaseStatus();
  res.status(dbStatus.connected ? 200 : 503).json({
    status: dbStatus.connected ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    database: dbStatus
  });
});

// Real-Time Event Stream Endpoint (SSE)
app.get("/api/realtime/stream", requireAuth, handleSseStream);

// Mount AI Module Router
app.use("/api/ai", aiRouter);

// Mount Chat Module Router
app.use("/api/conversations", chatRouter);

// Mount Phase 3 Routers
app.use("/api/otp", otpRouter);
app.use("/api/payments", paymentRouter);
app.use("/api/delivery", deliveryRouter);
app.use("/api/orders", trackingRouter);
app.use("/api/farm/parcels", parcelRouter);
app.use("/api/value-addition", valueAdditionRouter);
app.use("/api/farming-guide", farmingGuideRouter);
app.use("/api/farm-diary", farmingGuideRouter);
app.use("/api/farm-planner", farmingGuideRouter);

// Helper for standardized error responses
function sendError(res, statusCode, code, message) {
  return res.status(statusCode).json({
    success: false,
    error: { code, message }
  });
}

function handleRouteError(res, err, defaultMsg = "An internal server error occurred.") {
  if (err && (err.code === "DATABASE_UNAVAILABLE" || err.originalCode === "ECONNREFUSED")) {
    return sendError(res, 503, "DATABASE_UNAVAILABLE", "Database connection is unreachable. Please start your MySQL service.");
  }
  return sendError(res, 500, "SERVER_ERROR", err?.message || defaultMsg);
}

function generateId(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
}

function sanitizeUser(user) {
  if (!user) return null;
  const { password, securityAnswer, ...safeUser } = user;
  return safeUser;
}

function setAuthCookie(res, token) {
  const isProd = process.env.NODE_ENV === "production";
  const cookieHeader = `fc_token=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${isProd ? "; Secure" : ""}`;
  res.setHeader("Set-Cookie", cookieHeader);
}

function clearAuthCookie(res) {
  res.setHeader("Set-Cookie", "fc_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
}

// ---------------- LOCATION ROUTES (PUBLIC) ----------------

app.get("/api/locations/countries", async (req, res) => {
  try {
    const countries = await getCountries();
    res.json(countries);
  } catch (err) {
    console.error("Fetch countries error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to fetch countries.");
  }
});

// Alias for singular /api/location/countries
app.get("/api/location/countries", async (req, res) => {
  try {
    const countries = await getCountries();
    res.json(countries);
  } catch (err) {
    console.error("Fetch countries error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to fetch countries.");
  }
});

app.get("/api/locations/regions/:countryCode", async (req, res) => {
  const { countryCode } = req.params;
  try {
    const regions = await getRegions(countryCode);
    res.json(regions);
  } catch (err) {
    console.error("Fetch regions error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to fetch regions.");
  }
});

app.get("/api/locations/districts/:countryCode/:regionCode", async (req, res) => {
  const { countryCode, regionCode } = req.params;
  try {
    const districts = await getDistricts(countryCode, regionCode);
    res.json(districts);
  } catch (err) {
    console.error("Fetch districts error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to fetch districts.");
  }
});

app.get("/api/locations/places/:countryCode/:regionCode/:districtCode", async (req, res) => {
  const { countryCode, regionCode, districtCode } = req.params;
  try {
    const places = await getPlaces(countryCode, regionCode, districtCode);
    res.json(places);
  } catch (err) {
    console.error("Fetch places error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to fetch places.");
  }
});

app.get("/api/locations/search", async (req, res) => {
  const { q, countryCode } = req.query;
  try {
    const results = await searchLocations(q || "", countryCode || "");
    res.json(results);
  } catch (err) {
    console.error("Location search error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to search locations.");
  }
});

app.get("/api/locations/reverse-geocode", async (req, res) => {
  const { lat, lng } = req.query;
  try {
    const result = await reverseGeocode(parseFloat(lat), parseFloat(lng));
    res.json(result);
  } catch (err) {
    console.error("Reverse geocode error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to reverse geocode.");
  }
});

// ---------------- AUTH ROUTES ----------------

// GET /api/auth/me - Retrieve currently authenticated user from HTTP-only session cookie
app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({
    success: true,
    user: sanitizeUser(req.user)
  });
});

// POST /api/auth/login
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return sendError(res, 400, "INVALID_INPUT", "Email and password are required.");
  }

  try {
    const user = await query.get(
      "SELECT * FROM users WHERE LOWER(email) = LOWER(?)",
      [email.trim()]
    );

    if (!user) {
      return sendError(res, 401, "INVALID_CREDENTIALS", "Invalid email or password.");
    }

    const { verified, needsRehash } = verifyPassword(password, user.password);

    if (!verified) {
      return sendError(res, 401, "INVALID_CREDENTIALS", "Invalid email or password.");
    }

    // Auto-migrate legacy plaintext password if verified
    if (needsRehash) {
      const newHash = hashPassword(password);
      await query.run("UPDATE users SET password = ? WHERE id = ?", [newHash, user.id]);
    }

    // Generate JWT and set httpOnly cookie with trusted database role
    const token = signJwt({ id: user.id, email: user.email, role: user.role });
    setAuthCookie(res, token);

    res.json({
      success: true,
      user: sanitizeUser(user)
    });
  } catch (err) {
    console.error("Login error:", err);
    handleRouteError(res, err, "Unable to sign in right now. Please try again.");
  }
});

// POST /api/auth/google - Authenticate or link user via Google OAuth ID Token
app.post("/api/auth/google", async (req, res) => {
  const { credential, role: requestedRole } = req.body || {};

  if (!credential || typeof credential !== "string") {
    return sendError(res, 400, "INVALID_INPUT", "Google ID token credential is required.");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return sendError(res, 500, "CONFIG_ERROR", "Google Client ID is not configured on the server.");
  }

  try {
    const googleClient = new OAuth2Client(clientId);
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: clientId,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      return sendError(res, 401, "INVALID_TOKEN", "Failed to decode Google ID token payload.");
    }

    const { sub: googleId, email, email_verified, name } = payload;

    // Strict validation of server-verified Google identity fields
    if (!googleId || !email || email_verified !== true) {
      return sendError(res, 401, "UNVERIFIED_ACCOUNT", "Google account email is missing or unverified.");
    }

    const normalizedEmail = email.trim().toLowerCase();

    // A. Find user by google_id
    let user = await query.get("SELECT * FROM users WHERE google_id = ?", [googleId]);

    // B. If not found by google_id, lookup by verified email
    if (!user) {
      user = await query.get("SELECT * FROM users WHERE LOWER(email) = ?", [normalizedEmail]);
      if (user) {
        // C. Safely link google_id and mark email_verified = 1, preserving existing role
        await query.run(
          "UPDATE users SET google_id = ?, email_verified = 1 WHERE id = ?",
          [googleId, user.id]
        );
        user.google_id = googleId;
        user.email_verified = 1;
      }
    }

    // D. If no existing user found in database
    if (!user) {
      // Normalize requested onboarding role ('buyer' -> 'vendor')
      const normalizedRole = requestedRole === "buyer" ? "vendor" : requestedRole;

      // Reject any attempt to claim admin or invalid roles
      if (normalizedRole && !["farmer", "vendor"].includes(normalizedRole)) {
        return sendError(res, 400, "INVALID_ROLE", "Google registration only allows farmer or buyer roles.");
      }

      if (!normalizedRole) {
        // Return clear response indicating registration / role onboarding is required
        return res.status(200).json({
          success: false,
          requiresOnboarding: true,
          error: {
            code: "REGISTRATION_REQUIRED",
            message: "No FarmConnect account found for this Google email. Please select your account type to proceed."
          },
          googleUser: {
            googleId,
            email: normalizedEmail,
            name: name || normalizedEmail.split("@")[0]
          }
        });
      }

      // Provision new non-admin user with verified Google identity
      const userId = generateId("usr");
      const createdAt = new Date().toISOString();
      await query.run(
        `INSERT INTO users (id, email, google_id, role, name, email_verified, account_status, terms_accepted, terms_accepted_at, createdAt)
         VALUES (?, ?, ?, ?, ?, 1, 'ACTIVE', 1, ?, ?)`,
        [userId, normalizedEmail, googleId, normalizedRole, name || normalizedEmail.split("@")[0], createdAt, createdAt]
      );

      user = await query.get("SELECT * FROM users WHERE id = ?", [userId]);
    }

    // Generate standard FarmConnect JWT and set HttpOnly cookie with authoritative DB role
    const token = signJwt({ id: user.id, email: user.email, role: user.role });
    setAuthCookie(res, token);

    return res.json({
      success: true,
      user: sanitizeUser(user)
    });
  } catch (err) {
    console.error("Google Auth error:", err);
    return sendError(res, 401, "INVALID_CREDENTIALS", "Google ID token verification failed: " + (err.message || "Invalid signature or audience."));
  }
});

// POST /api/auth/register
app.post("/api/auth/register", async (req, res) => {
  const {
    email,
    password,
    role,
    name,
    mobile,
    farmName,
    farmSize,
    farmingExperience,
    cropsGrown,
    primaryCrop,
    expectedQuantity,
    businessName,
    businessType,
    gstin,
    procurementCategories,
    procurementQuantity,
    countryCode,
    countryName,
    region,
    district,
    city,
    postalCode,
    address,
    lat,
    lng,
    currency,
    securityQuestion,
    securityAnswer,
    termsAccepted,
    mobileVerified,
    about
  } = req.body || {};

  if (!email || !password || !role || !name || !securityQuestion || !securityAnswer) {
    return sendError(res, 400, "INVALID_INPUT", "Email, password, role, name, security question and answer are required.");
  }

  if (termsAccepted === false) {
    return sendError(res, 400, "TERMS_REQUIRED", "You must agree to the FarmConnect Terms & Conditions and Privacy Policy.");
  }

  // Normalize role input (accept 'buyer' as 'vendor')
  const normalizedRole = role === "buyer" ? "vendor" : role;

  if (!["farmer", "vendor"].includes(normalizedRole)) {
    return sendError(res, 400, "INVALID_ROLE", "Public registration only allows farmer or buyer roles.");
  }

  const pwdValidation = validatePassword(password);
  if (!pwdValidation.valid) {
    return sendError(res, 400, "WEAK_PASSWORD", pwdValidation.message);
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const existingUser = await query.get("SELECT id FROM users WHERE LOWER(email) = ?", [normalizedEmail]);
    if (existingUser) {
      return sendError(res, 400, "EMAIL_EXISTS", "An account with this email already exists. Please sign in.");
    }

    const cleanEmail = normalizeContact(email);
    const verified = await isOtpVerified(cleanEmail, "registration_verification");
    if (!verified) {
      return sendError(res, 400, "EMAIL_UNVERIFIED", "Email OTP verification is required before creating an account. Please verify your email.");
    }
    const isEmailVerified = true;

    const prefix = normalizedRole === "farmer" ? "f" : "v";
    const id = generateId(prefix);
    const createdAt = new Date().toISOString();
    const verificationStatus = normalizedRole === "farmer" ? "Pending" : "Verified";
    const hashedPassword = hashPassword(password);

    await query.run(
      `INSERT INTO users (
        id, email, password, role, name, mobile, farmName, farmSize, farmingExperience, cropsGrown, primaryCrop, expectedQuantity,
        businessName, businessType, gstin, procurementCategories, procurementQuantity,
        countryCode, countryName, region, district, city, postalCode, address, lat, lng, currency,
        securityQuestion, securityAnswer, verificationStatus, email_verified, mobile_verified, account_status, terms_accepted, terms_accepted_at, about, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        email.trim(),
        hashedPassword,
        normalizedRole,
        name.trim(),
        mobile ? mobile.trim() : null,
        farmName ? farmName.trim() : null,
        farmSize ? farmSize.trim() : null,
        farmingExperience ? farmingExperience.trim() : null,
        cropsGrown ? cropsGrown.trim() : null,
        primaryCrop ? primaryCrop.trim() : null,
        expectedQuantity ? expectedQuantity.trim() : null,
        businessName ? businessName.trim() : null,
        businessType ? businessType.trim() : null,
        gstin ? gstin.trim() : null,
        procurementCategories ? procurementCategories.trim() : null,
        procurementQuantity ? procurementQuantity.trim() : null,
        countryCode || "IN",
        countryName || "India",
        region || null,
        district || null,
        city || null,
        postalCode || null,
        address || null,
        lat || null,
        lng || null,
        currency || "INR",
        securityQuestion,
        securityAnswer.trim().toLowerCase(),
        verificationStatus,
        isEmailVerified ? 1 : 0, // email_verified
        0, // mobile_verified
        "ACTIVE", // account_status
        1, // terms_accepted
        createdAt, // terms_accepted_at
        about || null,
        createdAt
      ]
    );

    // Invalidate consumed registration verification record
    await consumeVerifiedOtp(cleanEmail, "registration_verification");

    const newUser = await query.get("SELECT * FROM users WHERE id = ?", [id]);

    const token = signJwt({ id: newUser.id, email: newUser.email, role: newUser.role });
    setAuthCookie(res, token);

    res.status(201).json({
      success: true,
      user: sanitizeUser(newUser)
    });
  } catch (err) {
    console.error("Registration error:", err);
    handleRouteError(res, err, "Internal server error during registration.");
  }
});

// POST /api/auth/logout
app.post("/api/auth/logout", (req, res) => {
  clearAuthCookie(res);
  res.json({ success: true, message: "Logged out successfully." });
});

// POST /api/auth/verify-security
app.post("/api/auth/verify-security", async (req, res) => {
  const { email } = req.body || {};

  if (!email) {
    return sendError(res, 400, "INVALID_INPUT", "Email is required.");
  }

  try {
    const user = await query.get("SELECT securityQuestion FROM users WHERE LOWER(email) = LOWER(?)", [email.trim()]);
    if (!user) {
      return sendError(res, 404, "USER_NOT_FOUND", "No account found with this email address.");
    }
    res.json({ success: true, securityQuestion: user.securityQuestion });
  } catch (err) {
    console.error("Verify security question error:", err);
    sendError(res, 500, "SERVER_ERROR", "Internal server error.");
  }
});

// POST /api/auth/reset-password
app.post("/api/auth/reset-password", async (req, res) => {
  const { email, securityAnswer, newPassword } = req.body || {};

  if (!email || !securityAnswer || !newPassword) {
    return sendError(res, 400, "INVALID_INPUT", "Email, security answer, and new password are required.");
  }

  const pwdValidation = validatePassword(newPassword);
  if (!pwdValidation.valid) {
    return sendError(res, 400, "WEAK_PASSWORD", pwdValidation.message);
  }

  try {
    const user = await query.get("SELECT * FROM users WHERE LOWER(email) = LOWER(?)", [email.trim()]);
    if (!user) {
      return sendError(res, 404, "USER_NOT_FOUND", "Account not found.");
    }

    if (!user.securityAnswer || user.securityAnswer.trim().toLowerCase() !== securityAnswer.trim().toLowerCase()) {
      return sendError(res, 400, "INVALID_ANSWER", "Incorrect security answer.");
    }

    const hashedPassword = hashPassword(newPassword);
    await query.run("UPDATE users SET password = ? WHERE id = ?", [hashedPassword, user.id]);

    res.json({ success: true, message: "Password reset successfully. Please log in with your new password." });
  } catch (err) {
    console.error("Reset password error:", err);
    sendError(res, 500, "SERVER_ERROR", "Internal server error.");
  }
});

// POST /api/auth/reset-password-otp (OTP verified password reset)
app.post("/api/auth/reset-password-otp", async (req, res) => {
  const { email, otp, newPassword } = req.body || {};

  if (!email || !otp || !newPassword) {
    return sendError(res, 400, "INVALID_INPUT", "Email, OTP verification code, and new password are required.");
  }

  const pwdValidation = validatePassword(newPassword);
  if (!pwdValidation.valid) {
    return sendError(res, 400, "WEAK_PASSWORD", pwdValidation.message);
  }

  try {
    const user = await query.get("SELECT * FROM users WHERE LOWER(email) = LOWER(?)", [email.trim()]);
    if (!user) {
      return sendError(res, 404, "USER_NOT_FOUND", "Account not found with this email.");
    }

    const otpVerification = await verifyOtp({
      userId: user.id,
      contact: email.trim().toLowerCase(),
      purpose: "password_reset",
      otp
    });

    if (!otpVerification.valid) {
      return sendError(res, 400, "OTP_VERIFICATION_FAILED", otpVerification.message);
    }

    const hashedPassword = hashPassword(newPassword);
    await query.run("UPDATE users SET password = ? WHERE id = ?", [hashedPassword, user.id]);

    res.json({ success: true, message: "Password reset successfully via OTP. Please log in with your new password." });
  } catch (err) {
    console.error("Reset password OTP error:", err);
    sendError(res, 500, "SERVER_ERROR", "Internal server error resetting password.");
  }
});

// POST /api/auth/change-password (OTP verified authenticated password change)
app.post("/api/auth/change-password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword, otp } = req.body || {};

  if (!currentPassword || !newPassword || !otp) {
    return sendError(res, 400, "INVALID_INPUT", "Current password, new password, and OTP code are required.");
  }

  const pwdValidation = validatePassword(newPassword);
  if (!pwdValidation.valid) {
    return sendError(res, 400, "WEAK_PASSWORD", pwdValidation.message);
  }

  try {
    const user = await query.get("SELECT * FROM users WHERE id = ?", [req.user.id]);
    if (!user) {
      return sendError(res, 404, "USER_NOT_FOUND", "User account not found.");
    }

    const passwordCheck = verifyPassword(currentPassword, user.password);
    if (!passwordCheck.verified) {
      return sendError(res, 400, "INVALID_PASSWORD", "Current password is incorrect.");
    }

    const otpVerification = await verifyOtp({
      userId: user.id,
      contact: user.email,
      purpose: "password_change",
      otp
    });

    if (!otpVerification.valid) {
      return sendError(res, 400, "OTP_VERIFICATION_FAILED", otpVerification.message);
    }

    const hashedPassword = hashPassword(newPassword);
    await query.run("UPDATE users SET password = ? WHERE id = ?", [hashedPassword, user.id]);

    res.json({ success: true, message: "Password changed successfully." });
  } catch (err) {
    console.error("Change password error:", err);
    sendError(res, 500, "SERVER_ERROR", "Internal server error changing password.");
  }
});

// ---------------- USER MANAGEMENT ROUTES ----------------

// GET /api/users (Admin Only)
app.get("/api/users", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const users = await query.all("SELECT * FROM users ORDER BY createdAt DESC");
    res.json(users.map(sanitizeUser));
  } catch (err) {
    console.error("Fetch users error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to fetch users.");
  }
});

// PUT /api/users/:id (Protected: Self or Admin)
app.put("/api/users/:id", requireAuth, async (req, res) => {
  const { id } = req.params;

  if (req.user.id !== id && req.user.role !== "admin") {
    return sendError(res, 403, "FORBIDDEN", "You are not authorized to update this user profile.");
  }

  const {
    name,
    mobile,
    farmName,
    farmSize,
    farmingExperience,
    cropsGrown,
    primaryCrop,
    expectedQuantity,
    businessName,
    businessType,
    gstin,
    procurementCategories,
    procurementQuantity,
    countryCode,
    countryName,
    region,
    district,
    city,
    postalCode,
    lat,
    lng,
    currency,
    securityQuestion,
    securityAnswer,
    password,
    about
  } = req.body;

  try {
    const user = await query.get("SELECT * FROM users WHERE id = ?", [id]);
    if (!user) {
      return sendError(res, 404, "USER_NOT_FOUND", "User not found.");
    }

    const safeTrim = (val) => (typeof val === "string" ? val.trim() : val);

    let hashedPassword = user.password;
    if (password && String(password).trim() !== "") {
      const pwdValidation = validatePassword(password);
      if (!pwdValidation.valid) {
        return sendError(res, 400, "WEAK_PASSWORD", pwdValidation.message);
      }
      hashedPassword = hashPassword(password);
    }

    await query.run(
      `UPDATE users 
       SET name = ?, mobile = ?, farmName = ?, farmSize = ?, farmingExperience = ?, cropsGrown = ?, primaryCrop = ?, expectedQuantity = ?,
           businessName = ?, businessType = ?, gstin = ?, procurementCategories = ?, procurementQuantity = ?,
           countryCode = ?, countryName = ?, region = ?, district = ?, city = ?, postalCode = ?, lat = ?, lng = ?, currency = ?, securityQuestion = ?, securityAnswer = ?, password = ?, about = ?
       WHERE id = ?`,
      [
        name !== undefined && name !== null ? safeTrim(name) : user.name,
        mobile !== undefined ? safeTrim(mobile) : user.mobile,
        farmName !== undefined ? safeTrim(farmName) : user.farmName,
        farmSize !== undefined ? safeTrim(farmSize) : user.farmSize,
        farmingExperience !== undefined ? safeTrim(farmingExperience) : user.farmingExperience,
        cropsGrown !== undefined ? safeTrim(cropsGrown) : user.cropsGrown,
        primaryCrop !== undefined ? safeTrim(primaryCrop) : user.primaryCrop,
        expectedQuantity !== undefined ? safeTrim(expectedQuantity) : user.expectedQuantity,
        businessName !== undefined ? safeTrim(businessName) : user.businessName,
        businessType !== undefined ? safeTrim(businessType) : user.businessType,
        gstin !== undefined ? safeTrim(gstin) : user.gstin,
        procurementCategories !== undefined ? safeTrim(procurementCategories) : user.procurementCategories,
        procurementQuantity !== undefined ? safeTrim(procurementQuantity) : user.procurementQuantity,
        countryCode !== undefined ? countryCode : user.countryCode,
        countryName !== undefined ? countryName : user.countryName,
        region !== undefined ? safeTrim(region) : user.region,
        district !== undefined ? safeTrim(district) : user.district,
        city !== undefined ? safeTrim(city) : user.city,
        postalCode !== undefined ? safeTrim(postalCode) : user.postalCode,
        lat !== undefined && lat !== null ? parseFloat(lat) : user.lat,
        lng !== undefined && lng !== null ? parseFloat(lng) : user.lng,
        currency !== undefined ? currency : user.currency,
        securityQuestion !== undefined ? securityQuestion : user.securityQuestion,
        securityAnswer !== undefined ? safeTrim(securityAnswer).toLowerCase() : user.securityAnswer,
        hashedPassword,
        about !== undefined ? about : user.about,
        id
      ]
    );

    const updatedUser = await query.get("SELECT * FROM users WHERE id = ?", [id]);
    res.json(sanitizeUser(updatedUser));
  } catch (err) {
    console.error("Update user error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to update user profile.");
  }
});

// PUT /api/users/:id/verification (Admin Only)
app.put("/api/users/:id/verification", requireAuth, requireRole("admin"), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};

  if (!status || !["Verified", "Rejected", "Pending"].includes(status)) {
    return sendError(res, 400, "INVALID_INPUT", "Valid status ('Verified', 'Rejected', 'Pending') is required.");
  }

  try {
    await query.run("UPDATE users SET verificationStatus = ? WHERE id = ?", [status, id]);
    
    const notifId = generateId("n");
    await query.run(
      "INSERT INTO notifications (id, userId, text, type, `read`, createdAt) VALUES (?, ?, ?, 'verification', 0, ?)",
      [notifId, id, `Your account verification status has been updated to ${status}.`, new Date().toISOString()]
    );

    res.json({ success: true, message: "Verification status updated successfully." });
  } catch (err) {
    console.error("Verify user error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to update user verification.");
  }
});

// ---------------- PRODUCT ROUTES ----------------

// Helper to resolve localized product fields with fallback: selected lang -> English -> original
async function resolveProductTranslations(products, lang = "en") {
  if (!Array.isArray(products) || products.length === 0) return products;

  const productIds = products.map((p) => p.id);
  const placeholders = productIds.map(() => "?").join(",");
  const targetLangs = lang === "en" ? ["en"] : [lang, "en"];
  const langPlaceholders = targetLangs.map(() => "?").join(",");

  let translations = [];
  try {
    translations = await query.all(
      `SELECT product_id, language_code, name, description 
       FROM product_translations 
       WHERE product_id IN (${placeholders}) AND language_code IN (${langPlaceholders})`,
      [...productIds, ...targetLangs]
    );
  } catch (err) {
    console.warn("Product translations query warning:", err.message);
  }

  const transMap = new Map();
  for (const t of (translations || [])) {
    const key = `${t.product_id}_${t.language_code}`;
    transMap.set(key, t);
  }

  return products.map((p) => {
    const origName = p.name;
    const origDesc = p.description;

    // Priority fallback: selected language -> English -> original
    const targetTrans = transMap.get(`${p.id}_${lang}`);
    const enTrans = transMap.get(`${p.id}_en`);
    const resolvedTrans = targetTrans || enTrans;

    const translatedName = resolvedTrans?.name || origName;
    const translatedDesc = resolvedTrans?.description !== undefined && resolvedTrans?.description !== null && resolvedTrans?.description !== ""
      ? resolvedTrans.description
      : origDesc;

    return {
      ...p,
      originalName: origName,
      originalDescription: origDesc,
      name: translatedName,
      description: translatedDesc,
      translatedCategory: translateCategory(p.category, lang),
      translatedUnit: translateUnit(p.unit, lang),
      translatedGrade: translateGrade(p.grade, lang)
    };
  });
}

// GET /api/products (Public - with ?lang= query param support)
app.get("/api/products", async (req, res) => {
  const lang = req.query.lang || req.headers["accept-language"]?.split(",")[0]?.split("-")[0]?.toLowerCase() || "en";
  try {
    const products = await query.all("SELECT * FROM products ORDER BY createdAt DESC");
    const localized = await resolveProductTranslations(products, lang);
    res.json(localized);
  } catch (err) {
    console.error("Fetch products error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to fetch products.");
  }
});

// GET /api/products/:id (Public - with ?lang= support)
app.get("/api/products/:id", async (req, res) => {
  const { id } = req.params;
  const lang = req.query.lang || req.headers["accept-language"]?.split(",")[0]?.split("-")[0]?.toLowerCase() || "en";
  try {
    const product = await query.get("SELECT * FROM products WHERE id = ?", [id]);
    if (!product) {
      return sendError(res, 404, "PRODUCT_NOT_FOUND", "Product not found.");
    }
    const [localized] = await resolveProductTranslations([product], lang);
    res.json(localized);
  } catch (err) {
    console.error("Fetch single product error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to fetch product.");
  }
});

// GET /api/products/:id/translations (Public or Authenticated)
app.get("/api/products/:id/translations", async (req, res) => {
  const { id } = req.params;
  try {
    const product = await query.get("SELECT id, name, description FROM products WHERE id = ?", [id]);
    if (!product) {
      return sendError(res, 404, "PRODUCT_NOT_FOUND", "Product not found.");
    }
    const translations = await query.all(
      "SELECT id, product_id, language_code, name, description, created_at, updated_at FROM product_translations WHERE product_id = ? ORDER BY language_code ASC",
      [id]
    );
    res.json({
      productId: id,
      originalName: product.name,
      originalDescription: product.description,
      translations: translations || []
    });
  } catch (err) {
    console.error("Fetch translations error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to fetch product translations.");
  }
});

// POST /api/products/:id/translations (Farmer owner or Admin Only)
app.post("/api/products/:id/translations", requireAuth, requireRole("farmer", "admin"), async (req, res) => {
  const { id } = req.params;
  const { language_code, name, description } = req.body || {};

  if (!language_code || !name) {
    return sendError(res, 400, "INVALID_INPUT", "language_code and translated name are required.");
  }

  try {
    const product = await query.get("SELECT * FROM products WHERE id = ?", [id]);
    if (!product) {
      return sendError(res, 404, "PRODUCT_NOT_FOUND", "Product not found.");
    }

    if (product.farmerId !== req.user.id && req.user.role !== "admin") {
      return sendError(res, 403, "FORBIDDEN", "You are not authorized to modify translations for this product.");
    }

    const langCode = String(language_code).trim().toLowerCase();
    const transId = `pt_${id}_${langCode}`;
    const nowIso = new Date().toISOString();

    await query.run(
      `INSERT INTO product_translations (id, product_id, language_code, name, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), updated_at = VALUES(updated_at)`,
      [transId, id, langCode, name.trim(), description || "", nowIso, nowIso]
    );

    const saved = await query.get("SELECT * FROM product_translations WHERE id = ?", [transId]);
    res.status(200).json({ success: true, translation: saved });
  } catch (err) {
    console.error("Save product translation error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to save product translation.");
  }
});

// DELETE /api/products/:id/translations/:lang (Farmer owner or Admin Only)
app.delete("/api/products/:id/translations/:lang", requireAuth, requireRole("farmer", "admin"), async (req, res) => {
  const { id, lang } = req.params;
  try {
    const product = await query.get("SELECT * FROM products WHERE id = ?", [id]);
    if (!product) {
      return sendError(res, 404, "PRODUCT_NOT_FOUND", "Product not found.");
    }

    if (product.farmerId !== req.user.id && req.user.role !== "admin") {
      return sendError(res, 403, "FORBIDDEN", "You are not authorized to delete translations for this product.");
    }

    await query.run("DELETE FROM product_translations WHERE product_id = ? AND language_code = ?", [id, lang.toLowerCase()]);
    res.json({ success: true, message: `Translation for language '${lang}' deleted successfully.` });
  } catch (err) {
    console.error("Delete product translation error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to delete product translation.");
  }
});

// POST /api/products (Farmer or Admin Only)
app.post("/api/products", requireAuth, requireRole("farmer", "admin"), async (req, res) => {
  const { name, category, grade, price, currency, unit, stock, description, imageUrl, moq, tierPrices, organic, harvestDate, value_added_product_id } = req.body || {};

  if (!name || !category || price === undefined || !unit || stock === undefined) {
    return sendError(res, 400, "INVALID_INPUT", "Required fields: name, category, price, unit, stock.");
  }

  if (typeof price !== "number" || price <= 0) {
    return sendError(res, 400, "INVALID_INPUT", "Price must be a positive number.");
  }

  if (!Number.isInteger(stock) || stock < 0) {
    return sendError(res, 400, "INVALID_INPUT", "Stock must be a non-negative integer.");
  }

  const farmerId = req.user.id; // Backend authoritative farmer identity
  const id = generateId("p");
  const createdAt = new Date().toISOString();

  try {
    const farmer = await query.get("SELECT countryCode, region, district, city, lat, lng, currency FROM users WHERE id = ?", [farmerId]);

    await query.run(
      `INSERT INTO products (id, name, category, grade, price, currency, unit, stock, farmerId, countryCode, region, district, city, lat, lng, description, imageUrl, moq, tierPrices, organic, harvestDate, value_added_product_id, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        name.trim(),
        category.trim(),
        grade || "A",
        price,
        currency || (farmer ? farmer.currency : "INR"),
        unit,
        stock,
        farmerId,
        farmer ? farmer.countryCode : "IN",
        farmer ? farmer.region : "Maharashtra",
        farmer ? farmer.district : "Nashik",
        farmer ? farmer.city : "Nashik",
        farmer && farmer.lat ? farmer.lat : 19.9975,
        farmer && farmer.lng ? farmer.lng : 73.7898,
        description || "",
        imageUrl || "",
        moq || 10,
        tierPrices || "{}",
        organic ? 1 : 0,
        harvestDate || null,
        value_added_product_id || null,
        createdAt
      ]
    );

    const newProduct = await query.get("SELECT * FROM products WHERE id = ?", [id]);
    res.status(201).json(newProduct);
  } catch (err) {
    console.error("Create product error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to create product.");
  }
});

// PUT /api/products/:id (Farmer ownership or Admin)
app.put("/api/products/:id", requireAuth, requireRole("farmer", "admin"), async (req, res) => {
  const { id } = req.params;

  try {
    const product = await query.get("SELECT * FROM products WHERE id = ?", [id]);
    if (!product) {
      return sendError(res, 404, "PRODUCT_NOT_FOUND", "Product not found.");
    }

    if (product.farmerId !== req.user.id && req.user.role !== "admin") {
      return sendError(res, 403, "FORBIDDEN", "You are not authorized to edit this product.");
    }

    const { name, category, grade, price, currency, unit, stock, countryCode, region, district, city, lat, lng, description, imageUrl, moq, tierPrices, organic, harvestDate, value_added_product_id } = req.body;

    await query.run(
      `UPDATE products 
       SET name = ?, category = ?, grade = ?, price = ?, currency = ?, unit = ?, stock = ?, countryCode = ?, region = ?, district = ?, city = ?, lat = ?, lng = ?, description = ?, imageUrl = ?, moq = ?, tierPrices = ?, organic = ?, harvestDate = ?, value_added_product_id = ?
       WHERE id = ?`,
      [
        name !== undefined ? name : product.name,
        category !== undefined ? category : product.category,
        grade !== undefined ? grade : product.grade,
        price !== undefined ? price : product.price,
        currency !== undefined ? currency : product.currency,
        unit !== undefined ? unit : product.unit,
        stock !== undefined ? stock : product.stock,
        countryCode !== undefined ? countryCode : product.countryCode,
        region !== undefined ? region : product.region,
        district !== undefined ? district : product.district,
        city !== undefined ? city : product.city,
        lat !== undefined && lat !== null ? parseFloat(lat) : product.lat,
        lng !== undefined && lng !== null ? parseFloat(lng) : product.lng,
        description !== undefined ? description : product.description,
        imageUrl !== undefined ? imageUrl : product.imageUrl,
        moq !== undefined ? moq : product.moq,
        tierPrices !== undefined ? tierPrices : product.tierPrices,
        organic !== undefined ? (organic ? 1 : 0) : product.organic,
        harvestDate !== undefined ? harvestDate : product.harvestDate,
        value_added_product_id !== undefined ? value_added_product_id : product.value_added_product_id,
        id
      ]
    );

    const updatedProduct = await query.get("SELECT * FROM products WHERE id = ?", [id]);
    res.json(updatedProduct);
  } catch (err) {
    console.error("Update product error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to update product.");
  }
});

// DELETE /api/products/:id (Farmer ownership or Admin)
app.delete("/api/products/:id", requireAuth, requireRole("farmer", "admin"), async (req, res) => {
  const { id } = req.params;

  try {
    const product = await query.get("SELECT * FROM products WHERE id = ?", [id]);
    if (!product) {
      return sendError(res, 404, "PRODUCT_NOT_FOUND", "Product not found.");
    }

    if (product.farmerId !== req.user.id && req.user.role !== "admin") {
      return sendError(res, 403, "FORBIDDEN", "You are not authorized to delete this product.");
    }

    await query.run("DELETE FROM products WHERE id = ?", [id]);
    res.json({ success: true, message: "Product deleted successfully.", id });
  } catch (err) {
    console.error("Delete product error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to delete product.");
  }
});

// ---------------- ORDER ROUTES ----------------

// GET /api/orders (Protected: Admin sees all, Farmer/Vendor see their own)
app.get("/api/orders", requireAuth, async (req, res) => {
  try {
    let sql = `
      SELECT 
        o.id as id,
        o.vendorId,
        o.vendorName,
        o.deliveryCountry,
        o.deliveryRegion,
        o.deliveryDistrict,
        o.deliveryCity,
        o.deliveryPostalCode,
        o.deliveryAddress,
        o.paymentMethod,
        o.totalAmount,
        o.currency,
        o.status,
        o.createdAt,
        oi.productId,
        oi.farmerId,
        oi.qty,
        oi.amount,
        oi.unitPrice,
        oi.id as itemId
      FROM orders o
      JOIN order_items oi ON o.id = oi.orderId
    `;
    const params = [];

    if (req.user.role === "vendor") {
      sql += " WHERE o.vendorId = ?";
      params.push(req.user.id);
    } else if (req.user.role === "farmer") {
      sql += " WHERE oi.farmerId = ?";
      params.push(req.user.id);
    }

    sql += " ORDER BY o.createdAt DESC";

    const joinedOrders = await query.all(sql, params);
    res.json(joinedOrders);
  } catch (err) {
    console.error("Fetch orders error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to fetch orders.");
  }
});

// POST /api/orders (Vendor B2B Checkout - ATOMIC TRANSACTION + AUTHORITATIVE VALIDATION)
app.post("/api/orders", requireAuth, requireRole("vendor", "admin"), async (req, res) => {
  const {
    deliveryCountry,
    deliveryRegion,
    deliveryDistrict,
    deliveryCity,
    deliveryPostalCode,
    deliveryAddress,
    paymentMethod,
    currency,
    items
  } = req.body || {};

  if (!items || !Array.isArray(items) || items.length === 0) {
    return sendError(res, 400, "INVALID_INPUT", "Order items array must not be empty.");
  }

  // Authoritative vendor identity from backend authentication
  const vendorId = req.user.id;
  const vendorName = req.user.name;

  // Step 1: Pre-validation of products, quantities, MOQs, and stock availability BEFORE transaction
  const validatedItems = [];
  let calculatedTotalAmount = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const productId = item.productId;
    const qty = parseInt(item.qty, 10);

    if (!productId) {
      return sendError(res, 400, "INVALID_INPUT", `Item at position ${i + 1} is missing productId.`);
    }

    if (isNaN(qty) || qty <= 0) {
      return sendError(res, 400, "INVALID_QUANTITY", `Item quantity must be a positive integer.`);
    }

    // Look up trusted product data from database
    const product = await query.get("SELECT * FROM products WHERE id = ?", [productId]);
    if (!product) {
      return sendError(res, 404, "PRODUCT_NOT_FOUND", `Product with ID ${productId} was not found.`);
    }

    // MOQ Validation
    const minMoq = product.moq || 1;
    if (qty < minMoq) {
      return sendError(
        res,
        400,
        "MOQ_NOT_MET",
        `Quantity for '${product.name}' (${qty} ${product.unit}) is below minimum order quantity (MOQ: ${minMoq} ${product.unit}).`
      );
    }

    // Stock Validation (Problem 5: Strict check, rejection without clamping)
    if (qty > product.stock) {
      return sendError(
        res,
        409,
        "INSUFFICIENT_STOCK",
        `Insufficient stock for '${product.name}'. Only ${product.stock} ${product.unit} is currently available.`
      );
    }

    // Calculate server-side authoritative price and line total (supporting B2B tier prices)
    let unitPrice = product.price;
    if (product.tierPrices) {
      try {
        const tiers = JSON.parse(product.tierPrices);
        const sortedThresholds = Object.keys(tiers).map(Number).sort((a, b) => b - a);
        for (const threshold of sortedThresholds) {
          if (qty >= threshold) {
            unitPrice = tiers[threshold];
            break;
          }
        }
      } catch {
        /* fallback to base price */
      }
    }

    const itemAmount = qty * unitPrice;
    calculatedTotalAmount += itemAmount;

    validatedItems.push({
      product,
      qty,
      unitPrice,
      itemAmount,
      farmerId: product.farmerId
    });
  }

  const orderId = `FC-${Math.floor(Math.random() * 90000 + 10000)}`;
  const createdAt = new Date().toISOString();

  // Server-side authoritative road distance and delivery charge calculation
  let firstFarmerLat = 19.9975, firstFarmerLng = 73.7898;
  if (validatedItems[0]?.product?.lat && validatedItems[0]?.product?.lng) {
    firstFarmerLat = validatedItems[0].product.lat;
    firstFarmerLng = validatedItems[0].product.lng;
  } else if (validatedItems[0]?.farmerId) {
    const farmer = await query.get("SELECT lat, lng FROM users WHERE id = ?", [validatedItems[0].farmerId]);
    if (farmer && farmer.lat && farmer.lng) {
      firstFarmerLat = farmer.lat;
      firstFarmerLng = farmer.lng;
    }
  }

  const destLat = req.body.deliveryLat ? parseFloat(req.body.deliveryLat) : 19.076;
  const destLng = req.body.deliveryLng ? parseFloat(req.body.deliveryLng) : 72.8777;

  const deliveryInfo = await calculateDeliveryCharge({
    originLat: firstFarmerLat,
    originLng: firstFarmerLng,
    destLat,
    destLng,
    orderValue: calculatedTotalAmount
  });

  const subtotal = calculatedTotalAmount;
  const deliveryCharge = deliveryInfo.deliveryCharge;
  const grandTotal = subtotal + deliveryCharge;
  const initialPaymentStatus = paymentMethod === "cod" ? "COD" : "PENDING_PAYMENT";

  // Step 2: Atomic MySQL Transaction Execution
  let conn = null;
  try {
    conn = await query.beginTransaction();

    // 1. Insert Group Order
    await query.run(
      `INSERT INTO orders (id, vendorId, vendorName, deliveryCountry, deliveryRegion, deliveryDistrict, deliveryCity, deliveryPostalCode, deliveryAddress, deliveryLat, deliveryLng, paymentMethod, totalAmount, subtotal, deliveryCharge, deliveryDistanceKm, deliveryEtaMinutes, paymentStatus, currency, status, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Order Placed', ?)`,
      [
        orderId,
        vendorId,
        vendorName,
        deliveryCountry || "India",
        deliveryRegion || null,
        deliveryDistrict || null,
        deliveryCity || null,
        deliveryPostalCode || null,
        deliveryAddress || null,
        destLat,
        destLng,
        paymentMethod || "cod",
        grandTotal,
        subtotal,
        deliveryCharge,
        deliveryInfo.distanceKm,
        deliveryInfo.etaMinutes,
        initialPaymentStatus,
        currency || "INR",
        createdAt
      ],
      conn
    );

    // 1b. Seed initial 'Order Placed' tracking event
    const initTrackingId = generateId("trk");
    await query.run(
      `INSERT INTO order_tracking_events (id, order_id, status, location, latitude, longitude, description, timestamp, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        initTrackingId,
        orderId,
        "Order Placed",
        deliveryCity || deliveryDistrict || deliveryRegion || "Order Received",
        destLat,
        destLng,
        `Order confirmed and placed by buyer for delivery to ${deliveryAddress || deliveryCity || "destination"}.`,
        createdAt,
        vendorId
      ],
      conn
    );

    // 2. Insert Order Items and Update Product Inventory
    for (let i = 0; i < validatedItems.length; i++) {
      const vItem = validatedItems[i];
      const itemId = `${orderId}-${i + 1}`;

      // Insert Order Item
      await query.run(
        `INSERT INTO order_items (id, orderId, productId, farmerId, qty, unitPrice, amount)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [itemId, orderId, vItem.product.id, vItem.farmerId, vItem.qty, vItem.unitPrice, vItem.itemAmount],
        conn
      );

      // Atomic Inventory Reduction (Problem 5: Strict atomic condition)
      const stockResult = await query.run(
        "UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?",
        [vItem.qty, vItem.product.id, vItem.qty],
        conn
      );

      if (stockResult.changes !== 1) {
        // Stock changed concurrently during checkout -> force transaction rollback
        throw new Error(`STOCK_CONFLICT:${vItem.product.name}`);
      }

      // Create notification for farmer
      if (vItem.farmerId) {
        const notifId = generateId("n");
        const notifText = `New B2B Order ${orderId} received for ${vItem.qty} ${vItem.product.unit} of ${vItem.product.name} from ${vendorName}`;
        await query.run(
          `INSERT INTO notifications (id, userId, text, type, \`read\`, createdAt)
           VALUES (?, ?, ?, 'order', 0, ?)`,
          [notifId, vItem.farmerId, notifText, createdAt],
          conn
        );
      }
    }

    // All operations succeeded -> COMMIT
    await query.commit(conn);
    conn = null;

    // Broadcast real-time events to farmers
    for (const vItem of validatedItems) {
      if (vItem.farmerId) {
        broadcastEventToUser(vItem.farmerId, "new_order", {
          orderId,
          productName: vItem.product.name,
          qty: vItem.qty,
          unit: vItem.product.unit,
          vendorName,
          amount: vItem.itemAmount
        });

        // Low stock warning broadcast
        const updatedP = await query.get("SELECT stock, moq, name FROM products WHERE id = ?", [vItem.product.id]);
        if (updatedP && updatedP.stock <= (updatedP.moq || 10)) {
          broadcastEventToUser(vItem.farmerId, "low_stock", {
            productId: vItem.product.id,
            productName: updatedP.name,
            remainingStock: updatedP.stock
          });
        }
      }
    }

    // Fetch joined order rows to return to frontend
    const createdJoined = await query.all(`
      SELECT o.*, oi.productId, oi.farmerId, oi.qty, oi.amount, oi.unitPrice, oi.id as itemId
      FROM orders o JOIN order_items oi ON o.id = oi.orderId
      WHERE o.id = ?
    `, [orderId]);

    res.status(201).json(createdJoined);
  } catch (err) {
    // Rollback transaction on ANY failure to maintain database integrity
    if (conn) {
      try {
        await query.rollback(conn);
      } catch {
        /* ignore rollback error if already inactive */
      }
    }

    if (err.message && err.message.startsWith("STOCK_CONFLICT:")) {
      const pName = err.message.split(":")[1];
      return sendError(res, 409, "INSUFFICIENT_STOCK", `Stock for '${pName}' was updated by another user during checkout. Please retry.`);
    }

    console.error("Atomic order checkout transaction error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to place order due to a transaction error.");
  }
});

// PUT /api/orders/:id (Status update with auth check)
app.put("/api/orders/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};

  const VALID_ORDER_STATUSES = [
    "Order Placed",
    "Order Confirmed",
    "Confirmed",
    "Pending",
    "Processing",
    "Packed",
    "Dispatched",
    "Shipped",
    "In Transit",
    "Reached Destination Hub",
    "Out for Delivery",
    "Delivered",
    "Cancelled"
  ];

  if (!status || !VALID_ORDER_STATUSES.includes(status)) {
    return sendError(res, 400, "INVALID_INPUT", `Valid status is required. Allowed: ${VALID_ORDER_STATUSES.join(", ")}`);
  }

  try {
    const order = await query.get("SELECT * FROM orders WHERE id = ?", [id]);
    if (!order) {
      return sendError(res, 404, "ORDER_NOT_FOUND", "Order not found.");
    }

    // Check authorization: Admin, order vendor, or farmer of any item in order
    let isAuthorized = req.user.role === "admin" || order.vendorId === req.user.id;
    if (!isAuthorized && req.user.role === "farmer") {
      const farmerItem = await query.get("SELECT id FROM order_items WHERE orderId = ? AND farmerId = ? LIMIT 1", [id, req.user.id]);
      if (farmerItem) isAuthorized = true;
    }

    if (!isAuthorized) {
      return sendError(res, 403, "FORBIDDEN", "You are not authorized to update this order.");
    }

    await query.run("UPDATE orders SET status = ? WHERE id = ?", [status, id]);

    // Record tracking event in order_tracking_events
    const trkId = generateId("trk");
    const trkLocation = req.body.location || order.deliveryCity || order.deliveryDistrict || order.deliveryRegion || "Transit Checkpoint";
    const trkLat = req.body.latitude !== undefined && req.body.latitude !== null ? parseFloat(req.body.latitude) : order.deliveryLat;
    const trkLng = req.body.longitude !== undefined && req.body.longitude !== null ? parseFloat(req.body.longitude) : order.deliveryLng;
    const trkDesc = req.body.description || `Order status updated to ${status}.`;
    await query.run(
      `INSERT INTO order_tracking_events (id, order_id, status, location, latitude, longitude, description, timestamp, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [trkId, id, status, trkLocation, trkLat, trkLng, trkDesc, new Date().toISOString(), req.user.id]
    );

    // Create notification and broadcast real-time event for vendor
    if (order.vendorId) {
      const notifId = generateId("n");
      const notifText = `Order ${id} status updated to ${status}`;
      await query.run(
        `INSERT INTO notifications (id, userId, text, type, \`read\`, createdAt)
         VALUES (?, ?, ?, 'order', 0, ?)`,
        [notifId, order.vendorId, notifText, new Date().toISOString()]
      );

      broadcastEventToUser(order.vendorId, "order_status_change", {
        orderId: id,
        status
      });
    }

    // Broadcast real-time event to farmers involved in the order
    const orderItems = await query.all("SELECT DISTINCT farmerId FROM order_items WHERE orderId = ?", [id]);
    for (const item of orderItems) {
      if (item.farmerId) {
        broadcastEventToUser(item.farmerId, "order_status_change", {
          orderId: id,
          status
        });
      }
    }

    // If marked Delivered, increment completedOrders counter
    if (status === "Delivered") {
      for (const item of orderItems) {
        if (item.farmerId) {
          await query.run("UPDATE users SET completedOrders = completedOrders + 1 WHERE id = ?", [item.farmerId]);
        }
      }
    }

    const updatedJoined = await query.get(`
      SELECT o.*, oi.productId, oi.farmerId, oi.qty, oi.amount, oi.unitPrice, oi.id as itemId
      FROM orders o JOIN order_items oi ON o.id = oi.orderId
      WHERE o.id = ? LIMIT 1
    `, [id]);

    res.json(updatedJoined);
  } catch (err) {
    console.error("Update order error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to update order status.");
  }
});

// ---------------- NOTIFICATION ROUTES ----------------

// GET /api/notifications (Strictly for authenticated user)
app.get("/api/notifications", requireAuth, async (req, res) => {
  try {
    // Determine target userId: Users can only see their own notifications; Admin can specify query userId
    const targetUserId = (req.user.role === "admin" && req.query.userId) ? req.query.userId : req.user.id;

    const notifications = await query.all(
      "SELECT * FROM notifications WHERE userId = ? ORDER BY createdAt DESC",
      [targetUserId]
    );

    const mapped = notifications.map(n => ({
      ...n,
      read: !!n.read
    }));

    res.json(mapped);
  } catch (err) {
    console.error("Fetch notifications error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to fetch notifications.");
  }
});

// POST /api/notifications (System or Admin)
app.post("/api/notifications", requireAuth, async (req, res) => {
  const { userId, text, type } = req.body || {};

  if (!userId || !text) {
    return sendError(res, 400, "INVALID_INPUT", "userId and notification text are required.");
  }

  if (req.user.role !== "admin" && userId !== req.user.id) {
    return sendError(res, 403, "FORBIDDEN", "You can only create notifications for yourself.");
  }

  const id = generateId("n");
  const createdAt = new Date().toISOString();

  try {
    await query.run(
      `INSERT INTO notifications (id, userId, text, type, \`read\`, createdAt)
       VALUES (?, ?, ?, ?, 0, ?)`,
      [id, userId, text, type || "system", createdAt]
    );

    const newNotif = await query.get("SELECT * FROM notifications WHERE id = ?", [id]);
    newNotif.read = !!newNotif.read;
    res.status(201).json(newNotif);
  } catch (err) {
    console.error("Create notification error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to create notification.");
  }
});

// PUT /api/notifications/read-all
app.put("/api/notifications/read-all", requireAuth, async (req, res) => {
  try {
    await query.run("UPDATE notifications SET `read` = 1 WHERE userId = ?", [req.user.id]);
    res.json({ success: true, message: "All notifications marked as read." });
  } catch (err) {
    console.error("Read all notifications error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to mark notifications read.");
  }
});

// PUT /api/notifications/:id/read
app.put("/api/notifications/:id/read", requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    await query.run("UPDATE notifications SET `read` = 1 WHERE id = ? AND userId = ?", [id, req.user.id]);
    res.json({ success: true, message: "Notification marked as read.", id });
  } catch (err) {
    console.error("Read notification error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to mark notification read.");
  }
});

// ---------------- REVIEWS ROUTES ----------------

// GET /api/reviews (Public)
app.get("/api/reviews", async (req, res) => {
  const { productId, farmerId } = req.query;

  try {
    let reviews;
    if (productId) {
      reviews = await query.all(
        "SELECT * FROM reviews WHERE productId = ? AND status = 'Approved' ORDER BY createdAt DESC",
        [productId]
      );
    } else if (farmerId) {
      reviews = await query.all(
        "SELECT * FROM reviews WHERE farmerId = ? AND productId IS NULL AND status = 'Approved' ORDER BY createdAt DESC",
        [farmerId]
      );
    } else {
      reviews = await query.all("SELECT * FROM reviews WHERE status = 'Approved' ORDER BY createdAt DESC");
    }
    res.json(reviews);
  } catch (err) {
    console.error("Fetch reviews error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to fetch reviews.");
  }
});

// POST /api/reviews (Vendor Only)
app.post("/api/reviews", requireAuth, requireRole("vendor", "admin"), async (req, res) => {
  const { productId, farmerId, rating, comment } = req.body || {};

  if (!farmerId || !rating || !comment) {
    return sendError(res, 400, "INVALID_INPUT", "Required fields: farmerId, rating, comment.");
  }

  const vendorId = req.user.id;
  const vendorName = req.user.name;
  const id = generateId("r");
  const createdAt = new Date().toISOString();

  try {
    let verifiedPurchase = 0;
    const pastOrder = await query.get(
      `SELECT oi.id FROM order_items oi 
       JOIN orders o ON oi.orderId = o.id 
       WHERE o.vendorId = ? AND oi.farmerId = ? AND o.status = 'Delivered' LIMIT 1`,
      [vendorId, farmerId]
    );
    if (pastOrder) verifiedPurchase = 1;

    await query.run(
      `INSERT INTO reviews (id, productId, farmerId, vendorId, vendorName, rating, comment, verifiedPurchase, status, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Approved', ?)`,
      [id, productId || null, farmerId, vendorId, vendorName, parseInt(rating, 10), comment, verifiedPurchase, createdAt]
    );

    const average = await query.get("SELECT AVG(rating) as avgRating FROM reviews WHERE farmerId = ? AND status = 'Approved'", [farmerId]);
    if (average && average.avgRating !== null && average.avgRating !== undefined) {
      await query.run("UPDATE users SET rating = ? WHERE id = ?", [parseFloat(parseFloat(average.avgRating).toFixed(1)), farmerId]);
    }

    const newReview = await query.get("SELECT * FROM reviews WHERE id = ?", [id]);
    res.status(201).json(newReview);
  } catch (err) {
    console.error("Create review error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to submit review.");
  }
});

// DELETE /api/reviews/:id (Admin Only)
app.delete("/api/reviews/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const { id } = req.params;

  try {
    await query.run("DELETE FROM reviews WHERE id = ?", [id]);
    res.json({ success: true, message: "Review removed successfully." });
  } catch (err) {
    console.error("Delete review error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to delete review.");
  }
});

// ---------------- REPORTS & ANALYTICS ROUTES ----------------

// GET /api/reports/farmer/:farmerId (Farmer Self or Admin)
app.get("/api/reports/farmer/:farmerId", requireAuth, async (req, res) => {
  const { farmerId } = req.params;

  if (req.user.id !== farmerId && req.user.role !== "admin") {
    return sendError(res, 403, "FORBIDDEN", "You are not authorized to view these reports.");
  }

  try {
    const stats = await query.get(
      `SELECT 
        SUM(amount) as totalRevenue,
        COUNT(DISTINCT orderId) as totalOrders,
        SUM(qty) as totalQty
       FROM order_items 
       WHERE farmerId = ?`,
      [farmerId]
    );

    const productPerformance = await query.all(
      `SELECT p.name, SUM(oi.qty) as unitsSold, SUM(oi.amount) as revenue
       FROM order_items oi
       JOIN products p ON oi.productId = p.id
       WHERE oi.farmerId = ?
       GROUP BY oi.productId
       ORDER BY revenue DESC`,
      [farmerId]
    );

    res.json({
      revenue: stats ? (stats.totalRevenue || 0) : 0,
      orders: stats ? (stats.totalOrders || 0) : 0,
      quantitySold: stats ? (stats.totalQty || 0) : 0,
      productPerformance
    });
  } catch (err) {
    console.error("Fetch farmer report error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to load reports data.");
  }
});

// ---------------- TRANSLATION ROUTE ----------------

const translationCache = new Map();

const SERVER_FALLBACK_DICT = {
  ta: {
    "Dashboard": "டாஷ்போர்டு",
    "Settings": "அமைப்புகள்",
    "Add Product": "தயாரிப்பைச் சேர்",
    "Edit Product": "தயாரிப்பைத் திருத்து",
    "Delete Product": "தயாரிப்பை நீக்கு",
    "Save": "சேமி",
    "Cancel": "ரத்து செய்",
    "Logout": "வெளியேறு",
    "Farmers": "விவசாயிகள்",
    "Buyers": "வாங்குபவர்கள்",
    "Products": "தயாரிப்புகள்",
    "Orders": "ஆர்டர்கள்",
    "Search": "தேடு",
    "Loading...": "ஏற்றுகிறது...",
    "Price": "விலை",
    "Quantity": "அளவு"
  },
  hi: {
    "Dashboard": "डैशबोर्ड",
    "Settings": "सेटिंग्स",
    "Add Product": "उत्पाद जोड़ें",
    "Edit Product": "उत्पाद संपादित करें",
    "Delete Product": "उत्पाद हटाएँ",
    "Save": "सहेजें",
    "Cancel": "रद्द करें",
    "Logout": "लॉग आउट",
    "Farmers": "किसान",
    "Buyers": "खरीदार",
    "Products": "उत्पाद",
    "Orders": "ऑर्डर",
    "Search": "खोजें",
    "Loading...": "लोड हो रहा है...",
    "Price": "मूल्य",
    "Quantity": "मात्रा"
  }
};

app.post("/api/translate", async (req, res) => {
  const { texts, sourceLanguage = "en", targetLanguage = "ta" } = req.body || {};

  if (!texts || !Array.isArray(texts) || texts.length === 0) {
    return sendError(res, 400, "INVALID_INPUT", "Required: texts must be a non-empty array of strings.");
  }

  if (sourceLanguage === targetLanguage) {
    return res.json({ translations: texts });
  }

  const results = new Array(texts.length);
  const unCachedIndices = [];
  const unCachedTexts = [];

  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];
    const cacheKey = `${sourceLanguage}:${targetLanguage}:${text}`;
    if (translationCache.has(cacheKey)) {
      results[i] = translationCache.get(cacheKey);
    } else {
      unCachedIndices.push(i);
      unCachedTexts.push(text);
    }
  }

  if (unCachedTexts.length === 0) {
    return res.json({ translations: results });
  }

  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.GOOGLE_PROJECT_ID || process.env.PROJECT_ID;
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;

  let gcpTranslatedTexts = null;

  if (projectId) {
    try {
      const url = `https://translation.googleapis.com/v3/projects/${projectId}/locations/global:translateText${apiKey ? `?key=${apiKey}` : ""}`;
      
      const requestBody = {
        sourceLanguageCode: sourceLanguage,
        targetLanguageCode: targetLanguage,
        contents: unCachedTexts,
        mimeType: "text/plain"
      };

      const headers = { "Content-Type": "application/json" };
      if (process.env.GOOGLE_ACCESS_TOKEN) {
        headers["Authorization"] = `Bearer ${process.env.GOOGLE_ACCESS_TOKEN}`;
      }

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const data = await response.json();
        if (data.translations && Array.isArray(data.translations)) {
          gcpTranslatedTexts = data.translations.map(t => t.translatedText);
        }
      } else {
        const errText = await response.text();
        console.warn("GCP Translation API v3 notice:", response.status, errText);
      }
    } catch (err) {
      console.warn("GCP Translation API request failed, falling back to local dictionary:", err.message);
    }
  }

  for (let idx = 0; idx < unCachedTexts.length; idx++) {
    const origText = unCachedTexts[idx];
    const targetIdx = unCachedIndices[idx];
    let translated = null;

    if (gcpTranslatedTexts && gcpTranslatedTexts[idx]) {
      translated = gcpTranslatedTexts[idx];
    } else if (SERVER_FALLBACK_DICT[targetLanguage] && SERVER_FALLBACK_DICT[targetLanguage][origText]) {
      translated = SERVER_FALLBACK_DICT[targetLanguage][origText];
    } else {
      translated = origText;
    }

    const cacheKey = `${sourceLanguage}:${targetLanguage}:${origText}`;
    translationCache.set(cacheKey, translated);
    results[targetIdx] = translated;
  }

  res.json({ translations: results });
});

// Centralized Error Handling Middleware (Prevents HTML stack trace leaks)
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({
      success: false,
      error: { code: "INVALID_JSON", message: "Malformed JSON request body." }
    });
  }
  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({
      success: false,
      error: { code: "CORS_FORBIDDEN", message: "Origin not allowed by CORS." }
    });
  }
  console.error("[Server Error]:", err);
  const isProd = process.env.NODE_ENV === "production";
  res.status(err.status || 500).json({
    success: false,
    error: {
      code: err.code || "SERVER_ERROR",
      message: isProd ? "An internal server error occurred." : (err.message || "An internal server error occurred.")
    }
  });
});

// Start Express Server
const server = app.listen(PORT, "0.0.0.0", async () => {
  console.log(`FarmConnect Secure Backend listening at http://localhost:${PORT} (0.0.0.0:${PORT})`);

  // Phase 12 Startup Diagnostics Banner
  try {
    const diag = await getAiDiagnostics();
    console.log("\n========================================================");
    console.log("🌾 FarmConnect AI System Startup Diagnostics");
    console.log(`• AI Engine Status : [${diag.aiEngine}]`);
    console.log(`• NLP Engine Status: [${diag.nlpEngine || diag.aiEngine}]`);
    console.log(`• Model            : ${diag.aiModel || "local-python-nlp"}`);
    console.log(`• Latency          : ${diag.aiLatencyMs || 0}ms`);
    console.log(`• STT / TTS        : ${diag.sttProvider} / ${diag.ttsProvider}`);
    console.log(`• Retry Attempts   : ${diag.retryAttempts}`);
    console.log(`• Fallback         : ${diag.fallback}`);
    console.log(`• Details          : ${diag.diagnosticsDetails}`);
    console.log("========================================================\n");
  } catch (err) {
    console.warn("⚠️ AI startup diagnostics notice:", err.message);
  }

  // Safe non-blocking SMTP connection verification test
  verifySmtpConnection().catch((smtpErr) => {
    console.warn("[Email Service] Startup SMTP verification notice:", smtpErr.message);
  });
});

// Graceful Shutdown Handler (prevents libuv assertions & socket leaks)
async function gracefulShutdown(signal) {
  console.log(`\n[Server] Received ${signal}. Starting graceful shutdown...`);
  server.close(async () => {
    console.log("[Server] HTTP server closed.");
    try {
      if (pool && typeof pool.end === "function") {
        await pool.end();
        console.log("[Server] Database connection pool closed.");
      }
    } catch (dbErr) {
      console.warn("[Server] Error closing database pool:", dbErr.message);
    }
    setTimeout(() => {
      console.log("[Server] Graceful shutdown complete.");
      process.exit(0);
    }, 100);
  });
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
