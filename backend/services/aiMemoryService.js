import { query } from "../database.js";

const MAX_MEMORIES_PER_USER = 50;
const MAX_KEY_LENGTH = 100;
const MAX_VALUE_LENGTH = 1000;

const ALLOWED_MEMORY_TYPES = [
  "preference",
  "crop_history",
  "strategy",
  "language",
  "unit",
  "notification",
  "general"
];

// Sensitive content blacklist to prevent credential/secret leakage
const SENSITIVE_PATTERNS = [
  /password/i,
  /passwd/i,
  /jwt/i,
  /bearer\s+[a-zA-Z0-9_\-\.]+/i,
  /api[_-]?key/i,
  /secret/i,
  /token/i,
  /credit[_-]?card/i,
  /cvv/i,
  /otp/i,
  /private[_-]?key/i,
  /auth[_-]?header/i
];

function generateId(prefix = "mem") {
  return `${prefix}_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
}

/**
 * Validates text against sensitive secrets & prompt injection attacks
 */
export function sanitizeMemoryContent(text) {
  if (!text || typeof text !== "string") return "";
  
  // Reject secrets
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(text)) {
      throw new Error("SENSITIVE_DATA_PROHIBITED: AI memory cannot store passwords, tokens, or security credentials.");
    }
  }

  // Strip script tags or injection attempts
  const cleaned = text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/javascript:/gi, "")
    .trim();

  return cleaned;
}

/**
 * Retrieve active memories for a specific user
 */
export async function getUserMemories(userId, options = {}) {
  if (!userId) return [];
  const { memoryType = null, isActive = true } = options;

  let sql = "SELECT * FROM ai_user_memory WHERE userId = ?";
  const params = [userId];

  if (isActive !== null) {
    sql += " AND isActive = ?";
    params.push(isActive ? 1 : 0);
  }

  if (memoryType && ALLOWED_MEMORY_TYPES.includes(memoryType)) {
    sql += " AND memoryType = ?";
    params.push(memoryType);
  }

  sql += " ORDER BY updatedAt DESC LIMIT ?";
  params.push(MAX_MEMORIES_PER_USER);

  const rows = await query.all(sql, params);
  return rows || [];
}

/**
 * Search user memories by keyword
 */
export async function searchUserMemory(userId, queryText) {
  if (!userId || !queryText || typeof queryText !== "string") return [];
  const cleanQ = sanitizeMemoryContent(queryText).toLowerCase();
  if (!cleanQ) return [];

  const sql = `
    SELECT * FROM ai_user_memory 
    WHERE userId = ? AND isActive = 1 
      AND (LOWER(\`key\`) LIKE ? OR LOWER(\`value\`) LIKE ?)
    ORDER BY updatedAt DESC LIMIT 10
  `;
  const likeParam = `%${cleanQ}%`;
  const rows = await query.all(sql, [userId, likeParam, likeParam]);
  return rows || [];
}

/**
 * Get aggregated context string for AI agent prompt injection
 */
export async function getRelevantUserContext(user) {
  if (!user || !user.id) return { memories: [], summary: "" };

  const memories = await getUserMemories(user.id, { isActive: true });
  if (!memories || memories.length === 0) {
    return {
      memories: [],
      summary: `Role: ${user.role}. Region: ${user.region || "Not specified"}.`
    };
  }

  const memoryLines = memories.map((m) => `- [${m.memoryType}] ${m.key}: ${m.value} (Confidence: ${m.confidence || "high"})`);
  const summary = `Known User Preferences & Context:\n${memoryLines.join("\n")}`;

  return { memories, summary };
}

/**
 * Propose memory update (returns proposal object for user verification)
 */
export function proposeMemoryItem(user, itemData = {}) {
  if (!user || !user.id) {
    throw new Error("UNAUTHENTICATED: User required for memory proposal.");
  }

  const { memoryType = "general", key, value, confidence = "high", source = "conversation" } = itemData;

  if (!key || typeof key !== "string" || !key.trim()) {
    throw new Error("INVALID_KEY: Memory key is required.");
  }

  if (!value || typeof value !== "string" || !value.trim()) {
    throw new Error("INVALID_VALUE: Memory value is required.");
  }

  const cleanKey = sanitizeMemoryContent(key).slice(0, MAX_KEY_LENGTH);
  const cleanValue = sanitizeMemoryContent(value).slice(0, MAX_VALUE_LENGTH);

  return {
    requiresConfirmation: true,
    proposalType: "AI_MEMORY_UPDATE",
    memory: {
      userId: user.id,
      memoryType: ALLOWED_MEMORY_TYPES.includes(memoryType) ? memoryType : "general",
      key: cleanKey,
      value: cleanValue,
      confidence: ["high", "medium", "low"].includes(confidence) ? confidence : "high",
      source: source || "conversation"
    },
    message: `Would you like me to remember this preference: "${cleanKey} = ${cleanValue}"?`
  };
}

/**
 * Save confirmed memory item into database
 */
export async function saveMemoryItem(userId, memoryData) {
  if (!userId) throw new Error("UNAUTHENTICATED: User ID required.");

  const { memoryType = "general", key, value, confidence = "high", source = "user_explicit", expiresAt = null } = memoryData;

  const cleanKey = sanitizeMemoryContent(key).slice(0, MAX_KEY_LENGTH);
  const cleanValue = sanitizeMemoryContent(value).slice(0, MAX_VALUE_LENGTH);
  const safeType = ALLOWED_MEMORY_TYPES.includes(memoryType) ? memoryType : "general";
  const safeConfidence = ["high", "medium", "low"].includes(confidence) ? confidence : "high";

  // Check quota
  const countRow = await query.get("SELECT COUNT(*) as count FROM ai_user_memory WHERE userId = ? AND isActive = 1", [userId]);
  if (countRow && countRow.count >= MAX_MEMORIES_PER_USER) {
    // Evict oldest memory item
    const oldest = await query.get("SELECT id FROM ai_user_memory WHERE userId = ? ORDER BY updatedAt ASC LIMIT 1", [userId]);
    if (oldest) {
      await query.run("DELETE FROM ai_user_memory WHERE id = ?", [oldest.id]);
    }
  }

  const now = new Date().toISOString();

  // Check if existing memory with same userId + key exists; if so, update it
  const existing = await query.get(
    "SELECT id FROM ai_user_memory WHERE userId = ? AND \`key\` = ? AND isActive = 1",
    [userId, cleanKey]
  );

  if (existing) {
    await query.run(
      "UPDATE ai_user_memory SET memoryType = ?, \`value\` = ?, confidence = ?, source = ?, updatedAt = ?, expiresAt = ? WHERE id = ?",
      [safeType, cleanValue, safeConfidence, source, now, expiresAt, existing.id]
    );
    return { id: existing.id, updated: true, key: cleanKey, value: cleanValue };
  }

  const newId = generateId("mem");
  await query.run(
    "INSERT INTO ai_user_memory (id, userId, memoryType, \`key\`, \`value\`, confidence, source, createdAt, updatedAt, expiresAt, isActive) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)",
    [newId, userId, safeType, cleanKey, cleanValue, safeConfidence, source, now, now, expiresAt]
  );

  return { id: newId, created: true, key: cleanKey, value: cleanValue };
}

/**
 * Delete or deactivate memory item
 */
export async function deleteMemoryItem(userId, memoryId) {
  if (!userId || !memoryId) return false;

  const existing = await query.get("SELECT * FROM ai_user_memory WHERE id = ? AND userId = ?", [memoryId, userId]);
  if (!existing) return false;

  await query.run("DELETE FROM ai_user_memory WHERE id = ? AND userId = ?", [memoryId, userId]);
  return true;
}

/**
 * Clear all memories for a user (account privacy control)
 */
export async function clearUserMemories(userId) {
  if (!userId) return 0;
  const result = await query.run("DELETE FROM ai_user_memory WHERE userId = ?", [userId]);
  return result?.changes || 0;
}
