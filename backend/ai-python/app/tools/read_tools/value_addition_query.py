"""
Value Addition Read-Only Query & Financial Calculation AI Tools.
Enables local AI to answer farmer questions on crop value addition, processing guides,
equipment, government schemes, and financial ROI estimation using actual database records.
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


async def get_value_addition_recommendations(
    crop_name: Optional[str] = None,
    category: Optional[str] = None,
    params: Optional[Dict[str, Any]] = None,
    **kwargs: Any
) -> Dict[str, Any]:
    """
    Get value-added product recommendations derived from a specific harvest crop or category.
    Returns matching catalog products with processing methods, yield, and multiplier metrics.
    """
    p = {**(params or {}), **kwargs}
    crop_val = (p.get("crop_name") or crop_name or "").strip()
    cat_val = (p.get("category") or category or "").strip()

    sql = """
        SELECT 
            p.id, p.crop_name, p.product_name, p.category, p.description, p.value_addition_multiplier,
            g.id AS guide_id, g.processing_method, g.difficulty_level, g.expected_yield_percentage, g.summary
        FROM crop_value_added_products p
        LEFT JOIN processing_guides g ON g.value_added_product_id = p.id
        WHERE 1=1
    """
    sql_params = []

    if crop_val and crop_val.lower() != "all":
        norm_crop = normalize_crop_name(crop_val)
        sql += " AND (LOWER(p.crop_name) LIKE ? OR LOWER(p.crop_name) LIKE ?)"
        sql_params.extend([f"%{crop_val.lower()}%", f"%{norm_crop.lower()}%"])

    if cat_val and cat_val.lower() != "all":
        sql += " AND LOWER(p.category) = ?"
        sql_params.append(cat_val.lower())

    sql += " ORDER BY p.crop_name ASC, p.value_addition_multiplier DESC"

    rows = db.query_all(sql, sql_params)

    return {
        "success": True,
        "crop_queried": crop_val or "All",
        "category_queried": cat_val or "All",
        "total_recommendations": len(rows),
        "products": rows,
        "note": "Recommendations are based strictly on authoritative FarmConnect catalog records."
    }


async def get_value_addition_product_details(
    product_id: Optional[str] = None,
    product_name: Optional[str] = None,
    params: Optional[Dict[str, Any]] = None,
    **kwargs: Any
) -> Dict[str, Any]:
    """
    Fetch comprehensive value-added product details including guide, stages, equipment, packaging, market, and schemes.
    """
    p = {**(params or {}), **kwargs}
    pid = (p.get("product_id") or product_id or "").strip()
    pname = (p.get("product_name") or product_name or "").strip()

    if not pid and not pname:
        return {"success": False, "error": "Either product_id or product_name must be provided."}

    sql = "SELECT * FROM crop_value_added_products WHERE 1=1"
    sql_params = []

    if pid:
        sql += " AND id = ?"
        sql_params.append(pid)
    elif pname:
        sql += " AND (LOWER(product_name) = ? OR LOWER(product_name) LIKE ?)"
        sql_params.extend([pname.lower(), f"%{pname.lower()}%"])

    product = db.query_get(sql, sql_params)
    if not product:
        return {"success": False, "error": f"Value-added product not found for input: id='{pid}', name='{pname}'."}

    guide = db.query_get("SELECT * FROM processing_guides WHERE value_added_product_id = ?", [product["id"]])
    stages = []
    equipment = []
    packaging = None
    market_info = None

    if guide:
        stages = db.query_all("SELECT * FROM processing_stages WHERE guide_id = ? ORDER BY stage_number ASC", [guide["id"]])
        equipment = db.query_all("SELECT * FROM processing_equipment WHERE guide_id = ?", [guide["id"]])
        packaging = db.query_get("SELECT * FROM processing_packaging_storage WHERE guide_id = ?", [guide["id"]])
        market_info = db.query_get("SELECT * FROM processing_market_info WHERE guide_id = ?", [guide["id"]])

    schemes = db.query_all(
        """SELECT s.scheme_name, s.short_code, s.authority, s.description, s.eligibility_info, s.benefits_info, s.official_source_url, s.last_updated_date, m.relevance_notes
           FROM crop_product_scheme_mappings m
           JOIN government_schemes s ON m.scheme_id = s.id
           WHERE m.value_added_product_id = ?""",
        [product["id"]]
    )

    return {
        "success": True,
        "product": product,
        "guide": guide,
        "stages": stages,
        "equipment": equipment,
        "packaging": packaging,
        "market_info": market_info,
        "schemes": schemes,
        "disclaimer": "Government scheme criteria require official verification by the respective authority upon formal application."
    }


async def get_value_addition_processing_guide(
    product_id: Optional[str] = None,
    product_name: Optional[str] = None,
    crop_name: Optional[str] = None,
    params: Optional[Dict[str, Any]] = None,
    **kwargs: Any
) -> Dict[str, Any]:
    """
    Get step-by-step processing guide instructions and equipment specifications for a value-added product.
    """
    p = {**(params or {}), **kwargs}
    pid = (p.get("product_id") or product_id or "").strip()
    pname = (p.get("product_name") or product_name or "").strip()
    cname = (p.get("crop_name") or crop_name or "").strip()

    sql = "SELECT p.id, p.crop_name, p.product_name, g.* FROM crop_value_added_products p JOIN processing_guides g ON g.value_added_product_id = p.id WHERE 1=1"
    sql_params = []

    if pid:
        sql += " AND p.id = ?"
        sql_params.append(pid)
    elif pname:
        sql += " AND LOWER(p.product_name) LIKE ?"
        sql_params.append(f"%{pname.lower()}%")
    elif cname:
        sql += " AND LOWER(p.crop_name) LIKE ?"
        sql_params.append(f"%{cname.lower()}%")

    guide = db.query_get(sql, sql_params)
    if not guide:
        return {"success": False, "error": "No processing guide found matching search criteria."}

    stages = db.query_all("SELECT * FROM processing_stages WHERE guide_id = ? ORDER BY stage_number ASC", [guide["id"]])
    equipment = db.query_all("SELECT * FROM processing_equipment WHERE guide_id = ?", [guide["id"]])
    packaging = db.query_get("SELECT * FROM processing_packaging_storage WHERE guide_id = ?", [guide["id"]])

    return {
        "success": True,
        "product_name": guide["product_name"],
        "crop_name": guide["crop_name"],
        "title": guide["title"],
        "processing_method": guide["processing_method"],
        "difficulty_level": guide["difficulty_level"],
        "expected_yield_percentage": guide["expected_yield_percentage"],
        "processing_time_hours": guide["processing_time_hours"],
        "summary": guide["summary"],
        "source_reference": guide.get("source_reference"),
        "stages": stages,
        "equipment": equipment,
        "packaging": packaging
    }


async def calculate_value_addition_economics(
    raw_quantity: float,
    raw_unit_price: float,
    product_id: Optional[str] = None,
    processing_cost: float = 0.0,
    labour_cost: float = 0.0,
    packaging_cost: float = 0.0,
    transport_cost: float = 0.0,
    other_costs: float = 0.0,
    expected_output_quantity: Optional[float] = None,
    expected_selling_price: Optional[float] = None,
    params: Optional[Dict[str, Any]] = None,
    **kwargs: Any
) -> Dict[str, Any]:
    """
    Perform financial calculation comparing raw harvest sale vs value-added processing economics.
    Does not invent market prices; uses supplied inputs or catalog yield metrics.
    """
    p = {**(params or {}), **kwargs}
    raw_qty = max(0.0, float(p.get("raw_quantity", raw_quantity)))
    raw_price = max(0.0, float(p.get("raw_unit_price", raw_unit_price)))
    pid = p.get("product_id") or product_id

    p_cost = max(0.0, float(p.get("processing_cost", processing_cost)))
    l_cost = max(0.0, float(p.get("labour_cost", labour_cost)))
    pkg_cost = max(0.0, float(p.get("packaging_cost", packaging_cost)))
    t_cost = max(0.0, float(p.get("transport_cost", transport_cost)))
    o_cost = max(0.0, float(p.get("other_costs", other_costs)))

    out_qty = float(p.get("expected_output_quantity", expected_output_quantity or 0.0))
    sell_price = float(p.get("expected_selling_price", expected_selling_price or 0.0))

    product_info = None
    if pid:
        product_info = db.query_get(
            """SELECT p.*, g.expected_yield_percentage 
               FROM crop_value_added_products p 
               LEFT JOIN processing_guides g ON g.value_added_product_id = p.id 
               WHERE p.id = ?""",
            [pid]
        )

    # Yield & Price estimation if not provided by user
    yield_pct = 80.0
    multiplier = 1.8
    if product_info:
        if product_info.get("expected_yield_percentage"):
            yield_pct = float(product_info["expected_yield_percentage"])
        if product_info.get("value_addition_multiplier"):
            multiplier = float(product_info["value_addition_multiplier"])

    if out_qty <= 0:
        out_qty = raw_qty * (yield_pct / 100.0)

    if sell_price <= 0:
        sell_price = raw_price * multiplier

    raw_material_cost = raw_qty * raw_price
    total_cost = raw_material_cost + p_cost + l_cost + pkg_cost + t_cost + o_cost

    projected_revenue = out_qty * sell_price
    projected_profit = projected_revenue - total_cost

    roi_pct = (projected_profit / total_cost * 100.0) if total_cost > 0 else 0.0

    return {
        "success": True,
        "product_id": pid,
        "product_name": product_info["product_name"] if product_info else "Custom Processed Product",
        "crop_name": product_info["crop_name"] if product_info else "Agricultural Crop",
        "inputs": {
            "raw_quantity": raw_qty,
            "raw_unit_price": raw_price,
            "raw_material_cost": raw_material_cost,
            "processing_cost": p_cost,
            "labour_cost": l_cost,
            "packaging_cost": pkg_cost,
            "transport_cost": t_cost,
            "other_costs": o_cost
        },
        "output": {
            "expected_output_quantity": round(out_qty, 2),
            "expected_selling_price": round(sell_price, 2)
        },
        "financials": {
            "raw_revenue_if_sold_raw": round(raw_material_cost, 2),
            "total_processing_cost": round(total_cost, 2),
            "projected_processed_revenue": round(projected_revenue, 2),
            "projected_profit": round(projected_profit, 2),
            "roi_percentage": round(roi_pct, 2)
        },
        "estimation_note": "Financials are estimated based on supplied inputs and catalog yield metrics. Actual market realization depends on buyer negotiations."
    }
