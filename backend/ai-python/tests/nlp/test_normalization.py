import pytest
from app.nlp.normalization import normalize_text


def test_normalize_units_and_quantities():
    res = normalize_text("I have 500 KG of produce")
    assert len(res.quantities) == 1
    assert res.quantities[0].value == 500.0
    assert res.quantities[0].unit == "kg"
    assert "500 kg" in res.normalized_text


def test_normalize_tonnes():
    res1 = normalize_text("I have 2 tonnes ready")
    assert len(res1.quantities) == 1
    assert res1.quantities[0].value == 2.0
    assert res1.quantities[0].unit == "tonne"

    res2 = normalize_text("2 ton harvest")
    assert len(res2.quantities) == 1
    assert res2.quantities[0].value == 2.0
    assert res2.quantities[0].unit == "tonne"


def test_normalize_prices_and_currency():
    res1 = normalize_text("Price is Rs 40/kg")
    assert len(res1.prices) >= 1
    p1 = res1.prices[0]
    assert p1.value == 40.0
    assert p1.currency == "INR"
    assert p1.per_unit == "kg"

    res2 = normalize_text("offered at ₹40 per kg")
    assert len(res2.prices) >= 1
    p2 = res2.prices[0]
    assert p2.value == 40.0
    assert p2.currency == "INR"
    assert p2.per_unit == "kg"


def test_normalize_price_operator():
    res = normalize_text("looking for less than ₹40 per kg")
    assert len(res.prices) >= 1
    p = res.prices[0]
    assert p.value == 40.0
    assert p.operator == "less_than"


def test_normalize_whitespace_and_unicode():
    raw = "  Tomato    price\u00A0\u00A0is  Rs\u00A045   "
    res = normalize_text(raw)
    assert "  " not in res.normalized_text
    assert res.original_text == raw
