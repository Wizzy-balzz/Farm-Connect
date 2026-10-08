"""
Farming Guide & Crop Knowledge AI Read-Only Tools (Phase B).
Provides local AI access to verified database records for:
- Crop Knowledge
- Soil Compatibility
- Crop Calendar & Growth Stages
- Crop Rotation Recommendations
- Irrigation & Nutrient Safety Guides
- Pest & Disease Management
- Farm Planner Recommendations
"""

from typing import Any, Dict, List, Optional
from app.database.connection import db


async def get_crop_knowledge(
    crop_name: Optional[str] = None,
    category: Optional[str] = None,
    params: Optional[Dict[str, Any]] = None,
    **kwargs: Any
) -> Dict[str, Any]:
    """Retrieves authoritative crop knowledge from the database for a crop or category."""
    p = {**(params or {}), **kwargs}
    crop_val = (p.get("crop_name") or crop_name or "").strip()
    cat_val = (p.get("category") or category or "").strip()

    sql = "SELECT * FROM crops WHERE 1=1"
    sql_params = []

    if crop_val and crop_val.lower() != "all":
        sql += " AND (LOWER(name) LIKE ? OR LOWER(scientific_name) LIKE ?)"
        sql_params.extend([f"%{crop_val.lower()}%", f"%{crop_val.lower()}%"])

    if cat_val and cat_val.lower() != "all":
        sql += " AND LOWER(category) = ?"
        sql_params.append(cat_val.lower())

    rows = db.query_all(sql, sql_params)
    return {
        "success": True,
        "count": len(rows),
        "crops": rows
    }


async def get_soil_crop_compatibility(
    soil_type: Optional[str] = None,
    ph: Optional[float] = None,
    season: Optional[str] = None,
    water_availability: Optional[str] = None,
    params: Optional[Dict[str, Any]] = None,
    **kwargs: Any
) -> Dict[str, Any]:
    """Evaluates crop compatibility deterministically against stored soil & agronomic data."""
    p = {**(params or {}), **kwargs}
    soil_val = (p.get("soil_type") or soil_type or "").strip()
    ph_val = p.get("ph") if p.get("ph") is not None else ph
    season_val = (p.get("season") or season or "").strip()
    water_val = (p.get("water_availability") or water_availability or "").strip()

    all_crops = db.query_all("SELECT * FROM crops ORDER BY name ASC")
    results = []

    for c in all_crops:
        score = 70
        reasons = []
        conditions = []

        if soil_val:
            c_soil = (c.get("soil_texture") or c.get("soil_requirements") or "").lower()
            if soil_val.lower() in c_soil:
                score += 15
                reasons.append(f"Soil texture '{soil_val}' matches {c['name']} ideal requirements.")
            else:
                score -= 10
                conditions.append(f"Soil texture '{soil_val}' may require organic soil conditioning.")

        if ph_val is not None:
            ph_min = c.get("ph_min") or 5.5
            ph_max = c.get("ph_max") or 7.5
            if ph_min <= ph_val <= ph_max:
                score += 15
                reasons.append(f"Soil pH {ph_val} is within optimal range ({ph_min} - {ph_max}).")
            else:
                score -= 15
                conditions.append(f"Soil pH {ph_val} is outside ideal range ({ph_min} - {ph_max}).")

        if season_val:
            c_seasons = (c.get("seasons") or "").lower()
            if season_val.lower() in c_seasons or "year-round" in c_seasons:
                score += 10
                reasons.append(f"Fits target season '{season_val}'.")

        score = max(15, min(98, score))
        compat = "HIGH" if score >= 75 else ("MEDIUM" if score >= 50 else "LOW")

        results.append({
            "crop": c["name"],
            "category": c["category"],
            "compatibility": compat,
            "score": score,
            "reasons": reasons,
            "importantConditions": conditions
        })

    results.sort(key=lambda x: x["score"], reverse=True)
    return {
        "success": True,
        "count": len(results),
        "results": results
    }


async def get_crop_calendar(
    crop_name: str,
    params: Optional[Dict[str, Any]] = None,
    **kwargs: Any
) -> Dict[str, Any]:
    """Retrieves growth stage sequence timeline for a given crop."""
    p = {**(params or {}), **kwargs}
    c_name = (p.get("crop_name") or crop_name or "").strip()

    crop = db.query_get("SELECT * FROM crops WHERE LOWER(name) LIKE ?", [f"%{c_name.lower()}%"])
    if not crop:
        return {"success": False, "error": f"Crop '{c_name}' not found."}

    stages = db.query_all("SELECT * FROM crop_growth_stages WHERE crop_id = ? ORDER BY stage_order ASC", [crop["id"]])
    return {
        "success": True,
        "crop": crop["name"],
        "duration_days": crop["duration_days"],
        "stages": stages
    }


async def get_crop_rotation_recommendations(
    previous_crop: str,
    params: Optional[Dict[str, Any]] = None,
    **kwargs: Any
) -> Dict[str, Any]:
    """Retrieves recommended crop rotation rules for a given previous crop."""
    p = {**(params or {}), **kwargs}
    prev = (p.get("previous_crop") or previous_crop or "").strip()

    rules = db.query_all("SELECT * FROM crop_rotation_rules WHERE LOWER(previous_crop_name) LIKE ?", [f"%{prev.lower()}%"])
    return {
        "success": True,
        "previous_crop": prev,
        "recommendations": rules
    }


async def get_crop_irrigation_guide(
    crop_name: str,
    params: Optional[Dict[str, Any]] = None,
    **kwargs: Any
) -> Dict[str, Any]:
    """Retrieves irrigation requirements and rainfall advice integration for a crop."""
    p = {**(params or {}), **kwargs}
    c_name = (p.get("crop_name") or crop_name or "").strip()

    crop = db.query_get("SELECT * FROM crops WHERE LOWER(name) LIKE ?", [f"%{c_name.lower()}%"])
    if not crop:
        return {"success": False, "error": f"Crop '{c_name}' not found."}

    guide = db.query_get("SELECT * FROM crop_irrigation_guides WHERE crop_id = ?", [crop["id"]])
    return {
        "success": True,
        "crop": crop["name"],
        "guide": guide or {"water_requirement_mm": "500-800 mm", "method": "Furrow/Drip", "rainfall_considerations": "Review planned irrigation based on expected rainfall forecast."}
    }


async def get_crop_nutrient_guide(
    crop_name: str,
    params: Optional[Dict[str, Any]] = None,
    **kwargs: Any
) -> Dict[str, Any]:
    """Retrieves nutrient guidance and mandatory soil test notice for a crop."""
    p = {**(params or {}), **kwargs}
    c_name = (p.get("crop_name") or crop_name or "").strip()

    crop = db.query_get("SELECT * FROM crops WHERE LOWER(name) LIKE ?", [f"%{c_name.lower()}%"])
    if not crop:
        return {"success": False, "error": f"Crop '{c_name}' not found."}

    guide = db.query_get("SELECT * FROM crop_nutrient_guides WHERE crop_id = ?", [crop["id"]])
    return {
        "success": True,
        "crop": crop["name"],
        "soil_test_notice": "MANDATORY NOTICE: Conduct laboratory soil testing before applying chemical fertilizers.",
        "guide": guide
    }


async def get_crop_pest_disease_guide(
    crop_name: str,
    params: Optional[Dict[str, Any]] = None,
    **kwargs: Any
) -> Dict[str, Any]:
    """Retrieves pest & disease information with integrated management procedures."""
    p = {**(params or {}), **kwargs}
    c_name = (p.get("crop_name") or crop_name or "").strip()

    crop = db.query_get("SELECT * FROM crops WHERE LOWER(name) LIKE ?", [f"%{c_name.lower()}%"])
    if not crop:
        return {"success": False, "error": f"Crop '{c_name}' not found."}

    pests = db.query_all("SELECT * FROM crop_pest_diseases WHERE crop_id = ?", [crop["id"]])
    return {
        "success": True,
        "crop": crop["name"],
        "safety_disclaimer": "DO NOT automatically prescribe pesticide dosage without consulting an authorized extension officer.",
        "pests": pests
    }


async def get_farm_planner_recommendations(
    district: Optional[str] = None,
    soil_type: Optional[str] = None,
    season: Optional[str] = None,
    water_availability: Optional[str] = None,
    previous_crop: Optional[str] = None,
    params: Optional[Dict[str, Any]] = None,
    **kwargs: Any
) -> Dict[str, Any]:
    """Executes multi-factor signature farm planner crop ranking."""
    p = {**(params or {}), **kwargs}
    dist_val = (p.get("district") or district or "").strip()
    soil_val = (p.get("soil_type") or soil_type or "").strip()
    season_val = (p.get("season") or season or "").strip()
    water_val = (p.get("water_availability") or water_availability or "").strip()
    prev_val = (p.get("previous_crop") or previous_crop or "").strip()

    all_crops = db.query_all("SELECT * FROM crops ORDER BY name ASC")
    recommendations = []

    for c in all_crops:
        score = 75
        reasons = []

        if soil_val and soil_val.lower() in (c.get("soil_texture") or "").lower():
            score += 15
            reasons.append(f"Soil texture '{soil_val}' matches {c['name']}.")
        if season_val and (season_val.lower() in (c.get("seasons") or "").lower() or "year-round" in (c.get("seasons") or "").lower()):
            score += 10
            reasons.append(f"Fits '{season_val}' season.")

        score = max(20, min(98, score))

        recommendations.append({
            "crop": c["name"],
            "category": c["category"],
            "compatibilityScore": score,
            "whyRecommended": " ".join(reasons) if reasons else f"Standard crop suitable for {dist_val or 'region'}.",
            "durationDays": c["duration_days"]
        })

    recommendations.sort(key=lambda x: x["compatibilityScore"], reverse=True)
    return {
        "success": True,
        "count": len(recommendations),
        "recommendations": recommendations
    }
