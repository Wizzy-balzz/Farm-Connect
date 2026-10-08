import pytest
from app.nlp.language import detect_language


def test_detect_english():
    res = detect_language("What is the current market price for tomatoes?")
    assert res.language == "en"
    assert res.script == "latin"
    assert res.is_mixed is False
    assert res.confidence >= 0.8


def test_detect_tamil_native():
    res = detect_language("தக்காளியின் இன்றைய விலை என்ன?")
    assert res.language == "ta"
    assert res.script == "tamil"
    assert res.is_mixed is False
    assert res.confidence >= 0.8


def test_detect_hindi_native():
    res = detect_language("आज टमाटर का भाव क्या है?")
    assert res.language == "hi"
    assert res.script == "devanagari"
    assert res.is_mixed is False
    assert res.confidence >= 0.8


def test_detect_tanglish():
    res = detect_language("Tomato price enna?")
    assert res.language == "tanglish"
    assert res.script == "latin"
    assert res.is_mixed is True
    assert res.confidence >= 0.7


def test_detect_hinglish():
    res = detect_language("Tamatar ka rate kya hai?")
    assert res.language == "hinglish"
    assert res.script == "latin"
    assert res.is_mixed is True
    assert res.confidence >= 0.7


def test_detect_other_indic_scripts():
    # Telugu
    res_te = detect_language("టమాటా ధర ఎంత?")
    assert res_te.language == "te"
    assert res_te.script == "telugu"

    # Kannada
    res_kn = detect_language("ಟೊಮೆಟೊ ಬೆಲೆ ಎಷ್ಟು?")
    assert res_kn.language == "kn"
    assert res_kn.script == "kannada"

    # Malayalam
    res_ml = detect_language("തക്കാളിയുടെ വില എന്താണ്?")
    assert res_ml.language == "ml"
    assert res_ml.script == "malayalam"

    # Bengali
    res_bn = detect_language("টমেটোর দাম কত?")
    assert res_bn.language == "bn"
    assert res_bn.script == "bengali"

    # Gujarati
    res_gu = detect_language("ટામેટાંનો ભાવ શું છે?")
    assert res_gu.language == "gu"
    assert res_gu.script == "gujarati"

    # Punjabi
    res_pa = detect_language("ਟਮਾਟਰ ਦਾ ਭਾਅ ਕੀ ਹੈ?")
    assert res_pa.language == "pa"
    assert res_pa.script == "gurmukhi"

    # Urdu
    res_ur = detect_language("ٹماٹر کی قیمت کیا ہے؟")
    assert res_ur.language == "ur"
    assert res_ur.script == "arabic"


def test_detect_mixed_script():
    res = detect_language("Tomato தக்காளி price")
    assert res.language == "ta"
    assert res.is_mixed is True


def test_detect_empty_text():
    res = detect_language("")
    assert res.language == "en"
    assert res.confidence == 0.5
