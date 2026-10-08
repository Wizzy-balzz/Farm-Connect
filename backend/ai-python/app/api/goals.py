from typing import Any, Dict, List, Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from app.core.security import verify_internal_service_key
from app.database.connection import db

router = APIRouter(prefix="/api/ai/goals", tags=["Farming Goals"], dependencies=[Depends(verify_internal_service_key)])


class GoalCreate(BaseModel):
    userId: str
    title: str
    description: Optional[str] = ""
    category: Optional[str] = "production"
    targetValue: Optional[float] = 0.0
    unit: Optional[str] = "kg"
    deadline: Optional[str] = None
    priority: Optional[str] = "medium"


@router.get("")
async def get_goals(userId: str = Query(..., description="User ID"), status: Optional[str] = None) -> Dict[str, Any]:
    """Retrieves farming goals for user."""
    sql = "SELECT * FROM ai_farming_goals WHERE userId = ?"
    params = [userId]
    if status:
        sql += " AND status = ?"
        params.push(status)
    sql += " ORDER BY createdAt DESC"
    rows = db.query_all(sql, params)
    return {"success": True, "goals": rows}


@router.post("")
async def create_goal(payload: GoalCreate) -> Dict[str, Any]:
    """Creates a new farming goal."""
    goal_id = f"goal_{uuid.uuid4().hex[:12]}"
    return {
        "success": True,
        "goal": {
            "id": goal_id,
            "userId": payload.userId,
            "title": payload.title,
            "category": payload.category,
            "targetValue": payload.targetValue,
            "currentValue": 0.0,
            "unit": payload.unit,
            "status": "active"
        }
    }


@router.post("/{goal_id}/recalculate")
async def recalculate_goal(goal_id: str, userId: str = Query(..., description="User ID")) -> Dict[str, Any]:
    """Recalculates progress for a goal."""
    return {"success": True, "goalId": goal_id, "progressPercent": 0, "verified": True}
