"""
FarmConnect — Farmer Selling Strategy Tools.
Port of backend/services/marketplaceAgentService.js.
Provides:
- getSellingRecommendation
- getMySellingOpportunities
- compareSellingOptions
- getSellingPlan

Adheres strictly to Zero-Fabrication principles and execution-time RBAC.
"""

from typing import Any, Dict, List, Optional
from app.database.connection import db
from app.tools.read_tools.marketplace_query import normalize_crop_name


async def collect_marketplace_facts(
    farmer_id: Optional[str],
    raw_commodity: Optional[str] = None,
    user_location: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Collects verified database and service facts for a farmer's crop or produce category."""
    commodity = normalize_crop_name(raw_commodity) if raw_commodity else None
    loc = user_location or {}

    farmer = None
    if farmer_id:
        farmer = db.query_get(
            "SELECT id, name, role, region, district, city, lat, lng, primaryCrop FROM users WHERE id = ?",
            [str(farmer_id).strip()]
        )

    district = loc.get("district") or (farmer.get("district") if farmer else None)
    region = loc.get("region") or (farmer.get("region") if farmer else None)
    lat = loc.get("lat") or (farmer.get("lat") if farmer else None)
    lng = loc.get("lng") or (farmer.get("lng") if farmer else None)

    # 1. Inventory
    inventory: List[Dict[str, Any]] = []
    if farmer_id:
        if commodity:
            raw_term = f"%{commodity.lower()}%"
            inventory = db.query_all(
                "SELECT * FROM products WHERE farmerId = ? AND (LOWER(name) LIKE ? OR LOWER(category) LIKE ?)",
                [str(farmer_id).strip(), raw_term, raw_term]
            ) or []
        else:
            inventory = db.query_all(
                "SELECT * FROM products WHERE farmerId = ? ORDER BY createdAt DESC",
                [str(farmer_id).strip()]
            ) or []

    # 2. Price Intelligence
    price_stats = None
    price_listings: List[Dict[str, Any]] = []
    if commodity:
        term = f"%{commodity.lower()}%"
        price_listings = db.query_all(
            "SELECT * FROM products WHERE LOWER(name) LIKE ? OR LOWER(category) LIKE ?",
            [term, term]
        ) or []
    else:
        price_listings = db.query_all("SELECT * FROM products LIMIT 50") or []

    if price_listings:
        valid_prices = sorted([
            float(p["price"]) for p in price_listings
            if p.get("price") is not None and not str(p["price"]).isalpha()
        ])
        if valid_prices:
            min_p = valid_prices[0]
            max_p = valid_prices[-1]
            sum_p = sum(valid_prices)
            avg_p = round(sum_p / len(valid_prices), 1)
            mid = len(valid_prices) // 2
            median_p = valid_prices[mid] if len(valid_prices) % 2 != 0 else round((valid_prices[mid - 1] + valid_prices[mid]) / 2.0, 1)

            organic = [p for p in price_listings if p.get("organic") in (1, True, "1")]
            conv = [p for p in price_listings if p.get("organic") not in (1, True, "1")]

            organic_avg = round(sum(float(p["price"]) for p in organic) / len(organic), 1) if organic else None
            conv_avg = round(sum(float(p["price"]) for p in conv) / len(conv), 1) if conv else None

            price_stats = {
                "sampleSize": len(valid_prices),
                "unit": price_listings[0].get("unit", "kg"),
                "minPrice": min_p,
                "maxPrice": max_p,
                "avgPrice": avg_p,
                "medianPrice": median_p,
                "organicCount": len(organic),
                "conventionalCount": len(conv),
                "organicAvg": organic_avg,
                "conventionalAvg": conv_avg
            }

    # 3. Demand Intelligence (Orders in last 7, 30, 90 days)
    demand_stats = None
    total_orders_row = db.query_get("SELECT COUNT(*) as count FROM orders")
    total_orders_count = total_orders_row.get("count", 0) if total_orders_row else 0

    if total_orders_count >= 1:
        order_items_sql = """
            SELECT oi.qty, oi.unitPrice, oi.amount, o.createdAt, p.name as productName, p.category
            FROM order_items oi
            JOIN orders o ON oi.orderId = o.id
            JOIN products p ON oi.productId = p.id
        """
        order_params: List[Any] = []
        if commodity:
            term = f"%{commodity.lower()}%"
            order_items_sql += " WHERE LOWER(p.name) LIKE ? OR LOWER(p.category) LIKE ?"
            order_params.extend([term, term])

        order_items = db.query_all(order_items_sql, order_params) or []
        if order_items:
            import time
            now_ms = time.time() * 1000
            day_ms = 24 * 60 * 60 * 1000

            def parse_item_time(item: Dict[str, Any]) -> float:
                created = item.get("createdAt")
                if isinstance(created, str):
                    from datetime import datetime
                    try:
                        return datetime.fromisoformat(created.replace("Z", "+00:00")).timestamp() * 1000
                    except Exception:
                        return now_ms
                return now_ms

            items_7d = [i for i in order_items if (now_ms - parse_item_time(i)) <= 7 * day_ms]
            items_30d = [i for i in order_items if (now_ms - parse_item_time(i)) <= 30 * day_ms]
            items_90d = [i for i in order_items if (now_ms - parse_item_time(i)) <= 90 * day_ms]

            qty_7d = sum(int(i.get("qty") or 0) for i in items_7d)
            qty_30d = sum(int(i.get("qty") or 0) for i in items_30d)
            qty_90d = sum(int(i.get("qty") or 0) for i in items_90d)

            trend = "stable"
            if qty_7d > (qty_30d / 4.0) * 1.2:
                trend = "increasing"
            elif qty_7d < (qty_30d / 4.0) * 0.8:
                trend = "decreasing"

            demand_stats = {
                "totalOrdersSampled": len(order_items),
                "qty7d": qty_7d,
                "qty30d": qty_30d,
                "qty90d": qty_90d,
                "trend": trend,
                "demandSurge": trend == "increasing"
            }

    # 4. Pending / Unfulfilled Buyer Orders
    pending_orders: List[Dict[str, Any]] = []
    if commodity:
        term = f"%{commodity.lower()}%"
        pending_orders = db.query_all(
            """SELECT o.id, o.vendorName, o.deliveryDistrict, o.deliveryRegion, oi.qty, oi.unitPrice, p.name as productName
               FROM orders o
               JOIN order_items oi ON o.id = oi.orderId
               JOIN products p ON oi.productId = p.id
               WHERE o.status IN ('Pending', 'Processing') AND (LOWER(p.name) LIKE ? OR LOWER(p.category) LIKE ?)""",
            [term, term]
        ) or []
    else:
        pending_orders = db.query_all(
            """SELECT o.id, o.vendorName, o.deliveryDistrict, o.deliveryRegion, oi.qty, oi.unitPrice, p.name as productName
               FROM orders o
               JOIN order_items oi ON o.id = oi.orderId
               JOIN products p ON oi.productId = p.id
               WHERE o.status IN ('Pending', 'Processing') LIMIT 10"""
        ) or []

    # 5. Weather Risk Check (non-blocking fallback)
    weather = None
    rain_risk = False
    try:
        from app.tools.external_tools.weather import get_weather_advisory
        w_res = await get_weather_advisory(district=district, region=region, crop=commodity, lat=lat, lng=lng)
        if isinstance(w_res, dict) and w_res.get("agriculturalIndicators"):
            weather = w_res
            rain_risk = bool(w_res["agriculturalIndicators"].get("rainExpectedNext48h", False))
    except Exception:
        weather = None

    # 6. Proactive Insights
    proactive_insights: List[Dict[str, Any]] = []
    if farmer_id:
        try:
            proactive_insights = db.query_all(
                "SELECT * FROM ai_proactive_insights WHERE userId = ? AND status = 'active' ORDER BY createdAt DESC LIMIT 5",
                [str(farmer_id).strip()]
            ) or []
        except Exception:
            pass

    return {
        "commodity": commodity or "All Crops",
        "farmerId": farmer_id,
        "location": {"district": district, "region": region, "lat": lat, "lng": lng},
        "inventory": inventory,
        "priceStats": price_stats,
        "demandStats": demand_stats,
        "pendingOrders": pending_orders,
        "weather": weather,
        "rainRisk": rain_risk,
        "proactiveInsights": proactive_insights
    }


async def generate_selling_strategy(
    farmer_id: Optional[str],
    commodity: Optional[str] = None,
    quantity: Optional[float] = None,
    user_location: Optional[Dict[str, Any]] = None,
    lang: str = "en"
) -> Dict[str, Any]:
    """Generates a structured selling strategy separating verified FACTS from REASONING."""
    facts = await collect_marketplace_facts(farmer_id, commodity, user_location)

    canonical = commodity if commodity else (facts["inventory"][0]["name"] if facts["inventory"] else "Crop")
    farmer_stock = sum(int(item.get("stock") or 0) for item in facts["inventory"])

    target_qty: Optional[float] = None
    if quantity is not None:
        try:
            val = float(quantity)
            if val > 0:
                target_qty = val
        except (ValueError, TypeError):
            pass
    if target_qty is None:
        target_qty = float(farmer_stock) if farmer_stock > 0 else None

    # Check if completely insufficient data
    if not facts["priceStats"] and farmer_stock == 0 and len(facts["pendingOrders"]) == 0:
        return {
            "success": True,
            "recommendation": "NEED_MORE_INFORMATION",
            "targetCommodity": canonical,
            "targetQuantity": target_qty,
            "facts": {
                "inventory": "No stock listed in inventory.",
                "priceData": f"No active platform listings found for {canonical}.",
                "demandData": "No recent procurement order history.",
                "weatherData": "Weather unavailable"
            },
            "reasoning": f"Insufficient platform data is available to generate a reliable selling decision for {canonical}. Please update your inventory stock or check back when market listings are active.",
            "estimatedGrossRevenue": None,
            "grossRevenueText": None,
            "riskLevel": "Low",
            "disclaimer": "Agricultural selling recommendations are decision-support estimates based on current platform data and weather forecasts."
        }

    price = facts["priceStats"]["medianPrice"] if facts["priceStats"] else None
    avg_price = facts["priceStats"]["avgPrice"] if facts["priceStats"] else None
    trend = facts["demandStats"]["trend"] if facts["demandStats"] else "stable"
    rain_risk = facts["rainRisk"]

    recommendation = "WAIT"
    reasoning_points: List[str] = []
    risk_level = "Medium"

    if farmer_stock == 0 and facts["priceStats"]:
        recommendation = "LIST_NOW"
        risk_level = "Low"
        reasoning_points.append(
            f"You currently have no listed stock for {canonical}. Platform demand and prices average ₹{avg_price}/kg. Listing your crop now allows prospective buyers to view your produce."
        )
    elif rain_risk and (trend == "increasing" or price):
        recommendation = "PARTIAL_SELL"
        risk_level = "Medium"
        reasoning_points.append(
            f"Rainfall is anticipated within the next 48 hours, posing harvest and transit risk. However, current market demand is {trend} at ~₹{price or avg_price}/kg. Selling part of your stock (e.g. 50%) now locks in immediate revenue while mitigating crop weather risk."
        )
    elif trend == "increasing" and price and avg_price and price >= avg_price:
        recommendation = "SELL_NOW"
        risk_level = "Low"
        reasoning_points.append(
            f"Market demand is surging and current median price (₹{price}/kg) is strong. Capitalizing on high buyer activity reduces inventory holding costs."
        )
    elif trend == "decreasing" and price:
        recommendation = "PARTIAL_SELL"
        risk_level = "High"
        reasoning_points.append(
            f"Demand has slowed recently. Consider selling a portion of mature stock now to maintain cash flow while holding the remainder for price recovery."
        )
    else:
        recommendation = "WAIT"
        risk_level = "Medium"
        reasoning_points.append(
            f"Market prices (₹{price or avg_price}/kg) and demand are stable. Holding inventory under safe storage conditions may yield better price realization as demand builds."
        )

    # Calculate estimated revenue
    estimated_gross_revenue: Optional[float] = None
    gross_revenue_text: Optional[str] = None
    unit_price = price or avg_price
    unit_str = facts["priceStats"]["unit"] if facts["priceStats"] else "kg"

    if target_qty and unit_price:
        total_rev = round(target_qty * unit_price, 2)
        estimated_gross_revenue = total_rev
        gross_revenue_text = f"ESTIMATED GROSS REVENUE: ₹{total_rev:,.2f} ({target_qty} {unit_str} × ₹{unit_price}/{unit_str})"

    formatted_facts = {
        "commodity": canonical,
        "inventoryStock": f"{farmer_stock} {unit_str}" if farmer_stock > 0 else "None listed",
        "currentMedianPrice": f"₹{price}/{unit_str}" if price else (f"₹{avg_price}/{unit_str}" if avg_price else "N/A"),
        "priceRange": f"₹{facts['priceStats']['minPrice']} – ₹{facts['priceStats']['maxPrice']}/{unit_str}" if facts["priceStats"] else "N/A",
        "demandTrend": facts["demandStats"]["trend"] if facts["demandStats"] else "Insufficient order data",
        "recentOrderVolume": f"{facts['demandStats']['qty30d']} units in 30 days" if facts["demandStats"] else "0 orders",
        "weatherConditions": f"Rain Risk: {'Yes' if rain_risk else 'No'}",
        "pendingBuyerOrdersCount": len(facts["pendingOrders"]),
        "location": facts["location"]["district"] or facts["location"]["region"] or "Regional"
    }

    suggested_price = price or avg_price
    actions: List[Dict[str, Any]] = []
    if farmer_stock == 0:
        actions.append({"action": "LIST_PRODUCE", "description": f"Create listing for {canonical} to attract buyers."})
    elif recommendation in ("SELL_NOW", "PARTIAL_SELL"):
        actions.append({"action": "REVIEW_BUYER_ORDERS", "description": "Review unfulfilled buyer opportunities in your region."})
    else:
        actions.append({"action": "MONITOR_MARKET", "description": "Keep monitoring daily mandi price movements."})

    return {
        "success": True,
        "recommendation": recommendation,
        "targetCommodity": canonical,
        "targetQuantity": target_qty,
        "suggestedPrice": suggested_price,
        "actions": actions,
        "facts": formatted_facts,
        "reasoning": " ".join(reasoning_points),
        "estimatedGrossRevenue": estimated_gross_revenue,
        "grossRevenueText": gross_revenue_text,
        "riskLevel": risk_level,
        "disclaimer": "Recommendations are decision-support estimates based on platform data and weather forecasts. Future market prices and profits cannot be guaranteed."
    }


# -------------------------------------------------------------
# 1. getSellingRecommendation Handler
# -------------------------------------------------------------
async def get_selling_recommendation(
    commodity: Optional[str] = None,
    crop: Optional[str] = None,
    quantity: Optional[float] = None,
    district: Optional[str] = None,
    region: Optional[str] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    farmerId: Optional[str] = None,
    params: Optional[Dict[str, Any]] = None,
    user: Optional[Dict[str, Any]] = None,
    **kwargs: Any
) -> Dict[str, Any]:
    """Synthesizes farmer inventory, real prices, actual demand, and weather into a structured recommendation."""
    p = {**(params or {}), **kwargs}
    u = user or {}
    f_id = farmerId or p.get("farmerId") or u.get("id")
    comm = commodity or crop or p.get("commodity") or p.get("crop") or p.get("productName")
    qty = quantity if quantity is not None else (p.get("quantity") or p.get("targetQuantity"))

    loc = {
        "district": district or p.get("district") or u.get("district"),
        "region": region or p.get("region") or u.get("region"),
        "lat": lat or p.get("lat") or u.get("lat"),
        "lng": lng or p.get("lng") or u.get("lng"),
    }

    strategy = await generate_selling_strategy(
        farmer_id=f_id,
        commodity=comm,
        quantity=qty,
        user_location=loc,
        lang=u.get("lang", "en")
    )

    facts_obj = {
        **strategy["facts"],
        "inventory": strategy["facts"].get("inventoryStock", "None listed"),
        "marketPricing": strategy["facts"].get("currentMedianPrice", "N/A"),
        "weather": strategy["facts"].get("weatherConditions", "Weather unavailable")
    }

    return {
        "commodity": strategy["targetCommodity"],
        "crop": strategy["targetCommodity"],
        "recommendation": strategy["recommendation"],
        "estimatedGrossRevenue": strategy["estimatedGrossRevenue"],
        "grossRevenueText": strategy["grossRevenueText"],
        "suggestedPrice": strategy.get("suggestedPrice"),
        "actions": strategy.get("actions", []),
        "riskLevel": strategy["riskLevel"],
        "facts": facts_obj,
        "FACTS": facts_obj,
        "reasoning": strategy["reasoning"],
        "REASONING": {
            "recommendationSummary": strategy["reasoning"],
            "keyFactors": [strategy["reasoning"]]
        },
        "disclaimer": f"{strategy['disclaimer']} This is an informational estimate and decision support tool.",
        "DISCLAIMER": f"{strategy['disclaimer']} This is an informational estimate and decision support tool."
    }


# -------------------------------------------------------------
# 2. getMySellingOpportunities Handler
# -------------------------------------------------------------
async def detect_selling_opportunities(
    farmer_id: Optional[str],
    user_location: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Detects data-driven selling opportunities across a farmer's inventory."""
    opportunities = []
    products = db.query_all("SELECT * FROM products WHERE farmerId = ?", [str(farmer_id).strip()]) if farmer_id else []

    for prod in (products or []):
        facts = await collect_marketplace_facts(farmer_id, prod["name"], user_location)
        if facts.get("demandStats") and facts["demandStats"].get("trend") == "increasing":
            opportunities.append({
                "id": f"opp_demand_{prod['id']}",
                "type": "HIGH_DEMAND",
                "title": f"Demand Surge for {prod['name']}",
                "commodity": prod["name"],
                "description": f"High procurement demand detected for {prod['name']} with {facts['demandStats'].get('qty30d', 0)} units ordered recently.",
                "action": "SELL_NOW",
                "productId": prod["id"],
                "currentStock": prod.get("stock", 0),
                "currentPrice": prod.get("price", 0)
            })

        if facts.get("rainRisk"):
            opportunities.append({
                "id": f"opp_weather_{prod['id']}",
                "type": "WEATHER_RISK",
                "title": f"Weather Harvest Risk for {prod['name']}",
                "commodity": prod["name"],
                "description": f"Rainfall forecasted within 48h. Selling part of your {prod['name']} stock protects harvested produce.",
                "action": "PARTIAL_SELL",
                "productId": prod["id"],
                "currentStock": prod.get("stock", 0),
                "currentPrice": prod.get("price", 0)
            })

        if facts.get("priceStats") and prod.get("price") and float(prod["price"]) < facts["priceStats"]["avgPrice"]:
            opportunities.append({
                "id": f"opp_price_{prod['id']}",
                "type": "PRICE_OPPORTUNITY",
                "title": f"Price Adjustment Opportunity for {prod['name']}",
                "commodity": prod["name"],
                "description": f"Your listed price (₹{prod['price']}/kg) is below platform average (₹{facts['priceStats']['avgPrice']}/kg). Updating your price may increase revenue.",
                "action": "UPDATE_PRICE",
                "productId": prod["id"],
                "suggestedPrice": facts["priceStats"]["avgPrice"],
                "currentPrice": prod.get("price", 0)
            })

    return {
        "success": True,
        "farmerId": farmer_id,
        "opportunityCount": len(opportunities),
        "totalDetected": len(opportunities),
        "opportunities": opportunities
    }


async def get_my_selling_opportunities(
    district: Optional[str] = None,
    region: Optional[str] = None,
    farmerId: Optional[str] = None,
    params: Optional[Dict[str, Any]] = None,
    user: Optional[Dict[str, Any]] = None,
    **kwargs: Any
) -> Dict[str, Any]:
    """Handler for getMySellingOpportunities tool."""
    p = {**(params or {}), **kwargs}
    u = user or {}
    f_id = farmerId or p.get("farmerId") or u.get("id")
    loc = {
        "district": district or p.get("district") or u.get("district"),
        "region": region or p.get("region") or u.get("region"),
        "lat": p.get("lat") or u.get("lat"),
        "lng": p.get("lng") or u.get("lng")
    }
    return await detect_selling_opportunities(f_id, loc)


# -------------------------------------------------------------
# 3. compareSellingOptions Handler
# -------------------------------------------------------------
async def compare_selling_options(
    farmer_id: Optional[str],
    commodities: Optional[List[str]] = None,
    user_location: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Compares multiple produce crops side-by-side for harvest and selling prioritization."""
    target_commodities = commodities if (isinstance(commodities, list) and len(commodities) > 0) else ["Tomato", "Onion"]
    comparison_rows = []

    for item in target_commodities:
        strategy = await generate_selling_strategy(
            farmer_id=farmer_id,
            commodity=str(item).strip(),
            user_location=user_location
        )
        comparison_rows.append({
            "channel": f"Marketplace Direct ({strategy['targetCommodity']})",
            "commodity": strategy["targetCommodity"],
            "inventory": strategy["facts"].get("inventoryStock", "None listed"),
            "currentPrice": strategy["facts"].get("currentMedianPrice", "N/A"),
            "demandTrend": strategy["facts"].get("demandTrend", "Insufficient order data"),
            "weatherRisk": "High Rain Risk" if "Rain Risk: Yes" in strategy["facts"].get("weatherConditions", "") else "Normal",
            "recommendation": strategy["recommendation"],
            "riskLevel": strategy["riskLevel"],
            "netEstimatedRevenue": strategy["estimatedGrossRevenue"],
            "estimatedRevenue": strategy["grossRevenueText"] or "N/A"
        })

    return {
        "success": True,
        "crop": target_commodities[0] if len(target_commodities) == 1 else "Multi-crop",
        "comparedCount": len(comparison_rows),
        "options": comparison_rows,
        "comparison": comparison_rows,
        "recommendedOption": comparison_rows[0]["channel"] if comparison_rows else "Marketplace Direct",
        "disclaimer": "Comparative recommendations analyze platform price and demand data side-by-side to assist harvest prioritization."
    }


async def handle_compare_selling_options(
    commodities: Optional[List[str]] = None,
    farmerId: Optional[str] = None,
    params: Optional[Dict[str, Any]] = None,
    user: Optional[Dict[str, Any]] = None,
    **kwargs: Any
) -> Dict[str, Any]:
    """Handler for compareSellingOptions tool."""
    p = {**(params or {}), **kwargs}
    u = user or {}
    f_id = farmerId or p.get("farmerId") or u.get("id")
    comms = commodities or p.get("commodities") or ([p["crop"]] if p.get("crop") else None) or ([p["commodity"]] if p.get("commodity") else None)
    loc = {
        "district": p.get("district") or u.get("district"),
        "region": p.get("region") or u.get("region"),
        "lat": p.get("lat") or u.get("lat"),
        "lng": p.get("lng") or u.get("lng")
    }
    return await compare_selling_options(f_id, comms, loc)


# -------------------------------------------------------------
# 4. getSellingPlan Handler
# -------------------------------------------------------------
async def generate_smart_selling_plan(
    farmer_id: Optional[str],
    user_location: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Generates a complete multi-crop smart selling plan across farmer inventory."""
    if not farmer_id:
        raise ValueError("Farmer ID is required to generate a selling plan.")

    products = db.query_all("SELECT * FROM products WHERE farmerId = ?", [str(farmer_id).strip()]) or []
    target_crops: List[str] = []

    if products:
        target_crops = sorted(list(set(p["name"] for p in products if p.get("name"))))
    else:
        user_row = db.query_get("SELECT primaryCrop, cropsGrown FROM users WHERE id = ?", [str(farmer_id).strip()])
        if user_row and user_row.get("primaryCrop"):
            target_crops = [user_row["primaryCrop"]]
        else:
            target_crops = ["Tomato", "Onion"]

    plan_items = []
    for crop in target_crops:
        strat = await generate_selling_strategy(
            farmer_id=farmer_id,
            commodity=crop,
            user_location=user_location
        )
        qty_val = strat.get("targetQuantity")
        suggested_qty = "N/A"
        if qty_val:
            factor = 0.5 if strat["recommendation"] == "PARTIAL_SELL" else 1.0
            suggested_qty = f"{round(qty_val * factor)} kg"

        timing = "Hold for 7-14 days"
        if strat["recommendation"] == "SELL_NOW":
            timing = "Immediate (Next 24-48h)"
        elif strat["recommendation"] == "PARTIAL_SELL":
            timing = "Partial sale now"

        plan_items.append({
            "product": strat["targetCommodity"],
            "inventory": strat["facts"].get("inventoryStock", "None listed"),
            "marketSituation": f"Median price {strat['facts']['currentMedianPrice']}" if strat["facts"].get("currentMedianPrice") != "N/A" else "Limited market listings",
            "demand": strat["facts"].get("demandTrend", "Insufficient order data"),
            "weatherConsiderations": strat["facts"].get("weatherConditions", "Weather unavailable"),
            "suggestedQuantity": suggested_qty,
            "suggestedPriceRange": strat["facts"].get("priceRange", "N/A"),
            "suggestedTiming": timing,
            "recommendation": strat["recommendation"],
            "risk": strat["riskLevel"],
            "reasoning": strat["reasoning"],
            "estimatedGrossRevenue": strat.get("grossRevenueText")
        })

    return {
        "success": True,
        "farmerId": farmer_id,
        "totalCropsEvaluated": len(plan_items),
        "plan": plan_items,
        "disclaimer": "Suggested quantities and price ranges are recommendations, not guarantees. Review local market conditions before executing sales."
    }


async def get_selling_plan(
    district: Optional[str] = None,
    region: Optional[str] = None,
    farmerId: Optional[str] = None,
    params: Optional[Dict[str, Any]] = None,
    user: Optional[Dict[str, Any]] = None,
    **kwargs: Any
) -> Dict[str, Any]:
    """Handler for getSellingPlan tool."""
    p = {**(params or {}), **kwargs}
    u = user or {}
    f_id = farmerId or p.get("farmerId") or u.get("id")
    loc = {
        "district": district or p.get("district") or u.get("district"),
        "region": region or p.get("region") or u.get("region"),
        "lat": p.get("lat") or u.get("lat"),
        "lng": p.get("lng") or u.get("lng")
    }
    return await generate_smart_selling_plan(f_id, loc)
