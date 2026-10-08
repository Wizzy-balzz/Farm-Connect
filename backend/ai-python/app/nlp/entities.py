import re
from typing import Optional
from app.nlp.models import ExtractedEntities, NormalizedTextResult
from app.nlp.agriculture_dictionary import CROP_NAME_CANONICAL, KNOWN_LOCATIONS, resolve_canonical_commodity
from app.nlp.normalization import normalize_text

TIME_PATTERNS = [
    (re.compile(r"\b(today|இன்று|आज)\b", re.IGNORECASE), "today"),
    (re.compile(r"\b(tomorrow|நாளை|कल)\b", re.IGNORECASE), "tomorrow"),
    (re.compile(r"\b(next\s+week|அடுத்த\s+வாரம்|अगले\s+हफ्ते)\b", re.IGNORECASE), "next_week"),
    (re.compile(r"\b(next\s+month|அடுத்த\s+மாதம்|अगले\s+महीने)\b", re.IGNORECASE), "next_month"),
    (re.compile(r"\b(this\s+season|இந்த\s+பருவம்|इस\s+सीजन)\b", re.IGNORECASE), "this_season"),
    (re.compile(r"\b(now|இப்போது|ippo|अभी)\b", re.IGNORECASE), "now"),
]


def extract_entities(text: str, norm_result: Optional[NormalizedTextResult] = None) -> ExtractedEntities:
    """
    Deterministically extracts agricultural commodities, quantities, units, prices,
    locations, and temporal expressions from text.
    """
    if not text or not isinstance(text, str):
        return ExtractedEntities()

    normalized = norm_result or normalize_text(text)
    clean_lower = normalized.normalized_text.lower()
    raw_lower = text.lower()

    # 1. Commodity / Crop Extraction
    canonical_commodity = None
    raw_commodity = None

    # Sort dictionary keys by descending length to match longest multi-word crops first
    sorted_crops = sorted(CROP_NAME_CANONICAL.keys(), key=lambda k: len(k), reverse=True)
    for crop_key in sorted_crops:
        # Match as whole word or phrase in raw or normalized text
        pattern = rf"(?:\b|\s|^){re.escape(crop_key.lower())}(?:\b|\s|$)"
        if re.search(pattern, raw_lower) or re.search(pattern, clean_lower):
            canonical, _ = CROP_NAME_CANONICAL[crop_key.lower()]
            canonical_commodity = canonical
            raw_commodity = crop_key
            break

    # 2. Location Extraction
    location = None
    for loc in KNOWN_LOCATIONS:
        loc_pattern = rf"(?:\b|\s|^){re.escape(loc.lower())}(?:\b|\s|$)"
        if re.search(loc_pattern, clean_lower) or re.search(loc_pattern, raw_lower):
            location = loc
            break

    # 3. Quantity & Unit
    quantity_val = None
    unit_val = None
    if normalized.quantities:
        q = normalized.quantities[0]
        quantity_val = q.value
        unit_val = q.unit

    # 4. Price & Currency
    price_val = None
    currency_val = None
    price_op = None
    if normalized.prices:
        p = normalized.prices[0]
        price_val = p.value
        currency_val = p.currency
        price_op = p.operator

    # 5. Time Expression
    time_expr = None
    for pattern, label in TIME_PATTERNS:
        if pattern.search(clean_lower) or pattern.search(raw_lower):
            time_expr = label
            break

    return ExtractedEntities(
        commodity=canonical_commodity,
        raw_commodity=raw_commodity,
        quantity=quantity_val,
        unit=unit_val,
        price=price_val,
        currency=currency_val,
        price_operator=price_op,
        location=location,
        time_expression=time_expr
    )
