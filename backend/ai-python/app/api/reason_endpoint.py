from fastapi import APIRouter, Depends
from app.core.security import verify_internal_service_key
from app.ai.models import ReasoningRequest, ReasoningResponse
from app.ai.reasoning import reason_about_query

router = APIRouter(
    prefix="/api/ai",
    tags=["AI Reasoning Engine"],
    dependencies=[Depends(verify_internal_service_key)]
)


@router.post("/reason", response_model=ReasoningResponse)
async def reason_endpoint(payload: ReasoningRequest) -> ReasoningResponse:
    """
    Internal isolated reasoning endpoint for Phase 2C verification.
    Pipeline:
      User Text -> Deterministic NLP -> Reasoning Router -> Gemini (if needed) -> Response Validation -> Fallback (if failed).
    Protected by X-Internal-Service-Key. Node.js production traffic is NOT routed here.
    """
    return await reason_about_query(payload)
