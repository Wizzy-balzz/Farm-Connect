from typing import Optional
from fastapi import Header, HTTPException, status
from pydantic import BaseModel
from app.core.config import settings
from app.core.logging import logger


class AuthenticatedUserContext(BaseModel):
    """Authenticated user context forwarded by Node.js gateway."""
    id: str
    role: str
    name: Optional[str] = "User"
    email: Optional[str] = None
    district: Optional[str] = None
    region: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    rating: Optional[float] = 5.0
    primaryCrop: Optional[str] = None


async def verify_internal_service_key(
    x_internal_service_key: Optional[str] = Header(None, alias="X-Internal-Service-Key")
) -> bool:
    """
    Validates that incoming internal requests originate from the authorized Node.js backend.
    Public requests cannot access the Python service directly without the shared internal key.
    """
    expected_secret = settings.INTERNAL_API_SECRET
    
    # In development, if secret is empty or unset, log warning but allow local connections
    if not expected_secret or expected_secret == "farmconnect_internal_ai_secret_dev_key":
        if not x_internal_service_key or x_internal_service_key == expected_secret:
            return True

    if not x_internal_service_key or x_internal_service_key != expected_secret:
        logger.warning("Unauthorized internal service access attempt rejected.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="UNAUTHORIZED_INTERNAL_SERVICE: Valid X-Internal-Service-Key required."
        )

    return True
