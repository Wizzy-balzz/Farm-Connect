from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from app.schemas.common import UserContextSchema


class ChatRequest(BaseModel):
    """Chat message request payload."""
    prompt: str = Field(..., min_length=1, description="User prompt text")
    conversationId: Optional[str] = Field(None, description="Active conversation thread ID")
    lang: Optional[str] = Field("en", description="Target UI language preference")
    user: Optional[UserContextSchema] = Field(None, description="Forwarded user session context")


class ChatMessageResponse(BaseModel):
    """Single assistant message payload."""
    id: str
    role: str = "assistant"
    content: str
    toolName: Optional[str] = None
    toolResult: Optional[Any] = None
    actionSuggestion: Optional[Dict[str, Any]] = None
    createdAt: str


class ChatResponse(BaseModel):
    """Complete chat response payload matching frontend contract."""
    success: bool = True
    conversationId: str
    message: ChatMessageResponse


class ConversationSummary(BaseModel):
    """Conversation summary."""
    id: str
    userId: str
    title: str
    createdAt: str
    updatedAt: str
