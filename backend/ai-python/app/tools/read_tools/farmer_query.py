"""
Farmer Query Tools: getFarmerProfile, getFarmerProducts.
Exact port of read-only logic from backend/ai/aiTools.js.
Ensures zero leakage of credentials, passwords, tokens, or private security fields.
"""

from typing import Any, Dict, List, Optional
from app.database.connection import db


async def get_farmer_profile(
    farmerId: Optional[str] = None,
    params: Optional[Dict[str, Any]] = None,
    user: Optional[Dict[str, Any]] = None,
    **kwargs: Any
) -> Optional[Dict[str, Any]]:
    """
    Get verified farmer background, farm name, location, rating, and completed order count.
    Never exposes passwords, tokens, OTPs, or private security fields.
    """
    p = {**(params or {}), **kwargs}
    f_id = farmerId or p.get("farmerId")
    if not f_id:
        return None

    # Query only public-facing safe profile columns
    sql = """
        SELECT id, name, farmName, region, district, city, verificationStatus, about, rating, completedOrders
        FROM users
        WHERE id = ? AND role = 'farmer'
    """
    row = db.query_get(sql, [str(f_id).strip()])
    return row or None


async def get_farmer_products(
    farmerId: Optional[str] = None,
    params: Optional[Dict[str, Any]] = None,
    user: Optional[Dict[str, Any]] = None,
    **kwargs: Any
) -> List[Dict[str, Any]]:
    """List all active produce lots listed by a specific farmer."""
    p = {**(params or {}), **kwargs}
    f_id = farmerId or p.get("farmerId")
    if not f_id:
        return []

    sql = "SELECT * FROM products WHERE farmerId = ? ORDER BY createdAt DESC"
    rows = db.query_all(sql, [str(f_id).strip()])
    return rows or []
