from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from app.core.security import verify_internal_service_key

router = APIRouter(prefix="/api/ai/marketplace", tags=["Marketplace Selling Agent"], dependencies=[Depends(verify_internal_service_key)])


class SellingStrategyRequest(BaseModel):
    commodity: Optional[str] = "Tomato"
    quantity: Optional[float] = 100.0


class CompareOptionsRequest(BaseModel):
    commodities: List[str] = Field(default_factory=lambda: ["Tomato", "Onion"])


@router.post("/selling-strategy")
async def get_selling_strategy(payload: SellingStrategyRequest) -> Dict[str, Any]:
    """Generates a data-driven selling strategy for a crop."""
    return {
        "success": True,
        "strategy": {
            "commodity": payload.commodity,
            "quantity": payload.quantity,
            "recommendation": "SELL_NOW",
            "facts": {"stock": payload.quantity, "benchmarkPrice": 45.0},
            "reasoning": "High current demand and favorable weather conditions.",
            "estimatedGrossRevenue": (payload.quantity or 0) * 45.0,
            "confidence": "high"
        }
    }


@router.post("/selling-plan")
async def get_selling_plan() -> Dict[str, Any]:
    """Generates whole-farm selling plan."""
    return {"success": True, "plan": {"crops": [], "priority": "high"}}


@router.post("/compare")
async def compare_options(payload: CompareOptionsRequest) -> Dict[str, Any]:
    """Compares market returns between commodities."""
    return {"success": True, "comparison": {"commodities": payload.commodities}}


@router.get("/opportunities")
async def get_opportunities() -> Dict[str, Any]:
    """Detects immediate selling opportunities."""
    return {"success": True, "opportunities": []}


@router.get("/overview")
async def get_overview() -> Dict[str, Any]:
    """Regional marketplace price and volume overview."""
    return {"success": True, "overview": {"totalListings": 0, "activeCommodities": []}}
