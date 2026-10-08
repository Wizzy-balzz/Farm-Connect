import re
from typing import Dict, List, Optional, Pattern, Tuple
from app.nlp.models import ExtractedEntities, IntentResult

# Multi-lingual regex rules with priority scores and explanation tags
INTENT_RULES: List[Tuple[str, List[re.Pattern], float]] = [
    # 00. PROJECT_KNOWLEDGE: FarmConnect project capabilities, features, roles, tech stack, integrations
    (
        "PROJECT_KNOWLEDGE",
        [
            re.compile(r"\b(what\s+is\s+farmconnect|about\s+farmconnect|tell\s+me\s+about\s+farmconnect|farmconnect\s+overview|what\s+does\s+farmconnect\s+do|farmconnect\s+app(?:lication)?)\b", re.IGNORECASE),
            re.compile(r"\b(what\s+features\s+(?:does\s+farmconnect\s+have|are\s+there)|farmconnect\s+features|list\s+(?:all\s+)?features|what\s+can\s+you\s+do|what\s+can\s+you\s+help\s+me\s+with|how\s+can\s+you\s+help|what\s+are\s+your\s+capabilities|show\s+capabilities|help\s+me\s+with|available\s+features|all\s+features)\b", re.IGNORECASE),
            re.compile(r"\b(what\s+can\s+(?:a\s+farmer|farmers?|i|a\s+user)\s+do|farmer\s+features|farmer\s+capabilities|farmer\s+role|features?\s+for\s+farmers?)\b", re.IGNORECASE),
            re.compile(r"\b(what\s+can\s+a\s+vendor\s+do|vendor\s+features|vendor\s+capabilities|vendor\s+role|what\s+can\s+buyers?\s+do|buyer\s+features|trader\s+features)\b", re.IGNORECASE),
            re.compile(r"\b(what\s+can\s+an\s+admin\s+do|admin\s+features|admin\s+capabilities|admin\s+role|admin\s+dashboard\s+features)\b", re.IGNORECASE),
            re.compile(r"\b(how\s+does\s+(?:the\s+)?marketplace\s+work|how\s+does\s+ordering\s+work|marketplace\s+working|how\s+to\s+order|order\s+process)\b", re.IGNORECASE),
            re.compile(r"\b(does\s+farmconnect\s+support\s+google\s+login|google\s+(?:oauth|login|sign-?in)|social\s+login|auth\s+support)\b", re.IGNORECASE),
            re.compile(r"\b(does\s+farmconnect\s+support\s+multiple\s+languages|multilingual\s+support|what\s+languages|language\s+support|tamil\s+support|hindi\s+support)\b", re.IGNORECASE),
            re.compile(r"\b(does\s+farmconnect\s+support\s+voice|voice\s+support|voice\s+assistant|speech\s+to\s+text|text\s+to\s+speech|voice\s+features)\b", re.IGNORECASE),
            re.compile(r"\b(what\s+ai\s+features\s+(?:are\s+available|do\s+you\s+have)|ai\s+capabilities|ai\s+copilot|ai\s+assistant\s+features)\b", re.IGNORECASE),
            re.compile(r"\b(what\s+technologies\s+(?:are\s+used|does\s+farmconnect\s+use)|tech\s+stack|technology\s+stack|built\s+with)\b", re.IGNORECASE),
            re.compile(r"\b(what\s+apis?\s+(?:are\s+)?integrated|integrated\s+apis|external\s+apis|third-?party\s+integrations)\b", re.IGNORECASE),
            re.compile(r"\b(what\s+makes\s+farmconnect\s+different\s+from\s+a\s+crud\s+(?:application|app)|crud\s+difference|different\s+from\s+crud|why\s+not\s+just\s+crud)\b", re.IGNORECASE),
            re.compile(r"(பார்ம்கனெக்ட்\s+என்றால்\s+என்ன|பார்ம்கனெக்ட்\s+பற்றி|என்னென்ன\s+அம்சங்கள்|விவசாயி\s+என்ன|வியாபாரி\s+என்ன|அட்மின்\s+என்ன|கூகிள்\s+லாகின்|பல\s+மொழிகள்|குரல்\s+வசதி)", re.IGNORECASE),
            re.compile(r"(फॉर्मकनेक्ट\s+क्या\s+है|फॉर्मकनेक्ट\s+के\s+बारे\s+में|क्या\s+सुविधाएं|किसान\s+क्या|व्यापारी\s+क्या|एडमिन\s+क्या|गूगल\s+लॉगिन|वॉयस\s+सपोर्ट)", re.IGNORECASE),
            re.compile(r"\b(farmconnect\s+kya\s+hai|kya\s+kya\s+features\s+hai|farmer\s+kya\s+kar\s+sakta|vendor\s+kya\s+kar\s+sakta|admin\s+kya\s+kar\s+sakta|google\s+login\s+hai\s+kya|voice\s+support\s+hai\s+kya)\b", re.IGNORECASE),
        ],
        0.98
    ),

    # 0A. INVENTORY_LOW_STOCK: Specific query for low stock or inventory shortages
    (
        "INVENTORY_LOW_STOCK",
        [
            re.compile(r"\b(low\s+in\s+stock|low\s+stock|out\s+of\s+stock|stock\s+(?:is\s+)?low|shortage|running\s+low|critical\s+stock|low-?stock\s+items?|show\s+low-?stock|list\s+low-?stock)\b", re.IGNORECASE),
            re.compile(r"(குறைந்த\s+இருப்பு|கையிருப்பு\s+குறைவு|இருப்பு\s+குறைவு|தீர்ந்து\s+போன)", re.IGNORECASE),
            re.compile(r"\b(kam\s+stock|stock\s+kam|khatam\s+hone\s+wala|stock\s+shortage)\b", re.IGNORECASE),
            re.compile(r"(कम\s+स्टॉक|स्टॉक\s+कम|कमी)", re.IGNORECASE),
        ],
        0.98
    ),

    # 0B. INVENTORY_QUERY: General inventory / stock queries
    (
        "INVENTORY_QUERY",
        [
            re.compile(r"\b(show|check|get|view|what\s+is)\s+(?:my\s+)?(?:.*?\s+)?(inventory|stock|produce)\b", re.IGNORECASE),
            re.compile(r"\b(my\s+inventory|my\s+stock|current\s+stock|stock\s+levels?)\b", re.IGNORECASE),
            re.compile(r"(என்\s+சரக்கு\s+இருப்பு|என்\s+இருப்பு|சரக்கு\s+இருப்பு|கையிருப்பு)", re.IGNORECASE),
            re.compile(r"\b(mera\s+stock|apna\s+stock|stock\s+dikhao|inventory\s+batao)\b", re.IGNORECASE),
            re.compile(r"(मेरा\s+स्टॉक|स्टॉक\s+दिखाएं|इन्वेंटरी)", re.IGNORECASE),
        ],
        0.96
    ),

    # 0C. REVENUE_SALES_QUERY: Sales, earnings, revenue queries
    (
        "REVENUE_SALES_QUERY",
        [
            re.compile(r"\b(how\s+much\s+.*?\b(?:revenue|sales|money|did\s+i\s+earn)|earned\s+this\s+month|revenue\s+this\s+month|my\s+sales|my\s+revenue|sales\s+revenue|sales\s+report)\b", re.IGNORECASE),
            re.compile(r"(வருமானம்|விற்பனை\s+விவரம்|விற்பனை\s+அறிக்கை|மொத்த\s+விற்பனை)", re.IGNORECASE),
            re.compile(r"\b(kitni\s+kamai|is\s+mahine\s+ki\s+kamai|meri\s+sales|kitna\s+bikri|bikri\s+report)\b", re.IGNORECASE),
            re.compile(r"(कितनी\s+कमाई|बिक्री\s+विवरण|मेरी\s+बिक्री)", re.IGNORECASE),
        ],
        0.96
    ),

    # 0D. MARKETPLACE_SEARCH: Product discovery in marketplace
    (
        "MARKETPLACE_SEARCH",
        [
            re.compile(
                r"\b("
                r"(?:list|show|view|get|display|search|browse|find)(?:\s+(?:out|all|the|my))*\s+(?:products|harvests|listings|items|produce)(?:\s+(?:in|on|at|from)\s+(?:the\s+)?(?:marketplace|mandi|catalog))?"
                r"|what\s+products\s+(?:are\s+)?available"
                r"|marketplace\s+products"
                r"|products\s+in\s+(?:the\s+)?marketplace"
                r"|available\s+products"
                r"|all\s+products"
                r"|search\s+products"
                r"|browse\s+marketplace"
                r")\b",
                re.IGNORECASE
            ),
            re.compile(r"(சந்தை\s+பொருட்கள்|பொருட்களை\s+தேடு|சந்தையில்\s+உள்ள\s+பொருட்கள்)", re.IGNORECASE),
            re.compile(r"\b(marketplace\s+me\s+products|mandi\s+me\s+products|products\s+dhundho)\b", re.IGNORECASE),
            re.compile(r"(बाज़ार\s+के\s+उत्पाद|उत्पाद\s+खोजें)", re.IGNORECASE),
        ],
        0.96
    ),

    # 0E. ORDER_QUERY: Listing or checking orders
    (
        "ORDER_QUERY",
        [
            re.compile(
                r"\b("
                r"(?:list|show|view|get|check|display)(?:\s+(?:out|all|the|my))*\s+orders"
                r"|my\s+orders"
                r"|what\s+are\s+my\s+orders"
                r"|what\s+orders\s+do\s+i\s+have"
                r"|list\s+the\s+orders"
                r"|show\s+my\s+orders"
                r"|recent\s+orders"
                r"|order\s+history"
                r"|orders\s+list"
                r")\b",
                re.IGNORECASE
            ),
            re.compile(r"(என்\s+ஆர்டர்கள்|ஆர்டர்களை\s+காட்டு|ஆர்டர்\s+பட்டியல்|ஆர்டர்கள்)", re.IGNORECASE),
            re.compile(r"\b(mere\s+orders|orders\s+dikhao|orders\s+batao|orders\s+ki\s+list)\b", re.IGNORECASE),
            re.compile(r"(मेरे\s+ऑर्डर|ऑर्डर\s+दिखाएं|ऑर्डर\s+सूची)", re.IGNORECASE),
        ],
        0.96
    ),

    # 0E. FARMING_GOALS: Goals & milestones
    (
        "FARMING_GOALS",
        [
            re.compile(r"\b(farming\s+goals?|my\s+goals?|show\s+goals?|goal\s+progress|my\s+targets?)\b", re.IGNORECASE),
            re.compile(r"(விவசாய\s+இலக்குகள்|என்\s+இலக்குகள்|இலக்கு\s+முன்னேற்றம்)", re.IGNORECASE),
            re.compile(r"\b(mere\s+goals|kheti\s+ke\s+lakshya|goals\s+dikhao)\b", re.IGNORECASE),
            re.compile(r"(कृषि\s+लक्ष्य|मेरे\s+लक्ष्य)", re.IGNORECASE),
        ],
        0.96
    ),

    # 0F. FOLLOWUPS_QUERY: Reminders and follow-up tasks
    (
        "FOLLOWUPS_QUERY",
        [
            re.compile(r"\b(show\s+(?:my\s+)?follow-?ups|pending\s+follow-?ups|my\s+follow-?ups|show\s+(?:my\s+)?reminders|my\s+tasks|pending\s+tasks)\b", re.IGNORECASE),
            re.compile(r"(நினைவூட்டல்கள்|என்\s+நினைவூட்டல்கள்|மீதமுள்ள\s+பணிகள்)", re.IGNORECASE),
            re.compile(r"\b(follow-?ups\s+dikhao|pending\s+reminders|mere\s+tasks)\b", re.IGNORECASE),
            re.compile(r"(फॉलो-अप\s+दिखाएं|पेंडिंग\s+टास्क)", re.IGNORECASE),
        ],
        0.96
    ),

    # 0G. FARM_REPORT: Complete farm overview & analytics
    (
        "FARM_REPORT",
        [
            re.compile(r"\b((?:give\s+me\s+)?(?:my\s+)?farm\s+report|farm\s+performance|overall\s+farm\s+summary)\b", re.IGNORECASE),
            re.compile(r"(பண்ணை\s+அறிக்கை|பண்ணை\s+செயல்திறன்)", re.IGNORECASE),
            re.compile(r"\b(farm\s+report\s+dikhao|farm\s+summary)\b", re.IGNORECASE),
            re.compile(r"(फार्म\s+रिपोर्ट)", re.IGNORECASE),
        ],
        0.96
    ),

    # 0H. DEMAND_INTELLIGENCE: Market commodity demand trend
    (
        "DEMAND_INTELLIGENCE",
        [
            re.compile(r"\b(demand\s+for|market\s+demand|is\s+there\s+demand|demand\s+trends?|high\s+demand)\b", re.IGNORECASE),
            re.compile(r"(தேவை\s+எவ்வாறு|சந்தை\s+தேவை|தேவை\s+இருக்கிறதா|தேவை\s+அதிகமா)", re.IGNORECASE),
            re.compile(r"\b(demand\s+kya\s+hai|maang\s+kya\s+hai|demand\s+kaisi\s+hai)\b", re.IGNORECASE),
            re.compile(r"(मांग\s+क्या\s+है|मांग\s+कैसी\s+है)", re.IGNORECASE),
        ],
        0.93
    ),

    # 0I. MEMORY_QUERY: Stored user preferences & memory
    (
        "MEMORY_QUERY",
        [
            re.compile(r"\b(what\s+do\s+you\s+remember|my\s+memory|my\s+preferences|saved\s+preferences|what\s+do\s+you\s+know\s+about\s+me)\b", re.IGNORECASE),
            re.compile(r"(என்னை\s+பற்றி\s+என்ன\s+நினைவில்|என்\s+விருப்பங்கள்)", re.IGNORECASE),
            re.compile(r"\b(mere\s+baare\s+me\s+kya\s+yaad|meri\s+preferences)\b", re.IGNORECASE),
            re.compile(r"(मेरी\s+प्राथमिकताएं|मेरे\s+बारे\s+में\s+क्या\s+याद)", re.IGNORECASE),
        ],
        0.95
    ),

    # 0J. COPILOT_PLAN: Selling plan or multi-step preparation
    (
        "COPILOT_PLAN",
        [
            re.compile(r"\b(help\s+me\s+prepare\s+(?:.*?\s+)?for\s+sale|create\s+a\s+selling\s+plan|selling\s+plan|plan\s+to\s+sell)\b", re.IGNORECASE),
            re.compile(r"(விற்பனை\s+திட்டம்|விற்பனைக்கு\s+தயார்\s+செய்ய)", re.IGNORECASE),
            re.compile(r"\b(bechne\s+ka\s+plan|selling\s+plan\s+banao)\b", re.IGNORECASE),
            re.compile(r"(बिक्री\s+की\s+योजना)", re.IGNORECASE),
        ],
        0.95
    ),

    # 1. SELLING_STRATEGY: Decision support (sell now or wait, market timing)
    (
        "SELLING_STRATEGY",
        [
            re.compile(r"\b(should\s+i\s+sell\s+(now|today)?\s*(or\s+wait)?|sell\s+now\s+or\s+wait|when\s+to\s+sell|best\s+time\s+to\s+sell)\b", re.IGNORECASE),
            re.compile(r"\b(eppo\s+vikkalama|eppo\s+sell\s+pannalama|wait\s+pannalama|vikkava|vikkalama)\b", re.IGNORECASE),
            re.compile(r"(இப்போது\s+விற்கலாமா|காத்திருக்கலாமா|எப்போது\s+விற்பது)", re.IGNORECASE),
            re.compile(r"\b(abhi\s+bechna\s+chahiye|bechein\s+ya\s+rukein|kab\s+bechna\s+hai|beche ya wait kare)\b", re.IGNORECASE),
            re.compile(r"(अभी\s+बेचें\s+या\s+इंतज़ार\s+करें|कब\s+बेचना\s+चाहिए)", re.IGNORECASE),
        ],
        0.95
    ),

    # 2. FOLLOWUP_REQUEST: Reminders & scheduled alerts
    (
        "FOLLOWUP_REQUEST",
        [
            re.compile(r"\b(remind\s+me|set\s+a\s+reminder|create\s+a\s+task|follow\s*up|schedule\s+a\s+reminder)\b", re.IGNORECASE),
            re.compile(r"(ஞாபகப்படுத்து|நினைவூட்டு|ரிமைண்டர்)", re.IGNORECASE),
            re.compile(r"\b(yaad\s+dilana|reminder\s+lagao|task\s+banao)\b", re.IGNORECASE),
            re.compile(r"(याद\s+दिलाना|रिमाइंडर)", re.IGNORECASE),
        ],
        0.95
    ),

    # 3. ORDER_TRACKING: Tracking and order delivery queries
    (
        "ORDER_TRACKING",
        [
            re.compile(r"\b(where\s+is\s+my\s+order|track\s+(?:my\s+)?(?:.*?\s+)?order|order\s+status|tracking\s+details|when\s+will\s+my\s+order\s+arrive)\b", re.IGNORECASE),
            re.compile(r"(என்\s+ஆர்டர்\s+எங்கே|ஆர்டரை\s+ட்ராக்\s+செய்|ஆர்டர்\s+நிலை)", re.IGNORECASE),
            re.compile(r"\b(mera\s+order\s+kahan\s+hai|order\s+track\s+karo|order\s+status)\b", re.IGNORECASE),
            re.compile(r"(मेरा\s+ऑर्डर\s+कहाँ\s+है|ऑर्डर\s+ट्रैक\s+करें)", re.IGNORECASE),
        ],
        0.95
    ),

    # 4. BUYER_SEARCH: Discovering wholesale buyers, traders, merchants
    (
        "BUYER_SEARCH",
        [
            re.compile(r"\b(show|find|list|get)\s+(.*?\s+)?(buyers|merchants|traders|vendors)\b", re.IGNORECASE),
            re.compile(r"\b(buyers\s+near\s+me|buyers\s+in|who\s+is\s+buying)\b", re.IGNORECASE),
            re.compile(r"(கொள்முதல்\s+செய்வோர்|வியாபாரிகள்|வாங்குவோர்)", re.IGNORECASE),
            re.compile(r"\b(kharidne\s+wale|buyers\s+dikhao|vyapari)\b", re.IGNORECASE),
            re.compile(r"(खरीदार\s+दिखाएं|व्यापारी)", re.IGNORECASE),
        ],
        0.90
    ),

    # 5. CROP_RECOMMENDATION: What to plant / cultivate / grow
    (
        "CROP_RECOMMENDATION",
        [
            re.compile(r"\b(what\s+crops?\s+should\s+i\s+(grow|plant|cultivate)|which\s+crop\s+to\s+(grow|plant)|best\s+crop\s+this\s+season|recommend\s+a\s+crop)\b", re.IGNORECASE),
            re.compile(r"(எந்த\s+பயிரை\s+பயிரிடலாம்|என்ன\s+பயிர்\s+நடலாம்|பயிர்\s+பரிந்துரை)", re.IGNORECASE),
            re.compile(r"\b(kaun\s+si\s+fasal\s+ugayein|konsi\s+fasal\s+lagayein|fasal\s+salah)\b", re.IGNORECASE),
            re.compile(r"(कौन\s+सी\s+फसल\s+उगाएं|फसल\s+की\s+सिफारिश)", re.IGNORECASE),
        ],
        0.90
    ),

    # 6. PRICE_INTELLIGENCE: Commodity rates, market price benchmarks
    (
        "PRICE_INTELLIGENCE",
        [
            re.compile(r"\b(what\s+is\s+.*?(price|rate|cost)|how\s+much\s+is|price\s+of|mandi\s+rate|market\s+prices?|give\s+(?:me\s+)?market\s+prices?|today'?s\s+.*?price)\b", re.IGNORECASE),
            re.compile(r"\b(price\s+enna|rate\s+enna|evlo\s+rate|vilai\s+enna)\b", re.IGNORECASE),
            re.compile(r"(விலை\s+என்ன|சந்தை\s+விலை|இன்றைய\s+விலை)", re.IGNORECASE),
            re.compile(r"\b(kya\s+rate\s+hai|kitna\s+bhav\s+hai|mandi\s+bhav|aaj\s+ka\s+rate|daam\s+kya\s+hai|bhav\s+kya)\b", re.IGNORECASE),
            re.compile(r"(भाव\s+क्या\s+है|दाम\s+क्या\s+है|बाजार\s+मूल्य)", re.IGNORECASE),
            re.compile(r"\b(price|rate|bhav|daam)\b", re.IGNORECASE),
        ],
        0.90
    ),

    # 7. WEATHER_QUERY: Weather forecast, rain, temperature, wind
    (
        "WEATHER_QUERY",
        [
            re.compile(r"\b(weather\s+forecast|will\s+it\s+rain|temperature|weather\s+today|rain\s+prediction)\b", re.IGNORECASE),
            re.compile(r"\b(mazhai\s+varuma|weather\s+eppadi\s+irukku|vanilai)\b", re.IGNORECASE),
            re.compile(r"(வானிலை|மழை\s+வருமா|வெப்பநிலை)", re.IGNORECASE),
            re.compile(r"\b(mausam\s+kaisa\s+hai|barish\s+hogi\s+kya|barish\s+ka\s+mausam)\b", re.IGNORECASE),
            re.compile(r"(मौसम\s+कैसा\s+है|बारिश\s+होगी\s+क्या)", re.IGNORECASE),
        ],
        0.90
    ),

    # 8. BUYING_REQUEST: Intention to procure or purchase produce
    (
        "BUYING_REQUEST",
        [
            re.compile(r"\b(i\s+want\s+to\s+buy|looking\s+to\s+buy|purchase|procure|need\s+to\s+buy)\b", re.IGNORECASE),
            re.compile(r"\b(vanga\s+venduma|vanganum|buy\s+pannanum)\b", re.IGNORECASE),
            re.compile(r"(வாங்க\s+வேண்டும்|கொள்முதல்\s+செய்ய|வாங்க\s+விருப்பம்)", re.IGNORECASE),
            re.compile(r"\b(kharidna\s+hai|kharidna\s+chahta\s+hoon|buy\s+karna\s+hai)\b", re.IGNORECASE),
            re.compile(r"(खरीदना\s+है|खरीदना\s+चाहता\s+हूं)", re.IGNORECASE),
        ],
        0.88
    ),

    # 9. SELLING_OFFER: Explicit offer / desire to sell inventory
    (
        "SELLING_OFFER",
        [
            re.compile(r"\b(i\s+want\s+to\s+sell|ready\s+to\s+sell|have\s+(.*?)\s+to\s+sell|putting\s+up\s+for\s+sale)\b", re.IGNORECASE),
            re.compile(r"\b(vikkalam\s+nu|vikkara\s+mari|sell\s+pannanum|vakkanum|irukku,?\s*sell|irukku,?\s*vikk)\b", re.IGNORECASE),
            re.compile(r"(விற்க\s+வேண்டும்|விற்கணும்|விற்பனை\s+செய்ய|இருக்கிற?து,?\s*விற்க)", re.IGNORECASE),
            re.compile(r"\b(bechna\s+hai|bechna\s+chahta\s+hoon|sell\s+karna\s+hai|hain,?\s*mujhe\s+bechna)\b", re.IGNORECASE),
            re.compile(r"(बेचना\s+है|बेचना\s+चाहता\s+हूं|बिक्री\s+के\s+लिए)", re.IGNORECASE),
        ],
        0.88
    ),

    # 10. FARM_ADVISORY: Crop disease, pest management, fertilizer, irrigation
    (
        "FARM_ADVISORY",
        [
            re.compile(r"\b(fertilizer|pesticide|fungicide|disease|pest|insects|leaf\s+curl|yellow\s+leaves|irrigation|spray)\b", re.IGNORECASE),
            re.compile(r"(பூச்சி|நோய்|உரம்|மருந்து\s+தெளிக்க|பாசனம்|இலைக்கருகல்)", re.IGNORECASE),
            re.compile(r"\b(keeda|rog|khad|dawa\s+chhidkav|sinchai|patti)\b", re.IGNORECASE),
            re.compile(r"(कीटनाशक|रोग|खाद|दवा|छिड़काव)", re.IGNORECASE),
        ],
        0.85
    ),

    # 11. GENERAL_CHAT: Greetings & conversational
    (
        "GENERAL_CHAT",
        [
            re.compile(r"\b(hello|hi|hey|good\s+morning|who\s+are\s+you|what\s+can\s+you\s+do|thank\s+you|thanks)\b", re.IGNORECASE),
            re.compile(r"(வணக்கம்|நன்றி)", re.IGNORECASE),
            re.compile(r"\b(namaste|kaise\s+ho|shukriya|dhanyavad)\b", re.IGNORECASE),
            re.compile(r"(नमस्ते|धन्यवाद|प्रणाम)", re.IGNORECASE),
        ],
        0.75
    ),

]


def detect_intent(text: str, entities: Optional[ExtractedEntities] = None) -> IntentResult:
    """
    Deterministically classifies intent from raw and normalized query text.
    Uses priority scoring and pattern matching across supported Indian languages.
    """
    if not text or not isinstance(text, str) or not text.strip():
        return IntentResult(
            intent="GENERAL_CHAT",
            confidence=0.5,
            matched_patterns=[]
        )

    clean_text = text.strip()
    matched_intents: List[Tuple[str, float, str]] = []

    for intent_name, patterns, base_conf in INTENT_RULES:
        for pat in patterns:
            match = pat.search(clean_text)
            if match:
                matched_str = match.group(0)
                matched_intents.append((intent_name, base_conf, matched_str))
                # Break to next intent once one pattern in this category matches
                break

    if matched_intents:
        # Highest confidence first; in tie, highest base priority first
        matched_intents.sort(key=lambda x: x[1], reverse=True)
        top_intent, top_conf, top_match = matched_intents[0]
        return IntentResult(
            intent=top_intent,
            confidence=top_conf,
            matched_patterns=[m[2] for m in matched_intents]
        )

    # Heuristic fallback based on entities:
    # If a commodity is present with a quantity and price, likely a selling offer
    if entities and entities.commodity and entities.quantity:
        return IntentResult(
            intent="SELLING_OFFER",
            confidence=0.70,
            matched_patterns=["entity_heuristic_commodity_and_quantity"]
        )

    if entities and entities.commodity:
        return IntentResult(
            intent="PRICE_INTELLIGENCE",
            confidence=0.60,
            matched_patterns=["entity_heuristic_commodity_only"]
        )

    return IntentResult(
        intent="GENERAL_CHAT",
        confidence=0.50,
        matched_patterns=["default_fallback"]
    )
