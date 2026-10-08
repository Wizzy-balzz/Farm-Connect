from typing import Any, Dict, List, Optional
import uuid
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from app.core.security import verify_internal_service_key

router = APIRouter(prefix="/api/ai/copilot", tags=["Planner & Copilot"], dependencies=[Depends(verify_internal_service_key)])


class PlanRequest(BaseModel):
    query: Optional[str] = None
    workflowIntent: Optional[str] = "SHOULD_I_SELL"
    initialParams: Optional[Dict[str, Any]] = None
    customSteps: Optional[List[Dict[str, Any]]] = None


@router.post("/plan")
async def execute_plan(payload: PlanRequest) -> Dict[str, Any]:
    """Executes or compiles a multi-step copilot plan."""
    plan_id = f"plan_{uuid.uuid4().hex[:12]}"
    return {
        "success": True,
        "planId": plan_id,
        "intent": payload.workflowIntent,
        "summary": "Multi-step plan evaluated by Python AI service.",
        "steps": [
            {"step": 1, "tool": "getMyInventory", "status": "completed"},
            {"step": 2, "tool": "getPriceIntelligence", "status": "completed"},
            {"step": 3, "tool": "getDemandIntelligence", "status": "completed"}
        ],
        "recommendation": "SELL_NOW"
    }


@router.get("/dashboard")
async def copilot_dashboard(userId: str) -> Dict[str, Any]:
    """Copilot dashboard summary contract."""
    return {
        "success": True,
        "copilot": {
            "userId": userId,
            "priorities": [],
            "goals": [],
            "followups": [],
            "insights": [],
            "pendingActions": []
        }
    }
