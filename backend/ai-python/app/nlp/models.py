from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class LanguageDetectionResult(BaseModel):
    """Result of deterministic script and vocabulary language detection."""
    language: str = Field(..., description="ISO 639-1 code or sub-dialect (e.g., 'en', 'ta', 'hi', 'tanglish', 'hinglish')")
    language_name: str = Field(..., description="Human readable language name")
    script: str = Field(..., description="Detected script: 'latin', 'tamil', 'devanagari', 'telugu', etc.")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Explainable deterministic confidence score")
    is_mixed: bool = Field(default=False, description="True if code-switching or mixed scripts detected")


class NormalizedQuantity(BaseModel):
    value: float
    unit: str
    raw: str


class NormalizedPrice(BaseModel):
    value: float
    currency: str = "INR"
    per_unit: Optional[str] = "kg"
    operator: Optional[str] = None
    raw: str


class NormalizedTextResult(BaseModel):
    """Result of deterministic text normalization."""
    original_text: str
    normalized_text: str
    normalized_tokens: List[str] = Field(default_factory=list)
    quantities: List[NormalizedQuantity] = Field(default_factory=list)
    prices: List[NormalizedPrice] = Field(default_factory=list)


class ExtractedEntities(BaseModel):
    """Extracted agricultural, commerce, and location entities."""
    commodity: Optional[str] = None
    raw_commodity: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    price: Optional[float] = None
    currency: Optional[str] = None
    price_operator: Optional[str] = None
    location: Optional[str] = None
    time_expression: Optional[str] = None


class IntentResult(BaseModel):
    """Result of deterministic rule-based intent classification."""
    intent: str = Field(..., description="Target intent code (e.g. SELLING_STRATEGY, ORDER_TRACKING)")
    confidence: float = Field(..., ge=0.0, le=1.0)
    matched_patterns: List[str] = Field(default_factory=list)


class NlpPipelineResult(BaseModel):
    """Structured end-to-end output of deterministic NLP pipeline."""
    original_text: str
    language: LanguageDetectionResult
    normalization: NormalizedTextResult
    entities: ExtractedEntities
    intent: IntentResult
    context_metadata: Dict[str, Any] = Field(default_factory=dict)
    processing: Dict[str, Any] = Field(
        default_factory=lambda: {
            "gemini_used": False,
            "deterministic": True,
            "pipeline_version": "1.0.0"
        }
    )
