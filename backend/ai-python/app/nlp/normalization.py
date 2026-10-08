import re
import unicodedata
from typing import List, Tuple
from app.nlp.models import NormalizedPrice, NormalizedQuantity, NormalizedTextResult
from app.nlp.agriculture_dictionary import UNIT_NORMALIZATION

# Currency symbols and abbreviations
CURRENCY_PATTERNS = [
    (re.compile(r"(?:₹|rs\.?|inr)\s*(\d+(?:\.\d+)?)", re.IGNORECASE), "INR"),
    (re.compile(r"(\d+(?:\.\d+)?)\s*(?:rs\.?|inr|rupees)", re.IGNORECASE), "INR"),
]

# Quantity regex (e.g. 500 kg, 2 tonnes, 500 கிலோ)
QUANTITY_PATTERN = re.compile(
    r"(\d+(?:\.\d+)?)\s*([a-zA-Z\u0B80-\u0BFF\u0900-\u097F]+)",
    re.IGNORECASE
)

# Price per unit regex (e.g. ₹40/kg, Rs 40 per kg, 40 rs per kg, under ₹40 per kg)
PRICE_PER_UNIT_PATTERN = re.compile(
    r"(?:(less\s+than|under|below|more\s+than|above|at)?\s*)?"
    r"(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*"
    r"(?:rs\.?|inr|rupees)?\s*"
    r"(?:\/|per|for\s+every)?\s*"
    r"([a-zA-Z\u0B80-\u0BFF\u0900-\u097F]+)?",
    re.IGNORECASE
)


def normalize_text(text: str) -> NormalizedTextResult:
    """
    Deterministically normalizes whitespace, Unicode, punctuation, numbers,
    currency units, and quantities without destroying original input text.
    """
    if not text or not isinstance(text, str):
        return NormalizedTextResult(
            original_text="",
            normalized_text="",
            normalized_tokens=[],
            quantities=[],
            prices=[]
        )

    # 1. Unicode normalization (NFKC)
    nfkc_text = unicodedata.normalize("NFKC", text.strip())

    # 2. Whitespace normalization
    clean_spaces = re.sub(r"\s+", " ", nfkc_text)

    # 3. Extract structured quantities and prices before surface transforms
    quantities: List[NormalizedQuantity] = []
    prices: List[NormalizedPrice] = []

    # Parse Price Expressions (e.g., "for less than ₹40 per kg", "Rs 40/kg")
    price_matches = re.finditer(
        r"(less\s+than|under|below|more\s+than|above)?\s*(?:₹|rs\.?|inr)\s*(\d+(?:\.\d+)?)(?:\s*(?:\/|per)\s*([a-zA-Z]+))?",
        clean_spaces,
        re.IGNORECASE
    )
    for m in price_matches:
        op_raw, val_str, unit_raw = m.groups()
        val = float(val_str)
        unit = UNIT_NORMALIZATION.get((unit_raw or "kg").lower(), "kg")
        op = None
        if op_raw:
            op_clean = op_raw.lower()
            if any(k in op_clean for k in ["less", "under", "below"]):
                op = "less_than"
            elif any(k in op_clean for k in ["more", "above"]):
                op = "greater_than"

        prices.append(NormalizedPrice(
            value=val,
            currency="INR",
            per_unit=unit,
            operator=op,
            raw=m.group(0).strip()
        ))

    # Also handle "Rs 40/kg" or "40 rs/kg"
    if not prices:
        alt_price = re.finditer(
            r"(\d+(?:\.\d+)?)\s*(?:rs|inr|₹)(?:\s*(?:\/|per)\s*([a-zA-Z]+))?",
            clean_spaces,
            re.IGNORECASE
        )
        for m in alt_price:
            val_str, unit_raw = m.groups()
            prices.append(NormalizedPrice(
                value=float(val_str),
                currency="INR",
                per_unit=UNIT_NORMALIZATION.get((unit_raw or "kg").lower(), "kg"),
                operator=None,
                raw=m.group(0).strip()
            ))

    # Parse Quantities (e.g., "500 kg", "2 tonnes", "500 கிலோ")
    for m in QUANTITY_PATTERN.finditer(clean_spaces):
        val_str, unit_raw = m.groups()
        clean_unit = unit_raw.lower()
        if clean_unit in UNIT_NORMALIZATION:
            # Check if this match was part of a price (e.g. ₹40 per kg)
            is_price_part = any(m.group(0) in p.raw for p in prices)
            if not is_price_part:
                quantities.append(NormalizedQuantity(
                    value=float(val_str),
                    unit=UNIT_NORMALIZATION[clean_unit],
                    raw=m.group(0).strip()
                ))

    # 4. Standardize text tokens
    # Replace unit variants in text with canonical forms (e.g., "500 KG" -> "500 kg")
    normalized = clean_spaces
    for raw_u, canon_u in UNIT_NORMALIZATION.items():
        normalized = re.sub(rf"\b{raw_u}\b", canon_u, normalized, flags=re.IGNORECASE)

    # Replace currency symbols
    normalized = re.sub(r"(?:₹|rs\.?|rupees)\s*", "INR ", normalized, flags=re.IGNORECASE)

    tokens = [t.strip(".,?!:;\"'") for t in normalized.split() if t.strip()]

    return NormalizedTextResult(
        original_text=text,
        normalized_text=normalized.strip(),
        normalized_tokens=tokens,
        quantities=quantities,
        prices=prices
    )
