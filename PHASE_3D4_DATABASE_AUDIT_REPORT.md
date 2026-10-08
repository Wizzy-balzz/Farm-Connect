# FARMCONNECT — PHASE 3D-4A DATABASE AUDIT REPORT
## Complete SQLite → MySQL Database & Migration State Audit

**Date:** October 2, 2026  
**Status:** AUDIT COMPLETE (Read-Only)  
**Author:** Senior Backend & Database Architecture Engineer  
**Scope:** Phase 3D-4A (Comprehensive SQLite → MySQL Situation Analysis)

---

## 1. Executive Summary & Current Architecture

A comprehensive, read-only audit of the entire FarmConnect repository was conducted to inspect the database state, drivers, schemas, configurations, migration scripts, and query patterns across Node.js and Python.

### Critical Finding:
**FarmConnect is ALREADY authoritatively running on MySQL in production.**
- The Node.js authoritative backend (`backend/database.js`) connects to **MySQL 9.6.0** at `127.0.0.1:3306` (`farmconnect` database) via `mysql2/promise` with an active connection pool.
- The authoritative regression suite (`node backend/test-all-phases.js`, **611 / 611 PASS**) executes 100% against the live MySQL database.
- The Python AI subsystem (`backend/ai-python/app/database/connection.py`) actively connects to **MySQL** via `pymysql` (health check: `{"connected": True, "engine": "mysql", "host": "127.0.0.1", "database": "farmconnect"}`).
- The existing SQLite database (`backend/database.sqlite`) is a **frozen legacy development snapshot from August 27, 2026** containing only 18 legacy tables, whereas the authoritative MySQL database contains **27 production tables**.
- `sqlite3` is **not installed** in `backend/package.json`; the backend uses `mysql2` exclusively.

---

## 2. SQLite Database File Details

- **Original Path:** `d:\MWTEL\myi-react-app\backend\database.sqlite`
- **File Size:** 192,512 bytes (188 KB)
- **Last Modified Timestamp:** August 27, 2026, 14:27:09 IST
- **Total Tables in SQLite:** 18
- **Total Triggers in SQLite:** 0
- **Total Views in SQLite:** 0

---

## 3. Data Safety & Backup Verification

A safe byte-for-byte backup copy of the SQLite database was created prior to inspection without altering or touching the original database file.

| Attribute | Details |
|---|---|
| **Original SQLite Path** | `d:\MWTEL\myi-react-app\backend\database.sqlite` |
| **Backup Path** | `d:\MWTEL\myi-react-app\backend\database.sqlite.backup-phase3d4` |
| **Backup Size** | 192,512 bytes |
| **Backup Timestamp** | October 2, 2026, 20:21:46 IST |
| **Integrity Status** | Exact SHA-256 match; original file unmodified |

---

## 4. Drivers & Runtime Environment

### Node.js Driver Stack
- **MySQL Driver:** `mysql2` v3.12.0 (specifically `mysql2/promise`)
- **SQLite Driver:** None installed in `backend/package.json`. (`sqlite3` was previously imported in legacy script `migrate-sqlite-to-mysql.js`, but fails at runtime if invoked).

### Python Driver Stack
- **MySQL Driver:** `pymysql` v1.1.1 with `pymysql.cursors.DictCursor` (installed in `backend/ai-python/venv`).
- **SQLite Driver:** Standard library `sqlite3` (configured solely as an emergency fallback in `connection.py` if MySQL socket is unreachable).

---

## 5. MySQL Configuration & Live Status

Configuration loaded from `backend/.env`:
- **Host:** `127.0.0.1` (`DB_HOST`)
- **Port:** `3306` (`DB_PORT`)
- **User:** `root` (`DB_USER`)
- **Database:** `farmconnect` (`DB_NAME`)
- **Server Version:** MySQL `9.6.0`
- **Engine:** `InnoDB`
- **Default Charset / Collation:** `utf8mb4` / `utf8mb4_unicode_ci`
- **Pool Settings:** `connectionLimit: 10`, `waitForConnections: true`, `queueLimit: 0`, `dateStrings: true`
- **Connection Health:** `connected: true`, active pool operating normally.

---

## 6. Complete Table Inventory & Row Count Comparison

| # | Table Name | Business Classification | SQLite Rows | MySQL Rows | SQLite Cols | MySQL Cols | Schema Parity |
|---|---|---|---|---|---|---|---|
| 1 | `users` | AUTH / USERS | 13 | **14** | 23 | **39** | MySQL has +16 profile columns |
| 2 | `products` | PRODUCTS / INVENTORY | 13 | **14** | 22 | 22 | Identical schema |
| 3 | `product_translations` | MULTILINGUAL (Phase 3) | *N/A* | **56** | *N/A* | 7 | New in MySQL |
| 4 | `orders` | ORDERS | 19 | **19** | 20 | **22** | MySQL has +2 coordinate cols |
| 5 | `order_items` | ORDERS | 21 | **20** | 7 | 7 | Active operational data |
| 6 | `order_tracking_events` | TRACKING (Phase 13) | *N/A* | **1** | *N/A* | 9 | New in MySQL |
| 7 | `notifications` | MESSAGING | 48 | **35** | 6 | 6 | Live operational notifications |
| 8 | `reviews` | MARKETPLACE | 3 | **9** | 10 | 10 | Live ratings & reviews |
| 9 | `saved_searches` | MARKETPLACE | 0 | 0 | 5 | 5 | Identical schema |
| 10 | `ai_conversations` | AI SESSIONS | 4 | **897** | 5 | 5 | Active AI test & prod threads |
| 11 | `ai_messages` | AI MESSAGES | 16 | **2441** | 7 | 7 | Active conversation history |
| 12 | `ai_insights` | AI ANALYTICS | 0 | 0 | 5 | 5 | Identical schema |
| 13 | `ai_proactive_insights` | INSIGHTS (Phase 7) | *N/A* | **27** | *N/A* | 13 | New in MySQL |
| 14 | `ai_image_analyses` | CROP VISION (Phase 8) | *N/A* | 0 | *N/A* | 10 | New in MySQL |
| 15 | `ai_user_memory` | AI MEMORY (Phase 11) | *N/A* | 0 | *N/A* | 11 | New in MySQL |
| 16 | `ai_farming_goals` | AI GOALS (Phase 11) | *N/A* | 0 | *N/A* | 13 | New in MySQL |
| 17 | `ai_followups` | AI FOLLOWUPS (Phase 11) | *N/A* | 0 | *N/A* | 11 | New in MySQL |
| 18 | `ai_pending_actions` | PROPOSALS (Phase 6) | *N/A* | **4** | *N/A* | 15 | New in MySQL |
| 19 | `ai_action_audit` | ACTION AUDIT (Phase 6) | *N/A* | **3** | *N/A* | 11 | New in MySQL |
| 20 | `real_time_events` | REALTIME (SSE) | 11 | **21** | 6 | 6 | Live events |
| 21 | `conversations` | USER CHAT | 0 | 0 | 7 | 7 | Identical schema |
| 22 | `messages` | USER CHAT | 0 | **1** | 11 | 11 | Active chat messages |
| 23 | `blocked_users` | SAFETY | 0 | 0 | 4 | 4 | Identical schema |
| 24 | `message_reports` | SAFETY | 0 | 0 | 6 | 6 | Identical schema |
| 25 | `otp_verifications` | AUTH / OTP | 0 | **24** | 9 | 9 | Live OTP verifications |
| 26 | `payments` | PAYMENTS | 8 | **1** | 12 | 12 | Live transactions |
| 27 | `delivery_pricing_rules` | LOGISTICS | 0 | **4** | 8 | 8 | Seeded delivery rules |
| **TOTALS** | **27 Tables** | | **18 Tables** | **27 Tables** | | | **All 18 SQLite in MySQL** |

---

## 7. Schema Structural Details

### Primary Keys
- **Convention:** 100% of tables use alphanumeric string IDs (`VARCHAR(100)`).
- **Auto-increment:** Zero tables use `AUTO_INCREMENT` or SQLite `AUTOINCREMENT`. IDs are generated client/service-side using UUIDs or timestamped domain keys (`u_...`, `prod_...`, `ord_...`, `mem_...`).

### Foreign Keys
Preserved with exact referential integrity in MySQL (`ENGINE=InnoDB`):
- `products.farmerId` $\rightarrow$ `users.id` (`ON DELETE CASCADE`)
- `product_translations.product_id` $\rightarrow$ `products.id` (`ON DELETE CASCADE`)
- `orders.vendorId` $\rightarrow$ `users.id` (`ON DELETE SET NULL`)
- `order_items.orderId` $\rightarrow$ `orders.id` (`ON DELETE CASCADE`)
- `order_items.productId` $\rightarrow$ `products.id` (`ON DELETE SET NULL`)
- `order_items.farmerId` $\rightarrow$ `users.id` (`ON DELETE SET NULL`)
- `order_tracking_events.order_id` $\rightarrow$ `orders.id` (`ON DELETE CASCADE`)
- `notifications.userId` $\rightarrow$ `users.id` (`ON DELETE CASCADE`)
- `reviews.productId` $\rightarrow$ `products.id` (`ON DELETE CASCADE`)
- `reviews.farmerId` $\rightarrow$ `users.id` (`ON DELETE CASCADE`)
- `reviews.vendorId` $\rightarrow$ `users.id` (`ON DELETE SET NULL`)
- `ai_conversations.userId` $\rightarrow$ `users.id` (`ON DELETE CASCADE`)
- `ai_messages.conversationId` $\rightarrow$ `ai_conversations.id` (`ON DELETE CASCADE`)
- `ai_proactive_insights.userId` $\rightarrow$ `users.id` (`ON DELETE CASCADE`)
- `ai_image_analyses.userId` $\rightarrow$ `users.id` (`ON DELETE CASCADE`)
- `ai_user_memory.userId` $\rightarrow$ `users.id` (`ON DELETE CASCADE`)
- `ai_farming_goals.userId` $\rightarrow$ `users.id` (`ON DELETE CASCADE`)
- `ai_followups.userId` $\rightarrow$ `users.id` (`ON DELETE CASCADE`)
- `ai_pending_actions.userId` $\rightarrow$ `users.id` (`ON DELETE CASCADE`)
- `ai_action_audit.userId` $\rightarrow$ `users.id` (`ON DELETE CASCADE`)

### Indexes & Unique Constraints
- `users.email` (`UNIQUE`)
- `product_translations.uk_prod_lang(product_id, language_code)` (`UNIQUE`)
- Performance B-Tree indexes: `idx_users_role`, `idx_products_category`, `idx_orders_status`, `idx_orders_createdAt`, `idx_proactive_user`, `idx_ai_user_memory_user`.

---

## 8. Application Query & Dependency Audit

A full static analysis was conducted across all 656 SQL query lines in `backend/`:

| Pattern Scanned | Occurrences in Backend Code | Status / Note |
|---|---|---|
| `PRAGMA` | **0** | SQLite-only; absent from application code |
| `AUTOINCREMENT` | **0** | SQLite-only; absent |
| `INSERT OR REPLACE` | **0** | SQLite-only; absent |
| `INSERT OR IGNORE` | **0** | Node code uses MySQL-standard `INSERT IGNORE INTO` |
| `datetime(` / `date(` (SQL) | **0** | All timestamps stored as ISO-8601 strings in `VARCHAR(100)` |
| `strftime` (SQL) | **0** | Only Python `time.strftime` in standard library |
| `last_insert_rowid` | **0** | Absent; MySQL uses `result.insertId` in `database.js` |
| `changes()` | **0** | Absent; MySQL uses `result.affectedRows` in `database.js` |
| `mysql2` | **9** | Authoritative database connection in `backend/database.js` |
| `createPool` | **1** | Master connection pool in `backend/database.js` |
| Parameter Placeholders | `?` | Uniformly supported by both `mysql2` and SQLite |

**Total SQLite-Specific SQL Locations in Node.js Application:** **0**  
Every query in Node.js is already fully compatible with and executed on MySQL.

---

## 9. Migration Script Audit (`backend/migrate-sqlite-to-mysql.js`)

Inspection of `backend/migrate-sqlite-to-mysql.js`:
1. **Current Executability:** **Broken / Inactive.** Attempting to run `node backend/migrate-sqlite-to-mysql.js` results in `Error: Cannot find package 'sqlite3'`. `sqlite3` was removed from dependencies after the initial cutover.
2. **Table Coverage:** Incomplete. Only enumerates 18 tables; completely ignores the 9 tables introduced in Phases 3, 6, 7, 8, 11, and 13.
3. **Transaction Safety:** Does not use transactions. Inserts row-by-row with `INSERT IGNORE`.
4. **Data Overwrite Behavior:** Because it uses `INSERT IGNORE`, running it would not overwrite existing primary keys in MySQL, but could create inconsistent foreign key associations if IDs conflicted.
5. **Validation:** Computes simple row count comparison; lacks schema, type, or constraint validation.
6. **Recommendation:** **Do NOT run this script.** MySQL is already ahead of SQLite in both schema versions and data freshness.

---

## 10. Python Subsystem Database Access Audit

Inspection of `backend/ai-python/app/database/connection.py` and all 89 Python DB invocations:
- **Connection Mode:** Connects to MySQL (`127.0.0.1:3306`, DB: `farmconnect`) via `pymysql`.
- **Query Types in Production Code:**
  - `query_all`: 44 invocations (100% `SELECT`)
  - `query_get`: 36 invocations (100% `SELECT`)
  - `query_run`: **0 invocations in production code**.
- **Test Enforcement:** The 5 occurrences of `query_run` exist exclusively in `tests/tools/` to explicitly verify that mutating tables in `RESTRICTED_MUTATION_TABLES` raises `PermissionError("AI_MUTATION_PROHIBITED")`.
- **Architectural Compliance:** Python operates strictly in **Read-Only Approved Mode**. Node.js retains exclusive business mutation authority.

---

## 11. Migration Risks & Blockers

### Risks
1. **Accidental SQLite Resync Risk:** Any developer script that blindly attempts to copy `database.sqlite` into MySQL would wipe or corrupt the 9 newer tables (`ai_action_audit`, `ai_proactive_insights`, `product_translations`, etc.) and overwrite 2,400+ active AI test conversation records.
2. **Stale Data:** SQLite contains data from August 2026. Merging it would introduce stale product pricing and deleted user records.

### Blockers for Current System
- **None.** The application, regression suite, and frontend are already 100% operational on MySQL.

---

## 12. Recommended Future Steps

1. **Retain MySQL as Authoritative Production Engine:** Maintain `mysql2` and `InnoDB` tables as the single source of truth.
2. **Archive Legacy SQLite:** Keep `backend/database.sqlite.backup-phase3d4` as an immutable historical artifact.
3. **Deprecate `migrate-sqlite-to-mysql.js`:** Remove or archive `migrate-sqlite-to-mysql.js` to eliminate ambiguity for future contributors.
4. **Remove SQLite Fallback in Python:** In a planned future cleanup, replace the fallback SQLite logic in `backend/ai-python/app/database/connection.py` with pure MySQL connection pooling and retry handlers.

---

## 13. Required Summary Metrics

- **SQLite Database Path:** `d:\MWTEL\myi-react-app\backend\database.sqlite`
- **Total SQLite Tables:** 18 tables
- **Total MySQL Tables:** 27 tables
- **SQLite Row Count Total:** 150 rows
- **MySQL Row Count Total:** 3,550+ rows (including 2,441 AI messages and 897 AI conversations)
- **Existing MySQL Status:** Fully initialized, active, healthy (`127.0.0.1:3306`, MySQL 9.6.0)
- **Migration Script Status:** Deprecated / broken dependency (`sqlite3` missing)
- **SQLite-Specific SQL Locations in Application:** 0
- **Migration Blockers:** None (system already runs on MySQL)
- **Production Authority:** Node.js + MySQL (100% authoritative)
- **Python Authority:** Approved Read-Only via MySQL
- **Files Modified:** 0 application files modified
- **Files Created:**
  - `backend/database.sqlite.backup-phase3d4` (Safe binary backup)
  - `PHASE_3D4_DATABASE_AUDIT_REPORT.md` (This audit report)
