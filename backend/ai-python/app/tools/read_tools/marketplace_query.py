"""
Marketplace Query Tools: searchProducts, getProduct, getNearbyProducts, compareProducts.
Exact port of read-only logic from backend/ai/aiTools.js.
"""

from typing import Any, Dict, List, Optional
from app.database.connection import db
from app.nlp.agriculture_dictionary import CROP_NAME_CANONICAL


def normalize_crop_name(crop_input: Optional[str]) -> str:
    """Normalizes produce/crop names in Tamil, Hindi, Tanglish, Hinglish to canonical English names."""
    if not crop_input or not isinstance(crop_input, str):
        return ""
    cleaned = crop_input.strip().lower()
    if cleaned in CROP_NAME_CANONICAL:
        return CROP_NAME_CANONICAL[cleaned][0]
    for key, (canonical, _) in CROP_NAME_CANONICAL.items():
        if cleaned in key.lower() or key.lower() in cleaned:
            return canonical
    return crop_input.strip()


async def search_products(
    params: Optional[Dict[str, Any]] = None,
    user: Optional[Dict[str, Any]] = None,
    queryText: Optional[str] = "",
    category: Optional[str] = "All",
    organic: Optional[bool] = False,
    maxPrice: Optional[float] = None,
    moq: Optional[float] = None,
    **kwargs: Any
) -> List[Dict[str, Any]]:
    """
    Search agricultural produce listings in the FarmConnect marketplace with optional filters
    for name, category, organic certification, max price, and MOQ.
    Returns list of matching product records.
    """
    p = {**(params or {}), **kwargs}
    q_text = (p.get("queryText") if p.get("queryText") is not None else queryText) or p.get("keyword") or ""
    cat = (p.get("category") if p.get("category") is not None else category) or "All"
    is_org = p.get("organic") if p.get("organic") is not None else organic
    max_p = p.get("maxPrice") if p.get("maxPrice") is not None else maxPrice
    moq_val = p.get("moq") if p.get("moq") is not None else moq
    limit = p.get("limit", 20)

    sql = "SELECT * FROM products WHERE 1=1"
    sql_params: List[Any] = []

    if q_text and str(q_text).strip():
        raw_trimmed = str(q_text).strip()
        canonical = normalize_crop_name(raw_trimmed)
        if canonical and canonical.lower() != raw_trimmed.lower():
            sql += " AND (LOWER(name) LIKE ? OR LOWER(description) LIKE ? OR LOWER(name) LIKE ? OR LOWER(description) LIKE ?)"
            raw_term = f"%{raw_trimmed.lower()}%"
            canon_term = f"%{canonical.lower()}%"
            sql_params.extend([raw_term, raw_term, canon_term, canon_term])
        else:
            sql += " AND (LOWER(name) LIKE ? OR LOWER(description) LIKE ?)"
            term = f"%{raw_trimmed.lower()}%"
            sql_params.extend([term, term])

    if cat and str(cat).lower() != "all":
        sql += " AND LOWER(category) = LOWER(?)"
        sql_params.append(str(cat).strip())

    if is_org in (True, "true", "1", 1):
        sql += " AND organic = 1"

    if max_p is not None:
        try:
            val = float(max_p)
            if val >= 0:
                sql += " AND price <= ?"
                sql_params.append(val)
        except (ValueError, TypeError):
            pass

    if moq_val is not None:
        try:
            val = float(moq_val)
            if val >= 0:
                sql += " AND moq <= ?"
                sql_params.append(val)
        except (ValueError, TypeError):
            pass

    sql += f" ORDER BY createdAt DESC LIMIT {int(limit)}"
    rows = db.query_all(sql, sql_params)
    return rows or []


async def get_product(
    id: Optional[str] = None,
    params: Optional[Dict[str, Any]] = None,
    user: Optional[Dict[str, Any]] = None,
    **kwargs: Any
) -> Optional[Dict[str, Any]]:
    """Retrieve complete specification for a single produce listing by its product ID."""
    p = {**(params or {}), **kwargs}
    prod_id = id or p.get("id")
    if not prod_id:
        return None
    return db.query_get("SELECT * FROM products WHERE id = ?", [str(prod_id).strip()])


async def get_nearby_products(
    params: Optional[Dict[str, Any]] = None,
    user: Optional[Dict[str, Any]] = None,
    district: Optional[str] = None,
    region: Optional[str] = None,
    countryCode: Optional[str] = "IN",
    **kwargs: Any
) -> List[Dict[str, Any]]:
    """Find fresh harvest listings located within a specific district or region/state."""
    p = {**(params or {}), **kwargs}
    dist = (district or p.get("district") or "").strip()
    reg = (region or p.get("region") or "").strip()
    cc = (countryCode or p.get("countryCode") or "IN").strip()

    sql = "SELECT * FROM products WHERE 1=1"
    sql_params: List[Any] = []

    if dist:
        sql += " AND LOWER(district) = LOWER(?)"
        sql_params.append(dist)
    elif reg:
        sql += " AND LOWER(region) = LOWER(?)"
        sql_params.append(reg)

    if cc:
        sql += " AND UPPER(countryCode) = UPPER(?)"
        sql_params.append(cc)

    sql += " ORDER BY createdAt DESC LIMIT 15"
    rows = db.query_all(sql, sql_params)
    return rows or []


async def compare_products(
    productIds: Optional[List[str]] = None,
    params: Optional[Dict[str, Any]] = None,
    user: Optional[Dict[str, Any]] = None,
    **kwargs: Any
) -> List[Dict[str, Any]]:
    """Compare multiple produce listings side-by-side by price, grade, MOQ, and organic status."""
    p = {**(params or {}), **kwargs}
    p_ids = productIds or p.get("productIds") or []
    if not isinstance(p_ids, list) or len(p_ids) == 0:
        return []

    clean_ids = [str(pid).strip() for pid in p_ids if str(pid).strip()]
    if not clean_ids:
        return []

    placeholders = ",".join(["?"] * len(clean_ids))
    sql = f"SELECT * FROM products WHERE id IN ({placeholders})"
    rows = db.query_all(sql, clean_ids)
    return rows or []


async def get_nearby_buyer_opportunities(
    district: Optional[str] = None,
    region: Optional[str] = None,
    farmerId: Optional[str] = None,
    params: Optional[Dict[str, Any]] = None,
    user: Optional[Dict[str, Any]] = None,
    **kwargs: Any
) -> Dict[str, Any]:
    """
    Retrieves unfulfilled buyer orders near farmer location.
    Strips all private customer information, addresses, phone numbers, and payment credentials.
    Zero-fabrication: returns empty list if no pending buyer opportunities exist.
    """
    p = {**(params or {}), **kwargs}
    u = user or {}
    f_id = farmerId or p.get("farmerId") or u.get("id")

    farmer = None
    if f_id:
        farmer = db.query_get("SELECT district, region FROM users WHERE id = ?", [str(f_id).strip()])

    target_district = (district or p.get("district") or (farmer.get("district") if farmer else None) or u.get("district") or "").strip()
    target_region = (region or p.get("region") or (farmer.get("region") if farmer else None) or u.get("region") or "").strip()

    sql = """
        SELECT o.id as orderId, o.vendorName, o.deliveryDistrict, o.deliveryRegion, o.totalAmount, o.status, o.createdAt,
               oi.qty, oi.unitPrice, p.name as productName, p.category
        FROM orders o
        JOIN order_items oi ON o.id = oi.orderId
        JOIN products p ON oi.productId = p.id
        WHERE o.status IN ('Pending', 'Processing')
    """
    sql_params: List[Any] = []

    if target_district:
        sql += " AND LOWER(o.deliveryDistrict) = LOWER(?)"
        sql_params.append(target_district)
    elif target_region:
        sql += " AND LOWER(o.deliveryRegion) = LOWER(?)"
        sql_params.append(target_region)

    sql += " ORDER BY o.createdAt DESC LIMIT 15"
    rows = db.query_all(sql, sql_params) or []

    # Map rows to sanitized structures without private customer data
    sanitized_opportunities = []
    for r in rows:
        sanitized_opportunities.append({
            "orderId": r.get("orderId"),
            "vendorName": r.get("vendorName") or "Verified Wholesale Buyer",
            "deliveryDistrict": r.get("deliveryDistrict"),
            "deliveryRegion": r.get("deliveryRegion"),
            "totalAmount": float(r.get("totalAmount") or 0.0),
            "status": r.get("status"),
            "createdAt": r.get("createdAt"),
            "qty": int(r.get("qty") or 0),
            "unitPrice": float(r.get("unitPrice") or 0.0),
            "productName": r.get("productName"),
            "category": r.get("category"),
        })

    return {
        "success": True,
        "location": {"district": target_district or None, "region": target_region or None},
        "buyerDemandCount": len(sanitized_opportunities),
        "buyerOpportunities": sanitized_opportunities
    }
