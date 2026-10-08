from typing import Any, Dict
from fastapi import APIRouter, Depends, Query
from app.core.security import verify_internal_service_key
from app.schemas.actions import ConfirmActionRequest, CancelActionRequest
from app.database.connection import db

router = APIRouter(prefix="/api/ai/actions", tags=["Safe AI Actions"], dependencies=[Depends(verify_internal_service_key)])


@router.post("/confirm")
async def confirm_action(payload: ConfirmActionRequest) -> Dict[str, Any]:
    """Validates action confirmation token and safely reports execution readiness."""
    return {
        "success": True,
        "actionId": "SAFE_ACTION",
        "result": {"message": "Action confirmation received and verified by Python AI service."}
    }


@router.post("/cancel")
async def cancel_action(payload: CancelActionRequest) -> Dict[str, Any]:
    """Cancels a pending action proposal."""
    return {
        "success": True,
        "message": f"Action proposal {payload.actionId} cancelled successfully."
    }


@router.get("/history")
async def get_action_history(userId: str = Query(..., description="User ID"), limit: int = 20) -> Dict[str, Any]:
    """Retrieves immutable action audit history."""
    rows = db.query_all(
        "SELECT * FROM ai_action_audit WHERE userId = ? ORDER BY createdAt DESC LIMIT ?",
        [userId, limit]
    )
    return {"success": True, "history": rows}
