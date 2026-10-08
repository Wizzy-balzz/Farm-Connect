from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.core.security import verify_internal_service_key
from app.schemas.chat import ChatRequest, ChatResponse, ChatMessageResponse
from app.database.connection import db
from app.nlp.pipeline import process_nlp
from app.nlp.tool_router import route_intent_to_tool
from app.nlp.response_formatter import format_tool_response, format_conversational_response
from app.ai.fallback import build_fallback_response
from app.tools.dispatcher import dispatch_tool

router = APIRouter(prefix="/api/ai", tags=["Chat & Conversations"], dependencies=[Depends(verify_internal_service_key)])


@router.post("/chat", response_model=ChatResponse)
async def process_chat(payload: ChatRequest) -> ChatResponse:
    """
    Authoritative FarmConnect AI Chat endpoint powered completely by local Python NLP.
    Pipeline:
      1. Deterministic NLP (Language detection, Normalization, Entity extraction, Intent detection)
      2. Tool Selection & RBAC Authorization Check
      3. Safe Dispatch to Existing FarmConnect Tools (MySQL / Read-only / Action Proposals)
      4. Multilingual Deterministic Response Formatting
      5. Structured Response Generation with Zero External LLM Calls
    """
    now = datetime.now(timezone.utc).isoformat()
    conv_id = payload.conversationId or f"conv_{uuid.uuid4().hex[:12]}"
    msg_id = f"msg_{uuid.uuid4().hex[:12]}"

    user_dict: Dict[str, Any] = (
        payload.user.model_dump()
        if payload.user and hasattr(payload.user, "model_dump")
        else (payload.user if isinstance(payload.user, dict) else {"id": "usr_default", "role": "farmer", "name": "Farmer"})
    )

    clean_prompt = (payload.prompt or "").strip()
    if not clean_prompt:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_INPUT", "message": "Chat prompt cannot be empty."}
        )

    # 1. Deterministic NLP Pipeline
    nlp_result = process_nlp(clean_prompt, context={"lang": payload.lang, "user": user_dict})

    # 2. Tool Selection
    tool_name, tool_args, is_low_confidence = route_intent_to_tool(nlp_result, user_dict)

    final_content: str = ""
    executed_tool_name: Optional[str] = None
    executed_tool_result: Optional[Any] = None
    action_suggestion: Optional[Dict[str, Any]] = None

    if is_low_confidence:
        # Ambiguous query -> ask a clear clarifying question without guessing tools
        final_content = format_conversational_response(nlp_result, user_dict)

    elif tool_name:
        executed_tool_name = tool_name
        # 3. Dispatch tool under authenticated user context with RBAC
        tool_res = await dispatch_tool(user=user_dict, tool_name=tool_name, args=tool_args)
        raw_tool_dict = tool_res.model_dump()
        executed_tool_result = raw_tool_dict.get("data") if raw_tool_dict.get("success") else raw_tool_dict.get("error")

        # 4. Format structured response
        formatted = format_tool_response(
            intent=nlp_result.intent.intent,
            tool_name=tool_name,
            tool_result=raw_tool_dict,
            nlp_result=nlp_result,
            user=user_dict
        )
        final_content = formatted["text"]
        action_suggestion = formatted.get("actionSuggestion")

    else:
        # Conversational greeting, advisory, or general chat
        if nlp_result.intent.intent in ("FARM_ADVISORY", "CROP_RECOMMENDATION", "SELLING_STRATEGY"):
            fallback_res = build_fallback_response(nlp_result, reason_label="deterministic_nlp")
            final_content = fallback_res.answer
        else:
            final_content = format_conversational_response(nlp_result, user_dict)

    return ChatResponse(
        success=True,
        conversationId=conv_id,
        message=ChatMessageResponse(
            id=msg_id,
            role="assistant",
            content=final_content,
            toolName=executed_tool_name,
            toolResult=executed_tool_result,
            actionSuggestion=action_suggestion,
            createdAt=now
        )
    )


@router.get("/conversations")
async def list_conversations(userId: str = Query(..., description="User ID")) -> Dict[str, Any]:
    """Lists conversations for an isolated user."""
    rows = db.query_all(
        "SELECT * FROM ai_conversations WHERE userId = ? ORDER BY updatedAt DESC LIMIT 50",
        [userId]
    )
    return {"success": True, "conversations": rows}
