"""
Copilot Goals & Follow-ups Read-Only Tools:
- getMyFarmingGoals
- getMyFollowUps
- getGoalProgress (READ-ONLY calculation only; strictly zero database mutations)

Exact port of read-only logic from backend/services/aiGoalService.js,
backend/services/aiFollowupService.js, and backend/ai/aiTools.js.

Strictly authenticated and isolated:
- User identity is ALWAYS extracted from trusted internal session context (user["id"]).
- Any user-supplied userId, farmerId, or vendorId in parameters is completely ignored.
- Parameterized SQL only.
- Strict read-only: absolutely NO database mutations (INSERT, UPDATE, DELETE).
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from app.database.connection import db

VALID_GOAL_CATEGORIES = {
    "production",
    "selling",
    "inventory",
    "revenue",
    "crop_planning",
    "marketplace",
    "learning",
    "reminders",
}

VALID_GOAL_STATUSES = {"active", "completed", "cancelled", "overdue", "paused"}
VALID_FOLLOWUP_STATUSES = {"pending", "completed", "dismissed", "expired"}

SENSITIVE_KEYS = {
    "password", "password_hash", "passwordhash", "secret", "token",
    "jwt", "otp", "auth_token", "api_key", "apikey", "refresh_token",
    "private_key", "salt", "credentials"
}


def scrub_sensitive_dict(item: Dict[str, Any]) -> Dict[str, Any]:
    """Ensure no private credentials or secret fields leak in responses."""
    return {k: v for k, v in item.items() if str(k).lower() not in SENSITIVE_KEYS}


# -------------------------------------------------------------
# 1. getMyFarmingGoals (Read-Only)
# -------------------------------------------------------------
async def get_my_farming_goals(
    user: Dict[str, Any],
    status: Optional[str] = None,
    category: Optional[str] = None,
    **kwargs: Any
) -> List[Dict[str, Any]]:
    """
    Retrieve farmer's active, completed, or overdue agricultural and selling goals.
    Strictly scoped to authenticated user["id"].
    Never mutates goal state.
    """
    user_id = str(user.get("id") or user.get("user_id") or "").strip()
    if not user_id:
        return []

    sql = "SELECT * FROM ai_farming_goals WHERE userId = ?"
    params: List[Any] = [user_id]

    if status and str(status).strip() in VALID_GOAL_STATUSES:
        sql += " AND status = ?"
        params.append(str(status).strip())

    if category and str(category).strip() in VALID_GOAL_CATEGORIES:
        sql += " AND category = ?"
        params.append(str(category).strip())

    sql += " ORDER BY createdAt DESC LIMIT 50"
    rows = db.query_all(sql, params) or []

    now = datetime.now(timezone.utc)
    results = []
    for goal in rows:
        is_overdue = False
        deadline_str = goal.get("deadline")
        if goal.get("status") == "active" and deadline_str:
            try:
                dl_clean = str(deadline_str).replace("Z", "+00:00")
                if "T" not in dl_clean:
                    dl_date = datetime.fromisoformat(dl_clean).replace(tzinfo=timezone.utc)
                else:
                    dl_date = datetime.fromisoformat(dl_clean)
                    if dl_date.tzinfo is None:
                        dl_date = dl_date.replace(tzinfo=timezone.utc)
                if dl_date < now:
                    is_overdue = True
            except Exception:
                is_overdue = False

        target = float(goal.get("targetValue") or 0.0)
        current = float(goal.get("currentValue") or 0.0)
        progress_percent = min(100, round((current / target) * 100)) if target > 0 else 0

        goal_clean = scrub_sensitive_dict(goal)
        goal_clean["isOverdue"] = is_overdue
        goal_clean["progressPercent"] = progress_percent
        goal_clean["targetValue"] = target
        goal_clean["currentValue"] = current
        results.append(goal_clean)

    return results


# -------------------------------------------------------------
# 2. getMyFollowUps (Read-Only)
# -------------------------------------------------------------
async def get_my_follow_ups(
    user: Dict[str, Any],
    status: Optional[str] = "pending",
    **kwargs: Any
) -> List[Dict[str, Any]]:
    """
    Retrieve pending farming tasks, weather alerts, and copilot reminders.
    Strictly scoped to authenticated user["id"].
    Never mutates task state.
    """
    user_id = str(user.get("id") or user.get("user_id") or "").strip()
    if not user_id:
        return []

    sql = "SELECT * FROM ai_followups WHERE userId = ?"
    params: List[Any] = [user_id]

    status_filter = str(status).strip().lower() if status else "pending"
    if status_filter != "all" and status_filter in VALID_FOLLOWUP_STATUSES:
        sql += " AND status = ?"
        params.append(status_filter)

    sql += " ORDER BY createdAt DESC LIMIT 50"
    rows = db.query_all(sql, params) or []
    return [scrub_sensitive_dict(row) for row in rows]


# -------------------------------------------------------------
# 3. getGoalProgress (READ-ONLY CALCULATION ONLY)
# -------------------------------------------------------------
async def get_goal_progress(
    user: Dict[str, Any],
    goalId: str,
    **kwargs: Any
) -> Optional[Dict[str, Any]]:
    """
    Calculate and inspect progress of a farming goal against verified platform sales.
    STRICTLY READ-ONLY:
    Unlike Node's calculateVerifiedGoalProgress which executes UPDATE ai_farming_goals,
    this Python function calculates metrics purely in-memory from read-only order data
    and NEVER persists or mutates the database.
    """
    user_id = str(user.get("id") or user.get("user_id") or "").strip()
    if not user_id or not goalId:
        return None

    # 1. Fetch goal with strict user scoping
    goal_row = db.query_get(
        "SELECT * FROM ai_farming_goals WHERE id = ? AND userId = ?",
        [str(goalId).strip(), user_id]
    )
    if not goal_row:
        return None

    target = float(goal_row.get("targetValue") or 0.0)
    calculated_current = float(goal_row.get("currentValue") or 0.0)
    source_fact = "User reported progress."
    category = str(goal_row.get("category") or "").lower()
    title_lower = str(goal_row.get("title") or "").lower()
    unit = str(goal_row.get("unit") or "kg")

    # 2. If goal is selling, production, or revenue, inspect actual completed orders
    if category in ("selling", "production", "revenue"):
        sql = """
            SELECT oi.qty, oi.amount, p.name as productName, o.status
            FROM order_items oi
            JOIN orders o ON oi.orderId = o.id
            LEFT JOIN products p ON oi.productId = p.id
            WHERE oi.farmerId = ? AND o.status IN ('Delivered', 'Accepted')
        """
        orders = db.query_all(sql, [user_id]) or []

        if category == "revenue":
            total_rev = sum(float(o.get("amount") or 0.0) for o in orders)
            calculated_current = total_rev
            source_fact = f"Verified sales total ₹{total_rev} across {len(orders)} completed orders."
        else:
            crop_keywords = ["tomato", "onion", "carrot", "rice", "wheat", "potato", "spinach", "banana", "pepper"]
            matched_crop = next((c for c in crop_keywords if c in title_lower), None)

            if matched_crop:
                matching_orders = [o for o in orders if matched_crop in str(o.get("productName") or "").lower()]
                total_qty = sum(int(o.get("qty") or 0) for o in matching_orders)
                calculated_current = float(total_qty)
                source_fact = f"Verified {total_qty} {unit} of {matched_crop} sold in {len(matching_orders)} orders."
            else:
                total_qty = sum(int(o.get("qty") or 0) for o in orders)
                calculated_current = float(total_qty)
                source_fact = f"Verified {total_qty} {unit} sold across all crops."

    # 3. Determine derived progress and status without DB UPDATE
    now = datetime.now(timezone.utc)
    is_overdue = False
    deadline_str = goal_row.get("deadline")
    if goal_row.get("status") == "active" and deadline_str:
        try:
            dl_clean = str(deadline_str).replace("Z", "+00:00")
            if "T" not in dl_clean:
                dl_date = datetime.fromisoformat(dl_clean).replace(tzinfo=timezone.utc)
            else:
                dl_date = datetime.fromisoformat(dl_clean)
                if dl_date.tzinfo is None:
                    dl_date = dl_date.replace(tzinfo=timezone.utc)
            if dl_date < now:
                is_overdue = True
        except Exception:
            is_overdue = False

    derived_status = "completed" if (target > 0 and calculated_current >= target and goal_row.get("status") == "active") else goal_row.get("status")
    progress_percent = min(100, round((calculated_current / target) * 100)) if target > 0 else 0

    calculated_goal = scrub_sensitive_dict(goal_row)
    calculated_goal["targetValue"] = target
    calculated_goal["currentValue"] = calculated_current
    calculated_goal["status"] = derived_status
    calculated_goal["isOverdue"] = is_overdue
    calculated_goal["progressPercent"] = progress_percent

    return {
        "goal": calculated_goal,
        "sourceFact": source_fact,
        "verifiedAt": now.isoformat()
    }
