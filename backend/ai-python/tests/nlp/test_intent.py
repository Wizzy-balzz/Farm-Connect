import pytest
from app.nlp.intent import detect_intent
from app.nlp.entities import extract_entities


def test_required_example_test1():
    """
    TEST 1:
    'I have 2 tonnes of tomatoes ready to sell. Should I sell now or wait?'
    Expected:
    intent = SELLING_STRATEGY
    commodity = Tomato
    quantity = 2
    unit = tonne
    """
    text = "I have 2 tonnes of tomatoes ready to sell. Should I sell now or wait?"
    entities = extract_entities(text)
    intent = detect_intent(text, entities=entities)

    assert intent.intent == "SELLING_STRATEGY"
    assert entities.commodity == "Tomato"
    assert entities.quantity == 2.0
    assert entities.unit == "tonne"


def test_required_example_test3():
    """
    TEST 3:
    'Track my tomato order.'
    Expected:
    intent = ORDER_TRACKING
    commodity = Tomato
    """
    text = "Track my tomato order."
    entities = extract_entities(text)
    intent = detect_intent(text, entities=entities)

    assert intent.intent == "ORDER_TRACKING"
    assert entities.commodity == "Tomato"


def test_required_example_test4():
    """
    TEST 4:
    'Show tomato buyers near Tirunelveli.'
    Expected:
    intent = BUYER_SEARCH
    commodity = Tomato
    location = Tirunelveli
    """
    text = "Show tomato buyers near Tirunelveli."
    entities = extract_entities(text)
    intent = detect_intent(text, entities=entities)

    assert intent.intent == "BUYER_SEARCH"
    assert entities.commodity == "Tomato"
    assert entities.location == "Tirunelveli"


def test_buying_request_intent():
    text = "I want to buy 500 kg onions."
    intent = detect_intent(text)
    assert intent.intent == "BUYING_REQUEST"


def test_crop_recommendation_intent():
    text = "What crops should I grow this season?"
    intent = detect_intent(text)
    assert intent.intent == "CROP_RECOMMENDATION"


def test_price_intelligence_intent():
    text = "What is today's tomato price?"
    intent = detect_intent(text)
    assert intent.intent == "PRICE_INTELLIGENCE"


def test_followup_request_intent():
    text = "Remind me to sell my tomatoes next week."
    intent = detect_intent(text)
    assert intent.intent == "FOLLOWUP_REQUEST"


def test_order_tracking_where_is_order():
    text = "Where is my order?"
    intent = detect_intent(text)
    assert intent.intent == "ORDER_TRACKING"


def test_marketplace_product_variations():
    variations = [
        "list out the products in marketplace",
        "show marketplace products",
        "what products are available",
        "list products"
    ]
    for text in variations:
        intent = detect_intent(text)
        assert intent.intent == "MARKETPLACE_SEARCH", f"Failed for: {text}"


def test_order_query_variations():
    variations = [
        "list the orders",
        "show orders",
        "show my orders",
        "what are my orders"
    ]
    for text in variations:
        intent = detect_intent(text)
        assert intent.intent == "ORDER_QUERY", f"Failed for: {text}"
