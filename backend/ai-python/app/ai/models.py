from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class AiErrorCode(str, Enum):
    """Centralized AI service error classifications for FarmConnect."""
    SUCCESS = "SUCCESS"
    BAD_REQUEST = "BAD_REQUEST"                     # 400
    AUTH_ERROR = "AUTH_ERROR"                       # 401
    PERMISSION_ERROR = "PERMISSION_ERROR"           # 403
    MODEL_NOT_FOUND = "MODEL_NOT_FOUND"             # 404
    QUOTA_EXHAUSTED = "QUOTA_EXHAUSTED"             # 429 Daily/metric limit
    RATE_LIMITED = "RATE_LIMITED"                   # 429 Temporary rate limit
    SERVER_ERROR = "SERVER_ERROR"                   # 500
    TEMPORARILY_UNAVAILABLE = "TEMPORARILY_UNAVAILABLE" # 503 / 502 / 504 / 408
    TIMEOUT = "TIMEOUT"                             # Timeout
    NETWORK_ERROR = "NETWORK_ERROR"                 # Network failure
    UNKNOWN_ERROR = "UNKNOWN_ERROR"


# Backward-compatibility alias — existing tests and imports continue to work
GeminiErrorCode = AiErrorCode


class ReasoningType(str, Enum):
    """Reasoning categories distinguishing advisory from deterministic retrieval."""
    DETERMINISTIC_NLP = "deterministic_nlp"
    AGRICULTURAL_ADVISORY = "agricultural_advisory"
    SELLING_STRATEGY = "selling_strategy"
    CROP_RECOMMENDATION = "crop_recommendation"
    FARM_ADVISORY = "farm_advisory"
    MARKET_INTERPRETATION = "market_interpretation"
    TOOL_ROUTING = "tool_routing"
    GENERAL_CONVERSATION = "general_conversation"
    DETERMINISTIC_FALLBACK = "deterministic_fallback"


class ReasoningRequest(BaseModel):
    """Input payload for internal reasoning endpoint."""
    text: str = Field(..., min_length=1, description="Raw user query text")
    language_override: Optional[str] = Field(default=None, description="Optional forced ISO language code")
    user_role: Optional[str] = Field(default="farmer", description="User role in FarmConnect: farmer, buyer, admin")
    user_location: Optional[str] = Field(default=None, description="Known user location/mandi")
    context: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Conversation context, history, known entities")
    force_reasoning: Optional[bool] = Field(default=False, description="For testing/diagnostics: force complex reasoning even if deterministic suffices")

    # Backward-compatibility alias
    @property
    def force_gemini(self) -> bool:
        return self.force_reasoning


class AiExecutionResult(BaseModel):
    """Low-level execution result from the AI reasoning engine."""
    success: bool
    text: Optional[str] = None
    function_calls: Optional[List[Dict[str, Any]]] = None
    attempts: int = 1
    latency_ms: int = 0
    error_code: Optional[AiErrorCode] = None
    error_message: Optional[str] = None
    is_transient: bool = False


# Backward-compatibility alias
GeminiExecutionResult = AiExecutionResult


class StructuredReasoningOutput(BaseModel):
    """Schema expected from the AI reasoning engine output."""
    answer: str = Field(..., description="Direct, helpful response to the farmer in user language")
    intent: str = Field(..., description="Target agricultural intent code")
    language: str = Field(..., description="Language/dialect of the response")
    confidence: float = Field(default=0.85, ge=0.0, le=1.0)
    reasoning_type: str = Field(default="agricultural_advisory")
    requires_tool: bool = Field(default=False)
    suggested_tool: Optional[str] = Field(default=None)
    suggested_tool_args: Optional[Dict[str, Any]] = Field(default_factory=dict)
    warnings: List[str] = Field(default_factory=list)


class ReasoningResponse(BaseModel):
    """Final, validated structured response returned to internal caller."""
    answer: str
    intent: str
    language: str
    confidence: float
    reasoning_type: str
    requires_tool: bool = False
    suggested_tool: Optional[str] = None
    suggested_tool_args: Optional[Dict[str, Any]] = Field(default_factory=dict)
    executed_tools: Optional[List[Dict[str, Any]]] = None
    tool_call_count: int = 0
    warnings: List[str] = Field(default_factory=list)
    fallback_used: bool = False
    gemini_used: bool = False
    entities: Dict[str, Any] = Field(default_factory=dict)
    processing_metadata: Dict[str, Any] = Field(default_factory=dict)
