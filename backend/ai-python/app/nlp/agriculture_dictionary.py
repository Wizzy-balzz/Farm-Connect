from typing import Dict, Optional, Tuple

# Canonical Agricultural Produce Mappings
# Preserves and extends existing Node.js aiTools.js CROP_NAME_CANONICAL mapping
CROP_NAME_CANONICAL: Dict[str, Tuple[str, str]] = {
    # Surface Form: (Canonical English Name, Language Code)
    # Tomato
    "தக்காளி": ("Tomato", "ta"),
    "thakkali": ("Tomato", "ta"),
    "டொமேட்டோ": ("Tomato", "ta"),
    "டொமாட்டோ": ("Tomato", "ta"),
    "टमाटर": ("Tomato", "hi"),
    "tamatar": ("Tomato", "hi"),
    "tomato": ("Tomato", "en"),
    "tomatoes": ("Tomato", "en"),
    "tameta": ("Tomato", "gu"),
    "tomatoolu": ("Tomato", "te"),

    # Onion
    "வெங்காயம்": ("Onion", "ta"),
    "vengayam": ("Onion", "ta"),
    "vengaayam": ("Onion", "ta"),
    "சின்ன வெங்காயம்": ("Onion", "ta"),
    "பல்லாரி": ("Onion", "ta"),
    "प्याज": ("Onion", "hi"),
    "pyaj": ("Onion", "hi"),
    "pyaaz": ("Onion", "hi"),
    "kanda": ("Onion", "mr"),
    "dungri": ("Onion", "gu"),
    "ullipayalu": ("Onion", "te"),
    "eerulli": ("Onion", "kn"),
    "onion": ("Onion", "en"),
    "onions": ("Onion", "en"),

    # Rice / Paddy
    "அரிசி": ("Rice", "ta"),
    "நெல்": ("Rice", "ta"),
    "பாஸ்மதி": ("Rice", "ta"),
    "arisi": ("Rice", "ta"),
    "nel": ("Rice", "ta"),
    "चावल": ("Rice", "hi"),
    "धान": ("Rice", "hi"),
    "बासमती": ("Rice", "hi"),
    "chawal": ("Rice", "hi"),
    "dhan": ("Rice", "hi"),
    "bhat": ("Rice", "bn"),
    "tandul": ("Rice", "mr"),
    "biyyam": ("Rice", "te"),
    "akki": ("Rice", "kn"),
    "ari": ("Rice", "ml"),
    "rice": ("Rice", "en"),
    "paddy": ("Rice", "en"),
    "basmati": ("Rice", "en"),

    # Wheat
    "கோதுமை": ("Wheat", "ta"),
    "kothumai": ("Wheat", "ta"),
    "godhumai": ("Wheat", "ta"),
    "गेहूं": ("Wheat", "hi"),
    "गेहू": ("Wheat", "hi"),
    "gehu": ("Wheat", "hi"),
    "ghav": ("Wheat", "gu"),
    "godhuma": ("Wheat", "te"),
    "godhi": ("Wheat", "kn"),
    "wheat": ("Wheat", "en"),
    "durum": ("Wheat", "en"),

    # Spinach / Leafy Greens
    "கீரை": ("Spinach", "ta"),
    "பாலக்": ("Spinach", "ta"),
    "keerai": ("Spinach", "ta"),
    "पालक": ("Spinach", "hi"),
    "palak": ("Spinach", "hi"),
    "spinach": ("Spinach", "en"),
    "palakura": ("Spinach", "te"),

    # Pepper / Chilli
    "மிளகு": ("Pepper", "ta"),
    "கருப்பு மிளகு": ("Pepper", "ta"),
    "milagu": ("Pepper", "ta"),
    "மிளகாய்": ("Pepper", "ta"),
    "பச்சை மிளகாய்": ("Pepper", "ta"),
    "milagai": ("Pepper", "ta"),
    "मिर्च": ("Pepper", "hi"),
    "काली मिर्च": ("Pepper", "hi"),
    "mirch": ("Pepper", "hi"),
    "mirchi": ("Pepper", "te"),
    "pepper": ("Pepper", "en"),
    "chilli": ("Pepper", "en"),
    "chillies": ("Pepper", "en"),

    # Carrot
    "கேரட்": ("Carrot", "ta"),
    "carrot": ("Carrot", "en"),
    "carrots": ("Carrot", "en"),
    "गाजर": ("Carrot", "hi"),
    "gajar": ("Carrot", "hi"),

    # Potato
    "உருளைக்கிழங்கு": ("Potato", "ta"),
    "உருளை": ("Potato", "ta"),
    "urulaikilangu": ("Potato", "ta"),
    "urulai": ("Potato", "ta"),
    "आलू": ("Potato", "hi"),
    "aloo": ("Potato", "hi"),
    "batata": ("Potato", "mr"),
    "bangaladumpa": ("Potato", "te"),
    "potato": ("Potato", "en"),
    "potatoes": ("Potato", "en"),

    # Banana
    "வாழை": ("Banana", "ta"),
    "வாழைப்பழம்": ("Banana", "ta"),
    "valai": ("Banana", "ta"),
    "vazhai": ("Banana", "ta"),
    "केला": ("Banana", "hi"),
    "kela": ("Banana", "hi"),
    "arati": ("Banana", "te"),
    "bale": ("Banana", "kn"),
    "banana": ("Banana", "en"),
    "bananas": ("Banana", "en"),

    # Corn / Maize
    "மக்காச்சோளம்": ("Corn", "ta"),
    "சோளம்": ("Corn", "ta"),
    "cholam": ("Corn", "ta"),
    "मक्का": ("Corn", "hi"),
    "भुट्टा": ("Corn", "hi"),
    "makka": ("Corn", "hi"),
    "corn": ("Corn", "en"),
    "maize": ("Corn", "en"),

    # Cotton
    "பருத்தி": ("Cotton", "ta"),
    "paruthi": ("Cotton", "ta"),
    "कपास": ("Cotton", "hi"),
    "kapas": ("Cotton", "hi"),
    "cotton": ("Cotton", "en"),

    # Sugarcane
    "கரும்பு": ("Sugarcane", "ta"),
    "karumbu": ("Sugarcane", "ta"),
    "गन्ना": ("Sugarcane", "hi"),
    "ganna": ("Sugarcane", "hi"),
    "cheruku": ("Sugarcane", "te"),
    "kabbu": ("Sugarcane", "kn"),
    "sugarcane": ("Sugarcane", "en"),
}

# Unit normalizations
UNIT_NORMALIZATION = {
    "kg": "kg",
    "kgs": "kg",
    "kilo": "kg",
    "kilos": "kg",
    "kilogram": "kg",
    "kilograms": "kg",
    "கிலோ": "kg",
    "किलो": "kg",
    "किलोग्राम": "kg",
    "ton": "tonne",
    "tons": "tonne",
    "tonne": "tonne",
    "tonnes": "tonne",
    "டன்": "tonne",
    "टन": "tonne",
    "quintal": "quintal",
    "quintals": "quintal",
    "குவிண்டால்": "quintal",
    "क्विंटल": "quintal",
    "g": "g",
    "gram": "g",
    "grams": "g",
    "கிராம்": "g",
    "ग्राम": "g",
    "litre": "litre",
    "litres": "litre",
    "l": "litre",
    "லிட்டர்": "litre",
    "लीटर": "litre",
    "bag": "bag",
    "bags": "bag",
    "மூட்டை": "bag",
    "बोरी": "bag",
    "box": "box",
    "boxes": "box",
    "பெட்டி": "box",
    "पेटी": "box",
    "bundle": "bundle",
    "bundles": "bundle",
    "கட்டு": "bundle",
    "गुच्छा": "bundle",
    "acre": "acre",
    "acres": "acre",
    "ஏக்கர்": "acre",
    "एकड़": "acre",
}

# Known Agricultural Hub Locations (Tamil Nadu, Maharashtra, etc.)
KNOWN_LOCATIONS = [
    "Madurai", "Tirunelveli", "Nashik", "Coimbatore", "Salem", "Dindigul",
    "Trichy", "Tiruchirappalli", "Thanjavur", "Erode", "Theni", "Karur",
    "Vellore", "Tirupur", "Nagercoil", "Kanyakumari", "Namakkal", "Pudukkottai",
    "Pune", "Nagpur", "Solapur", "Kolhapur", "Satara", "Sangli", "Ahmednagar",
    "Bengaluru", "Bangalore", "Mysuru", "Hubballi", "Belagavi",
    "Guntur", "Vijayawada", "Kurnool", "Warangal", "Hyderabad"
]


def resolve_canonical_commodity(crop_input: str) -> Optional[Dict[str, str]]:
    """
    Resolves any surface produce name in Tamil, Hindi, Tanglish, or English
    to its canonical English commodity name and detected language.
    """
    if not crop_input or not isinstance(crop_input, str):
        return None

    cleaned = crop_input.strip().lower()

    # Exact match check
    if cleaned in CROP_NAME_CANONICAL:
        canonical, lang = CROP_NAME_CANONICAL[cleaned]
        return {"surface": crop_input.strip(), "canonical": canonical, "language": lang}

    # Substring / boundary match
    for key, (canonical, lang) in CROP_NAME_CANONICAL.items():
        if key in cleaned:
            return {"surface": crop_input.strip(), "canonical": canonical, "language": lang}

    return None
