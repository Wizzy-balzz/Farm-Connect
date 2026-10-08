import re
from typing import Dict, List, Tuple
from app.nlp.models import LanguageDetectionResult

# Script Unicode Ranges
SCRIPT_PATTERNS: List[Tuple[str, str, str, re.Pattern]] = [
    ("ta", "Tamil", "tamil", re.compile(r"[\u0B80-\u0BFF]")),
    ("hi", "Hindi", "devanagari", re.compile(r"[\u0900-\u097F]")),
    ("te", "Telugu", "telugu", re.compile(r"[\u0C00-\u0C7F]")),
    ("ml", "Malayalam", "malayalam", re.compile(r"[\u0D00-\u0D7F]")),
    ("kn", "Kannada", "kannada", re.compile(r"[\u0C80-\u0CFF]")),
    ("bn", "Bengali", "bengali", re.compile(r"[\u0980-\u09FF]")),
    ("gu", "Gujarati", "gujarati", re.compile(r"[\u0A80-\u0AFF]")),
    ("pa", "Punjabi", "gurmukhi", re.compile(r"[\u0A00-\u0A7F]")),
    ("ur", "Urdu", "arabic", re.compile(r"[\u0600-\u06FF]")),
]

# Vocabulary heuristic sets for Romanized code-switching
TANGLISH_KEYWORDS = {
    "enna", "eppo", "eppadi", "epdi", "irukku", "irukkaa", "irukka", "vikkalama",
    "pannalama", "pannanum", "evlo", "kitta", "romba", "kamia", "nalaiku",
    "thakkali", "vengayam", "kaasu", "vilai", "solla", "mudiyaadha", "paaru",
    "panradhu", "inga", "unga", "ungal", "en", "nalla", "kudukalama"
}

HINGLISH_KEYWORDS = {
    "kya", "hai", "kaise", "karein", "hoga", "bechna", "chahiye", "kitna",
    "tamatar", "pyaaz", "bhav", "daam", "karo", "karen", "mujhe", "pass",
    "mein", "aaj", "kal", "rate", "batao", "batayein", "mandi", "fasal"
}


def detect_language(text: str) -> LanguageDetectionResult:
    """
    Deterministically detects script and language from input text.
    Handles native Indian scripts, English, Tanglish, and Hinglish.
    """
    if not text or not isinstance(text, str) or not text.strip():
        return LanguageDetectionResult(
            language="en",
            language_name="English",
            script="latin",
            confidence=0.5,
            is_mixed=False
        )

    clean_text = text.strip()
    total_chars = len(clean_text)

    # 1. Native script detection
    for code, name, script_name, pattern in SCRIPT_PATTERNS:
        matches = pattern.findall(clean_text)
        if matches:
            char_count = len(matches)
            ratio = char_count / total_chars
            # Check for mixed script (e.g. Tamil script + Latin script words)
            has_latin = bool(re.search(r"[a-zA-Z]", clean_text))
            
            # Special check for Devanagari: distinguish Marathi vs Hindi if markers present
            lang_code = code
            lang_name = name
            if code == "hi" and any(w in clean_text.lower() for w in ["आहे", "नाही", "करा"]):
                lang_code = "mr"
                lang_name = "Marathi"

            confidence = min(0.99, max(0.65, round(0.70 + (ratio * 0.3), 2)))
            return LanguageDetectionResult(
                language=lang_code,
                language_name=lang_name,
                script=script_name,
                confidence=confidence,
                is_mixed=has_latin
            )

    # 2. Latin script processing: English vs Tanglish vs Hinglish
    words = [w.lower().strip(".,?!:;\"'") for w in clean_text.split() if w.strip()]
    if not words:
        return LanguageDetectionResult(
            language="en",
            language_name="English",
            script="latin",
            confidence=0.5,
            is_mixed=False
        )

    tanglish_matches = [w for w in words if w in TANGLISH_KEYWORDS]
    hinglish_matches = [w for w in words if w in HINGLISH_KEYWORDS]

    if tanglish_matches and len(tanglish_matches) >= len(hinglish_matches):
        confidence = min(0.95, round(0.70 + (len(tanglish_matches) / len(words)) * 0.3, 2))
        return LanguageDetectionResult(
            language="tanglish",
            language_name="Tamil (Tanglish)",
            script="latin",
            confidence=confidence,
            is_mixed=True
        )

    if hinglish_matches:
        confidence = min(0.95, round(0.70 + (len(hinglish_matches) / len(words)) * 0.3, 2))
        return LanguageDetectionResult(
            language="hinglish",
            language_name="Hindi (Hinglish)",
            script="latin",
            confidence=confidence,
            is_mixed=True
        )

    # Pure English default
    return LanguageDetectionResult(
        language="en",
        language_name="English",
        script="latin",
        confidence=0.90,
        is_mixed=False
    )
