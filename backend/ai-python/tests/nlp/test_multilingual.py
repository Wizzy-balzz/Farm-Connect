import pytest
from app.nlp.pipeline import process_nlp


def test_required_example_test5_tamil_native():
    """
    TEST 5:
    'என்னிடம் 500 கிலோ தக்காளி இருக்கு, விற்கணும்.'
    Expected:
    canonical commodity = Tomato
    quantity = 500
    unit = kg
    intent = SELLING_OFFER
    """
    text = "என்னிடம் 500 கிலோ தக்காளி இருக்கு, விற்கணும்."
    res = process_nlp(text)

    assert res.language.language == "ta"
    assert res.entities.commodity == "Tomato"
    assert res.entities.quantity == 500.0
    assert res.entities.unit == "kg"
    assert res.intent.intent == "SELLING_OFFER"


def test_required_example_test6_tanglish():
    """
    TEST 6:
    'En kitta 500 kg thakkali irukku, sell pannanum.'
    Expected:
    canonical commodity = Tomato
    quantity = 500
    unit = kg
    intent = SELLING_OFFER
    """
    text = "En kitta 500 kg thakkali irukku, sell pannanum."
    res = process_nlp(text)

    assert res.language.language == "tanglish"
    assert res.entities.commodity == "Tomato"
    assert res.entities.quantity == 500.0
    assert res.entities.unit == "kg"
    assert res.intent.intent == "SELLING_OFFER"


def test_hindi_native_equivalent():
    """
    Hindi equivalent:
    'मेरे पास 500 किलो टमाटर हैं, मुझे बेचना है।'
    Expected:
    canonical commodity = Tomato
    quantity = 500
    unit = kg
    intent = SELLING_OFFER
    """
    text = "मेरे पास 500 किलो टमाटर हैं, मुझे बेचना है।"
    res = process_nlp(text)

    assert res.language.language == "hi"
    assert res.entities.commodity == "Tomato"
    assert res.entities.quantity == 500.0
    assert res.entities.unit == "kg"
    assert res.intent.intent == "SELLING_OFFER"


def test_english_equivalent():
    """
    English equivalent:
    'I want to sell 500 kg tomatoes.'
    Expected:
    canonical commodity = Tomato
    quantity = 500
    unit = kg
    intent = SELLING_OFFER
    """
    text = "I want to sell 500 kg tomatoes."
    res = process_nlp(text)

    assert res.language.language == "en"
    assert res.entities.commodity == "Tomato"
    assert res.entities.quantity == 500.0
    assert res.entities.unit == "kg"
    assert res.intent.intent == "SELLING_OFFER"


def test_negative_cases():
    # 1. Empty text
    empty_res = process_nlp("")
    assert empty_res.original_text == ""
    assert empty_res.intent.intent == "GENERAL_CHAT"
    assert empty_res.entities.commodity is None

    # 2. Nonsense text
    nonsense_res = process_nlp("asdf qwerty 1234 xyz")
    assert nonsense_res.entities.commodity is None
    assert nonsense_res.intent.intent == "GENERAL_CHAT"

    # 3. Ambiguous request without commodity
    ambiguous_res = process_nlp("What should I do now?")
    assert ambiguous_res.intent.intent in ["GENERAL_CHAT", "FARM_ADVISORY", "SELLING_STRATEGY"]
    assert ambiguous_res.entities.commodity is None
