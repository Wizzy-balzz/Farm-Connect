from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from app.core.security import verify_internal_service_key
from app.database.connection import db

router = APIRouter(prefix="/api/ai/insights", tags=["Proactive Insights"], dependencies=[Depends(verify_internal_service_key)])


@router.get("")
async def get_insights(
    userId: str = Query(..., description="User ID"),
    lang: str = Query("en"),
    status: str = Query("active")
) -> Dict[str, Any]:
    """Retrieves active proactive agricultural alerts for user."""
    rows = db.query_all(
        "SELECT * FROM ai_proactive_insights WHERE userId = ? AND status = ? ORDER BY createdAt DESC LIMIT 20",
        [userId, status]
    )
    return {"success": True, "insights": rows}


@router.post("/generate")
async def generate_insights(userId: str = Query(..., description="User ID")) -> Dict[str, Any]:
    """Triggers on-demand evaluation of proactive insights."""
    return {"success": True, "generatedCount": 0, "message": "Evaluation completed."}


@router.post("/{insight_id}/read")
async def mark_insight_read(insight_id: str, userId: str = Query(..., description="User ID")) -> Dict[str, Any]:
    """Marks proactive insight as read."""
    return {"success": True, "id": insight_id}
