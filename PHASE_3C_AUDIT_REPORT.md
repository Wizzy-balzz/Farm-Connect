# FARMCONNECT — PHASE 3C AUDIT REPORT
## REMAINING AI TOOLS: AUTONOMOUS AUDIT & MIGRATION PLANNING

---

### 1. Executive Summary

This report delivers the authoritative, live-source audit of all remaining AI tools in the FarmConnect application.
The audit was conducted fully independently without modifying production business logic, without changing database schemas, and without redirecting production AI traffic.

- **Verified Baseline**:
  - Node.js regression: **611 / 611 PASS (100% CLEAN, 0 regressions)**
  - Python test suite: **151 / 151 PASS (100% CLEAN, 0 regressions)**
  - Production authority: **100% Node.js** (Python AI service remains completely isolated in verification mode).
- **Core Finding**:
  - Authoritative Node AI tool declarations: **47 tools**.
  - Migrated read-only tools in Python (Stages 1, 2, 3A, 3B): **29 tools**.
  - Remaining live Node tools audited in Phase 3C: **18 tools**.
- **Classification Summary**:
  - **Group A (Safe Python Read-Only Candidates)**: 4 tools (`getMyAiMemory`, `searchMyAiMemory`, `getRelevantUserContext`, `getMyFollowUps`, `getMyFarmingGoals`).
  - **Group B (Hybrid Candidates — Python Reasoning / Node Execution)**: 9 tools (`proposeUpdateProductPrice`, `proposeUpdateInventory`, `proposeCreateProductListing`, `proposeCancelOrder`, `proposeSendMessage`, `proposeMemoryUpdate`, `proposeCreateFarmingGoal`, `proposeCreateFollowUp`, `executeCopilotPlan`, `getMyProactiveInsights`, `getGoalProgress`).
  - **Group C (Node-Only — State Mutation & Authority)**: 2 tools (`proposeUpdateGoalProgress`, `completeFollowUp`).
  - **Group D (Do Not Migrate — Subsystem Architecture Boundaries)**: Confirmation and mutation endpoints (`POST /api/ai/actions/confirm`, `POST /api/ai/actions/cancel`, image vision `/api/ai/image-analysis`, voice transcription `/api/ai/voice`, and speech synthesis `/api/ai/tts`).

---

### 2. Live Tool Inventory

The live codebase was inspected across:
- `backend/ai/aiTools.js` (TOOL_DECLARATIONS and `executeAiTool` switch cases)
- `backend/ai/aiPermissions.js` (ROLE_PERMISSIONS matrix and `sanitizeToolParams`)
- `backend/ai/aiActions.js` (Action preparation, cryptographic token validation, and transactional execution)
- `backend/ai/aiRouter.js` (50 REST API endpoints)
- Services: `aiMemoryService.js`, `aiGoalService.js`, `aiFollowupService.js`, `aiPlannerService.js`, `proactiveInsightService.js`, `marketplaceAgentService.js`, `analyticsReportService.js`, `cropImageAnalysisService.js`.

The authoritative inventory confirms exactly **47 declared AI tools** in Node.js with a 100% bijection between `TOOL_DECLARATIONS`, `executeAiTool` dispatch cases, and `ROLE_PERMISSIONS`.

#### Complete Inventory Table (47 Tools)

| # | Tool Name | Subsystem / Phase | Status in Python | Classification |
|---|---|---|---|---|
| 1 | `searchProducts` | Catalog (Stage 1) | Migrated | READ-ONLY |
| 2 | `getProduct` | Catalog (Stage 1) | Migrated | READ-ONLY |
| 3 | `getNearbyProducts` | Regional Catalog (Stage 1) | Migrated | READ-ONLY |
| 4 | `getFarmerProfile` | Regional Public (Stage 3A) | Migrated | READ-ONLY |
| 5 | `getFarmerProducts` | Regional Public (Stage 3A) | Migrated | READ-ONLY |
| 6 | `compareProducts` | Regional Catalog (Stage 3A) | Migrated | READ-ONLY |
| 7 | `getMyOrders` | User Commerce (Stage 2) | Migrated | READ-ONLY |
| 8 | `getMySales` | Farmer Sales (Stage 2) | Migrated | READ-ONLY |
| 9 | `getMyInventory` | Farmer Stock (Stage 2) | Migrated | READ-ONLY |
| 10 | `getPriceInsights` | Price Analytics (Stage 3A) | Migrated | READ-ONLY |
| 11 | `getDemandInsights` | Demand Analytics (Stage 3A) | Migrated | READ-ONLY |
| 12 | `getWeatherAdvisory` | Weather / Advisory (Stage 1) | Migrated | READ-ONLY |
| 13 | `getPriceIntelligence` | Price Intelligence (Stage 1) | Migrated | READ-ONLY |
| 14 | `getDemandIntelligence` | Demand Intelligence (Stage 3A) | Migrated | READ-ONLY |
| 15 | `getSellingRecommendation`| Selling Strategy (Stage 3B) | Migrated | READ-ONLY |
| 16 | `getMyProactiveInsights` | Proactive Alerts (Phase 7) | **Remaining (Audited)** | **HYBRID** |
| 17 | `getPlatformAnalytics` | Macro Analytics (Stage 3B) | Migrated | READ-ONLY (Admin) |
| 18 | `proposeUpdateProductPrice`| Action Proposal (Phase 6) | **Remaining (Audited)** | **HYBRID** |
| 19 | `proposeUpdateInventory` | Action Proposal (Phase 6) | **Remaining (Audited)** | **HYBRID** |
| 20 | `proposeCreateProductListing`| Action Proposal (Phase 6) | **Remaining (Audited)** | **HYBRID** |
| 21 | `proposeCancelOrder` | Action Proposal (Phase 6) | **Remaining (Audited)** | **HYBRID** |
| 22 | `proposeSendMessage` | Action Proposal (Phase 6) | **Remaining (Audited)** | **HYBRID** |
| 23 | `getMySellingOpportunities`| Selling Strategy (Stage 3B) | Migrated | READ-ONLY |
| 24 | `compareSellingOptions` | Selling Strategy (Stage 3B) | Migrated | READ-ONLY |
| 25 | `getMarketplaceOverview` | Regional Overview (Stage 3A) | Migrated | READ-ONLY |
| 26 | `getNearbyBuyerOpportunities`| Regional Demand (Stage 3A) | Migrated | READ-ONLY |
| 27 | `getSellingPlan` | Selling Strategy (Stage 3B) | Migrated | READ-ONLY |
| 28 | `getMyFarmReport` | Farmer Analytics (Stage 2) | Migrated | READ-ONLY |
| 29 | `getMySalesAnalytics` | Farmer Analytics (Stage 2) | Migrated | READ-ONLY |
| 30 | `getMyInventoryAnalytics` | Farmer Stock (Stage 2) | Migrated | READ-ONLY |
| 31 | `getMyProductPerformance`| Product Velocity (Stage 2) | Migrated | READ-ONLY |
| 32 | `getMarketplaceAnalytics` | Marketplace Macro (Stage 3B) | Migrated | READ-ONLY |
| 33 | `getPlatformAnalyticsReport`| Macro Analytics (Stage 3B) | Migrated | READ-ONLY (Admin) |
| 34 | `compareAnalyticsPeriods` | Period Comparison (Stage 3B) | Migrated | READ-ONLY |
| 35 | `generateAnalyticsReport` | Advanced Reports (Stage 3B) | Migrated | READ-ONLY |
| 36 | `getMyAiMemory` | Personal Memory (Phase 11) | **Remaining (Audited)** | **READ-ONLY CANDIDATE** |
| 37 | `searchMyAiMemory` | Personal Memory (Phase 11) | **Remaining (Audited)** | **READ-ONLY CANDIDATE** |
| 38 | `getRelevantUserContext` | Context Aggregation (Phase 11)| **Remaining (Audited)** | **READ-ONLY CANDIDATE** |
| 39 | `proposeMemoryUpdate` | Memory Proposal (Phase 11) | **Remaining (Audited)** | **HYBRID** |
| 40 | `getMyFarmingGoals` | Farming Goals (Phase 11) | **Remaining (Audited)** | **READ-ONLY CANDIDATE** |
| 41 | `getGoalProgress` | Goal Verification (Phase 11) | **Remaining (Audited)** | **HYBRID** |
| 42 | `proposeCreateFarmingGoal`| Goal Proposal (Phase 11) | **Remaining (Audited)** | **HYBRID** |
| 43 | `proposeUpdateGoalProgress`| Goal Progress (Phase 11) | **Remaining (Audited)** | **NODE-ONLY** |
| 44 | `getMyFollowUps` | Follow-ups (Phase 11) | **Remaining (Audited)** | **READ-ONLY CANDIDATE** |
| 45 | `proposeCreateFollowUp` | Follow-up Proposal (Phase 11)| **Remaining (Audited)** | **HYBRID** |
| 46 | `completeFollowUp` | Follow-up Mutation (Phase 11)| **Remaining (Audited)** | **NODE-ONLY** |
| 47 | `executeCopilotPlan` | Multi-step Copilot (Phase 11)| **Remaining (Audited)** | **HYBRID** |

---

### 3. Exact Remaining Tool Count

- Total Node AI Tools: **47**
- Already Migrated to Python: **29**
- **Remaining Tools to be Audited & Planned: EXACTLY 18 TOOLS**

---

### 4. Tool-by-Tool Detailed Audit

#### Tool 1: `getMyAiMemory`
- **Implementation File**: `backend/services/aiMemoryService.js` (`getUserMemories`)
- **Calling Service**: `executeAiTool` in `backend/ai/aiTools.js`, `GET /api/ai/memory` in `aiRouter.js`
- **Registration**: `TOOL_DECLARATIONS.getMyAiMemory`
- **Current Production Status**: Active in Node production AI
- **Purpose**: Fetch active preference items, unit conventions, and historical context for the authenticated user.
- **Inputs**: `{ memoryType?: string, isActive?: boolean }`
- **Outputs**: `Array<{ id, userId, memoryType, key, value, confidence, source, createdAt, updatedAt }>`
- **Database Reads**: `SELECT * FROM ai_user_memory WHERE userId = ? AND isActive = ? ORDER BY updatedAt DESC LIMIT 50`
- **Database Writes**: None.
- **Business-State Mutation**: None.
- **External Side Effects**: None.
- **Notifications**: None.
- **Transactions / Row Locks**: None.
- **Idempotency**: Strictly idempotent read.
- **Human Confirmation**: Not required.
- **Authentication**: Required (`userId` forced from `user.id`).
- **RBAC**: Farmer, Vendor, Admin.
- **PII / Sensitive Data**: Stores preferences. Content is pre-screened to reject credentials, passwords, JWTs, and API keys.
- **Gemini Dependency**: None. Pure SQL read.
- **Security Classification**: User-Private Read.
- **Recommended Category**: **GROUP A — PYTHON READ-ONLY CANDIDATE**
- **Reason**: Pure read-only SQL lookup isolated by authenticated user ID.

#### Tool 2: `searchMyAiMemory`
- **Implementation File**: `backend/services/aiMemoryService.js` (`searchUserMemory`)
- **Calling Service**: `executeAiTool` in `backend/ai/aiTools.js`
- **Registration**: `TOOL_DECLARATIONS.searchMyAiMemory`
- **Current Production Status**: Active in Node production AI
- **Purpose**: Search user preferences and memory keys/values by natural language keywords.
- **Inputs**: `{ query: string }`
- **Outputs**: `Array<MemoryItem>` (max 10 items)
- **Database Reads**: `SELECT * FROM ai_user_memory WHERE userId = ? AND isActive = 1 AND (LOWER(key) LIKE ? OR LOWER(value) LIKE ?)`
- **Database Writes**: None.
- **Business-State Mutation**: None.
- **Security Classification**: User-Private Read.
- **Recommended Category**: **GROUP A — PYTHON READ-ONLY CANDIDATE**
- **Reason**: Pure parameterized read-only query filtered by session user ID.

#### Tool 3: `getRelevantUserContext`
- **Implementation File**: `backend/services/aiMemoryService.js` (`getRelevantUserContext`)
- **Calling Service**: Pre-prompt injection in `aiService.js`, `executeAiTool` in `aiTools.js`
- **Registration**: `TOOL_DECLARATIONS.getRelevantUserContext`
- **Current Production Status**: Active in Node production AI
- **Purpose**: Aggregate active memories into a synthesized prompt injection context string.
- **Inputs**: `{}` (implicit authenticated user)
- **Outputs**: `{ memories: Array, summary: string }`
- **Database Reads**: Queries `ai_user_memory`.
- **Database Writes**: None.
- **Security Classification**: User-Private Read Context.
- **Recommended Category**: **GROUP A — PYTHON READ-ONLY CANDIDATE**
- **Reason**: Vital read tool for Python Gemini engine to personalize responses without inter-process HTTP round-trips.

#### Tool 4: `proposeMemoryUpdate`
- **Implementation File**: `backend/services/aiMemoryService.js` (`proposeMemoryItem`)
- **Calling Service**: `executeAiTool` in `aiTools.js`
- **Registration**: `TOOL_DECLARATIONS.proposeMemoryUpdate`
- **Current Production Status**: Active in Node production AI
- **Purpose**: Prepare a memory proposal structure for user verification.
- **Inputs**: `{ key: string, value: string, memoryType?: string, confidence?: string }`
- **Outputs**: `{ requiresConfirmation: true, proposalType: "AI_MEMORY_UPDATE", memory: {...}, message: string }`
- **Database Reads**: None.
- **Database Writes**: None in proposal mode. (Save is executed via `saveMemoryItem` when user confirms).
- **Security Classification**: Action Proposal.
- **Recommended Category**: **GROUP B — HYBRID**
- **Reason**: Python generates and validates proposal content; Node authoritatively saves and manages memory limits and evictions.

#### Tool 5: `getMyFarmingGoals`
- **Implementation File**: `backend/services/aiGoalService.js` (`getUserGoals`)
- **Calling Service**: `executeAiTool` in `aiTools.js`, `GET /api/ai/goals`
- **Registration**: `TOOL_DECLARATIONS.getMyFarmingGoals`
- **Current Production Status**: Active in Node production AI
- **Purpose**: Retrieve user's farming goals with dynamic overdue detection and completion percentages.
- **Inputs**: `{ status?: string, category?: string }`
- **Outputs**: `Array<FarmingGoal>` (augmented with `isOverdue: boolean`, `progressPercent: number`)
- **Database Reads**: `SELECT * FROM ai_farming_goals WHERE userId = ?`
- **Database Writes**: None.
- **Security Classification**: User-Private Read.
- **Recommended Category**: **GROUP A — PYTHON READ-ONLY CANDIDATE**
- **Reason**: Pure read operation calculating progress percentages deterministically from database values.

#### Tool 6: `getGoalProgress`
- **Implementation File**: `backend/services/aiGoalService.js` (`calculateVerifiedGoalProgress`)
- **Calling Service**: `executeAiTool` in `aiTools.js`, `POST /api/ai/goals/:id/recalculate`
- **Registration**: `TOOL_DECLARATIONS.getGoalProgress`
- **Current Production Status**: Active in Node production AI
- **Purpose**: Verify actual delivered sales in `order_items` against goal target and update progress.
- **Inputs**: `{ goalId: string }`
- **Outputs**: `{ goal: GoalObject, sourceFact: string, verifiedAt: string }`
- **Database Reads**: `ai_farming_goals`, `order_items`, `orders`, `products`.
- **Database Writes**: **`UPDATE ai_farming_goals SET currentValue = ?, status = 'completed'`** (Line 291 of `aiGoalService.js`).
- **Business-State Mutation**: **YES**. Mutates goal currentValue and status.
- **Security Classification**: Semi-Autonomous Mutation.
- **Recommended Category**: **GROUP B — HYBRID**
- **Reason**: Python can query `order_items` and calculate progress, but the authoritative update to `ai_farming_goals` MUST be executed by Node.

#### Tool 7: `proposeCreateFarmingGoal`
- **Implementation File**: `backend/services/aiGoalService.js` (`proposeCreateGoal`)
- **Calling Service**: `executeAiTool` in `aiTools.js`
- **Registration**: `TOOL_DECLARATIONS.proposeCreateFarmingGoal`
- **Current Production Status**: Active in Node production AI
- **Purpose**: Formulate a proposed farming goal for user confirmation.
- **Inputs**: `{ title: string, category?: string, targetValue?: number, unit?: string, deadline?: string, priority?: string }`
- **Outputs**: `{ requiresConfirmation: true, proposalType: "AI_GOAL_CREATE", goal: {...}, message: string }`
- **Database Writes**: None until confirmed.
- **Security Classification**: Action Proposal.
- **Recommended Category**: **GROUP B — HYBRID**
- **Reason**: Python formulates the proposed parameters; Node handles authoritative confirmation and persistence.

#### Tool 8: `proposeUpdateGoalProgress`
- **Implementation File**: `backend/ai/aiTools.js` (line 1093) invoking `updateGoal` in `aiGoalService.js`
- **Calling Service**: `executeAiTool` in `aiTools.js`
- **Registration**: `TOOL_DECLARATIONS.proposeUpdateGoalProgress`
- **Current Production Status**: Active in Node production AI
- **Purpose**: Update progress currentValue, status, or deadline on an existing goal.
- **Inputs**: `{ goalId: string, currentValue?: number, status?: string }`
- **Database Writes**: **`UPDATE ai_farming_goals SET ... WHERE id = ? AND userId = ?`**
- **Business-State Mutation**: **DIRECT MUTATION**.
- **Security Classification**: State Mutation.
- **Recommended Category**: **GROUP C — NODE-ONLY**
- **Reason**: Directly mutates `ai_farming_goals`. Python must NOT execute direct database updates.

#### Tool 9: `getMyFollowUps`
- **Implementation File**: `backend/services/aiFollowupService.js` (`getUserFollowups`)
- **Calling Service**: `executeAiTool` in `aiTools.js`, `GET /api/ai/followups`
- **Registration**: `TOOL_DECLARATIONS.getMyFollowUps`
- **Current Production Status**: Active in Node production AI
- **Purpose**: Retrieve scheduled reminders, harvest follow-ups, and price alerts for the user.
- **Inputs**: `{ status?: string }`
- **Outputs**: `Array<FollowupItem>`
- **Database Reads**: `SELECT * FROM ai_followups WHERE userId = ? ...`
- **Database Writes**: None.
- **Security Classification**: User-Private Read.
- **Recommended Category**: **GROUP A — PYTHON READ-ONLY CANDIDATE**
- **Reason**: Safe parameterized read query filtered by session user ID.

#### Tool 10: `proposeCreateFollowUp`
- **Implementation File**: `backend/services/aiFollowupService.js` (`proposeCreateFollowup`)
- **Calling Service**: `executeAiTool` in `aiTools.js`
- **Registration**: `TOOL_DECLARATIONS.proposeCreateFollowUp`
- **Current Production Status**: Active in Node production AI
- **Purpose**: Prepare a follow-up task proposal.
- **Inputs**: `{ title: string, type?: string, triggerAt?: string, relatedEntityType?: string, relatedEntityId?: string }`
- **Outputs**: `{ requiresConfirmation: false, proposalType: "AI_FOLLOWUP_CREATE", followup: {...}, message: string }`
- **Database Writes**: None in proposal; creation mutates `ai_followups` and `notifications`.
- **Security Classification**: Action Proposal / Hybrid Task.
- **Recommended Category**: **GROUP B — HYBRID**
- **Reason**: Python proposes scheduling; Node persists and sends user notifications.

#### Tool 11: `completeFollowUp`
- **Implementation File**: `backend/services/aiFollowupService.js` (`completeFollowup`)
- **Calling Service**: `executeAiTool` in `aiTools.js`, `PUT /api/ai/followups/:id/complete`
- **Registration**: `TOOL_DECLARATIONS.completeFollowUp`
- **Current Production Status**: Active in Node production AI
- **Purpose**: Mark a follow-up task as completed.
- **Inputs**: `{ followupId: string }`
- **Database Writes**: **`UPDATE ai_followups SET status = 'completed', completedAt = ? WHERE id = ? AND userId = ?`**
- **Business-State Mutation**: **DIRECT MUTATION**.
- **Security Classification**: State Mutation.
- **Recommended Category**: **GROUP C — NODE-ONLY**
- **Reason**: Direct state mutation on user task lifecycle; must remain under authoritative Node control.

#### Tool 12: `executeCopilotPlan`
- **Implementation File**: `backend/services/aiPlannerService.js` (`executeCopilotPlan`)
- **Calling Service**: `executeAiTool` in `aiTools.js`, `POST /api/ai/copilot/plan`
- **Registration**: `TOOL_DECLARATIONS.executeCopilotPlan`
- **Current Production Status**: Active in Node production AI
- **Purpose**: Multi-step agent workflow coordinating up to 10 sequential read tools to synthesize a comprehensive farmer recommendation.
- **Inputs**: `{ query: string, workflowIntent?: string, initialParams?: object }`
- **Outputs**: `{ totalSteps, completedSteps, totalToolCalls, planSteps: Array, facts: Array, reasoning: string, recommendation: object, proposedAction?: object }`
- **Database Reads**: Invokes multiple tools across database tables.
- **Database Writes**: None directly.
- **Security Classification**: Workflow Orchestration.
- **Recommended Category**: **GROUP B — HYBRID**
- **Reason**: Python is built specifically for reasoning and planning orchestration, but Node must authorize the session and handle any resulting confirmation proposals.

#### Tool 13: `getMyProactiveInsights`
- **Implementation File**: `backend/services/proactiveInsightService.js` (`getUserProactiveInsights`)
- **Calling Service**: `executeAiTool` in `aiTools.js`, `GET /api/ai/insights`
- **Registration**: `TOOL_DECLARATIONS.getMyProactiveInsights`
- **Current Production Status**: Active in Node production AI
- **Purpose**: Retrieve proactive alerts (low stock, price movements, weather harvest risks).
- **Inputs**: `{ status?: string }`
- **Database Reads**: `SELECT * FROM ai_proactive_insights WHERE userId = ?`
- **Database Writes**: **`UPDATE ai_proactive_insights SET status = 'expired' WHERE userId = ? AND expiresAt < ?`** (auto-expires during retrieval).
- **Background Jobs**: Scheduled cron job `generateProactiveInsightsForUser`.
- **Security Classification**: Read-Lifecycle Hybrid.
- **Recommended Category**: **GROUP B — HYBRID**
- **Reason**: Python can evaluate risk logic; Node runs background crons and mutates expiration lifecycle states.

#### Tools 14–18: Core Action Proposals
- **Tools**:
  - `proposeUpdateProductPrice`
  - `proposeUpdateInventory`
  - `proposeCreateProductListing`
  - `proposeCancelOrder`
  - `proposeSendMessage`
- **Implementation File**: `backend/ai/aiActions.js` (`prepareActionProposal`)
- **Registration**: `TOOL_DECLARATIONS.*`
- **Current Production Status**: Active in Node production AI
- **Purpose**: Formulate non-autonomous action proposals, validate pre-conditions, calculate impact, generate 5-minute cryptographic tokens, and insert records into `ai_pending_actions`.
- **Confirmation Mechanism**: Confirmed via `POST /api/ai/actions/confirm` which enforces:
  - User authentication and ownership matching
  - 5-minute token expiration check
  - Idempotency guard (`CONFIRMED`, `CANCELLED`)
  - ACID transaction (`pool.getConnection()`, `beginTransaction()`)
  - Pessimistic row locking (`SELECT ... FOR UPDATE` on `products` and `orders`)
  - Stale state detection (`ACTION_STALE`)
  - Core database mutations (`UPDATE products`, `INSERT INTO products`, `UPDATE orders`, `INSERT INTO messages`)
  - Immutable audit logging to `ai_action_audit`
- **Security Classification**: Sensitive Action Proposal (Requires Human-in-the-Loop Confirmation).
- **Recommended Category**: **GROUP B — HYBRID (Proposal Content Generation)** / **GROUP C — NODE-ONLY (Execution & Mutation)**
- **Reason**: Python may assist in extracting parameters or suggesting price changes, but Node MUST remain the sole authority that issues cryptographic tokens, locks rows, executes mutations, and writes audit trails.

---

### 5. Classification Matrix

| Tool Name | Reads | Writes | DB Mutation | External Side Effects | Recommended Category | Migration Destination / Owner |
|---|---|---|---|---|---|---|
| `getMyAiMemory` | `ai_user_memory` | None | None | None | **GROUP A (Read-Only)** | Python `memory_query.py` |
| `searchMyAiMemory` | `ai_user_memory` | None | None | None | **GROUP A (Read-Only)** | Python `memory_query.py` |
| `getRelevantUserContext`| `ai_user_memory` | None | None | None | **GROUP A (Read-Only)** | Python `context_builder.py` |
| `proposeMemoryUpdate` | None | `ai_user_memory` (on confirm)| None (proposal) | None | **GROUP B (Hybrid)** | Python format / Node persist |
| `getMyFarmingGoals` | `ai_farming_goals`| None | None | None | **GROUP A (Read-Only)** | Python `goals_query.py` |
| `getGoalProgress` | Orders, Items, Goals| `ai_farming_goals` | Updates goal currentValue | None | **GROUP B (Hybrid)** | Python metrics / Node state update |
| `proposeCreateFarmingGoal`| None | `ai_farming_goals` (on confirm)| None (proposal) | None | **GROUP B (Hybrid)** | Python format / Node persist |
| `proposeUpdateGoalProgress`| None | `ai_farming_goals` | **Direct Mutation** | None | **GROUP C (Node-Only)**| Node `aiGoalService.js` |
| `getMyFollowUps` | `ai_followups` | None | None | None | **GROUP A (Read-Only)** | Python `followup_query.py` |
| `proposeCreateFollowUp`| None | `ai_followups`, `notif` | None (proposal) | Creates in-app alert | **GROUP B (Hybrid)** | Python plan / Node persist & notif |
| `completeFollowUp` | `ai_followups` | `ai_followups` | **Direct Mutation** | None | **GROUP C (Node-Only)**| Node `aiFollowupService.js` |
| `executeCopilotPlan` | Multi-tool reads | None directly | None | None | **GROUP B (Hybrid)** | Python planner / Node auth & proposal |
| `getMyProactiveInsights`| `ai_proactive_insights`| `ai_proactive_insights`| Row expiry update | None | **GROUP B (Hybrid)** | Python analysis / Node lifecycle & cron |
| `proposeUpdateProductPrice`| `products` | `ai_pending_actions` | Token generation | Confirmation UI | **GROUP B (Hybrid)** | Python analyze / Node token & execute |
| `proposeUpdateInventory`| `products` | `ai_pending_actions` | Token generation | Confirmation UI | **GROUP B (Hybrid)** | Python analyze / Node token & execute |
| `proposeCreateProductListing`| None | `ai_pending_actions` | Token generation | Confirmation UI | **GROUP B (Hybrid)** | Python analyze / Node token & execute |
| `proposeCancelOrder` | `orders`, `items` | `ai_pending_actions` | Token generation | Confirmation UI | **GROUP B (Hybrid)** | Python analyze / Node token & execute |
| `proposeSendMessage` | None | `ai_pending_actions` | Token generation | Confirmation UI | **GROUP B (Hybrid)** | Python analyze / Node token & execute |

---

### 6. Copilot Memory Audit

- **User Scoping & Isolation**: Enforced in Node via `WHERE userId = ?`. Any `userId` supplied in natural language or arguments is overridden by `user.id`.
- **Sensitive Memory Handling**: `sanitizeMemoryContent` runs regular expression checks against passwords, JWTs, bearer tokens, API keys, credit cards, CVVs, OTPs, and private keys, raising `SENSITIVE_DATA_PROHIBITED`.
- **Retention & Quotas**: Capped at 50 active memories per user. On limit breach, the oldest memory item is evicted by `updatedAt ASC`.
- **Python Read Safety**: Safe for Python read-only querying (`SELECT * FROM ai_user_memory WHERE userId = ? AND isActive = 1`).
- **Node Authority**: Memory insertions, deletions, and quota evictions must remain on Node to guarantee ACID consistency and prevent race conditions.

---

### 7. Farming Goals Audit

- **Read vs Write Decoupling**:
  - `getMyFarmingGoals`: Pure SELECT with dynamic math (`progressPercent = Math.min(100, (current / target) * 100)`). Safe for Python.
  - `getGoalProgress`: Evaluates verified completed orders (`oi.farmerId = ? AND o.status IN ('Delivered', 'Accepted')`). Safe to calculate in Python, but database update of `ai_farming_goals` must remain in Node.
  - `proposeCreateFarmingGoal`: In-memory proposal generation.
  - `proposeUpdateGoalProgress`: **Direct unconfirmed mutation**. Must remain exclusively on Node.

---

### 8. Follow-Up Audit

- **Read vs Mutation Decoupling**:
  - `getMyFollowUps`: Pure SELECT filtered by authenticated `userId` and `status = 'pending'`. Safe for Python.
  - `proposeCreateFollowUp`: Formulates follow-up title and trigger timestamp based on user conversation. Safe for Python.
  - `createFollowup`: Inserts record and creates a row in `notifications`. Node-authoritative.
  - `completeFollowUp`: Direct UPDATE setting `status = 'completed'` and `completedAt`. Node-authoritative.

---

### 9. Copilot Planner Audit (`executeCopilotPlan`)

Tracing `executeCopilotPlan` in `backend/services/aiPlannerService.js` confirms:
1. **Does it mutate state?** No. It coordinates read-only tools (`getMyInventory`, `getPriceIntelligence`, `getDemandIntelligence`, `getWeatherAdvisory`, `getMyOrders`, `getSellingRecommendation`).
2. **Execution Guardrails**:
   - Max 10 plan steps (`MAX_PLAN_STEPS = 10`).
   - Max 12 tool calls (`MAX_TOOL_CALLS = 12`).
   - Strict 30-second timeout (`MAX_EXECUTION_TIME_MS = 30000`) wrapped with `Promise.race`.
3. **Does it bypass confirmation?** No. If `getSellingRecommendation` generates an action proposal, it is returned in `proposedAction` for human confirmation.
4. **Architectural Recommendation**: **Hybrid Pattern**.
   - Python performs workflow intent detection, step resolution, and read-tool orchestration.
   - Node validates user session, enforces RBAC, and manages any confirmation proposals returned by the plan.

---

### 10. Proactive AI Audit (`getMyProactiveInsights`)

- **Does it mutate state?** Yes. On line 479 of `proactiveInsightService.js`, it automatically updates stale rows (`UPDATE ai_proactive_insights SET status = 'expired'`).
- **Background Scheduling**: Driven by background cron jobs that analyze market demand, rainfall forecasts, and pending orders.
- **Architectural Recommendation**: **Hybrid Pattern**.
  - Background alert generation and table lifecycle management remain in Node.
  - Stored insights can be queried in read-only mode by Python with strict `userId` scoping, while lifecycle status expiration remains with Node.

---

### 11. Action Proposal Security Audit

Tracing `backend/ai/aiActions.js`:
- **Cryptographic Security**: Tokens are generated via `crypto.randomBytes(32).toString("hex")` and stored as SHA-256 hashes (`confirmationTokenHash`). Raw tokens are never logged or persisted.
- **TTL**: Hard expiration of 5 minutes (`ACTION_TOKEN_LIFETIME_MS = 300000`).
- **Concurrency & Pessimistic Locking**: `confirmAction` executes within an explicit transaction (`pool.getConnection()`, `beginTransaction()`) using `SELECT ... FOR UPDATE` row locks on `products` and `orders`.
- **Stale State Detection**: Compares `currentProduct.price` / `currentProduct.stock` with `expectedState` captured at proposal time. If changed, rejects execution with `ACTION_STALE`.
- **Idempotency**: Completed actions (`CONFIRMED` or `CANCELLED`) reject re-execution with `ACTION_ALREADY_PROCESSED`.
- **Auditability**: Every confirmed execution writes an immutable record to `ai_action_audit` capturing `userId`, `actionId`, `parameters`, `result`, and timestamp.
- **Absolute Security Mandate**: **Python MUST NOT execute actions or mutate core business state.** Action execution must remain 100% Node-authoritative.

---

### 12. Node / Python Responsibility Boundary

```
                     USER (Web / Mobile)
                              │
                              ▼
                     Node.js Backend
                  [Authoritative Gateway]
               • JWT Authentication & Session
               • Strict RBAC Verification
               • Rate Limiting & Audit Trail
                              │
                              ▼
                    Python AI Subsystem
                 [FastAPI Reasoning Engine]
               • Multilingual NLP & Normalization
               • Gemini Function Calling Reasoning
               • Read-Only Analytics Execution
                              │
              ┌───────────────┴───────────────┐
              │                               │
       READ-ONLY TOOLS                 ACTION PROPOSALS
              │                               │
              ▼                               ▼
    Python Executes Queries            Python Generates
    Against Database (Read)            Proposed Parameters
              │                               │
              ▼                               ▼
     Returns Data/Facts to            Returns Proposal Object
      Synthesize Response              to Node for Storage
              │                               │
              │                               ▼
              │                     Node Issues Crypto Token
              │                     Stores in ai_pending_actions
              │                     Renders Confirmation Modal
              │                               │
              │                               ▼
              │                        USER CONFIRMS
              │                               │
              │                               ▼
              │                     Node Executes Mutation
              │                     • MySQL Transaction
              │                     • Pessimistic Row Lock
              │                     • Stale State Check
              │                     • Audit Trail in ai_action_audit
              ▼                               ▼
                      FINAL RESPONSE TO USER
```

---

### 13. Security Findings

1. **`proposeUpdateGoalProgress` Direct Mutation Risk**:
   - *Source*: `backend/ai/aiTools.js` (lines 1092–1094).
   - *Issue*: `proposeUpdateGoalProgress` bypasses confirmation and directly calls `await updateGoal(user.id, safeParams.goalId, safeParams)`. While scoped to `user.id`, the name implies a proposal but executes a live mutation.
   - *Mitigation*: Must remain classified as **Node-Only (Group C)**. Python must never invoke this as a read tool.
2. **`getGoalProgress` Hidden Mutation Risk**:
   - *Source*: `backend/services/aiGoalService.js` (line 291).
   - *Issue*: Calling `getGoalProgress` silently mutates `currentValue` in `ai_farming_goals`.
   - *Mitigation*: Hybrid boundary required. In Python, progress calculation must be read-only without updating the database.
3. **`getMyProactiveInsights` Lifecycle Expiry Write**:
   - *Source*: `backend/services/proactiveInsightService.js` (lines 478–483).
   - *Issue*: Read operation executes an `UPDATE` query on `ai_proactive_insights`.
   - *Mitigation*: Python must perform read-only query on active records; expiration updates remain on Node.

---

### 14. Dependency Graph

```
[executeCopilotPlan] (Hybrid Planner)
   │
   ├──> [getMyInventory] (Python Migrated - Stage 2)
   ├──> [getPriceIntelligence] (Python Migrated - Stage 1)
   ├──> [getDemandIntelligence] (Python Migrated - Stage 3A)
   ├──> [getWeatherAdvisory] (Python Migrated - Stage 1)
   ├──> [getMyOrders] (Python Migrated - Stage 2)
   ├──> [getSellingRecommendation] (Python Migrated - Stage 3B)
   └──> [ai_pending_actions] (Node Cryptographic Store)

[getRelevantUserContext] (Python Candidate)
   └──> [getMyAiMemory] (Python Candidate)
           └──> `ai_user_memory` (MySQL / SQLite)

[getGoalProgress] (Hybrid Candidate)
   ├──> `order_items` & `orders` (Read verified sales)
   └──> `ai_farming_goals` (Node-authoritative update)

[proposeUpdateProductPrice] (Hybrid Action Proposal)
   ├──> [prepareActionProposal] (Node Validation & Token Hash)
   │       └──> `ai_pending_actions`
   └──> [confirmAction] (Node Transaction & Mutate)
           ├──> `products` (FOR UPDATE row lock)
           └──> `ai_action_audit` (Immutable audit log)
```

---

### 15. Group A — Python Read-Only Candidates (4 Tools)

These tools are pure read queries that can safely migrate to Python with zero mutation risk:

1. **`getMyAiMemory`**:
   - *Reason*: Pure SQL read from `ai_user_memory` filtered by authenticated `userId`.
   - *Security Boundary*: Anti-spoofing forces `userId = user["id"]`.
   - *Expected Location*: `backend/ai-python/app/tools/read_tools/copilot_memory.py`.
   - *Dependencies*: `db.query_all`.
2. **`searchMyAiMemory`**:
   - *Reason*: Parameterized keyword search across user preferences.
   - *Security Boundary*: Forced `userId = user["id"]`.
   - *Expected Location*: `backend/ai-python/app/tools/read_tools/copilot_memory.py`.
3. **`getRelevantUserContext`**:
   - *Reason*: Formats memory items into synthesized prompt context.
   - *Security Boundary*: Scoped to session user.
   - *Expected Location*: `backend/ai-python/app/tools/read_tools/copilot_memory.py`.
4. **`getMyFollowUps`**:
   - *Reason*: Pure SQL read from `ai_followups`.
   - *Security Boundary*: Forced `userId = user["id"]`.
   - *Expected Location*: `backend/ai-python/app/tools/read_tools/copilot_tasks.py`.
5. **`getMyFarmingGoals`**:
   - *Reason*: Pure SQL read with deterministic progress calculation.
   - *Security Boundary*: Forced `userId = user["id"]`.
   - *Expected Location*: `backend/ai-python/app/tools/read_tools/copilot_tasks.py`.

---

### 16. Group B — Hybrid Candidates (9 Tools)

These tools require split responsibility: Python performs reasoning/formulation; Node performs validation, authorization, and persistence.

1. **`proposeMemoryUpdate`**:
   - *Python*: Validates key/value length, sanitizes content, returns proposal structure.
   - *Node*: Saves confirmed item, checks 50-memory quota, evicts oldest entry.
2. **`proposeCreateFarmingGoal`**:
   - *Python*: Formulates goal title, unit, category, and target value from chat.
   - *Node*: Generates goal ID, persists to `ai_farming_goals`, enforces user ownership.
3. **`proposeCreateFollowUp`**:
   - *Python*: Formulates follow-up title and trigger timestamp.
   - *Node*: Performs deduplication check, inserts into `ai_followups`, inserts notification.
4. **`getGoalProgress`**:
   - *Python*: Queries `order_items` and computes verified sales volume.
   - *Node*: Authoritatively updates `currentValue` and marks `status = 'completed'` in `ai_farming_goals`.
5. **`executeCopilotPlan`**:
   - *Python*: Detects intent, resolves workflow steps, orchestrates read tools, synthesizes facts/reasoning.
   - *Node*: Authenticates session, enforces role permissions, registers any confirmation proposals.
6. **`getMyProactiveInsights`**:
   - *Python*: Reads active insights for user; evaluates crop and weather risk heuristics.
   - *Node*: Manages background cron generation, auto-expires stale rows, marks insights as read.
7. **`proposeUpdateProductPrice` / `proposeUpdateInventory` / `proposeCreateProductListing` / `proposeCancelOrder` / `proposeSendMessage`**:
   - *Python*: Extracts parameters, evaluates pricing intelligence and demand trends, constructs proposal payload.
   - *Node*: Prepares cryptographic confirmation token, stores pending action, handles user confirmation, acquires row locks, executes mutation, and logs audit trail.

---

### 17. Group C — Node-Only Candidates (2 Tools)

These tools perform direct, unconfirmed database mutations and must remain exclusively on Node:

1. **`proposeUpdateGoalProgress`**: Direct UPDATE on `ai_farming_goals`.
2. **`completeFollowUp`**: Direct UPDATE on `ai_followups` setting `status = 'completed'`.

---

### 18. Group D — Do-Not-Migrate (Infrastructure Endpoints)

These operations are not Gemini tool declarations, but authoritative business infrastructure:
1. `POST /api/ai/actions/confirm`: Authoritative action execution with row locks and audit logging.
2. `POST /api/ai/actions/cancel`: Cancellation of pending proposals.
3. `POST /api/ai/image-analysis`: Crop plant vision analysis (direct REST endpoint).
4. `POST /api/ai/voice`: Audio transcription via multer and OpenAI/Whisper (direct REST endpoint).
5. `POST /api/ai/tts`: Speech synthesis (direct REST endpoint).

---

### 19. Recommended Migration Order

To maintain 100% safety, zero regression, and preservation of Node production authority, the remaining tools should be addressed in strict stages:

```
┌──────────────────────────────────────────────────────────────┐
│ STAGE 3C-1: Safe Read-Only Copilot Memory & Context          │
│ • Migrate: getMyAiMemory, searchMyAiMemory,                  │
│   getRelevantUserContext                                     │
│ • Enforce strict user isolation & anti-spoofing              │
│ • Verify 100% zero-credential leakage                        │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│ STAGE 3C-2: Safe Read-Only Goals & Follow-Ups                │
│ • Migrate: getMyFarmingGoals, getMyFollowUps                 │
│ • Read-only progress calculation for getGoalProgress         │
│ • Keep goal & follow-up mutations on Node                    │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│ STAGE 3C-3: Hybrid Copilot Workflow Planner                  │
│ • Migrate: executeCopilotPlan orchestration to Python        │
│ • Connect Python planner to migrated read tools              │
│ • Route any resulting action proposals to Node confirmation  │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│ STAGE 3C-4: Action Proposal Contract & Confirmation Boundary │
│ • Standardize Action Proposal JSON schema between Python     │
│   and Node                                                   │
│ • Python generates proposal payloads; Node issues crypto     │
│   tokens and executes mutations                              │
│ • Verify zero-mutation boundary on Python                    │
└──────────────────────────────────────────────────────────────┘
```

---

### 20. Risks & Mitigations

| Risk | Impact | Live Evidence | Mitigation Strategy |
|---|---|---|---|
| **Accidental State Mutation by Python** | High | `getGoalProgress` calls `updateGoal()` on Node line 291 | Implement Python read-only version that computes metrics without executing DB updates |
| **Misleading Tool Naming** | Medium | `proposeUpdateGoalProgress` actually mutates state directly | Classify as Group C (Node-Only); never allow Python direct execution |
| **Confirmation Bypass** | Critical | AI proposing action could be misinterpreted as executing it | Enforce human-in-the-loop confirmation modal; tokens generated and validated only on Node |
| **Stale State Mutation** | High | Product price/stock changes between proposal and confirmation | Node transaction re-checks state against `expectedStateJson` with `FOR UPDATE` row locks |
| **Cross-User Memory Leakage** | High | User querying another user's personal preferences | Forcibly overwrite `userId` in parameters with authenticated session identity (`user["id"]`) |

---

### 21. Known Limitations

- Python AI service remains in an isolated verification state and does NOT serve production traffic.
- Node.js remains 100% production-authoritative for all business logic, commerce transactions, and mutations.
- No production cutover has been performed.

---

### 22. Discrepancies With Previous Reports

1. **Tool Count Clarification**:
   - Previous informal documentation estimated ~45–47 tools.
   - Live audit confirms **EXACTLY 47 tools** in Node `TOOL_DECLARATIONS`, `executeAiTool`, and `ROLE_PERMISSIONS`.
2. **`proposeUpdateGoalProgress` Misnomer**:
   - Named with prefix `propose...`, but Node code directly mutates `ai_farming_goals` table without requiring confirmation.
3. **`getGoalProgress` Side Effect**:
   - Implemented as a read query, but silently mutates `ai_farming_goals` with verified values upon calculation.

---

### 23. Repository Change Verification

- **Code Changes**: ZERO production code changes made during this audit phase.
- **Node Regression Baseline**: `node backend/test-all-phases.js` -> **611 / 611 PASS (0 failures)**.
- **Python Test Baseline**: `pytest backend/ai-python/tests` -> **151 / 151 PASS (0 failures)**.
- **Working Tree**: Clean (all scratch inspection files removed).

---

### 24. Exact Next Stage

**STOP CONDITION SATISFIED.**
Do not automatically proceed to implementation.
The exact next step when instructed by the user is:
**Phase 3C Stage 3C-1**: Implementation of safe read-only copilot memory tools (`getMyAiMemory`, `searchMyAiMemory`, `getRelevantUserContext`) into the Python AI service with strict user isolation and zero-credential leakage.
