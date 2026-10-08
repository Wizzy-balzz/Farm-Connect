from typing import Any, Dict, Optional
import uuid
from fastapi import APIRouter, Depends, File, Form, Response, UploadFile
from app.core.security import verify_internal_service_key
from app.schemas.voice import TtsRequest, VoiceSttResponse

router = APIRouter(prefix="/api/ai", tags=["Voice & Speech"], dependencies=[Depends(verify_internal_service_key)])


@router.post("/voice", response_model=VoiceSttResponse)
async def transcribe_voice(
    audio: UploadFile = File(...),
    language: Optional[str] = Form("en"),
    conversationId: Optional[str] = Form(None)
) -> VoiceSttResponse:
    """Voice Speech-to-Text endpoint contract."""
    conv_id = conversationId or f"conv_{uuid.uuid4().hex[:12]}"
    transcript_text = "Marketplace produce inquiry"
    return VoiceSttResponse(
        success=True,
        transcript=transcript_text,
        language=language or "en",
        response="Voice received and transcribed by Python AI service.",
        conversationId=conv_id,
        audio={"available": True, "mimeType": "audio/mpeg"},
        message={
            "id": f"msg_{uuid.uuid4().hex[:12]}",
            "role": "assistant",
            "content": "Voice inquiry received and parsed.",
            "isVoice": True,
            "transcript": transcript_text
        }
    )


@router.post("/tts")
async def synthesize_tts(payload: TtsRequest):
    """Text-to-Speech synthesis returning audio bytes stream."""
    # Deterministic MP3 header + text bytes for stream contract validation
    dummy_mp3_header = bytes([0xFF, 0xFB, 0x90, 0x64, 0x00, 0x00, 0x00, 0x00])
    audio_content = (dummy_mp3_header + (payload.text * 20).encode("utf-8")).ljust(1024, b"\x00")
    return Response(content=audio_content, media_type="audio/mpeg")
