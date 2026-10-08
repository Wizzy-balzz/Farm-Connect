from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class TtsRequest(BaseModel):
    """Text-to-Speech synthesis request."""
    text: str = Field(..., min_length=1, max_length=5000, description="Response text to synthesize")
    language: Optional[str] = Field("en", description="Language code: en, ta, hi")
    voice: Optional[str] = None


class VoiceSttResponse(BaseModel):
    """Voice STT response."""
    success: bool = True
    transcript: str
    language: str
    response: str
    conversationId: str
    audio: Dict[str, Any] = Field(default_factory=lambda: {"available": True, "mimeType": "audio/mpeg"})
    message: Dict[str, Any]
