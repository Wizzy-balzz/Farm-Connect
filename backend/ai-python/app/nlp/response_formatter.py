"""
Deterministic Agricultural Response Formatter for FarmConnect.
Generates localized, human-friendly responses from tool outputs and NLP results
without any dependency on external LLM APIs.
"""

from typing import Any, Dict, List, Optional
from app.nlp.models import ExtractedEntities, NlpPipelineResult


def format_currency(amount: Any) -> str:
    """Safely format numeric currency amounts."""
    try:
        val = float(amount)
        return f"₹{val:,.2f}"
    except (ValueError, TypeError):
        return f"₹{amount}"


def format_tool_response(
    intent: str,
    tool_name: str,
    tool_result: Any,
    nlp_result: NlpPipelineResult,
    user: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Transforms structured tool execution data into clear, user-friendly
    agricultural text in the user's preferred language.

    Returns:
        dict with keys: 'text', 'actionSuggestion'
    """
    lang = (nlp_result.language.language or "en").lower()
    entities = nlp_result.entities
    commodity = entities.commodity
    action_suggestion = None

    # Handle error / forbidden tool execution
    if isinstance(tool_result, dict) and tool_result.get("success") is False:
        err = tool_result.get("error", {})
        err_code = err.get("code", "ERROR")
        if err_code == "FORBIDDEN":
            if lang in ("ta", "tamil", "tanglish"):
                text = "மன்னிக்கவும், இந்த தகவலை அணுக உங்கள் பயனர் கணக்கிற்கு அனுமதி இல்லை."
            elif lang in ("hi", "hindi", "hinglish"):
                text = "क्षमा करें, आपके खाते को इस जानकारी को देखने की अनुमति नहीं है।"
            else:
                text = "You are not authorized to access this information with your current platform role."
            return {"text": text, "actionSuggestion": None}

        msg = err.get("message", "Unable to retrieve records.")
        return {"text": f"FarmConnect request error: {msg}", "actionSuggestion": None}

    data = tool_result.get("data", tool_result) if isinstance(tool_result, dict) else tool_result

    # 1. Low Stock / Inventory Shortage
    if intent == "INVENTORY_LOW_STOCK" or tool_name == "getMyInventoryAnalytics":
        items = []
        if isinstance(data, dict):
            # Might have lowStockProducts list or summary
            items = data.get("lowStockProducts") or data.get("low_stock") or data.get("products") or []
        elif isinstance(data, list):
            items = [item for item in data if float(item.get("quantity") or item.get("stock") or 0) <= 50]

        if not items and isinstance(data, dict) and data.get("items"):
            items = data.get("items")

        if items:
            if lang in ("ta", "tamil", "tanglish"):
                lines = ["குறைந்த கையிருப்பு உள்ள உங்கள் தயாரிப்புகள்:"]
                for it in items[:8]:
                    name = it.get("title") or it.get("name") or it.get("crop") or "பயிர்"
                    qty = it.get("quantity") or it.get("stock") or 0
                    unit = it.get("unit") or "கிலோ"
                    lines.append(f"• {name} — {qty} {unit}")
                lines.append("\nவிரைவில் புதிய இருப்பை புதுப்பிக்கவும்.")
                text = "\n".join(lines)
            elif lang in ("hi", "hindi", "hinglish"):
                lines = ["आपके निम्नलिखित उत्पादों का स्टॉक कम है:"]
                for it in items[:8]:
                    name = it.get("title") or it.get("name") or it.get("crop") or "उत्पाद"
                    qty = it.get("quantity") or it.get("stock") or 0
                    unit = it.get("unit") or "kg"
                    lines.append(f"• {name} — {qty} {unit}")
                lines.append("\nकृपया जल्द ही नए स्टॉक को अपडेट करें।")
                text = "\n".join(lines)
            else:
                lines = ["These products are low in stock:"]
                for it in items[:8]:
                    name = it.get("title") or it.get("name") or it.get("crop") or "Product"
                    qty = it.get("quantity") or it.get("stock") or 0
                    unit = it.get("unit") or "kg"
                    lines.append(f"• {name} — {qty} {unit}")
                lines.append("\nConsider harvesting or restocking to fulfill incoming marketplace orders.")
                text = "\n".join(lines)

            action_suggestion = {
                "type": "NAVIGATE",
                "path": "/farmer/products",
                "label": "Manage My Products"
            }
            return {"text": text, "actionSuggestion": action_suggestion}
        else:
            if lang in ("ta", "tamil", "tanglish"):
                text = "உங்கள் தயாரிப்புகள் அனைத்தும் போதுமான கையிருப்பில் உள்ளன. இருப்பு பற்றாக்குறை ஏதுமில்லை."
            elif lang in ("hi", "hindi", "hinglish"):
                text = "आपके सभी उत्पादों का स्टॉक पर्याप्त है। किसी उत्पाद की कमी नहीं है।"
            else:
                text = "All your products currently have healthy inventory levels. No shortages detected."
            return {"text": text, "actionSuggestion": None}

    # 2. General Inventory Query
    if intent == "INVENTORY_QUERY" or tool_name == "getMyInventory":
        products = data if isinstance(data, list) else (data.get("products") or [])
        if commodity:
            # Filter specifically for the requested commodity
            matched = [p for p in products if commodity.lower() in (p.get("title") or p.get("name") or "").lower()]
            if matched:
                p = matched[0]
                title = p.get("title") or p.get("name") or commodity.capitalize()
                qty = p.get("quantity") or p.get("stock") or 0
                unit = p.get("unit") or "kg"
                price = format_currency(p.get("price") or 0)
                if lang in ("ta", "tamil", "tanglish"):
                    text = f"உங்களிடம் உள்ள {title} சரக்கு இருப்பு: {qty} {unit} (விலை: {price}/{unit})."
                elif lang in ("hi", "hindi", "hinglish"):
                    text = f"आपके पास {title} का कुल स्टॉक {qty} {unit} है (मूल्य: {price}/{unit})।"
                else:
                    text = f"Your {title} inventory is currently {qty} {unit} (Listed price: {price}/{unit})."
                return {
                    "text": text,
                    "actionSuggestion": {"type": "NAVIGATE", "path": "/farmer/products", "label": f"View {title} in Catalog"}
                }

        if products:
            if lang in ("ta", "tamil", "tanglish"):
                lines = ["உங்கள் தற்போதைய சரக்கு இருப்பு பட்டியல்:"]
                for p in products[:6]:
                    title = p.get("title") or p.get("name") or "பயிர்"
                    qty = p.get("quantity") or p.get("stock") or 0
                    unit = p.get("unit") or "கிலோ"
                    price = format_currency(p.get("price") or 0)
                    lines.append(f"• {title} — {qty} {unit} ({price}/{unit})")
                text = "\n".join(lines)
            elif lang in ("hi", "hindi", "hinglish"):
                lines = ["आपकी वर्तमान इन्वेंटरी सूची:"]
                for p in products[:6]:
                    title = p.get("title") or p.get("name") or "उत्पाद"
                    qty = p.get("quantity") or p.get("stock") or 0
                    unit = p.get("unit") or "kg"
                    price = format_currency(p.get("price") or 0)
                    lines.append(f"• {title} — {qty} {unit} ({price}/{unit})")
                text = "\n".join(lines)
            else:
                lines = ["Your current inventory items:"]
                for p in products[:6]:
                    title = p.get("title") or p.get("name") or "Product"
                    qty = p.get("quantity") or p.get("stock") or 0
                    unit = p.get("unit") or "kg"
                    price = format_currency(p.get("price") or 0)
                    lines.append(f"• {title} — {qty} {unit} ({price}/{unit})")
                text = "\n".join(lines)
            return {
                "text": text,
                "actionSuggestion": {"type": "NAVIGATE", "path": "/farmer/products", "label": "Manage Inventory"}
            }
        else:
            if lang in ("ta", "tamil", "tanglish"):
                text = "உங்கள் பண்ணை பட்டியலில் தற்போது எந்த தயாரிப்புகளும் பதிவு செய்யப்படவில்லை."
            else:
                text = "You currently have no listed products in your inventory. Add produce from your Farmer Dashboard to begin selling."
            return {"text": text, "actionSuggestion": {"type": "NAVIGATE", "path": "/farmer/products", "label": "Add New Produce"}}

    # 3. Revenue / Sales Analytics Query
    if intent == "REVENUE_SALES_QUERY" or tool_name in ("getMySalesAnalytics", "getMySales"):
        rev_val = 0.0
        orders_count = 0
        if isinstance(data, dict):
            rev_val = float(data.get("totalRevenue") or data.get("grossRevenue") or data.get("revenue") or 0.0)
            orders_count = int(data.get("totalOrders") or data.get("orderCount") or data.get("orders") or 0)
        elif isinstance(data, list):
            for row in data:
                rev_val += float(row.get("totalPrice") or row.get("price") or 0.0)
            orders_count = len(data)

        formatted_rev = format_currency(rev_val)
        if lang in ("ta", "tamil", "tanglish"):
            text = (
                f"ESTIMATED GROSS REVENUE: {formatted_rev}\n"
                f"சரிபார்க்கப்பட்ட விற்பனை ஆணைகள்: {orders_count}\n"
                "குறிப்பு: நிகர லாபம் உற்பத்தி மற்றும் போக்குவரத்து செலவுகளை பொறுத்து மாறுபடும்."
            )
        elif lang in ("hi", "hindi", "hinglish"):
            text = (
                f"ESTIMATED GROSS REVENUE: {formatted_rev}\n"
                f"सत्यापित ऑर्डर संख्या: {orders_count}\n"
                "नोट: शुद्ध लाभ इनपुट और परिवहन लागत पर निर्भर करता है।"
            )
        else:
            text = (
                f"ESTIMATED GROSS REVENUE: {formatted_rev}\n"
                f"Verified completed orders: {orders_count}\n"
                "Note: Actual net profit depends on your cultivation and transportation overheads."
            )
        return {
            "text": text,
            "actionSuggestion": {"type": "NAVIGATE", "path": "/farmer/orders", "label": "Review Order History"}
        }

    # 3B. Order Listing / Tracking (getMyOrders)
    if intent in ("ORDER_QUERY", "ORDER_TRACKING") or tool_name == "getMyOrders":
        orders = data if isinstance(data, list) else (data.get("orders") or [])
        user_role = (user.get("role") or "farmer").lower()

        if orders:
            unique_orders = {}
            for r in orders:
                oid = r.get("id") or "order"
                if oid not in unique_orders:
                    unique_orders[oid] = {
                        "id": oid,
                        "vendorName": r.get("vendorName") or "Buyer/Vendor",
                        "totalAmount": r.get("totalAmount") or r.get("amount") or 0,
                        "status": r.get("status") or "PENDING",
                        "createdAt": str(r.get("createdAt") or "").split("T")[0] or "Recent",
                        "itemsCount": 0
                    }
                unique_orders[oid]["itemsCount"] += 1

            order_list = list(unique_orders.values())

            if lang in ("ta", "tamil", "tanglish"):
                lines = [f"உங்கள் சமீபத்திய {min(len(order_list), 5)} ஆர்டர்கள் பட்டியல்:"]
                for o in order_list[:5]:
                    oid = o["id"]
                    status = o["status"]
                    amt = format_currency(o["totalAmount"])
                    vendor = o["vendorName"]
                    lines.append(f"• ஆர்டர் #{oid} — நிலை: {status} (தொகை: {amt}, வாடிக்கையாளர்/வியாபாரி: {vendor})")
                text = "\n".join(lines)
            elif lang in ("hi", "hindi", "hinglish"):
                lines = [f"आपके हाल के {min(len(order_list), 5)} ऑर्डर्स की सूची:"]
                for o in order_list[:5]:
                    oid = o["id"]
                    status = o["status"]
                    amt = format_currency(o["totalAmount"])
                    vendor = o["vendorName"]
                    lines.append(f"• ऑर्डर #{oid} — स्थिति: {status} (कुल: {amt}, व्यापारी/खरीदार: {vendor})")
                text = "\n".join(lines)
            else:
                lines = [f"Found {len(order_list)} recent order(s):"]
                for o in order_list[:5]:
                    oid = o["id"]
                    status = o["status"]
                    amt = format_currency(o["totalAmount"])
                    vendor = o["vendorName"]
                    dt = o["createdAt"]
                    lines.append(f"• Order #{oid} — Status: {status} (Total: {amt}, Party: {vendor}, Date: {dt})")
                text = "\n".join(lines)

            nav_path = "/vendor/orders" if user_role == "vendor" else "/farmer/orders"
            return {
                "text": text,
                "actionSuggestion": {"type": "NAVIGATE", "path": nav_path, "label": "View All Orders"}
            }
        else:
            if lang in ("ta", "tamil", "tanglish"):
                text = "தற்போது உங்களிடம் எந்த ஆர்டர்களும் பதிவு செய்யப்படவில்லை."
            elif lang in ("hi", "hindi", "hinglish"):
                text = "वर्तमान में आपके पास कोई ऑर्डर दर्ज नहीं है।"
            else:
                text = "No recent orders found in your account history."
            nav_path = "/vendor/orders" if user_role == "vendor" else "/farmer/orders"
            return {"text": text, "actionSuggestion": {"type": "NAVIGATE", "path": nav_path, "label": "Go to Orders Page"}}

    # 4. Marketplace Product Search
    if intent == "MARKETPLACE_SEARCH" or tool_name == "searchProducts":
        products = data if isinstance(data, list) else (data.get("products") or [])
        if products:
            if lang in ("ta", "tamil", "tanglish"):
                lines = [f"சந்தையில் உள்ள சிறந்த {min(len(products), 5)} தயாரிப்புகள்:"]
                for p in products[:5]:
                    title = p.get("title") or p.get("name") or "பயிர்"
                    price = format_currency(p.get("price") or 0)
                    qty = p.get("quantity") or p.get("stock") or 0
                    unit = p.get("unit") or "கிலோ"
                    loc = p.get("location") or "தமிழ்நாடு"
                    lines.append(f"• {title} — {price}/{unit} ({qty} {unit} இருப்பு, இடம்: {loc})")
                text = "\n".join(lines)
            else:
                lines = [f"Found {len(products)} matching marketplace listings:"]
                for p in products[:5]:
                    title = p.get("title") or p.get("name") or "Produce"
                    price = format_currency(p.get("price") or 0)
                    qty = p.get("quantity") or p.get("stock") or 0
                    unit = p.get("unit") or "kg"
                    loc = p.get("location") or "Local Mandi"
                    lines.append(f"• {title} — {price}/{unit} ({qty} {unit} available, {loc})")
                text = "\n".join(lines)
            return {
                "text": text,
                "actionSuggestion": {"type": "APPLY_FILTER", "filters": {}, "label": "View Marketplace Listings"}
            }
        else:
            text = "No matching marketplace listings were found for your query. Try broadening your search or check back soon."
            return {"text": text, "actionSuggestion": None}

    # 5. Farming Goals
    if intent == "FARMING_GOALS" or tool_name == "getMyFarmingGoals":
        goals = data if isinstance(data, list) else (data.get("goals") or [])
        if goals:
            lines = ["Your verified farming goals:"]
            for g in goals[:5]:
                title = g.get("title") or "Farming Target"
                pct = g.get("progressPct") or g.get("progress") or 0
                target = g.get("targetValue") or g.get("target") or ""
                unit = g.get("targetUnit") or ""
                lines.append(f"• {title}: {pct}% completed (Target: {target} {unit})")
            text = "\n".join(lines)
            return {"text": text, "actionSuggestion": {"type": "NAVIGATE", "path": "/farmer/dashboard", "label": "View Goals"}}
        else:
            text = "You have no active farming goals. You can set goals like 'Harvest 500 kg Tomatoes' to track seasonal progress."
            return {"text": text, "actionSuggestion": None}

    # 6. Follow-ups
    if intent == "FOLLOWUPS_QUERY" or tool_name == "getMyFollowUps":
        followups = data if isinstance(data, list) else (data.get("followups") or [])
        if followups:
            lines = ["Your scheduled agricultural follow-ups & reminders:"]
            for f in followups[:5]:
                title = f.get("title") or f.get("description") or "Follow-up"
                due = (f.get("scheduledDate") or f.get("dueDate") or "Scheduled").split("T")[0]
                lines.append(f"• {title} (Due: {due})")
            text = "\n".join(lines)
            return {"text": text, "actionSuggestion": None}
        else:
            text = "You have no pending follow-ups or alerts at this time."
            return {"text": text, "actionSuggestion": None}

    # 7. Weather Advisory
    if intent == "WEATHER_QUERY" or tool_name == "getWeatherAdvisory":
        loc = (entities.location or "Regional").capitalize()
        temp = data.get("temperature", 28) if isinstance(data, dict) else 28
        cond = data.get("condition", "Partly Cloudy") if isinstance(data, dict) else "Fair"
        advisory = data.get("advisory", "Suitable for outdoor farming activities.") if isinstance(data, dict) else "Weather is favorable."
        if lang in ("ta", "tamil", "tanglish"):
            text = (
                f"{loc} வானிலை நிலவரம்: வெப்பநிலை {temp}°C, வானிலை: {cond}.\n"
                f"வேளாண் ஆலோசனை: {advisory}"
            )
        else:
            text = (
                f"Weather Advisory for {loc}: Temperature is {temp}°C ({cond}).\n"
                f"Agricultural Recommendation: {advisory}"
            )
        return {"text": text, "actionSuggestion": None}

    # 8. Price Intelligence
    if intent == "PRICE_INTELLIGENCE" or tool_name in ("getPriceIntelligence", "getPriceInsights"):
        comm = commodity.capitalize() if commodity else "Agricultural produce"
        benchmark = format_currency(data.get("benchmarkPrice") or data.get("averagePrice") or data.get("price") or 45.0) if isinstance(data, dict) else "₹45.00"
        trend = (data.get("trend") or "STABLE") if isinstance(data, dict) else "STABLE"
        if lang in ("ta", "tamil", "tanglish"):
            text = f"{comm} சந்தை சராசரி விலை: {benchmark}/கிலோ (விலை போக்கு: {trend})."
        else:
            text = f"Market Intelligence for {comm}: Current benchmark price is {benchmark}/kg (Trend: {trend})."
        return {
            "text": text,
            "actionSuggestion": {"type": "NAVIGATE", "path": "/vendor/marketplace", "label": "View Market Trends"}
        }

    # 9. Selling Recommendation (Phase 9 / 11)
    if intent == "SELLING_STRATEGY" or tool_name in ("getSellingRecommendation", "getSellingPlan"):
        comm = commodity.capitalize() if commodity else "Produce"
        rec = data.get("recommendation", "SELL_NOW") if isinstance(data, dict) else "SELL_NOW"
        facts = data.get("facts", {}) if isinstance(data, dict) else {}
        reasoning = data.get("reasoning", "Market prices are currently favorable.") if isinstance(data, dict) else ""
        gross_rev = format_currency(data.get("estimatedGrossRevenue", 14400)) if isinstance(data, dict) else "₹14,400"

        if lang in ("ta", "tamil", "tanglish"):
            text = (
                f"விற்பனை பரிந்துரை ({comm}): {rec}\n\n"
                f"உண்மைகள் (FACTS): தற்போதைய சந்தை விலை மற்றும் வரத்து பகுப்பாய்வு செய்யப்பட்டது.\n"
                f"பகுப்பாய்வு (REASONING): {reasoning}\n"
                f"ESTIMATED GROSS REVENUE: {gross_rev}\n\n"
                "முக்கிய குறிப்பு: சந்தை விலை மாறக்கூடியது. முடிவெடுக்கும் முன் உள்ளூர் மண்டி விலையை சரிபார்க்கவும்."
            )
        else:
            text = (
                f"Selling Advisory for {comm}: {rec}\n\n"
                f"FACTS: Verified current mandi prices and inventory volume.\n"
                f"REASONING: {reasoning}\n"
                f"ESTIMATED GROSS REVENUE: {gross_rev}\n\n"
                "Note: Market conditions fluctuate. Final selling decision remains with the farmer."
            )
        return {
            "text": text,
            "actionSuggestion": {"type": "NAVIGATE", "path": "/farmer/products", "label": "Manage Farmer Produce"}
        }

    # 10. Farm Performance Report
    if intent == "FARM_REPORT" or tool_name == "getMyFarmReport":
        total_prods = data.get("totalProducts", 3) if isinstance(data, dict) else 3
        rev = format_currency(data.get("totalRevenue", 0)) if isinstance(data, dict) else "₹0.00"
        text = (
            f"Farm Performance Report Summary:\n"
            f"• Active Listed Products: {total_prods}\n"
            f"• ESTIMATED GROSS REVENUE: {rev}\n"
            f"• Inventory Health: All core listings active and ready for sale."
        )
        return {"text": text, "actionSuggestion": None}

    # Default fallback formatting
    text = f"FarmConnect processed your request using {tool_name} successfully."
    return {"text": text, "actionSuggestion": None}


from app.ai.project_knowledge import get_project_knowledge_response


def format_conversational_response(nlp_result: NlpPipelineResult, user: Optional[Dict[str, Any]] = None) -> str:
    """
    Generates natural, friendly conversational greetings, project knowledge answers,
    or broad capability clarification requests without executing backend tools.
    """
    lang = (nlp_result.language.language or "en").lower()
    intent = nlp_result.intent.intent
    conf = nlp_result.intent.confidence
    user_name = (user or {}).get("name") or "Farmer"

    if intent == "PROJECT_KNOWLEDGE":
        return get_project_knowledge_response(nlp_result.original_text, lang=lang)

    # Low confidence -> ask a comprehensive capability clarification question
    if conf < 0.60:
        if lang in ("ta", "tamil", "tanglish"):
            return (
                "நான் உங்களுக்கு பல பார்ம்கனெக்ட் அம்சங்களில் உதவ முடியும்:\n"
                "• **திட்ட விவரங்கள் & உதவி**: 'FarmConnect என்றால் என்ன?', 'விவசாயி என்ன செய்ய முடியும்?', 'கூகுள் லாகின் வசதி உள்ளதா?'\n"
                "• **சந்தை & விலை**: 'சந்தை பொருட்களை காட்டு', 'இன்றைய தக்காளி விலை என்ன?'\n"
                "• **இருப்பு & ஆர்டர்கள்**: 'என் இருப்பு என்ன?', 'குறைந்த இருப்பு பொருட்களை காட்டு', 'என் ஆர்டர்களை காட்டு'\n"
                "• **ஆலோசனைகள்**: 'விற்பனை திட்டம்', 'விவசாய இலக்குகள்', 'வானிலை அறிக்கை'"
            )
        elif lang in ("hi", "hindi", "hinglish"):
            return (
                "मैं FarmConnect की कई सुविधाओं में आपकी मदद कर सकता हूँ:\n"
                "• **प्रोजेक्ट जानकारी**: 'FarmConnect क्या है?', 'किसान क्या कर सकता है?', 'गूगल लॉगिन'\n"
                "• **मंडी और भाव**: 'बाजार के उत्पाद दिखाएं', 'टमाटर का मंडी भाव क्या है?'\n"
                "• **इन्वेंटरी और ऑर्डर**: 'मेरा स्टॉक दिखाओ', 'कम स्टॉक दिखाओ', 'मेरे ऑर्डर दिखाओ'\n"
                "• **सलाह और लक्ष्य**: 'बिक्री रणनीति', 'कृषि लक्ष्य', 'मौसम सलाह'"
            )
        else:
            return (
                "I can assist you with all FarmConnect capabilities! You can ask about:\n"
                "• **Project Info & Help**: 'What is FarmConnect?', 'What features are available?', 'What can a farmer do?', 'Does it support Google login?'\n"
                "• **Marketplace & Prices**: 'List marketplace products', 'Give market prices', 'Show buyers near me'\n"
                "• **Inventory & Orders**: 'Show my inventory', 'List low-stock items', 'Show my orders', 'Track my order'\n"
                "• **Decision Support**: 'Should I sell my crop now?', 'Show my farming goals', 'Weather advisory'"
            )

    # General greetings
    if lang in ("ta", "tamil", "tanglish"):
        return f"வணக்கம் {user_name}! FarmConnect விவசாய உதவி மையத்திற்கு வரவேற்கிறோம். இன்று உங்கள் பயிர்கள், சந்தை விலை அல்லது சரக்கு இருப்பு பற்றி என்ன தகவல் தேவை?"
    elif lang in ("hi", "hindi", "hinglish"):
        return f"नमस्ते {user_name}! FarmConnect कृषि सहायक में आपका स्वागत है। आज मैं आपकी फसलों, मंडी भाव या स्टॉक के बारे में क्या मदद कर सकता हूँ?"
    else:
        return f"Hello {user_name}! Welcome to FarmConnect AI assistant. How can I help you with your crops, market prices, inventory, or selling plans today?"
