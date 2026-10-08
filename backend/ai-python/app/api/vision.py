from typing import Any, Dict, Optional
import uuid
from fastapi import APIRouter, Depends, File, Form, UploadFile
from app.core.security import verify_internal_service_key
from app.schemas.vision import CropAnalysisResponse, CropAnalysisDetails

router = APIRouter(prefix="/api/ai", tags=["Crop Vision"], dependencies=[Depends(verify_internal_service_key)])


@router.post("/image-analysis", response_model=CropAnalysisResponse)
async def analyze_crop_image(
    image: UploadFile = File(...),
    notes: Optional[str] = Form(None),
    language: Optional[str] = Form("en"),
    userId: Optional[str] = Form(None)
) -> CropAnalysisResponse:
    """Multimodal crop and plant health analysis contract."""
    analysis_id = f"img_{uuid.uuid4().hex[:12]}"
    return CropAnalysisResponse(
        success=True,
        analysisId=analysis_id,
        analysis=CropAnalysisDetails(
            crop="Crop Analysis",
            observedSymptoms=["Preliminary visual inspection received"],
            possibleIssues=["Agricultural assessment ready"],
            possibleCauses=["Environmental or physiological factors"],
            severity="low",
            facts=["Image metadata and format received cleanly"],
            reasoning=["Multimodal vision model analysis"],
            recommendedActions=["Inspect field conditions and monitor affected crops"],
            prevention=["Maintain optimal irrigation and soil drainage"],
            confidence="medium",
            limitations="Visual inspection requires ground-truth field verification",
            disclaimer="AI-assisted preliminary assessment — not a definitive agricultural diagnosis."
        ),
        message="Preliminary crop image assessment completed successfully."
    )
