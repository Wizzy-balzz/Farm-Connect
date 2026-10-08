from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class CropAnalysisDetails(BaseModel):
    """Structured agronomic crop vision details."""
    crop: str = "Unknown"
    observedSymptoms: List[str] = Field(default_factory=list)
    possibleIssues: List[str] = Field(default_factory=list)
    possibleCauses: List[str] = Field(default_factory=list)
    severity: str = "medium"
    facts: List[str] = Field(default_factory=list)
    reasoning: List[str] = Field(default_factory=list)
    recommendedActions: List[str] = Field(default_factory=list)
    prevention: List[str] = Field(default_factory=list)
    confidence: str = "medium"
    limitations: str = "Preliminary assessment from photo"
    disclaimer: str = "AI-assisted preliminary assessment — not a definitive agricultural diagnosis."


class CropAnalysisResponse(BaseModel):
    """Complete crop image analysis response."""
    success: bool = True
    analysisId: str
    conversationId: Optional[str] = None
    analysis: CropAnalysisDetails
    message: str
