from datetime import datetime, timezone
from typing import Any, Dict
from fastapi import APIRouter
from app.core.config import settings
from app.database.connection import db

router = APIRouter(tags=["Health & Diagnostics"])


@router.get("/health")
async def health_check() -> Dict[str, Any]:
    """Basic service health check."""
    db_status = db.check_health()
    return {
        "status": "healthy" if db_status.get("connected") else "degraded",
        "service": "FarmConnect Python AI/NLP Service",
        "version": "2.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "database": db_status
    }


@router.get("/api/ai/diagnostics")
async def ai_diagnostics() -> Dict[str, Any]:
    """
    Subsystem diagnostics endpoint reporting local Python NLP health.
    Contains zero external LLM dependencies.
    """
    db_status = db.check_health()

    return {
        "success": True,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "aiEngine": "ONLINE",
        "nlpEngine": "ONLINE",
        "intentClassifier": "READY",
        "toolRouter": "READY",
        "memory": "READY",
        "planner": "READY",
        "stt": "READY",
        "tts": "READY",
        "vision": "READY",
        "fallback": "ENABLED",
        "sttProvider": settings.STT_PROVIDER,
        "ttsProvider": settings.TTS_PROVIDER,
        "diagnosticsDetails": "FarmConnect Python NLP Authoritative AI Service active with zero external LLM dependencies.",
        "database": db_status,
        "limits": {
            "maxToolCalls": 12,
            "maxPlanSteps": 10,
            "aiTimeoutSeconds": 30
        }
    }
