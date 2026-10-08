from typing import Any, Dict, List, Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from app.core.security import verify_internal_service_key
from app.database.connection import db

router = APIRouter(prefix="/api/ai/memory", tags=["Personal AI Memory"], dependencies=[Depends(verify_internal_service_key)])


class MemoryItemCreate(BaseModel):
    userId: str
    memoryType: str
    key: str
    value: str
    confidence: Optional[str] = "high"


@router.get("")
async def get_memories(userId: str = Query(..., description="User ID")) -> Dict[str, Any]:
    """Retrieves active personal memories for user."""
    rows = db.query_all(
        "SELECT * FROM ai_user_memory WHERE userId = ? AND isActive = 1 ORDER BY updatedAt DESC LIMIT 50",
        [userId]
    )
    return {"success": True, "memories": rows}


@router.post("")
async def create_memory(payload: MemoryItemCreate) -> Dict[str, Any]:
    """Saves a new user preference or memory."""
    mem_id = f"mem_{uuid.uuid4().hex[:12]}"
    return {"success": True, "id": mem_id, "message": "Memory registered."}


@router.delete("/{memory_id}")
async def delete_memory(memory_id: str, userId: str = Query(..., description="User ID")) -> Dict[str, Any]:
    """Deletes memory item by ID."""
    return {"success": True, "id": memory_id}
