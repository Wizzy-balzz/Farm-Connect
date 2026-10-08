"""
Authenticated Read-Only User & Analytics Tools:
- getMyOrders
- getMySales
- getMyInventory
- getMyFarmReport
- getMySalesAnalytics
- getMyInventoryAnalytics
- getMyProductPerformance

Exact port of logic from backend/ai/aiTools.js and backend/services/analyticsReportService.js.
Strictly authenticated and scoped: user ID is ALWAYS taken from trusted auth context.
Strictly Zero Fabrication:
- No fake orders, sales, revenue, profit, or trends invented when data is empty or missing.
- Previous-period comparison unavailable if previous sales <= 0.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from app.database.connection import db
from app.tools.read_tools.marketplace_query import normalize_crop_name
from app.tools.external_tools.weather import get_weather_advisory


def resolve_date_range(range_str: str = "30d", custom_start: Optional[str] = None, custom_end: Optional[str] = None) -> Dict[str, Any]:
    """Resolves period string into ISO start and end timestamps and previous period boundaries."""
    now = datetime.now(timezone.utc)
    end_date = now
    if custom_end:
        try:
            end_date = datetime.fromisoformat(custom_end.replace("Z", "+00:00"))
        except Exception:
            end_date = now

    label = "30 days"
    if custom_start:
        try:
            start_date = datetime.fromisoformat(custom_start.replace("Z", "+00:00"))
        except Exception:
            start_date = end_date - timedelta(days=30)
        label = "custom"
    else:
        r = (range_str or "30d").lower()
        if r in ("7d", "7 days", "week"):
            start_date = end_date - timedelta(days=7)
            label = "7 days"
        elif r in ("90d", "90 days", "quarter"):
            start_date = end_date - timedelta(days=90)
            label = "90 days"
        elif r in ("month", "this month"):
            start_date = end_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            label = "this month"
        else:
            start_date = end_date - timedelta(days=30)
            label = "30 days"

    duration = end_date - start_date
    prev_end_date = start_date - timedelta(seconds=1)
    prev_start_date = prev_end_date - duration

    return {
        "label": label,
        "current": {
            "startDate": start_date.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "endDate": end_date.strftime("%Y-%m-%dT%H:%M:%SZ"),
        },
        "previous": {
            "startDate": prev_start_date.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "endDate": prev_end_date.strftime("%Y-%m-%dT%H:%M:%SZ"),
        }
    }


def calculate_metric_comparison(current_val: float = 0.0, previous_val: float = 0.0, metric_name: str = "metric", unit: str = "") -> Dict[str, Any]:
    """
    Computes deterministic change between current and previous periods.
    Strictly avoids fabricating percentages when previous metric is 0 or unavailable.
    """
    curr = float(current_val or 0.0)
    prev = float(previous_val or 0.0)
    abs_change = round(curr - prev, 2)

    if prev <= 0:
        return {
            "metric": metric_name,
            "current": curr,
            "previous": prev,
            "absoluteChange": abs_change,
            "percentageChange": None,
            "unit": unit,
            "comparisonAvailable": False,
            "message": "Previous-period comparison is unavailable because there is insufficient data."
        }

    pct_change = round(((curr - prev) / prev) * 100.0, 1)
    trend = "up" if pct_change > 0 else "down" if pct_change < 0 else "flat"

    return {
        "metric": metric_name,
        "current": curr,
        "previous": prev,
        "absoluteChange": abs_change,
        "percentageChange": pct_change,
        "unit": unit,
        "trend": trend,
        "comparisonAvailable": True,
        "message": f"{'+' if pct_change >= 0 else ''}{pct_change}% compared to previous period."
    }


# -------------------------------------------------------------
# 1. getMyOrders
# -------------------------------------------------------------
async def get_my_orders(
    user: Dict[str, Any],
    limit: Optional[int] = 30,
    params: Optional[Dict[str, Any]] = None,
    **kwargs: Any
) -> List[Dict[str, Any]]:
    """
    Retrieve recent orders and fulfillment statuses for authenticated user.
    For vendors: purchases made by user.id.
    For farmers: order items containing user.id's produce lots.
    """
    role = (user.get("role") or "").lower()
    user_id = str(user.get("id") or user.get("user_id") or "")
    if not user_id:
        return []

    lim = int(limit or 30)

    sql = """
        SELECT o.id, o.vendorName, o.totalAmount, o.status, o.createdAt, oi.productId, oi.qty, oi.unitPrice, oi.amount
        FROM orders o JOIN order_items oi ON o.id = oi.orderId
    """
    sql_params: List[Any] = []

    if role == "vendor":
        sql += " WHERE o.vendorId = ?"
        sql_params.append(user_id)
    elif role == "farmer":
        sql += " WHERE oi.farmerId = ?"
        sql_params.append(user_id)
    elif role == "admin":
        # Admin can optionally filter by farmerId or vendorId if specified in params
        p = params or kwargs
        if p.get("farmerId"):
            sql += " WHERE oi.farmerId = ?"
            sql_params.append(str(p["farmerId"]))
        elif p.get("vendorId"):
            sql += " WHERE o.vendorId = ?"
            sql_params.append(str(p["vendorId"]))
    else:
        return []

    sql += f" ORDER BY o.createdAt DESC LIMIT {lim}"
    rows = db.query_all(sql, sql_params) or []
    return rows


# -------------------------------------------------------------
# 2. getMySales
# -------------------------------------------------------------
async def get_my_sales(
    user: Dict[str, Any],
    params: Optional[Dict[str, Any]] = None,
    **kwargs: Any
) -> Dict[str, Any]:
    """
    Retrieve comprehensive sales metrics for authenticated farmer:
    total revenue, completed orders count, quantity sold, and top selling products.
    """
    role = (user.get("role") or "").lower()
    if role not in ("farmer", "admin"):
        raise PermissionError("Only farmers can view sales reports.")

    farmer_id = str(user.get("id") or user.get("user_id") or "")
    # Admin can view specific farmer if requested
    if role == "admin":
        p = params or kwargs
        if p.get("farmerId"):
            farmer_id = str(p["farmerId"])

    stats = db.query_get(
        """SELECT 
            SUM(amount) as totalRevenue,
            COUNT(DISTINCT orderId) as totalOrders,
            SUM(qty) as totalQty
           FROM order_items WHERE farmerId = ?""",
        [farmer_id]
    )

    top_products = db.query_all(
        """SELECT p.name, SUM(oi.qty) as unitsSold, SUM(oi.amount) as revenue
           FROM order_items oi JOIN products p ON oi.productId = p.id
           WHERE oi.farmerId = ?
           GROUP BY oi.productId ORDER BY revenue DESC LIMIT 5""",
        [farmer_id]
    ) or []

    return {
        "revenue": float(stats["totalRevenue"]) if stats and stats.get("totalRevenue") is not None else 0.0,
        "orders": int(stats["totalOrders"]) if stats and stats.get("totalOrders") is not None else 0,
        "quantitySold": float(stats["totalQty"]) if stats and stats.get("totalQty") is not None else 0.0,
        "topProducts": top_products
    }


# -------------------------------------------------------------
# 3. getMyInventory
# -------------------------------------------------------------
async def get_my_inventory(
    user: Dict[str, Any],
    params: Optional[Dict[str, Any]] = None,
    **kwargs: Any
) -> List[Dict[str, Any]]:
    """
    Check authenticated farmer's listed produce inventory, current stock levels, units, and MOQ.
    """
    role = (user.get("role") or "").lower()
    if role not in ("farmer", "admin"):
        raise PermissionError("Only farmers can check inventory.")

    farmer_id = str(user.get("id") or user.get("user_id") or "")
    if role == "admin":
        p = params or kwargs
        if p.get("farmerId"):
            farmer_id = str(p["farmerId"])

    sql = "SELECT id, name, category, price, unit, stock, moq, organic FROM products WHERE farmerId = ? ORDER BY stock DESC"
    rows = db.query_all(sql, [farmer_id]) or []
    return rows


# -------------------------------------------------------------
# 4. getMySalesAnalytics
# -------------------------------------------------------------
async def get_farmer_sales_analytics(
    user: Dict[str, Any],
    period: Optional[str] = "30d",
    commodity: Optional[str] = None,
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
    params: Optional[Dict[str, Any]] = None,
    **kwargs: Any
) -> Dict[str, Any]:
    """
    Retrieve comprehensive sales metrics, gross revenue, quantity sold, order count, ASP,
    top crops, and daily sales trend for the farmer.
    """
    role = (user.get("role") or "").lower()
    if role not in ("farmer", "admin"):
        raise PermissionError("Only farmers can access sales analytics.")

    farmer_id = str(user.get("id") or user.get("user_id") or "")
    if role == "admin":
        p = params or kwargs
        if p.get("farmerId"):
            farmer_id = str(p["farmerId"])

    p = {**(params or {}), **kwargs}
    per = p.get("period") or period or "30d"
    s_date = p.get("startDate") or startDate
    e_date = p.get("endDate") or endDate
    comm = p.get("commodity") or commodity

    dates = resolve_date_range(per, s_date, e_date)
    crop_filter = normalize_crop_name(comm) if comm else None

    # Current period query
    curr_sql = """
        SELECT oi.id, oi.orderId, oi.productId, oi.qty, oi.unitPrice, oi.amount,
               o.status, o.createdAt, o.vendorName, o.deliveryDistrict,
               p.name as productName, p.category, p.unit
        FROM order_items oi
        JOIN orders o ON oi.orderId = o.id
        JOIN products p ON oi.productId = p.id
        WHERE oi.farmerId = ?
          AND o.createdAt >= ?
          AND o.createdAt <= ?
    """
    curr_params = [farmer_id, dates["current"]["startDate"], dates["current"]["endDate"]]
    if crop_filter:
        curr_sql += " AND (LOWER(p.name) LIKE ? OR LOWER(p.category) LIKE ?)"
        c_term = f"%{crop_filter.lower()}%"
        curr_params.extend([c_term, c_term])
    curr_sql += " ORDER BY o.createdAt ASC"

    current_items = db.query_all(curr_sql, curr_params) or []

    # Previous period query
    prev_sql = """
        SELECT oi.qty, oi.amount, o.status, o.createdAt
        FROM order_items oi
        JOIN orders o ON oi.orderId = o.id
        JOIN products p ON oi.productId = p.id
        WHERE oi.farmerId = ?
          AND o.createdAt >= ?
          AND o.createdAt <= ?
    """
    prev_params = [farmer_id, dates["previous"]["startDate"], dates["previous"]["endDate"]]
    if crop_filter:
        prev_sql += " AND (LOWER(p.name) LIKE ? OR LOWER(p.category) LIKE ?)"
        c_term = f"%{crop_filter.lower()}%"
        prev_params.extend([c_term, c_term])

    prev_items = db.query_all(prev_sql, prev_params) or []

    # Aggregations
    gross_revenue = round(sum(float(i.get("amount") or 0) for i in current_items), 2)
    total_qty_sold = round(sum(float(i.get("qty") or 0) for i in current_items), 2)
    distinct_orders = len(set(i["orderId"] for i in current_items if i.get("orderId")))
    avg_order_value = round(gross_revenue / distinct_orders, 2) if distinct_orders > 0 else 0.0
    avg_selling_price = round(gross_revenue / total_qty_sold, 2) if total_qty_sold > 0 else 0.0

    status_counts: Dict[str, int] = {}
    for i in current_items:
        st = i.get("status") or "Pending"
        status_counts[st] = status_counts.get(st, 0) + 1

    # Product breakdown
    prod_agg: Dict[str, Dict[str, Any]] = {}
    for i in current_items:
        pid = i.get("productId")
        pname = i.get("productName", "Produce")
        if pid not in prod_agg:
            prod_agg[pid] = {"name": pname, "quantitySold": 0.0, "grossSales": 0.0, "unit": i.get("unit", "kg")}
        prod_agg[pid]["quantitySold"] += float(i.get("qty") or 0)
        prod_agg[pid]["grossSales"] += float(i.get("amount") or 0)

    top_products = sorted(list(prod_agg.values()), key=lambda x: x["grossSales"], reverse=True)[:5]
    for tp in top_products:
        tp["grossSales"] = round(tp["grossSales"], 2)

    # Previous metrics
    prev_revenue = round(sum(float(i.get("amount") or 0) for i in prev_items), 2)
    prev_qty = round(sum(float(i.get("qty") or 0) for i in prev_items), 2)

    comparisons = [
        calculate_metric_comparison(gross_revenue, prev_revenue, "Gross Revenue", "INR"),
        calculate_metric_comparison(total_qty_sold, prev_qty, "Quantity Sold", "units")
    ]

    # Daily trend
    daily_map: Dict[str, Dict[str, Any]] = {}
    for i in current_items:
        dt = (i.get("createdAt") or "")[:10]
        if not dt:
            continue
        if dt not in daily_map:
            daily_map[dt] = {"date": dt, "revenue": 0.0, "orders": 0, "quantity": 0.0}
        daily_map[dt]["revenue"] += float(i.get("amount") or 0)
        daily_map[dt]["quantity"] += float(i.get("qty") or 0)
        daily_map[dt]["orders"] += 1
    sales_trend = sorted(list(daily_map.values()), key=lambda x: x["date"])

    facts = [
        f"Reporting period: {dates['label']} ({dates['current']['startDate'][:10]} to {dates['current']['endDate'][:10]})",
        f"Total realized revenue: ₹{gross_revenue:,.2f}",
        f"Total orders processed: {distinct_orders}",
        f"Total quantity delivered/sold: {total_qty_sold:,.1f} units",
        f"Average order value (AOV): ₹{avg_order_value:,.2f}"
    ]

    insights = []
    if distinct_orders == 0:
        insights.append("No order volume recorded during this period.")
    else:
        insights.append(f"Sales revenue is concentrated across {len(top_products)} crop(s).")
        if top_products:
            top_share = round((top_products[0]["grossSales"] / gross_revenue) * 100, 1) if gross_revenue > 0 else 0
            insights.append(f"{top_products[0]['name']} generated {top_share}% of total period sales.")

    recommendations = []
    if distinct_orders == 0:
        recommendations.append("Consider reviewing active listing prices against current marketplace averages to attract buyer orders.")

    limitations = [
        "Gross sales represent total transaction value and do NOT represent net profit.",
        "Net profit cannot be calculated without reliable on-farm input and cultivation cost data.",
        "Future market demand and prices are subject to seasonal volatility and are not guaranteed."
    ]

    return {
        "reportType": "SALES",
        "period": dates,
        "metrics": {
            "grossRevenue": gross_revenue,
            "totalQuantitySold": total_qty_sold,
            "totalOrders": distinct_orders,
            "avgOrderValue": avg_order_value,
            "avgSellingPrice": avg_selling_price,
            "statusCounts": status_counts
        },
        "topProducts": top_products,
        "salesTrend": sales_trend,
        "comparisons": comparisons,
        "facts": facts,
        "insights": insights,
        "recommendations": recommendations,
        "limitations": limitations
    }


# -------------------------------------------------------------
# 5. getMyInventoryAnalytics
# -------------------------------------------------------------
async def get_farmer_inventory_analytics(
    user: Dict[str, Any],
    params: Optional[Dict[str, Any]] = None,
    **kwargs: Any
) -> Dict[str, Any]:
    """
    Analyze farmer warehouse stock, low-stock items, slow-moving crops, and category distribution.
    """
    role = (user.get("role") or "").lower()
    if role not in ("farmer", "admin"):
        raise PermissionError("Only farmers can access inventory analytics.")

    farmer_id = str(user.get("id") or user.get("user_id") or "")
    if role == "admin":
        p = params or kwargs
        if p.get("farmerId"):
            farmer_id = str(p["farmerId"])

    products = db.query_all(
        "SELECT id, name, category, price, stock, moq, unit, organic, createdAt FROM products WHERE farmerId = ? ORDER BY stock DESC",
        [farmer_id]
    ) or []

    total_listings = len(products)
    total_stock_units = sum(int(p.get("stock") or 0) for p in products)
    total_inventory_value = round(sum(float(p.get("price") or 0) * int(p.get("stock") or 0) for p in products), 2)

    low_stock_items = [p for p in products if int(p.get("stock") or 0) <= (int(p.get("moq") or 10))]
    out_of_stock_items = [p for p in products if int(p.get("stock") or 0) <= 0]
    highest_stock_items = products[:5]

    # Check 30-day sales movement to detect slow-moving inventory
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%SZ")
    recent_sold = db.query_all(
        """SELECT oi.productId, SUM(oi.qty) as totalSold, MAX(o.createdAt) as lastSoldAt
           FROM order_items oi
           JOIN orders o ON oi.orderId = o.id
           WHERE oi.farmerId = ? AND o.createdAt >= ? AND o.status != 'Cancelled'
           GROUP BY oi.productId""",
        [farmer_id, thirty_days_ago]
    ) or []

    sold_map = {r["productId"]: float(r["totalSold"] or 0) for r in recent_sold}
    slow_moving = []
    for p in products:
        stock_qty = int(p.get("stock") or 0)
        sold_qty = sold_map.get(p["id"], 0.0)
        if stock_qty > 20 and sold_qty == 0:
            slow_moving.append({
                "id": p["id"],
                "name": p["name"],
                "stock": stock_qty,
                "daysWithoutSale": "30+ days"
            })

    # Category breakdown
    cat_counts: Dict[str, Dict[str, Any]] = {}
    for p in products:
        c = p.get("category") or "Other"
        if c not in cat_counts:
            cat_counts[c] = {"category": c, "stock": 0, "value": 0.0, "count": 0}
        cat_counts[c]["stock"] += int(p.get("stock") or 0)
        cat_counts[c]["value"] += float(p.get("price") or 0) * int(p.get("stock") or 0)
        cat_counts[c]["count"] += 1

    category_breakdown = list(cat_counts.values())

    facts = [
        f"Total active listings: {total_listings}",
        f"Total available inventory: {total_stock_units} units",
        f"Total inventory asset valuation: ₹{total_inventory_value:,.2f}",
        f"Low stock alerts: {len(low_stock_items)} items",
        f"Out of stock: {len(out_of_stock_items)} items",
        f"Slow moving stock lots: {len(slow_moving)} items"
    ]

    return {
        "reportType": "INVENTORY",
        "metrics": {
            "totalListings": total_listings,
            "totalStockUnits": total_stock_units,
            "totalInventoryValue": total_inventory_value,
            "lowStockCount": len(low_stock_items),
            "outOfStockCount": len(out_of_stock_items),
            "slowMovingCount": len(slow_moving)
        },
        "products": products,
        "lowStockItems": low_stock_items,
        "highestStockItems": highest_stock_items,
        "slowMovingProducts": slow_moving,
        "categoryBreakdown": category_breakdown,
        "facts": facts,
        "insights": [f"Warehouse holds {total_stock_units} units across {total_listings} listing(s)."],
        "recommendations": [f"Replenish {item['name']} (current stock: {item['stock']})" for item in low_stock_items[:3]],
        "limitations": ["Inventory valuations are based on current listing asking prices, not purchase costs."]
    }


# -------------------------------------------------------------
# 6. getMyProductPerformance
# -------------------------------------------------------------
async def get_product_performance(
    user: Dict[str, Any],
    productId: Optional[str] = None,
    period: Optional[str] = "30d",
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
    params: Optional[Dict[str, Any]] = None,
    **kwargs: Any
) -> Dict[str, Any]:
    """
    Evaluate product-level sales velocity, realized average price, order count,
    and gross revenue breakdown across produce listings.
    """
    role = (user.get("role") or "").lower()
    if role not in ("farmer", "admin"):
        raise PermissionError("Only farmers can access product performance.")

    farmer_id = str(user.get("id") or user.get("user_id") or "")
    if role == "admin":
        p = params or kwargs
        if p.get("farmerId"):
            farmer_id = str(p["farmerId"])

    p = {**(params or {}), **kwargs}
    prod_id = p.get("productId") or productId
    per = p.get("period") or period or "30d"
    s_date = p.get("startDate") or startDate
    e_date = p.get("endDate") or endDate

    dates = resolve_date_range(per, s_date, e_date)

    sql = """
        SELECT p.id as productId, p.name, p.category, p.price, p.stock, p.unit, p.moq,
               COALESCE(SUM(CASE WHEN o.id IS NOT NULL THEN oi.qty ELSE 0 END), 0) as totalSold,
               COALESCE(SUM(CASE WHEN o.id IS NOT NULL THEN oi.amount ELSE 0 END), 0) as grossRevenue,
               COUNT(DISTINCT o.id) as orderCount,
               AVG(CASE WHEN o.id IS NOT NULL THEN oi.unitPrice ELSE NULL END) as realizedAvgPrice
        FROM products p
        LEFT JOIN order_items oi ON p.id = oi.productId AND oi.farmerId = ?
        LEFT JOIN orders o ON oi.orderId = o.id AND o.status != 'Cancelled' AND o.createdAt >= ? AND o.createdAt <= ?
        WHERE p.farmerId = ?
    """
    sql_params = [farmer_id, dates["current"]["startDate"], dates["current"]["endDate"], farmer_id]

    if prod_id:
        sql += " AND p.id = ?"
        sql_params.append(str(prod_id).strip())

    sql += " GROUP BY p.id ORDER BY grossRevenue DESC"
    rows = db.query_all(sql, sql_params) or []

    products = []
    for r in rows:
        sold = float(r.get("totalSold") or 0.0)
        rev = round(float(r.get("grossRevenue") or 0.0), 2)
        price = float(r.get("price") or 0.0)
        realized_avg = round(float(r.get("realizedAvgPrice")), 2) if r.get("realizedAvgPrice") is not None else price
        velocity = "Fast" if sold > 50 else "Moderate" if sold > 10 else "Slow"

        products.append({
            "productId": r["productId"],
            "name": r["name"],
            "category": r["category"],
            "currentPrice": price,
            "stock": int(r.get("stock") or 0),
            "unit": r.get("unit", "kg"),
            "moq": int(r.get("moq") or 10),
            "totalSold": sold,
            "grossRevenue": rev,
            "orderCount": int(r.get("orderCount") or 0),
            "realizedAvgPrice": realized_avg,
            "velocity": velocity
        })

    facts = [
        f"{p['name']}: {p['totalSold']} {p['unit']} sold (Gross Revenue: ₹{p['grossRevenue']:,.2f}, Stock: {p['stock']} {p['unit']})"
        for p in products
    ]

    return {
        "reportType": "PRODUCT_PERFORMANCE",
        "period": dates["label"],
        "products": products,
        "facts": facts,
        "insights": [
            f"Evaluated {len(products)} product(s) for the period.",
            f"Top product by volume: {products[0]['name']}" if products else "No products available."
        ],
        "recommendations": [f"Restock {p['name']} (stock {p['stock']} <= MOQ {p['moq']})" for p in products if p["stock"] <= p["moq"]],
        "limitations": ["Gross revenue does not deduct production or handling costs."]
    }


# -------------------------------------------------------------
# 7. getMyFarmReport
# -------------------------------------------------------------
async def get_farm_performance_report(
    user: Dict[str, Any],
    period: Optional[str] = "30d",
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
    params: Optional[Dict[str, Any]] = None,
    **kwargs: Any
) -> Dict[str, Any]:
    """
    Generate a comprehensive farm performance report combining sales analytics,
    inventory analytics, and localized weather context.
    """
    role = (user.get("role") or "").lower()
    if role not in ("farmer", "admin"):
        raise PermissionError("Only farmers can generate farm performance reports.")

    farmer_id = str(user.get("id") or user.get("user_id") or "")
    if role == "admin":
        p = params or kwargs
        if p.get("farmerId"):
            farmer_id = str(p["farmerId"])

    # Retrieve sales and inventory in parallel/sequentially
    sales = await get_farmer_sales_analytics(user=user, period=period, startDate=startDate, endDate=endDate, params=params, **kwargs)
    inventory = await get_farmer_inventory_analytics(user=user, params=params, **kwargs)

    # Farmer profile for location context
    farmer = db.query_get(
        "SELECT id, name, role, region, district, city, lat, lng, primaryCrop FROM users WHERE id = ?",
        [farmer_id]
    )

    weather_risk = None
    if farmer and (farmer.get("lat") or farmer.get("district")):
        try:
            w_res = await get_weather_advisory(
                district=farmer.get("district"),
                region=farmer.get("region"),
                crop=farmer.get("primaryCrop"),
                lat=farmer.get("lat"),
                lng=farmer.get("lng"),
                use_cache=True
            )
            if w_res and not w_res.get("error"):
                weather_risk = {
                    "temperature": w_res.get("current", {}).get("temperature"),
                    "condition": w_res.get("current", {}).get("condition"),
                    "advisories": w_res.get("advisories", [])
                }
        except Exception:
            pass

    facts = [
        f"Total active produce listings: {inventory['metrics']['totalListings']}",
        f"Available warehouse stock: {inventory['metrics']['totalStockUnits']} units",
        f"Quantities sold ({sales['period']['label']}): {sales['metrics']['totalQuantitySold']} units",
        f"Order count: {sales['metrics']['totalOrders']}",
        f"ESTIMATED GROSS REVENUE: ₹{sales['metrics']['grossRevenue']:,.2f}",
        f"Average selling price: ₹{sales['metrics']['avgSellingPrice']}/unit",
        f"Low stock warnings: {inventory['metrics']['lowStockCount']} item(s)",
        f"Slow moving items: {inventory['metrics']['slowMovingCount']} item(s)"
    ]

    insights = list(sales.get("insights", [])) + list(inventory.get("insights", []))
    recommendations = list(sales.get("recommendations", [])) + list(inventory.get("recommendations", []))

    limitations = [
        "ESTIMATED GROSS REVENUE represents sales volume before production, labor, transportation, and commission costs.",
        "Profit cannot be calculated without reliable cost data.",
        "Future market prices and weather patterns remain subject to change and are not guaranteed."
    ]

    return {
        "reportType": "FARM_PERFORMANCE",
        "farmerId": farmer_id,
        "farmerName": farmer.get("name") if farmer else "Farmer",
        "period": sales["period"],
        "metrics": {
            "sales": sales["metrics"],
            "inventory": inventory["metrics"],
            "topProducts": sales["topProducts"],
            "lowStockItems": inventory["lowStockItems"],
            "slowMovingProducts": inventory["slowMovingProducts"]
        },
        "comparisons": sales["comparisons"],
        "weatherRisk": weather_risk,
        "facts": facts,
        "insights": insights,
        "recommendations": recommendations,
        "limitations": limitations
    }


# -------------------------------------------------------------
# 8. compareAnalyticsPeriods Handler
# -------------------------------------------------------------
async def compare_analytics_periods(
    farmerId: Optional[str] = None,
    period: Optional[str] = "30d",
    period1: Optional[str] = None,
    period2: Optional[str] = None,
    commodity: Optional[str] = None,
    params: Optional[Dict[str, Any]] = None,
    user: Optional[Dict[str, Any]] = None,
    **kwargs: Any
) -> Dict[str, Any]:
    """Compares farmer sales performance between two consecutive benchmark time windows."""
    p = {**(params or {}), **kwargs}
    u = user or {}
    role = (u.get("role") or "").lower()
    f_id = str(u.get("id") or u.get("user_id") or "")
    if role == "admin":
        if farmerId or p.get("farmerId"):
            f_id = str(farmerId or p.get("farmerId"))

    per = period or p.get("period") or "30d"
    dates = resolve_date_range(per)

    current_sales = await get_farmer_sales_analytics(
        user=u,
        farmerId=f_id,
        startDate=dates["current"]["startDate"],
        endDate=dates["current"]["endDate"],
        commodity=commodity or p.get("commodity")
    )

    prev_sales = await get_farmer_sales_analytics(
        user=u,
        farmerId=f_id,
        startDate=dates["previous"]["startDate"],
        endDate=dates["previous"]["endDate"],
        commodity=commodity or p.get("commodity")
    )

    comparisons = [
        calculate_metric_comparison(current_sales["metrics"]["grossRevenue"], prev_sales["metrics"]["grossRevenue"], "Gross Revenue", "INR"),
        calculate_metric_comparison(current_sales["metrics"]["totalQuantitySold"], prev_sales["metrics"]["totalQuantitySold"], "Total Quantity Sold", "units"),
        calculate_metric_comparison(current_sales["metrics"]["totalOrders"], prev_sales["metrics"]["totalOrders"], "Order Count", "orders"),
        calculate_metric_comparison(current_sales["metrics"]["avgSellingPrice"], prev_sales["metrics"]["avgSellingPrice"], "Average Selling Price", "INR/unit")
    ]

    facts = []
    for c in comparisons:
        if c.get("comparisonAvailable"):
            change_str = f"+{c['absoluteChange']}" if c['absoluteChange'] >= 0 else str(c['absoluteChange'])
            pct_str = f"+{c['percentageChange']}%" if (c['percentageChange'] is not None and c['percentageChange'] >= 0) else f"{c['percentageChange']}%"
            facts.append(f"{c['metric']}: Current {c['current']} {c['unit']}, Previous {c['previous']} {c['unit']} (Change: {change_str} {c['unit']}, {pct_str})")
        else:
            facts.append(f"{c['metric']}: Current {c['current']} {c['unit']}, Previous {c['previous']} {c['unit']} (Previous-period comparison is unavailable because there is insufficient data.)")

    insights = [
        f"Compared performance for period {dates['label']} against the immediate prior period of equal length.",
        f"Realized current gross revenue of ₹{current_sales['metrics']['grossRevenue']:,.2f} across {current_sales['metrics']['totalOrders']} completed orders."
    ]

    recommendations = [
        "Align harvesting schedules with periods of higher order volume and positive price realization."
    ]

    limitations = [
        "Period comparison assumes equivalent operating days and market trading activity between benchmark windows.",
        "Zero-value prior periods yield no percentage change to prevent mathematical fabrication."
    ]

    return {
        "reportType": "PERIOD_COMPARISON",
        "farmerId": f_id,
        "period": {
            "current": dates["current"],
            "previous": dates["previous"],
            "label": dates["label"]
        },
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "comparisons": comparisons,
        "facts": facts,
        "insights": insights,
        "recommendations": recommendations,
        "limitations": limitations
    }


# -------------------------------------------------------------
# 9. getPlatformAnalytics Handler
# -------------------------------------------------------------
async def get_platform_analytics(
    params: Optional[Dict[str, Any]] = None,
    user: Optional[Dict[str, Any]] = None,
    **kwargs: Any
) -> Dict[str, Any]:
    """Executive platform metrics summary for admin role."""
    u = user or {}
    role = (u.get("role") or "").lower()
    if role != "admin":
        raise PermissionError("Admin role required for executive platform analytics.")

    users_count = db.query_get("SELECT COUNT(*) as c FROM users")
    farmers_count = db.query_get("SELECT COUNT(*) as c FROM users WHERE role = 'farmer'")
    vendors_count = db.query_get("SELECT COUNT(*) as c FROM users WHERE role = 'vendor'")
    products_count = db.query_get("SELECT COUNT(*) as c FROM products")
    orders_count = db.query_get("SELECT COUNT(*) as c FROM orders")
    revenue_stats = db.query_get("SELECT SUM(totalAmount) as total FROM orders WHERE status = 'Delivered'")

    return {
        "users": users_count.get("c", 0) if users_count else 0,
        "farmers": farmers_count.get("c", 0) if farmers_count else 0,
        "vendors": vendors_count.get("c", 0) if vendors_count else 0,
        "products": products_count.get("c", 0) if products_count else 0,
        "orders": orders_count.get("c", 0) if orders_count else 0,
        "deliveredRevenue": float(revenue_stats.get("total") or 0.0) if revenue_stats else 0.0
    }


# -------------------------------------------------------------
# 10. getPlatformAnalyticsReport / getPlatformWideAnalytics Handler
# -------------------------------------------------------------
async def get_platform_wide_analytics(
    period: Optional[str] = "30d",
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
    params: Optional[Dict[str, Any]] = None,
    user: Optional[Dict[str, Any]] = None,
    **kwargs: Any
) -> Dict[str, Any]:
    """Comprehensive executive platform analytics report for admin role."""
    u = user or {}
    role = (u.get("role") or "").lower()
    if role != "admin":
        raise PermissionError("Admin role required for platform wide analytics report.")

    p = {**(params or {}), **kwargs}
    per = period or p.get("period") or "30d"
    s_date = startDate or p.get("startDate")
    e_date = endDate or p.get("endDate")
    dates = resolve_date_range(per, s_date, e_date)

    user_rows = db.query_all("SELECT role, COUNT(*) as count FROM users GROUP BY role") or []
    users_by_role = {"farmer": 0, "vendor": 0, "admin": 0}
    for r in user_rows:
        if r.get("role"):
            users_by_role[r["role"].lower()] = int(r["count"])
    total_users = sum(users_by_role.values())

    active_farmers_row = db.query_get("SELECT COUNT(DISTINCT farmerId) as count FROM products")
    active_vendors_row = db.query_get("SELECT COUNT(DISTINCT vendorId) as count FROM orders WHERE vendorId IS NOT NULL")
    active_farmers = active_farmers_row.get("count", 0) if active_farmers_row else 0
    active_vendors = active_vendors_row.get("count", 0) if active_vendors_row else 0

    total_products_row = db.query_get("SELECT COUNT(*) as count, SUM(stock) as totalStock FROM products")
    total_products = total_products_row.get("count", 0) if total_products_row else 0
    total_stock = total_products_row.get("totalStock", 0) or 0 if total_products_row else 0

    orders_in_period = db.query_all(
        "SELECT id, totalAmount, status, createdAt FROM orders WHERE createdAt >= ? AND createdAt <= ?",
        [dates["current"]["startDate"], dates["current"]["endDate"]]
    ) or []
    total_period_orders = len(orders_in_period)
    order_status_distribution = {"Pending": 0, "Processing": 0, "Completed": 0, "Cancelled": 0}
    period_gross_gmv = 0.0

    for o in orders_in_period:
        s = o.get("status") or "Pending"
        order_status_distribution[s] = order_status_distribution.get(s, 0) + 1
        if s != "Cancelled":
            period_gross_gmv += float(o.get("totalAmount") or 0.0)

    period_gross_gmv = round(period_gross_gmv, 2)

    ai_stats = {
        "conversations": 0,
        "messages": 0,
        "insights": 0,
        "proactiveInsights": 0,
        "imageAnalyses": 0,
        "pendingActions": 0,
        "actionAudit": 0
    }
    try:
        c_row = db.query_get("SELECT COUNT(*) as count FROM ai_conversations")
        m_row = db.query_get("SELECT COUNT(*) as count FROM ai_messages")
        pi_row = db.query_get("SELECT COUNT(*) as count FROM ai_proactive_insights")
        ia_row = db.query_get("SELECT COUNT(*) as count FROM ai_image_analyses")
        pa_row = db.query_get("SELECT COUNT(*) as count FROM ai_pending_actions")
        aa_row = db.query_get("SELECT COUNT(*) as count FROM ai_action_audit")

        ai_stats = {
            "conversations": c_row.get("count", 0) if c_row else 0,
            "messages": m_row.get("count", 0) if m_row else 0,
            "insights": 0,
            "proactiveInsights": pi_row.get("count", 0) if pi_row else 0,
            "imageAnalyses": ia_row.get("count", 0) if ia_row else 0,
            "pendingActions": pa_row.get("count", 0) if pa_row else 0,
            "actionAudit": aa_row.get("count", 0) if aa_row else 0
        }
    except Exception:
        pass

    facts = [
        f"Total platform users: {total_users} (Farmers: {users_by_role.get('farmer', 0)}, Vendors: {users_by_role.get('vendor', 0)}, Admins: {users_by_role.get('admin', 0)})",
        f"Active farmers with listings: {active_farmers}",
        f"Active purchasing vendors: {active_vendors}",
        f"Total marketplace listings: {total_products} ({total_stock} units available)",
        f"Period orders ({dates['label']}): {total_period_orders}",
        f"Period gross transaction volume: ₹{period_gross_gmv:,.2f}",
        f"Order fulfillment status: {order_status_distribution.get('Completed', 0)} completed, {order_status_distribution.get('Pending', 0) + order_status_distribution.get('Processing', 0)} in-flight, {order_status_distribution.get('Cancelled', 0)} cancelled",
        f"AI conversations: {ai_stats['conversations']} ({ai_stats['messages']} messages exchanged)",
        f"Proactive agricultural alerts issued: {ai_stats['proactiveInsights']}",
        f"Crop vision health analyses conducted: {ai_stats['imageAnalyses']}",
        f"Safe action audit entries recorded: {ai_stats['actionAudit']}"
    ]

    insights = [
        f"Platform ecosystem health: {total_users} registered users across {active_farmers} supplying farmers and {active_vendors} active procurement buyers.",
        f"AI adoption: FarmConnect AI has serviced {ai_stats['conversations']} sessions with {ai_stats['proactiveInsights']} proactive alerts and {ai_stats['imageAnalyses']} plant image diagnoses."
    ]

    recommendations = [
        "Continue monitoring unfulfilled and cancelled orders to optimize platform fulfillment rates."
    ]

    limitations = [
        "Platform GMV represents gross transacted order amounts without subtracting supplier disbursements, courier fees, or operational refunds.",
        "User identities and sensitive transaction credentials are strictly obscured in aggregate reports."
    ]

    return {
        "reportType": "PLATFORM",
        "period": {"label": dates["label"], "startDate": dates["current"]["startDate"], "endDate": dates["current"]["endDate"]},
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "users": {"total": total_users, "byRole": users_by_role, "activeFarmers": active_farmers, "activeVendors": active_vendors},
        "marketplace": {"totalProducts": total_products, "totalStock": total_stock, "periodGrossGmv": period_gross_gmv, "totalPeriodOrders": total_period_orders, "orderStatusDistribution": order_status_distribution},
        "aiSubsystems": ai_stats,
        "facts": facts,
        "insights": insights,
        "recommendations": recommendations,
        "limitations": limitations
    }


# -------------------------------------------------------------
# 11. generateAnalyticsReport Meta-Dispatcher Handler
# -------------------------------------------------------------
async def generate_analytics_report(
    reportType: Optional[str] = "FARM_PERFORMANCE",
    period: Optional[str] = "30d",
    commodity: Optional[str] = None,
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
    farmerId: Optional[str] = None,
    params: Optional[Dict[str, Any]] = None,
    user: Optional[Dict[str, Any]] = None,
    **kwargs: Any
) -> Dict[str, Any]:
    """Meta-dispatcher routing to specific analytics reports matching Node generateAnalyticsReport."""
    p = {**(params or {}), **kwargs}
    u = user or {}
    t = (reportType or p.get("reportType") or "FARM_PERFORMANCE").upper()
    role = (u.get("role") or "").lower()
    f_id = farmerId or p.get("farmerId") or u.get("id")

    if t == "SALES":
        return await get_farmer_sales_analytics(user=u, farmerId=f_id, period=period, commodity=commodity, startDate=startDate, endDate=endDate, params=p)
    elif t == "INVENTORY":
        return await get_farmer_inventory_analytics(user=u, farmerId=f_id, params=p)
    elif t == "MARKETPLACE":
        from app.tools.read_tools.intelligence import get_marketplace_analytics
        return await get_marketplace_analytics(commodity=commodity, period=period, startDate=startDate, endDate=endDate, params=p, user=u)
    elif t == "PLATFORM":
        if role != "admin":
            raise PermissionError("Admin role required for executive platform analytics report.")
        return await get_platform_wide_analytics(period=period, startDate=startDate, endDate=endDate, params=p, user=u)
    else:
        return await get_farm_performance_report(user=u, farmerId=f_id, period=period, startDate=startDate, endDate=endDate, params=p)

