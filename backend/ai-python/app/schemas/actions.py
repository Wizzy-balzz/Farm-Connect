from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ConfirmActionRequest(BaseModel):
    """Action confirmation request with cryptographic token."""
    confirmationToken: str = Field(..., min_length=16, description="Cryptographic confirmation token")
    userId: Optional[str] = None


class CancelActionRequest(BaseModel):
    """Explicit action cancellation request."""
    actionId: str = Field(..., min_length=1, description="Proposal or action ID to cancel")
    userId: Optional[str] = None


class ActionProposalResponse(BaseModel):
    """Action proposal presented to user on ActionConfirmationCard."""
    success: bool = True
    actionId: str
    proposalType: str
    confirmationToken: str
    displayFields: List[Dict[str, Any]]
    expectedState: Dict[str, Any]
    expiresInSeconds: int = 300
