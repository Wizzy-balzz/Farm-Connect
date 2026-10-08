from app.ai.response_parser import parse_and_validate_response
from app.nlp.pipeline import process_nlp


def test_parse_valid_structured_json():
    nlp_res = process_nlp("When should I sell my tomatoes?")
    raw = """
    {
      "answer": "Tomatoes have a short shelf-life. Since local demand is steady, sell within 2 days.",
      "intent": "SELLING_STRATEGY",
      "language": "en",
      "confidence": 0.90,
      "reasoning_type": "selling_strategy",
      "requires_tool": false,
      "suggested_tool": null,
      "suggested_tool_args": {},
      "warnings": []
    }
    """
    out, warnings = parse_and_validate_response(raw, nlp_res)
    assert out is not None
    assert "shelf-life" in out.answer
    assert out.intent == "SELLING_STRATEGY"
    assert out.confidence == 0.90
    assert not out.requires_tool


def test_strip_markdown_code_fences():
    nlp_res = process_nlp("When should I sell my tomatoes?")
    raw = """```json
    {
      "answer": "Markdown wrapped JSON output from Gemini",
      "intent": "SELLING_STRATEGY",
      "language": "en",
      "confidence": 0.88,
      "reasoning_type": "selling_strategy",
      "requires_tool": false
    }
    ```"""
    out, warnings = parse_and_validate_response(raw, nlp_res)
    assert out is not None
    assert out.answer == "Markdown wrapped JSON output from Gemini"
    assert out.intent == "SELLING_STRATEGY"


def test_strip_hidden_chain_of_thought():
    nlp_res = process_nlp("When should I sell my tomatoes?")
    raw = """
    {
      "answer": "<thought>The user has perishable tomatoes. Need to advise selling now.</thought>Selling now is recommended to avoid spoilage.",
      "intent": "SELLING_STRATEGY",
      "language": "en"
    }
    """
    out, warnings = parse_and_validate_response(raw, nlp_res)
    assert out is not None
    assert "<thought>" not in out.answer
    assert "</thought>" not in out.answer
    assert out.answer.strip() == "Selling now is recommended to avoid spoilage."


def test_unsupported_tool_neutralized():
    nlp_res = process_nlp("Track my order")
    raw = """
    {
      "answer": "Let me execute an imaginary tool.",
      "intent": "ORDER_TRACKING",
      "language": "en",
      "requires_tool": true,
      "suggested_tool": "fabricateDatabaseRecord"
    }
    """
    out, warnings = parse_and_validate_response(raw, nlp_res)
    assert out is not None
    # Unsupported tool should be neutralized to None and requires_tool=False
    assert out.suggested_tool is None
    assert not out.requires_tool
    assert any("unsupported tool" in w.lower() for w in warnings)


def test_recovery_from_plain_text_answer():
    nlp_res = process_nlp("I have tomatoes ready to sell. Should I sell now or wait?")
    raw = "Since tomatoes are perishable and harvest volume is significant, consider selling to a local mandi aggregator immediately."
    out, warnings = parse_and_validate_response(raw, nlp_res)
    assert out is not None
    assert "perishable" in out.answer
    assert out.intent == "SELLING_STRATEGY"
    assert any("plain-text" in w.lower() for w in warnings)


def test_empty_or_malformed_returns_none():
    nlp_res = process_nlp("Test empty")
    out, warnings = parse_and_validate_response("", nlp_res)
    assert out is None

    out2, warnings2 = parse_and_validate_response("xyz abc {broken json", nlp_res)
    assert out2 is None
