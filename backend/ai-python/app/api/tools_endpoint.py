"""
Internal API endpoint for executing and listing migrated Python AI tools.
Protected by X-Internal-Service-Key.
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.security import verify_internal_service_key
from app.tools.dispatcher import dispatch_tool
from app.tools.registry import list_tools
from app.tools.schemas import ToolExecutionResult

router = APIRouter(
    prefix="/api/ai/tools",
    tags=["AI Tools"],
    dependencies=[Depends(verify_internal_service_key)]
)


class ToolExecutionRequest(BaseModel):
    tool_name: str = Field(..., description="Registered tool name")
    args: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Arguments for the tool")
    user: Optional[Dict[str, Any]] = Field(
        default_factory=lambda: {"id": "internal_tester", "role": "farmer"},
        description="Authenticated user context"
    )


class ToolMetadata(BaseModel):
    name: str
    description: str
    required_roles: List[str]
    classification: str
    security_level: str


@router.get("", response_model=List[ToolMetadata])
async def list_registered_tools() -> List[ToolMetadata]:
    """List all available Phase 3B Python tools."""
    tools = list_tools()
    return [
        ToolMetadata(
            name=t.name,
            description=t.description,
            required_roles=t.required_roles,
            classification=t.classification,
            security_level=t.security_level
        )
        for t in tools
    ]


@router.post("/execute", response_model=ToolExecutionResult)
async def execute_tool_endpoint(req: ToolExecutionRequest) -> ToolExecutionResult:
    """Execute a single Python AI tool in authenticated context."""
    user = req.user or {"id": "internal_tester", "role": "farmer"}
    return await dispatch_tool(user=user, tool_name=req.tool_name, args=req.args)
