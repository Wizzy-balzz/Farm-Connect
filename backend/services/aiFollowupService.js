import { query } from "../database.js";

const VALID_TYPES = [
  "weather_check",
  "price_alert",
  "inventory_review",
  "order_review",
  "harvest_reminder",
  "custom"
];

const VALID_STATUSES = ["pending", "completed", "dismissed", "expired"];

function generateId(prefix = "flw") {
  return `${prefix}_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
}

/**
 * Fetch followups for user
 */
export async function getUserFollowups(userId, options = {}) {
  if (!userId) return [];
  const { status = "pending" } = options;

  let sql = "SELECT * FROM ai_followups WHERE userId = ?";
  const params = [userId];

  if (status && VALID_STATUSES.includes(status)) {
    sql += " AND status = ?";
    params.push(status);
  }

  sql += " ORDER BY createdAt DESC LIMIT 50";
  const rows = await query.all(sql, params);
  return rows || [];
}

/**
 * Get followup by ID with user isolation
 */
export async function getFollowupById(userId, followupId) {
  if (!userId || !followupId) return null;
  return query.get("SELECT * FROM ai_followups WHERE id = ? AND userId = ?", [followupId, userId]);
}

/**
 * Propose creating a follow-up task
 */
export function proposeCreateFollowup(user, data = {}) {
  if (!user || !user.id) {
    throw new Error("UNAUTHENTICATED: User required to propose followup.");
  }

  const { title, description = "", type = "custom", triggerAt = null, relatedEntityType = null, relatedEntityId = null } = data;

  if (!title || typeof title !== "string" || !title.trim()) {
    throw new Error("INVALID_TITLE: Follow-up title is required.");
  }

  return {
    requiresConfirmation: false,
    proposalType: "AI_FOLLOWUP_CREATE",
    followup: {
      userId: user.id,
      title: title.trim().slice(0, 255),
      description: (description || "").trim(),
      type: VALID_TYPES.includes(type) ? type : "custom",
      triggerAt: triggerAt || new Date(Date.now() + 86400000).toISOString(),
      relatedEntityType,
      relatedEntityId
    },
    message: `Scheduled follow-up: "${title.trim()}".`
  };
}

/**
 * Create a follow-up with deduplication and notification integration
 */
export async function createFollowup(userId, data) {
  if (!userId) throw new Error("UNAUTHENTICATED: User ID required.");

  const {
    title,
    description = "",
    type = "custom",
    triggerAt = null,
    relatedEntityType = null,
    relatedEntityId = null
  } = data;

  if (!title || typeof title !== "string" || !title.trim()) {
    throw new Error("INVALID_TITLE: Followup title cannot be empty.");
  }

  const cleanTitle = title.trim().slice(0, 255);
  const safeType = VALID_TYPES.includes(type) ? type : "custom";

  // Deduplication check: Do not create duplicate pending followups with identical title for the user
  const existing = await query.get(
    "SELECT id FROM ai_followups WHERE userId = ? AND title = ? AND status = 'pending'",
    [userId, cleanTitle]
  );

  if (existing) {
    return { id: existing.id, duplicate: true, title: cleanTitle };
  }

  const id = generateId("flw");
  const now = new Date().toISOString();
  const trigger = triggerAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  await query.run(
    `INSERT INTO ai_followups (
      id, userId, type, title, description, triggerAt, status, relatedEntityType, relatedEntityId, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
    [
      id,
      userId,
      safeType,
      cleanTitle,
      (description || "").trim(),
      trigger,
      relatedEntityType || null,
      relatedEntityId || null,
      now
    ]
  );

  // Integrate with existing notifications table so user sees a notification
  try {
    const notifId = generateId("notif");
    await query.run(
      "INSERT INTO notifications (id, userId, text, type, \`read\`, createdAt) VALUES (?, ?, ?, ?, 0, ?)",
      [notifId, userId, `AI Follow-up Scheduled: ${cleanTitle}`, "followup", now]
    );
  } catch (err) {
    console.warn("Failed to create follow-up notification:", err.message);
  }

  return { id, created: true, title: cleanTitle, triggerAt: trigger };
}

/**
 * Mark a follow-up as completed
 */
export async function completeFollowup(userId, followupId) {
  if (!userId || !followupId) return false;

  const existing = await getFollowupById(userId, followupId);
  if (!existing) return false;

  const now = new Date().toISOString();
  await query.run(
    "UPDATE ai_followups SET status = 'completed', completedAt = ? WHERE id = ? AND userId = ?",
    [now, followupId, userId]
  );

  return true;
}

/**
 * Dismiss a follow-up
 */
export async function dismissFollowup(userId, followupId) {
  if (!userId || !followupId) return false;

  const existing = await getFollowupById(userId, followupId);
  if (!existing) return false;

  await query.run("UPDATE ai_followups SET status = 'dismissed' WHERE id = ? AND userId = ?", [followupId, userId]);
  return true;
}
