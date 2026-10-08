"""
Authoritative Local Project Knowledge Base for FarmConnect.
Contains factual application-level knowledge derived directly from the codebase implementation.
Strictly non-sensitive: Contains zero secrets, credentials, tokens, or private user data.
"""

from typing import Any, Dict, Optional, Tuple
import re

# Comprehensive structured factual knowledge derived from codebase audit
PROJECT_KNOWLEDGE_BASE: Dict[str, Dict[str, str]] = {
    "project_overview": {
        "en": (
            "FarmConnect is an intelligent agricultural marketplace and copilot platform that connects farmers, "
            "wholesale vendors, and platform administrators. It provides direct farm-to-vendor produce trading, "
            "real-time APMC mandi market price intelligence, inventory tracking, order management with OpenStreetMap live tracking, "
            "a local Python AI copilot, and proactive agricultural analytics."
        ),
        "ta": (
            "FarmConnect என்பது விவசாயிகள், மொத்த வியாபாரிகள் மற்றும் நிர்வாகிகளை இணைக்கும் "
            "ஒரு மேம்பட்ட விவசாய சந்தை மற்றும் ஏஐ உதவியாளர் தளமாகும். இது நேரடியாக பயிர் விற்பனை, "
            "நேரடி மண்டி விலை நிலவரம், சரக்கு இருப்பு கண்காணிப்பு மற்றும் வரைபட ஆர்டர் டிராக்கிங் வசதிகளை வழங்குகிறது."
        ),
        "hi": (
            "FarmConnect एक कृषि डिजिटल प्लेटफॉर्म है जो किसानों, थोक विक्रेताओं और प्रशासकों को जोड़ता है। "
            "यह प्रत्यक्ष फसल बिक्री, लाइव मंडी भाव, इन्वेंटरी प्रबंधन, ऑर्डर ट्रैकिंग और लोकल एआई सहायता प्रदान करता है।"
        ),
    },

    "roles": {
        "en": (
            "FarmConnect supports three primary user roles:\n"
            "1. **Farmer**: Lists produce inventory, views market prices, manages orders, sets farming goals, and receives AI selling strategies.\n"
            "2. **Vendor / Buyer**: Browses marketplace listings, compares products, places orders with real-time delivery pricing, and tracks shipments.\n"
            "3. **Admin**: Manages user accounts, verifies farmer credentials, audits platform GMV analytics, and reviews message reports."
        ),
        "ta": (
            "FarmConnect 3 முக்கிய பயனர் பாத்திரங்களை ஆதரிக்கிறது:\n"
            "1. **விவசாயி**: பயிர்களை சந்தையில் பதிவிடல், இருப்பு நிர்வாகம், சந்தை விலை சரிபார்த்தல் மற்றும் விற்பனை திட்டமிடல்.\n"
            "2. **வியாபாரி (Vendor)**: பொருட்களை தேடுதல், ஒப்பிடுதல், ஆர்டர் செய்தல் மற்றும் லைவ் டிராக்கிங்.\n"
            "3. **நிர்வாகி (Admin)**: பயனர்களை நிர்வகித்தல், விவசாயி சான்றளிப்பு மற்றும் தளத்தின் ஒட்டுமொத்த வளர்ச்சி கண்காணிப்பு."
        ),
        "hi": (
            "FarmConnect में 3 मुख्य भूमिकाएं हैं:\n"
            "1. **किसान**: फसल की लिस्टिंग, इन्वेंटरी कंट्रोल, मंडी भाव देखना और बिक्री रणनीति।\n"
            "2. **व्यापारी (Vendor)**: उत्पाद खोजना, तुलना करना, ऑर्डर देना और लाइव शिपमेंट ट्रैकिंग।\n"
            "3. **एडमिन**: यूजर मैनेजमेंट, किसान सत्यापन और प्लेटफॉर्म एनालिटिक्स।"
        ),
    },

    "farmer_features": {
        "en": (
            "As a **Farmer** on FarmConnect, you can:\n"
            "• Create and manage product listings with prices, MOQ, quality grades, and multi-language translations.\n"
            "• Monitor produce inventory with automated low-stock warnings.\n"
            "• Track total sales revenue, ASP (Average Selling Price), and top-selling produce.\n"
            "• Get AI-driven Selling Strategies based on crop perishability and market trends.\n"
            "• Find nearby wholesale buyers matching your harvest.\n"
            "• Set and track agricultural farming goals and task follow-ups.\n"
            "• Access live regional weather advisories and risk forecasts."
        ),
        "ta": (
            "FarmConnect-இல் ஒரு **விவசாயியாக** நீங்கள் செய்யக்கூடியவை:\n"
            "• பயிர் விவரங்களை விலை, குறைந்தபட்ச அளவு மற்றும் தரத்துடன் சந்தையில் பதிவிடுவது.\n"
            "• சரக்கு இருப்பு மற்றும் குறைந்த இருப்பு எச்சரிக்கைகளை கண்காணிப்பது.\n"
            "• விற்பனை வருமானம் மற்றும் சிறந்த பயிர்களின் அறிக்கையை பெறுவது.\n"
            "• பயிர் அழுகும் தன்மையைக் கொண்டு AI விற்பனை ஆலோசனைகளை பெறுவது.\n"
            "• அருகிலுள்ள மொத்த கொள்முதல் வியாபாரிகளை கண்டறிவது.\n"
            "• விவசாய இலக்குகள் மற்றும் நினைவூட்டல்களை அமைப்பது."
        ),
        "hi": (
            "FarmConnect पर एक **किसान** के रूप में आप कर सकते हैं:\n"
            "• फसल लिस्टिंग, मूल्य, न्यूनतम ऑर्डर मात्रा (MOQ) और ग्रेड दर्ज करना।\n"
            "• इन्वेंटरी और कम स्टॉक अलर्ट ट्रैक करना।\n"
            "• कुल बिक्री आय और टॉप उत्पाद प्रदर्शन देखना।\n"
            "• फसल शेल्फ-लाइफ के आधार पर एआई बिक्री सलाह प्राप्त करना।\n"
            "• नजदीकी थोक खरीदारों की सूची देखना।\n"
            "• कृषि लक्ष्य और कार्य रिमाइंडर सेट करना।"
        ),
    },

    "vendor_features": {
        "en": (
            "As a **Vendor / Buyer** on FarmConnect, you can:\n"
            "• Search and filter fresh produce by crop, category, region, price, and organic status.\n"
            "• Compare 2 to 4 products side-by-side on pricing, MOQ, and specifications.\n"
            "• Add produce to cart and checkout with automated Haversine delivery pricing.\n"
            "• Track shipments in real time with OpenStreetMap interactive route steps.\n"
            "• View order history and download receipts.\n"
            "• Communicate directly with farmers via secured in-app chat.\n"
            "• Submit product reviews and ratings."
        ),
        "ta": (
            "FarmConnect-இல் ஒரு **வியாபாரியாக (Vendor)** நீங்கள் செய்யக்கூடியவை:\n"
            "• பயிர்கள், தரம், பகுதி மற்றும் விலை அடிப்படையில் பொருட்களை தேடுவது.\n"
            "• 2 முதல் 4 பொருட்களை ஒரே நேரத்தில் பக்கவாட்டில் ஒப்பிடுவது.\n"
            "• பொருட்களை கார்ட்டில் சேர்த்து டெலிவரி கட்டணத்துடன் ஆர்டர் செய்வது.\n"
            "• வரைபடம் மூலம் ஆர்டர் நிலையை நேரலையில் (Live Tracking) காண்பது.\n"
            "• விவசாயிகளுடன் நேரடி அரட்டை (Chat) செய்வது மற்றும் மதிப்புரைகள் வழங்குவது."
        ),
        "hi": (
            "FarmConnect पर एक **व्यापारी** के रूप में आप कर सकते हैं:\n"
            "• फसल, श्रेणी, स्थान और मूल्य के अनुसार उत्पादों को खोजना।\n"
            "• 2 से 4 उत्पादों की एक साथ तुलना करना।\n"
            "• कार्ट में सामान जोड़ना और डिलीवरी शुल्क के साथ चेकआउट करना।\n"
            "• ओपनस्ट्रीटमैप पर रियल-टाइम ऑर्डर ट्रैकिंग देखना।\n"
            "• किसानों से चैट करना और रेटिंग/रिव्यू देना।"
        ),
    },

    "admin_features": {
        "en": (
            "As an **Admin** on FarmConnect, you can:\n"
            "• Manage all registered platform users and role assignments.\n"
            "• Review and verify farmer identity credentials.\n"
            "• Access platform-wide GMV, sales growth, user metrics, and operational health reports.\n"
            "• Audit message reports and handle chat moderation."
        ),
        "ta": (
            "ஒரு **நிர்வாகியாக (Admin)** நீங்கள் செய்யக்கூடியவை:\n"
            "• பயனர்கள் மற்றும் அவர்களின் பாத்திரங்களை நிர்வகிப்பது.\n"
            "• விவசாயிகள் சான்றுகளை சரிபார்த்து அங்கீகரிப்பது.\n"
            "• தளத்தின் மொத்த விற்பனை (GMV) மற்றும் அறிக்கைகளை ஆய்வு செய்வது."
        ),
        "hi": (
            "एक **एडमिन** के रूप में आप कर सकते हैं:\n"
            "• यूजर अकाउंट और रोल मैनेजमेंट।\n"
            "• किसान डॉक्यूमेंट वेरिफिकेशन।\n"
            "• संपूर्ण प्लेटफॉर्म बिक्री (GMV) और हेल्थ रिपोर्ट देखना।"
        ),
    },

    "marketplace": {
        "en": (
            "The FarmConnect Marketplace facilitates direct agricultural commerce between farmers and wholesale buyers. "
            "Key capabilities include transparent price discovery, bulk minimum order quantities (MOQ), grade specifications "
            "(Grade A/B/C), organic certifications, district-based regional filtering, and side-by-side product comparisons."
        ),
        "ta": (
            "பார்ம்கனெக்ட் சந்தை விவசாயிகள் மற்றும் வியாபாரிகளிடையே நேரடி விவசாய வர்த்தகத்தை எளிதாக்குகிறது. "
            "வெளிப்படையான விலை, குறைந்தபட்ச ஆர்டர் அளவு (MOQ), பயிர் தரம் மற்றும்地区 பகுதி சார்ந்த தேடல்களை உள்ளடக்கியது."
        ),
        "hi": (
            "FarmConnect मंडी किसानों और खरीदारों के बीच सीधे व्यापार की सुविधा देती है। "
            "इसमें पारदर्शी मूल्य निर्धारण, न्यूनतम ऑर्डर मात्रा (MOQ), फसल ग्रेड (Grade A/B/C) और क्षेत्रीय फिल्टर शामिल हैं।"
        ),
    },

    "products": {
        "en": (
            "Products on FarmConnect include fresh vegetables, fruits, food grains, pulses, and spices. "
            "Listings contain product images, available stock quantity, unit price (per kg/quintal), minimum order threshold, "
            "harvest date, organic tag, origin location, and multilingual translations."
        ),
        "ta": (
            "பார்ம்கனெக்டில் காய்கறிகள், பழங்கள், தானியங்கள் மற்றும் நறுமணப் பொருட்கள் இடம்பெற்றுள்ளன. "
            "ஒவ்வொரு தயாரிப்பிலும் இருப்பு அளவு, கிலோ/க்விண்டால் விலை, அறுவடை தேதி மற்றும் இயற்கை சான்றிதழ் விவரங்கள் இருக்கும்."
        ),
        "hi": (
            "FarmConnect पर ताजी सब्जियां, फल, अनाज, दालें और मसाले उपलब्ध हैं। "
            "उत्पाद लिस्टिंग में मात्रा, प्रति किग्रा/क्विंटल मूल्य, कटाई की तारीख और जैविक टैग शामिल हैं।"
        ),
    },

    "orders": {
        "en": (
            "The ordering workflow includes atomic stock validation, delivery fee calculation based on regional distance, "
            "order state tracking (Placed, Confirmed, Shipped, Out for Delivery, Delivered), payment processing, "
            "and live OpenStreetMap tracking updates."
        ),
        "ta": (
            "ஆர்டர் செயல்முறையில் இருப்பு சரிபார்ப்பு, தொலைவு சார்ந்த டெலிவரி கட்டணம் கணக்கீடு, ஆர்டர் நிலை மாற்றங்கள் "
            "மற்றும் வரைபட நேரலை டிராக்கிங் ஆகியவை அடங்கும்."
        ),
        "hi": (
            "ऑर्डर प्रक्रिया में स्टॉक सत्यापन, दूरी के अनुसार डिलीवरी शुल्क, ऑर्डर स्थिति अपडेट और लाइव ओपनस्ट्रीटमैप ट्रैकिंग शामिल है।"
        ),
    },

    "inventory": {
        "en": (
            "FarmConnect inventory tools track current listed stock, alert farmers when items hit low-stock thresholds, "
            "and provide inventory analytics on fast-moving versus slow-moving crops."
        ),
        "ta": (
            "விவசாயியின் சரக்கு இருப்பு கருவிகள் தற்போதைய கைஇருப்பை கண்காணிக்கின்றன மற்றும் குறைந்த இருப்பு வரும்போது எச்சரிக்கின்றன."
        ),
        "hi": (
            "इन्वेंटरी टूल्स स्टॉक का हिसाब रखते हैं और कम स्टॉक होने पर चेतावनी देते हैं।"
        ),
    },

    "payments": {
        "en": (
            "FarmConnect integrates Razorpay payment processing supporting sandbox test mode and secure online payments. "
            "All payment transactions utilize server-side HMAC signature verification to prevent tampering."
        ),
        "ta": (
            "பார்ம்கனெக்ட் ரேஸர்பே (Razorpay) ஆன்லைன் கட்டண முறையை ஆதரிக்கிறது. பாதுகாப்பான HMAC கையொப்ப சரிபார்ப்புடன் செயல்படுகிறது."
        ),
        "hi": (
            "FarmConnect में Razorpay भुगतान गेटवे एकीकृत है जो सुरक्षित ऑनलाइन भुगतान और HMAC सत्यापन का समर्थन करता है।"
        ),
    },

    "authentication": {
        "en": (
            "Authentication uses secure Argon2id/PBKDF2 password hashing and httpOnly JWT session cookies. "
            "Password recovery is supported via security questions or OTP verification sent via Nodemailer email SMTP."
        ),
        "ta": (
            "பயனர் கணக்குகள் Argon2id குறிமுறை மற்றும் httpOnly JWT குக்கீகள் மூலம் பாதுகாக்கப்படுகின்றன. "
            "பாதுகாப்பு வினாக்கள் அல்லது மின்னஞ்சல் OTP மூலம் பாஸ்வேர்ட் மீட்டெடுக்கலாம்."
        ),
        "hi": (
            "अकाउंट सुरक्षा Argon2id पासवर्ड हैशिंग और httpOnly JWT कुकीज़ द्वारा संचालित है। "
            "पासवर्ड रीसेट सुरक्षा प्रश्नों या ईमेल OTP द्वारा समर्थित है।"
        ),
    },

    "oauth": {
        "en": (
            "Yes, FarmConnect supports Google OAuth single sign-on (SSO) for fast and secure user registration and login."
        ),
        "ta": (
            "ஆம், பார்ம்கனெக்ட் கூகிள் (Google OAuth) மூலம் எளிதாக லாகின் மற்றும் பதிவு செய்யும் வசதியை ஆதரிக்கிறது."
        ),
        "hi": (
            "हाँ, FarmConnect गूगल लॉगिन (Google OAuth) का समर्थन करता है।"
        ),
    },

    "ai_features": {
        "en": (
            "FarmConnect features an authoritative local Python AI Copilot (zero external LLM dependencies) providing:\n"
            "• Natural Language Intent & Entity understanding in English, Tamil, Hindi, and Tanglish/Hinglish.\n"
            "• Automatic execution of 14+ live data tools (prices, orders, inventory, demand, weather).\n"
            "• Human-In-The-Loop (HITL) Action Proposals with single-use authorization tokens.\n"
            "• Perishability Selling Strategy Engine (evaluating hold vs sell decisions).\n"
            "• Crop Disease & Health Image Analysis with magic-byte validation.\n"
            "• Personal Copilot Memory for remembering farmer crop preferences.\n"
            "• Proactive Agricultural Risk & Opportunity Alerts."
        ),
        "ta": (
            "பார்ம்கனெக்ட் உள்நாட்டு Python AI உதவியாளரைக் கொண்டுள்ளது:\n"
            "• தமிழ், ஆங்கிலம், ஹிந்தி மற்றும் தங்க்லீஷ் உரையாடல் புரிதல்.\n"
            "• 14+ நேரடி தரவு கருவிகளை (மண்டி விலை, ஆர்டர்கள், இருப்பு, வானிலை) தானாக இயக்குதல்.\n"
            "• மனித உறுதிப்படுத்தலுடன் (HITL) செயல் முன்மொழிவுகள் (விலை/இருப்பு மாற்றம்).\n"
            "• பயிர் அழுகல் நிலை சார்ந்த விற்பனை உத்தி ஆலோசனைகள்.\n"
            "• பயிர் நோய் புகைப்பட ஆய்வு.\n"
            "• விவசாயியின் நினைவூட்டல்கள் மற்றும் இலக்குகள் பராமரிப்பு."
        ),
        "hi": (
            "FarmConnect में पूरी तरह से लोकल Python AI असिस्टेंट है:\n"
            "• हिंदी, तमिल, अंग्रेजी और हिंग्लिश भाषा में स्वाभाविक बातचीत।\n"
            "• 14+ लाइव डेटा टूल्स (मंडी भाव, स्टॉक, ऑर्डर, मौसम) का स्वतः निष्पादन।\n"
            "• यूजर की सहमति से एक्शन प्रपोजल (मूल्य/स्टॉक अपडेट)।\n"
            "• फसल शेल्फ-लाइफ पर आधारित बिक्री रणनीति।\n"
            "• फसल बीमारी फोटो विश्लेषण।\n"
            "• व्यक्तिगत एआई मेमोरी और कृषि लक्ष्य ट्रैकिंग।"
        ),
    },

    "multilingual": {
        "en": (
            "Yes, FarmConnect fully supports multiple languages: English, Tamil (தமிழ்), Hindi (हिंदी), and Tanglish/Hinglish, "
            "including controlled agricultural terms, entity extraction, and response formatting."
        ),
        "ta": (
            "ஆம், பார்ம்கனெக்ட் தமிழ், ஆங்கிலம், ஹிந்தி மற்றும் தங்க்லீஷ் ஆகிய 4 மொழிகளையும் முழுமையாக ஆதரிக்கிறது."
        ),
        "hi": (
            "हाँ, FarmConnect हिंदी, तमिल, अंग्रेजी और हिंग्लिश भाषाओं का पूरा समर्थन करता है।"
        ),
    },

    "voice": {
        "en": (
            "Yes, FarmConnect supports voice interactions, including Speech-to-Text (STT) query input and Text-to-Speech (TTS) response playback, "
            "with browser Web Speech API fallback for seamless hands-free operation."
        ),
        "ta": (
            "ஆம், பார்ம்கனெக்ட் குரல் வழி உள்ளீடு (Speech-to-Text) மற்றும் குரல் வழி பதில் (Text-to-Speech) வசதிகளை ஆதரிக்கிறது."
        ),
        "hi": (
            "हाँ, FarmConnect वॉयस इनपुट (Speech-to-Text) और वॉयस आउटपुट (Text-to-Speech) का समर्थन करता है।"
        ),
    },

    "weather": {
        "en": (
            "FarmConnect integrates Open-Meteo API to provide real-time agricultural weather advisories, rainfall predictions, "
            "temperature monitoring, and agro-climatic risk warnings tailored to specific districts and crops."
        ),
        "ta": (
            "பார்ம்கனெக்ட் Open-Meteo API மூலம் நேரலை வானிலை முன்னறிவிப்பு, மழை வாய்ப்பு மற்றும் மாவட்ட அளவிலான வேளாண் அபாய எச்சரிக்கைகளை வழங்குகிறது."
        ),
        "hi": (
            "FarmConnect Open-Meteo API द्वारा रियल-टाइम मौसम सलाह, बारिश का पूर्वानुमान और कृषि जोखिम चेतावनी प्रदान करता है।"
        ),
    },

    "integrations": {
        "en": (
            "FarmConnect integrates the following external APIs and services:\n"
            "• **Open-Meteo**: Real-time regional agricultural weather forecasts.\n"
            "• **Razorpay**: Online payment gateway processing.\n"
            "• **OpenStreetMap & Nominatim**: Interactive route maps, geocoding, and reverse geocoding.\n"
            "• **Nodemailer / SMTP**: Transactional emails and OTP delivery."
        ),
        "ta": (
            "பார்ம்கனெக்டில் ஒருங்கிணைக்கப்பட்ட வெளிப்புற சேவைகள்:\n"
            "• **Open-Meteo**: வானிலை முன்னறிவிப்பு.\n"
            "• **Razorpay**: ஆன்லைன் கட்டண சேவை.\n"
            "• **OpenStreetMap & Nominatim**: வரைபடம் மற்றும் முகவரி சேவைகள்.\n"
            "• **Nodemailer / SMTP**: மின்னஞ்சல் மற்றும் OTP."
        ),
        "hi": (
            "FarmConnect में निम्नलिखित एपीआई एकीकृत हैं:\n"
            "• **Open-Meteo**: मौसम और बारिश पूर्वानुमान।\n"
            "• **Razorpay**: ऑनलाइन भुगतान।\n"
            "• **OpenStreetMap & Nominatim**: नक्शा और स्थान सेवा।\n"
            "• **Nodemailer / SMTP**: ईमेल और ओटीपी।"
        ),
    },

    "security": {
        "en": (
            "FarmConnect enforces multi-layered security:\n"
            "• Role-Based Access Control (RBAC) across Farmer, Vendor, and Admin roles.\n"
            "• Anti-IDOR protections ensuring strict user-level database data isolation.\n"
            "• Non-custodial Action Proposals (Python formulates proposals, Node validates and executes with user consent).\n"
            "• Password hashing with Argon2id and httpOnly JWT tokens.\n"
            "• Input validation and sanitized sql query execution."
        ),
        "ta": (
            "பார்ம்கனெக்ட் பாதுகாப்பு முறைகள்:\n"
            "• பங்கை சார்ந்த அனுமதி கட்டுப்பாடு (RBAC).\n"
            "• தனிநபர் தரவு பாதுகாப்பு (Anti-IDOR).\n"
            "• Argon2id கடவுச்சொல் பாதுகாப்பு மற்றும் பாதுகாப்பான குக்கீகள்."
        ),
        "hi": (
            "FarmConnect सुरक्षा मानक:\n"
            "• भूमिका-आधारित पहुंच नियंत्रण (RBAC)।\n"
            "• डेटा गोपनीयता संरक्षण (Anti-IDOR)।\n"
            "• Argon2id हैशिंग और httpOnly JWT।"
        ),
    },

    "tech_stack": {
        "en": (
            "FarmConnect is built with a modern high-performance architecture:\n"
            "• **Frontend**: React (Vite), TailwindCSS, Leaflet/OSM Maps, Lucide Icons, i18next.\n"
            "• **Node Backend**: Express.js REST API gateway, MySQL database layer, JWT Auth, Nodemailer.\n"
            "• **AI Microservice**: Python FastAPI service, Local Deterministic NLP engine, Pydantic schemas, Pytest."
        ),
        "ta": (
            "பார்ம்கனெக்ட் தொழில்நுட்ப தளம்:\n"
            "• **முன்முனை (Frontend)**: React (Vite), TailwindCSS, Leaflet Maps.\n"
            "• **பின்முனை (Node Backend)**: Express.js, MySQL, JWT Auth.\n"
            "• **AI சேவை**: Python FastAPI, Local NLP Engine."
        ),
        "hi": (
            "FarmConnect की तकनीक:\n"
            "• **फ्रंटएंड**: React (Vite), TailwindCSS, Leaflet Maps।\n"
            "• **बैकएंड**: Express.js, MySQL, JWT।\n"
            "• **एआई सेवा**: Python FastAPI, Local NLP।"
        ),
    },

    "crud_difference": {
        "en": (
            "FarmConnect goes far beyond a traditional CRUD application by integrating:\n"
            "1. **Local AI Copilot**: Intelligent natural language understanding and multi-language processing.\n"
            "2. **Perishability Decision Engine**: Algorithmic crop selling recommendations balancing shelf-life vs mandi price trends.\n"
            "3. **Market Intelligence**: Live APMC price and demand analytics across districts.\n"
            "4. **Human-In-The-Loop Action Proposals**: Structured proposal contracts with single-use execution tokens.\n"
            "5. **Live Shipment Tracking**: Interactive OpenStreetMap route simulation and event tracking.\n"
            "6. **Proactive Agricultural Risk Insights**: Automatic weather and low-stock alerts."
        ),
        "ta": (
            "சாதாரண CRUD செயலியை விட FarmConnect எவ்வாறு சிறந்தது:\n"
            "1. **உள்நாட்டு AI உதவியாளர்**: இயற்கை மொழி உரையாடல் மற்றும் 4 மொழிகள் ஆதரவு.\n"
            "2. **விற்பனை திட்டமிடும் இயந்திரம்**: பயிர் அழுகும் நிலை மற்றும் சந்தை விலை ஒப்பீடு.\n"
            "3. **சந்தை அறிவுக் கூர்மை**: நேரடி மண்டி விலை மற்றும் தேவை பகுப்பாய்வு.\n"
            "4. **செயல் முன்மொழிவுகள்**: பாதுகாப்பான டோக்கன்களுடன் மனித உறுதிப்படுத்தல்.\n"
            "5. **நேரலை வரைபட டிராக்கிங்**: OpenStreetMap வழித்தட டிராக்கிங்."
        ),
        "hi": (
            "साधारण CRUD ऐप की तुलना में FarmConnect क्यों खास है:\n"
            "1. **लोकल एआई Copilot**: स्वाभाविक भाषा और 4 भाषाओं में सहायता।\n"
            "2. **बिक्री निर्णय इंजन**: मंडी भाव और फसल शेल्फ-लाइफ का विश्लेषण।\n"
            "3. **मंडी भाव इंटेलिजेंस**: रियल-टाइम मांग और मूल्य रुझान।\n"
            "4. **मानव सहमति से एक्शन प्रपोजल**: सुरक्षित टोकन सिस्टम।\n"
            "5. **लाइव नक्शा ट्रैकिंग**: ओपनस्ट्रीटमैप लाइव ट्रैकिंग।"
        ),
    },

    "help": {
        "en": (
            "I can assist you with all FarmConnect features and live data operations:\n"
            "• **Project Information**: Learn about features, user roles (Farmer, Vendor, Admin), Google login, multi-language/voice, tech stack, and security.\n"
            "• **Marketplace & Prices**: List available products, check real-time market prices, or discover wholesale buyers.\n"
            "• **Farmer Tools**: View your inventory, check low-stock items, inspect sales revenue, and get selling strategies.\n"
            "• **Orders & Delivery**: Track orders in real-time or view your recent order history.\n"
            "• **Farm Management**: Check farming goals, task follow-ups, and regional weather advisories."
        ),
        "ta": (
            "நான் உங்களுக்கு பார்ம்கனெக்ட் அம்சங்கள் மற்றும் நேரலை தகவல்களில் உதவ முடியும்:\n"
            "• **திட்ட விவரங்கள்**: பார்ம்கனெக்ட் அம்சங்கள், பயனர் பாத்திரங்கள், கூகுள் லாகின், தமிழ்/ஹிந்தி மொழி மற்றும் குரல் வசதி.\n"
            "• **சந்தை மற்றும் விலை**: பொருட்கள் பட்டியல், இன்றைய சந்தை விலை மற்றும் வியாபாரிகள் விவரம்.\n"
            "• **விவசாயி கருவிகள்**: உங்கள் சரக்கு இருப்பு, குறைந்த இருப்பு பொருட்கள், விற்பனை வருமானம் மற்றும் விற்பனை ஆலோசனைகள்.\n"
            "• **ஆர்டர் மற்றும் டிராக்கிங்**: ஆர்டர் நிலை மற்றும் வரைபட டிராக்கிங்.\n"
            "• **பண்ணை நிர்வாகம்**: விவசாய இலக்குகள், நினைவூட்டல்கள் மற்றும் வானிலை அறிக்கைகள்."
        ),
        "hi": (
            "मैं FarmConnect की सभी सुविधाओं और लाइव डेटा में आपकी मदद कर सकता हूँ:\n"
            "• **प्रोजेक्ट जानकारी**: ऐप की सुविधाएं, भूमिकाएं (किसान, व्यापारी, एडमिन), गूगल लॉगिन, भाषा और वॉयस सपोर्ट।\n"
            "• **मंडी और भाव**: उपलब्ध उत्पाद, लाइव मंडी भाव, और खरीदार खोज।\n"
            "• **किसान टूल्स**: आपका स्टॉक, कम स्टॉक सूची, बिक्री आय और बिक्री रणनीति।\n"
            "• **ऑर्डर और ट्रैकिंग**: ऑर्डर स्थिति और लाइव मैप ट्रैकिंग।\n"
            "• **फार्म प्रबंधन**: कृषि लक्ष्य, रिमाइंडर और मौसम सलाह।"
        ),
    }
}


TOPIC_PATTERNS: list[Tuple[str, re.Pattern]] = [
    ("oauth", re.compile(r"\b(google|oauth|sign-?in\s+with\s+google|google\s+login)\b", re.IGNORECASE)),
    ("multilingual", re.compile(r"\b(language|languages|multilingual|tamil|hindi|tanglish|hinglish|bhasha|மொழி)\b", re.IGNORECASE)),
    ("voice", re.compile(r"\b(voice|speech|stt|tts|audio|bolkar|குரல்)\b", re.IGNORECASE)),
    ("farmer_features", re.compile(r"\b(farmer|farmers|kisan|விவசாயி)\b", re.IGNORECASE)),
    ("vendor_features", re.compile(r"\b(vendor|buyer|trader|buyers|merchants|vyapari|வியாபாரி|வாங்குபவர்)\b", re.IGNORECASE)),
    ("admin_features", re.compile(r"\b(admin|administrator|நிர்வாகி)\b", re.IGNORECASE)),
    ("marketplace", re.compile(r"\b(marketplace|mandi|catalog|சந்தை)\b", re.IGNORECASE)),
    ("orders", re.compile(r"\b(order|orders|ordering|tracking|shipment|ஆர்டர்)\b", re.IGNORECASE)),
    ("products", re.compile(r"\b(product|products|produce|crop|crops|பொருட்கள்)\b", re.IGNORECASE)),
    ("inventory", re.compile(r"\b(inventory|stock|warehouse|இருப்பு)\b", re.IGNORECASE)),
    ("payments", re.compile(r"\b(payment|payments|razorpay|checkout|கட்டணம்)\b", re.IGNORECASE)),
    ("authentication", re.compile(r"\b(auth|authentication|password|jwt|argon2id)\b", re.IGNORECASE)),
    ("ai_features", re.compile(r"\b(ai|copilot|assistant|nlp|reasoning|intelligence|செயற்கை\s+நுண்ணறிவு)\b", re.IGNORECASE)),
    ("weather", re.compile(r"\b(weather|forecast|rain|temperature|open-meteo|வானிலை)\b", re.IGNORECASE)),
    ("integrations", re.compile(r"\b(api|apis|integration|integrations|external|third-party)\b", re.IGNORECASE)),
    ("tech_stack", re.compile(r"\b(tech|technolog(?:y|ies)|stack|framework|react|express|fastapi|mysql|built)\b", re.IGNORECASE)),
    ("crud_difference", re.compile(r"\b(crud|different|difference)\b", re.IGNORECASE)),
    ("help", re.compile(r"\b(help|features|capabilities|what\s+can\s+you\s+do|what\s+can\s+you\s+help|available|all\s+features)\b", re.IGNORECASE)),
    ("project_overview", re.compile(r"\b(what\s+is\s+farmconnect|about\s+farmconnect|overview|farmconnect\s+app)\b", re.IGNORECASE)),
]


def match_project_topic(text: str) -> str:
    """Detects the specific project knowledge topic from query text."""
    clean = text.lower().strip()
    for topic, pattern in TOPIC_PATTERNS:
        if pattern.search(clean):
            return topic
    return "overview"


def get_project_knowledge_response(text: str, lang: str = "en") -> str:
    """
    Retrieves authoritative local project knowledge for a given query and language.
    Does not execute external calls or database queries.
    """
    topic = match_project_topic(text)
    knowledge_topic = PROJECT_KNOWLEDGE_BASE.get(topic) or PROJECT_KNOWLEDGE_BASE["project_overview"]

    normalized_lang = (lang or "en").lower()
    if normalized_lang in ("ta", "tamil", "tanglish"):
        selected_lang = "ta"
    elif normalized_lang in ("hi", "hindi", "hinglish"):
        selected_lang = "hi"
    else:
        selected_lang = "en"

    return knowledge_topic.get(selected_lang) or knowledge_topic["en"]
