from typing import Any, Dict, Generic, List, Optional, TypeVar
from pydantic import BaseModel, Field

T = TypeVar("T")


class StandardResponse(BaseModel, Generic[T]):
    """Standardized API response wrapper matching FarmConnect convention."""
    success: bool = True
    data: Optional[T] = None
    error: Optional[Dict[str, Any]] = None


class UserContextSchema(BaseModel):
    """Authenticated user context model."""
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
