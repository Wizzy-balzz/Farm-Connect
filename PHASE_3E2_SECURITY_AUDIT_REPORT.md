# FARMCONNECT — PHASE 3E-2: PRODUCTION SECURITY AUDIT REPORT

**Audit Date**: 2026-10-02T21:10:00+05:30  
**Application**: FarmConnect Core Production Architecture  
**Scope**: Full Stack Security Audit (Node.js Backend, MySQL 9.6.0, Python AI Subsystem, Frontend Boundary)  
**Authoritative Baseline**: MySQL 27 InnoDB tables, 611/611 PASS Regression Baseline  

---

## Executive Summary

A comprehensive application security audit of FarmConnect was conducted across 16 core security domains. The audit confirmed that FarmConnect incorporates strong architectural security controls:
- **100% Parameterized SQL**: Zero string-concatenated SQL queries in active production routes.
- **Robust Authentication**: PBKDF2-SHA512 password hashing with 100,000 iterations, constant-time verification, and HMAC-SHA256 signed session tokens.
- **Strict Role-Based Access Control**: Server-authoritative role verification and ownership checks across products, orders, conversations, and user profiles.
- **Read-Only Python AI Subsystem**: Python database access strictly enforces `SELECT`-only permissions via `PermissionError("AI_MUTATION_PROHIBITED")`.
- **Cryptographic Action Confirmation Boundary**: AI can never autonomously mutate business state; human confirmation with 32-byte tokens and parameter hashes is strictly enforced.
- **Safe Media Ingestion**: In-memory multer processing with magic byte header validation for crop photos.

Four defense-in-depth hardening opportunities were identified to elevate the application to enterprise-grade production posture:
1. Missing explicit HTTP payload size limits on `express.json()`.
2. Absence of modern HTTP defense-in-depth security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `Referrer-Policy`).
3. Absence of a centralized unhandled error middleware, risking HTML stack trace output on malformed requests.
4. Permissive order status validation on `PUT /api/orders/:id`.

---

## Detailed Audit by Domain

### 1. Authentication & Session Management
- **Password Storage**: Passwords are hashed using `crypto.pbkdf2Sync` with SHA-512, 100,000 iterations, and a unique 16-byte cryptographically secure random salt (`crypto.randomBytes(16)`).
- **Password Verification**: Uses `crypto.timingSafeEqual` over hex digest buffers, mitigating timing side-channel attacks. Legacy plaintext fallback is automatically migrated to PBKDF2 on first login.
- **Session Tokens**: JWT tokens are signed with HMAC-SHA256 (`signJwt`) and verified with `crypto.timingSafeEqual` (`verifyJwt`). Expiry is checked against standard epoch timestamps (24-hour default).
- **Cookie Security**: Set with `HttpOnly; SameSite=Lax`. When `NODE_ENV === "production"`, the `Secure` flag is enforced.
- **Public Registration**: Restricts public self-registration to `farmer` and `vendor` roles. `admin` accounts cannot be self-provisioned.
- **OTP Subsystem**: 6-digit numeric codes generated with `crypto.randomInt`, hashed with SHA-256 HMAC, expires in 5 minutes, enforces max 5 attempts with lockout, and limits requests to 10 per 15 minutes. Single-use and consumed upon verification.

### 2. Authorization / RBAC & Resource Ownership
- **Middleware**: `requireAuth` validates token and resolves live database user. `requireRole` restricts routes to authorized roles.
- **IDOR / Ownership Protection**:
  - `PUT /api/users/:id`: Asserts `req.user.id === id || req.user.role === 'admin'`.
  - `PUT /api/products/:id` & `DELETE /api/products/:id`: Asserts `product.farmerId === req.user.id || req.user.role === 'admin'`.
  - `GET /api/orders`: Scoped server-side by role (`WHERE o.vendorId = ?` for vendors, `WHERE oi.farmerId = ?` for farmers).
  - `PUT /api/orders/:id`: Authorizes only order buyer, item supplier farmer, or administrator.
  - `GET /api/orders/:id/tracking` & `POST /api/orders/:id/tracking`: Verifies ordering vendor, involved farmer, or admin.
  - `GET /api/conversations/:id/messages` & `POST /api/conversations/:id/messages`: Asserts `conv.farmerId === req.user.id || conv.vendorId === req.user.id`.
  - `ai_user_memory`, `ai_farming_goals`, `ai_followups`: Strictly bound to `req.user.id`.

### 3. SQL Injection Defense
- **Audit Findings**: 0 raw SQL concatenations involving user input.
- **Dynamic Queries**: Complex queries (e.g., `WHERE product_id IN (...)`) safely build parameter placeholders (`?`) while binding values through parameter arrays.
- **Multi-Field Updates**: Goal and user updates use whitelisted field names (`status = ?`, `priority = ?`) with parameters array binding.

### 4. API Input Validation & Request Limits
- **Current State**: Route handlers validate required fields, data types, and numeric constraints.
- **Hardening Gap**: `express.json()` did not specify an explicit byte limit, allowing potential payload DoS on unauthenticated or authenticated routes.
- **Hardening Gap**: `PUT /api/orders/:id` accepted any non-empty string as `status` without checking against the canonical domain list (`VALID_ORDER_STATUSES`).

### 5. File & Media Ingestion Security
- **Crop Vision**: Images are processed entirely in-memory (`multer.memoryStorage()`). Size is capped at 10MB. MIME types are strictly checked against `["image/jpeg", "image/jpg", "image/png", "image/webp"]`.
- **Magic Bytes Validation**: Inspects byte headers to verify true image formats (JPEG: `FF D8 FF`, PNG: `89 50 4E 47`, WebP: `RIFF...WEBP`), defeating extension spoofing.
- **Voice STT**: Audio streams are capped at 10MB / 60 seconds and verified against whitelisted audio MIME types (`audio/webm`, `audio/wav`, `audio/ogg`, `audio/mp3`, `audio/mp4`).

### 6. AI Subsystem Security & Confirmation Boundary
- **Role Isolation**: AI tools enforce role verification (`requireRole(["farmer"])` for selling strategies, farmer reports, inventory analytics).
- **Memory & Goal Isolation**: User memories and farming goals are strictly isolated by `userId`.
- **Action Confirmation Flow**:
  1. AI proposes action -> assigns risk level (`SENSITIVE` / `HIGH_RISK`).
  2. Generates 32-byte cryptographic random confirmation token (hashed with SHA-256 in DB).
  3. Action parameters are hashed with SHA-256 to detect tampering.
  4. 5-minute expiration window enforced.
  5. Human user must explicitly call `/api/ai/actions/confirm` with token.
  6. Server re-verifies ownership, state freshness (stale state protection), and executes within a MySQL transaction before writing an audit record to `ai_action_audit`.

### 7. Python AI Read-Only Boundary
- **Audit Findings**: Python database connector in `backend/ai-python/app/database/connection.py` uses `pymysql` exclusively for `SELECT` queries.
- **Mutation Prohibitions**: Any attempt to execute `INSERT`, `UPDATE`, `DELETE`, `ALTER`, `DROP`, or `TRUNCATE` in Python raises `PermissionError("AI_MUTATION_PROHIBITED")`.
- **Authority**: Node.js remains the sole authoritative backend for all business state.

### 8. Payment Security
- **Authoritative Amounts**: Order totals are computed on the server from database products and quantities. Client-provided payment amounts are compared against database totals; deviations trigger immediate rejection.
- **Signature Verification**: Gateway callbacks and webhooks verify HMAC-SHA256 signatures using `crypto.timingSafeEqual`.
- **Secret Protection**: Gateway secrets are never logged or exposed in client responses.

### 9. Realtime / SSE Stream Security
- **Authentication**: `app.get("/api/realtime/stream", requireAuth, handleSseStream)` requires a valid session token.
- **Connection Isolation**: Active connections are stored in a `Map<userId, Set<Response>>`. A user cannot subscribe to or receive another user's stream.
- **Heartbeat & Cleanup**: Keepalive heartbeats every 20s; connections are cleanly purged from the active map on client disconnect.

### 10. HTTP Headers & Transport Security
- **CORS**: Explicit origin whitelist with localhost/127.0.0.1 development fallback and credentials support.
- **Hardening Gap**: Missing defensive security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security`).

### 11. Error Handling & Information Leakage
- **Route Error Handlers**: Most routes employ `handleRouteError` or `sendError`.
- **Hardening Gap**: Global unhandled Express errors or malformed JSON payloads default to Express's built-in HTML handler, which can leak stack traces or framework fingerprints in production.

### 12. Secret Management
- **Audit Findings**: No hardcoded API keys, JWT secrets, database passwords, or payment secrets exist in tracked source code.
- **Git Tracking**: `.env` and `backend/.env` are confirmed ignored (`!!`). Only `.env.example` with safe placeholder strings is committed.

---

## Action Plan for Production Hardening

To harden the verified architecture without modifying application behavior, regression tests, or hallmark features:
1. **Add Defense-in-Depth HTTP Security Headers Middleware** (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Strict-Transport-Security`, `Permissions-Policy`).
2. **Set Explicit Body Parser Size Limit** (`express.json({ limit: "2mb" })`).
3. **Add Centralized Error Handler Middleware** at the end of `backend/server.js` to catch unhandled errors and format JSON responses without stack trace leaks.
4. **Enforce Canonical Order Status Validation** in `PUT /api/orders/:id`.
5. **Verify Security Hardening with Security Test Suite**.
