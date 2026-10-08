from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from app.core.security import verify_internal_service_key
from app.nlp.models import NlpPipelineResult
from app.nlp.pipeline import process_nlp

router = APIRouter(prefix="/api/ai/nlp", tags=["NLP Analysis"], dependencies=[Depends(verify_internal_service_key)])


class NlpAnalyzeRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Raw input text to analyze")
    context: Optional[Dict[str, Any]] = Field(default=None, description="Optional conversation context")


@router.post("/analyze", response_model=NlpPipelineResult)
async def analyze_nlp(payload: NlpAnalyzeRequest) -> NlpPipelineResult:
    """
    Internal deterministic NLP analysis endpoint.
    Performs language detection, text normalization, agricultural entity extraction,
    and intent classification without calling Gemini or mutating business data.
    """
    return process_nlp(payload.text, context=payload.context)
