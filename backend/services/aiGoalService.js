import { query } from "../database.js";

const VALID_CATEGORIES = [
  "production",
  "selling",
  "inventory",
  "revenue",
  "crop_planning",
  "marketplace",
  "learning",
  "reminders"
];

const VALID_STATUSES = ["active", "completed", "cancelled", "overdue", "paused"];
const VALID_PRIORITIES = ["low", "medium", "high", "critical"];

function generateId(prefix = "goal") {
  return `${prefix}_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
}

/**
 * Fetch farming goals for a specific user
 */
export async function getUserGoals(userId, options = {}) {
  if (!userId) return [];
  const { status = null, category = null } = options;

  let sql = "SELECT * FROM ai_farming_goals WHERE userId = ?";
  const params = [userId];

  if (status && VALID_STATUSES.includes(status)) {
    sql += " AND status = ?";
    params.push(status);
  }

  if (category && VALID_CATEGORIES.includes(category)) {
    sql += " AND category = ?";
    params.push(category);
  }

  sql += " ORDER BY createdAt DESC";

  const rows = await query.all(sql, params);
  const now = new Date();

  // Dynamically flag overdue goals
  return (rows || []).map((goal) => {
    let isOverdue = false;
    if (goal.status === "active" && goal.deadline) {
      const deadlineDate = new Date(goal.deadline);
      if (!isNaN(deadlineDate.getTime()) && deadlineDate < now) {
        isOverdue = true;
      }
    }
    const target = parseFloat(goal.targetValue) || 0;
    const current = parseFloat(goal.currentValue) || 0;
    const progressPercent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

    return {
      ...goal,
      isOverdue,
      progressPercent
    };
  });
}

/**
 * Get single goal by ID with user isolation
 */
export async function getGoalById(userId, goalId) {
  if (!userId || !goalId) return null;
  const goal = await query.get("SELECT * FROM ai_farming_goals WHERE id = ? AND userId = ?", [goalId, userId]);
  if (!goal) return null;

  const target = parseFloat(goal.targetValue) || 0;
  const current = parseFloat(goal.currentValue) || 0;
  const progressPercent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

  let isOverdue = false;
  if (goal.status === "active" && goal.deadline) {
    const deadlineDate = new Date(goal.deadline);
    if (!isNaN(deadlineDate.getTime()) && deadlineDate < new Date()) {
      isOverdue = true;
    }
  }

  return { ...goal, isOverdue, progressPercent };
}

/**
 * Propose creating a goal (for Phase 6 confirmation or AI assistant)
 */
export function proposeCreateGoal(user, goalData = {}) {
  if (!user || !user.id) {
    throw new Error("UNAUTHENTICATED: User required to propose goal.");
  }

  const { title, description = "", category = "selling", targetValue = 0, unit = "kg", deadline = null, priority = "medium" } = goalData;

  if (!title || typeof title !== "string" || !title.trim()) {
    throw new Error("INVALID_TITLE: Goal title is required.");
  }

  return {
    requiresConfirmation: true,
    proposalType: "AI_GOAL_CREATE",
    goal: {
      userId: user.id,
      title: title.trim().slice(0, 255),
      description: (description || "").trim(),
      category: VALID_CATEGORIES.includes(category) ? category : "selling",
      targetValue: parseFloat(targetValue) || 0,
      currentValue: 0,
      unit: (unit || "kg").trim().slice(0, 50),
      deadline: deadline || null,
      priority: VALID_PRIORITIES.includes(priority) ? priority : "medium"
    },
    message: `Would you like me to set the following goal: "${title.trim()}" (Target: ${targetValue} ${unit})?`
  };
}

/**
 * Create a farming goal in database
 */
export async function createGoal(userId, goalData) {
  if (!userId) throw new Error("UNAUTHENTICATED: User ID required.");

  const {
    title,
    description = "",
    category = "selling",
    targetValue = 0,
    currentValue = 0,
    unit = "kg",
    deadline = null,
    priority = "medium",
    status = "active"
  } = goalData;

  if (!title || typeof title !== "string" || !title.trim()) {
    throw new Error("INVALID_TITLE: Goal title cannot be empty.");
  }

  const goalId = generateId("goal");
  const now = new Date().toISOString();

  await query.run(
    `INSERT INTO ai_farming_goals (
      id, userId, title, description, category, targetValue, currentValue, unit, deadline, status, priority, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      goalId,
      userId,
      title.trim().slice(0, 255),
      (description || "").trim(),
      VALID_CATEGORIES.includes(category) ? category : "selling",
      parseFloat(targetValue) || 0,
      parseFloat(currentValue) || 0,
      (unit || "kg").trim().slice(0, 50),
      deadline || null,
      VALID_STATUSES.includes(status) ? status : "active",
      VALID_PRIORITIES.includes(priority) ? priority : "medium",
      now,
      now
    ]
  );

  return getGoalById(userId, goalId);
}

/**
 * Update an existing goal
 */
export async function updateGoal(userId, goalId, updates = {}) {
  if (!userId || !goalId) return null;

  const existing = await getGoalById(userId, goalId);
  if (!existing) return null;

  const fields = [];
  const params = [];

  if (updates.title !== undefined) {
    fields.push("title = ?");
    params.push(String(updates.title).trim().slice(0, 255));
  }
  if (updates.description !== undefined) {
    fields.push("description = ?");
    params.push(String(updates.description));
  }
  if (updates.category && VALID_CATEGORIES.includes(updates.category)) {
    fields.push("category = ?");
    params.push(updates.category);
  }
  if (updates.targetValue !== undefined) {
    fields.push("targetValue = ?");
    params.push(parseFloat(updates.targetValue) || 0);
  }
  if (updates.currentValue !== undefined) {
    const cVal = parseFloat(updates.currentValue) || 0;
    fields.push("currentValue = ?");
    params.push(cVal);
    // If currentValue >= targetValue, mark as completed if currently active
    const target = updates.targetValue !== undefined ? parseFloat(updates.targetValue) : parseFloat(existing.targetValue);
    if (target > 0 && cVal >= target && existing.status === "active") {
      fields.push("status = ?");
      params.push("completed");
    }
  }
  if (updates.status && VALID_STATUSES.includes(updates.status)) {
    fields.push("status = ?");
    params.push(updates.status);
  }
  if (updates.priority && VALID_PRIORITIES.includes(updates.priority)) {
    fields.push("priority = ?");
    params.push(updates.priority);
  }
  if (updates.deadline !== undefined) {
    fields.push("deadline = ?");
    params.push(updates.deadline);
  }

  if (fields.length === 0) return existing;

  const now = new Date().toISOString();
  fields.push("updatedAt = ?");
  params.push(now);

  params.push(goalId);
  params.push(userId);

  await query.run(`UPDATE ai_farming_goals SET ${fields.join(", ")} WHERE id = ? AND userId = ?`, params);
  return getGoalById(userId, goalId);
}

/**
 * Delete a goal
 */
export async function deleteGoal(userId, goalId) {
  if (!userId || !goalId) return false;
  const result = await query.run("DELETE FROM ai_farming_goals WHERE id = ? AND userId = ?", [goalId, userId]);
  return (result?.changes || 0) > 0;
}

/**
 * Re-calculate progress of a goal using live database transactions
 */
export async function calculateVerifiedGoalProgress(userId, goalId) {
  const goal = await getGoalById(userId, goalId);
  if (!goal) return null;

  let calculatedCurrentValue = parseFloat(goal.currentValue) || 0;
  let sourceFact = "User reported progress.";

  const titleLower = goal.title.toLowerCase();

  // If goal is selling or revenue, inspect actual delivered/accepted orders for this farmer
  if (goal.category === "selling" || goal.category === "production" || goal.category === "revenue") {
    const orders = await query.all(
      `SELECT oi.qty, oi.amount, p.name as productName, o.status 
       FROM order_items oi
       JOIN orders o ON oi.orderId = o.id
       LEFT JOIN products p ON oi.productId = p.id
       WHERE oi.farmerId = ? AND o.status IN ('Delivered', 'Accepted')`,
      [userId]
    );

    if (goal.category === "revenue") {
      const totalRev = (orders || []).reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0);
      calculatedCurrentValue = totalRev;
      sourceFact = `Verified sales total ₹${totalRev} across ${(orders || []).length} completed orders.`;
    } else {
      // Look for specific crop in title or description (e.g. "Tomato", "Onion")
      const cropKeywords = ["tomato", "onion", "carrot", "rice", "wheat", "potato", "spinach", "banana", "pepper"];
      const matchedCrop = cropKeywords.find((c) => titleLower.includes(c));

      if (matchedCrop) {
        const matchingOrders = (orders || []).filter((o) => (o.productName || "").toLowerCase().includes(matchedCrop));
        const totalQty = matchingOrders.reduce((sum, o) => sum + (parseInt(o.qty, 10) || 0), 0);
        calculatedCurrentValue = totalQty;
        sourceFact = `Verified ${totalQty} ${goal.unit} of ${matchedCrop} sold in ${matchingOrders.length} orders.`;
      } else {
        const totalQty = (orders || []).reduce((sum, o) => sum + (parseInt(o.qty, 10) || 0), 0);
        calculatedCurrentValue = totalQty;
        sourceFact = `Verified ${totalQty} ${goal.unit} sold across all crops.`;
      }
    }
  }

  // Update goal with verified data
  const updated = await updateGoal(userId, goalId, { currentValue: calculatedCurrentValue });
  return {
    goal: updated,
    sourceFact,
    verifiedAt: new Date().toISOString()
  };
}
