import pytest
from app.nlp.entities import extract_entities
from app.nlp.agriculture_dictionary import resolve_canonical_commodity


def test_required_example_test2():
    """
    TEST 2:
    'I want to sell 500 kg tomato near Madurai for less than ₹40 per kg.'
    Expected:
    commodity = Tomato
    quantity = 500
    unit = kg
    location = Madurai
    price = 40
    currency = INR
    price_operator = less_than
    """
    text = "I want to sell 500 kg tomato near Madurai for less than ₹40 per kg."
    entities = extract_entities(text)

    assert entities.commodity == "Tomato"
    assert entities.quantity == 500.0
    assert entities.unit == "kg"
    assert entities.location == "Madurai"
    assert entities.price == 40.0
    assert entities.currency == "INR"
    assert entities.price_operator == "less_than"


def test_canonical_agricultural_resolution():
    res_tomato = resolve_canonical_commodity("தக்காளி")
    assert res_tomato["canonical"] == "Tomato"
    assert res_tomato["language"] == "ta"

    res_thakkali = resolve_canonical_commodity("thakkali")
    assert res_thakkali["canonical"] == "Tomato"

    res_onion = resolve_canonical_commodity("வெங்காயம்")
    assert res_onion["canonical"] == "Onion"

    res_vengayam = resolve_canonical_commodity("vengayam")
    assert res_vengayam["canonical"] == "Onion"

    res_tamatar = resolve_canonical_commodity("टमाटर")
    assert res_tamatar["canonical"] == "Tomato"
    assert res_tamatar["language"] == "hi"


def test_time_expressions_extraction():
    e1 = extract_entities("What is today's tomato price?")
    assert e1.commodity == "Tomato"
    assert e1.time_expression == "today"

    e2 = extract_entities("Remind me to sell next week")
    assert e2.time_expression == "next_week"
