import { query } from "../database.js";
import { getLiveWeatherForecast } from "./weatherService.js";
import crypto from "crypto";

/**
 * FarmConnect Phase 7 — Proactive Agricultural AI & Smart Alerts Engine
 * Analyzes real database data (inventory, orders, market prices) & Open-Meteo weather
 * to generate non-autonomous, actionable recommendations with strict FACTS vs REASONING separation.
 */

// Helper to format currency
const formatCurrency = (val) => `₹${parseFloat(val || 0).toFixed(2)}`;

// Multilingual text dictionary for proactive insights
const TRANSLATIONS = {
  inventory: {
    en: {
      title: "Low Inventory Warning",
      message: "Your stock is critically low compared to market demand.",
      reasoning: "Maintaining sufficient stock prevents missed orders and helps capitalize on buyer demand."
    },
    ta: {
      title: "குறைந்த சரக்கு எச்சரிக்கை",
      message: "சந்தை தேவைக்கு ஏற்ப உங்கள் இருப்பு மிகவும் குறைவாக உள்ளது.",
      reasoning: "போதிய இருப்பைப் பராமரிப்பது ஆர்டர்களை இழப்பதைத் தவிர்க்கும்."
    },
    hi: {
      title: "कम स्टॉक चेतावनी",
      message: "बाजार की मांग की तुलना में आपका स्टॉक बहुत कम है।",
      reasoning: "पर्याप्त स्टॉक बनाए रखने से ऑर्डर छूटने से बचाव होता है।"
    },
    tanglish: {
      title: "Low Stock Alert",
      message: "Ungal stock romba kamia iruku demand oda compare panum podhu.",
      reasoning: "Stock sariya vachrundha orders miss aagadha."
    }
  },
  price: {
    en: {
      title: "Market Price Movement",
      message: "Significant price difference observed for your listed crop.",
      reasoning: "Reviewing your selling price according to local market trends may optimize your revenue."
    },
    ta: {
      title: "சந்தை விலை மாற்றம்",
      message: "உங்கள் பயிரின் சந்தை விலையில் கணிசமான மாற்றம் காணப்படுகிறது.",
      reasoning: "உள்ளூர் சந்தை போக்குக்கு ஏற்ப விலையை சீரமைப்பது வருவாயை அதிகரிக்கும்."
    },
    hi: {
      title: "बाजार मूल्य बदलाव",
      message: "आपकी फसल के बाजार मूल्य में महत्वपूर्ण बदलाव देखा गया है।",
      reasoning: "बाजार के रुझान के अनुसार अपनी बिक्री कीमत की समीक्षा करने से आय बढ़ सकती है।"
    },
    tanglish: {
      title: "Market Price Shift",
      message: "Ungal crop price ku market la nalla change iruku.",
      reasoning: "Market trend paathu price update panradhu nalladhu."
    }
  },
  demand: {
    en: {
      title: "High Crop Demand Alert",
      message: "Strong buying activity detected for your product category.",
      reasoning: "High demand periods offer favorable conditions to supply freshly harvested stock."
    },
    ta: {
      title: "அதிக பயிர் தேவை எச்சரிக்கை",
      message: "உங்கள் விளைபொருள் பிரிவில் அதிக கொள்முதல் செயல்பாடு உள்ளது.",
      reasoning: "அதிக தேவை உள்ள காலங்களில் புதிய அறுவடை பொருட்களை விநியோகிப்பது சிறந்தது."
    },
    hi: {
      title: "उच्च मांग चेतावनी",
      message: "आपकी उत्पाद श्रेणी के लिए मजबूत खरीदारी गतिविधि देखी गई है।",
      reasoning: "उच्च मांग के समय ताजा स्टॉक की आपूर्ति करना फायदेमंद होता है।"
    },
    tanglish: {
      title: "High Demand Alert",
      message: "Ungal category products ku ippo nalla demand iruku.",
      reasoning: "Demand அதிகமா இருக்கும் போது fresh harvest stock supply panradhu nalladhu."
    }
  },
  weather: {
    en: {
      title: "Agricultural Weather Advisory",
      message: "Weather conditions in your region require crop management attention.",
      reasoning: "Taking protective agricultural measures helps minimize weather-related crop damage."
    },
    ta: {
      title: "வேளாண் வானிலை ஆலோசனை",
      message: "உங்கள் பகுதியில் உள்ள வானிலை பயிர் பாதுகாப்பில் கவனம் கோருகிறது.",
      reasoning: "முன்னெச்சரிக்கை பாதுகாப்பு நடவடிக்கைகள் வானிலை சேதத்தைக் குறைக்கும்."
    },
    hi: {
      title: "कृषि मौसम सलाह",
      message: "आपके क्षेत्र में मौसम की स्थिति फसल प्रबंधन पर ध्यान देने की मांग करती है।",
      reasoning: "सुरक्षात्मक उपाय अपनाने से मौसम से होने वाले नुकसान को कम किया जा सकता है।"
    },
    tanglish: {
      title: "Weather Advisory Alert",
      message: "Ungal area weather conditions crop care ku mukkiyam.",
      reasoning: "Safe measures edutha weather damage ah kammi pannalam."
    }
  },
  selling: {
    en: {
      title: "Favorable Selling Opportunity",
      message: "Market demand, stable price, and clear weather create good selling conditions.",
      reasoning: "Selling during favorable conditions maximizes order fulfillment and profit margins."
    },
    ta: {
      title: "சாதகமான விற்பனை வாய்ப்பு",
      message: "சந்தை தேவை, நிலையான விலை மற்றும் நல்ல வானிலை சிறந்த விற்பனை சூழலை உருவாக்குகின்றன.",
      reasoning: "சாதகமான சூழலில் விற்பனை செய்வது லாபத்தை அதிகரிக்கும்."
    },
    hi: {
      title: "अनुकूल बिक्री अवसर",
      message: "बाजार की मांग, स्थिर कीमत और साफ मौसम बिक्री के लिए अच्छी स्थिति बनाते हैं।",
      reasoning: "अनुकूल परिस्थितियों में बिक्री करने से लाभ मार्जिन में सुधार होता है।"
    },
    tanglish: {
      title: "Good Selling Opportunity",
      message: "Market demand, stable price matrum clear weather nalla selling environment tharudhu.",
      reasoning: "Nalla time la sell panna profit margin அதிகமா கிடைக்கும்."
    }
  },
  order: {
    en: {
      title: "Pending Orders Action Required",
      message: "You have unfulfilled buyer orders awaiting dispatch confirmation.",
      reasoning: "Promptly fulfilling orders builds high buyer trust and boosts vendor repeat ratings."
    },
    ta: {
      title: "நிலுவையில் உள்ள ஆர்டர்கள் கவனம் தேவை",
      message: "அனுப்பப்படுவதற்கு காத்திருக்கும் ஆர்டர்கள் உள்ளன.",
      reasoning: "உடனடி விநியோகம் வாங்குபவரின் நம்பிக்கையை அதிகரிக்கும்."
    },
    hi: {
      title: "लंबित ऑर्डर कार्रवाई आवश्यक",
      message: "आपके पास प्रेषण की प्रतीक्षा कर रहे अपूर्ण ऑर्डर हैं।",
      reasoning: "त्वरित पूर्ति से खरीदार का विश्वास बढ़ता है।"
    },
    tanglish: {
      title: "Pending Orders Alert",
      message: "Ungalku innum deliver aagadha orders iruku.",
      reasoning: "Seekram order fulfill panna buyers trust adhigamaagum."
    }
  }
};

/**
 * Generates proactive insights for a given farmer user using real database data
 * @param {Object} user - User object { id, role, region, district, lat, lng }
 * @param {Object} options - { forceRefresh: boolean }
 */
export async function generateProactiveInsightsForUser(user, options = {}) {
  if (!user || !user.id) throw new Error("Valid user object required");
  if (user.role !== "farmer" && user.role !== "admin") {
    return { success: true, count: 0, message: "Proactive insights are tailored for farmers" };
  }

  const userId = user.id;
  const now = new Date().toISOString();
  const generatedInsights = [];

  // Helper for hash deduplication
  const generateDedupeKey = (type, entityId, condition) => {
    return crypto.createHash("md5").update(`${userId}_${type}_${entityId}_${condition}`).digest("hex");
  };

  // Helper to store insight if not duplicate
  const saveInsightIfNew = async (insightData) => {
    const dedupeHash = generateDedupeKey(insightData.type, insightData.metadata?.entityId || "global", insightData.title);
    
    // Check for existing active unexpired insight with same dedupe hash created in last 24h
    const existing = await query.get(
      `SELECT id FROM ai_proactive_insights 
       WHERE userId = ? AND type = ? AND status = 'active' AND createdAt >= ?`,
      [userId, insightData.type, new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()]
    );

    if (existing && !options.forceRefresh) {
      return null; // Skip duplicate
    }

    const id = `ins_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const expiresAt = insightData.expiresAt || new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(); // Default 48h expiry

    await query.run(
      `INSERT INTO ai_proactive_insights 
       (id, userId, type, severity, title, message, facts, reasoning, metadata, status, createdAt, expiresAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
      [
        id,
        userId,
        insightData.type,
        insightData.severity,
        insightData.title,
        insightData.message,
        JSON.stringify(insightData.facts),
        JSON.stringify(insightData.reasoning),
        JSON.stringify(insightData.metadata || {}),
        now,
        expiresAt
      ]
    );

    // Sync high/critical insights to notifications table
    if (insightData.severity === "high" || insightData.severity === "critical") {
      try {
        const notifId = `notif_ins_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
        await query.run(
          `INSERT INTO notifications (id, userId, text, type, \`read\`, createdAt) VALUES (?, ?, ?, 'ai_insight', 0, ?)`,
          [notifId, userId, `[AI Alert] ${insightData.title}: ${insightData.message}`, now]
        );
      } catch (err) {
        /* Ignore notification insert duplicate error */
      }
    }

    generatedInsights.push({ id, ...insightData });
    return id;
  };

  try {
    // 1. INVENTORY ALERTS (Real Product Stock Data)
    const farmerProducts = await query.all(
      "SELECT id, name, category, price, stock, unit, moq, region FROM products WHERE farmerId = ?",
      [userId]
    );

    for (const prod of farmerProducts) {
      const isLowStock = prod.stock <= (prod.moq || 10) || prod.stock <= 20;
      if (isLowStock) {
        await saveInsightIfNew({
          type: "inventory",
          severity: prod.stock <= 5 ? "critical" : "warning",
          title: `Low Inventory Alert: ${prod.name}`,
          message: `Current stock for ${prod.name} is ${prod.stock} ${prod.unit} (MOQ: ${prod.moq || 10} ${prod.unit}).`,
          facts: [
            `Product: ${prod.name}`,
            `Current Listed Stock: ${prod.stock} ${prod.unit}`,
            `Minimum Order Quantity (MOQ): ${prod.moq || 10} ${prod.unit}`,
            `Listed Unit Price: ${formatCurrency(prod.price)}/${prod.unit}`
          ],
          reasoning: [
            `Stock is nearing or below MOQ (${prod.moq || 10} ${prod.unit}).`,
            "Low stock risks unfulfillable orders and potential cancellation charges.",
            "Consider updating your inventory if new harvest is ready, or pausing the listing."
          ],
          metadata: {
            entityId: prod.id,
            productName: prod.name,
            currentStock: prod.stock,
            actionSuggestion: {
              type: "UPDATE_INVENTORY",
              productId: prod.id,
              productName: prod.name,
              currentStock: prod.stock,
              proposedStock: prod.stock + 100
            }
          }
        });
      }

      // 2. PRICE MOVEMENT ALERTS (Real Market Price Data)
      const marketPriceData = await query.get(
        `SELECT AVG(price) as avgPrice, MIN(price) as minPrice, MAX(price) as maxPrice, COUNT(*) as sampleCount
         FROM products WHERE category = ? AND id != ?`,
        [prod.category, prod.id]
      );

      if (marketPriceData && marketPriceData.sampleCount > 0 && marketPriceData.avgPrice > 0) {
        const avgPrice = parseFloat(marketPriceData.avgPrice);
        const currentPrice = parseFloat(prod.price);
        const priceDiffPct = ((currentPrice - avgPrice) / avgPrice) * 100;

        if (Math.abs(priceDiffPct) >= 15) {
          const isUnderpriced = priceDiffPct < -15;
          const proposedNewPrice = isUnderpriced ? Math.round(avgPrice * 0.95) : Math.round(avgPrice * 1.05);

          await saveInsightIfNew({
            type: "price",
            severity: isUnderpriced ? "high" : "info",
            title: `Price Movement Alert: ${prod.name}`,
            message: isUnderpriced
              ? `Your price (${formatCurrency(currentPrice)}) is ${Math.abs(priceDiffPct).toFixed(1)}% below the market average (${formatCurrency(avgPrice)}).`
              : `Your price (${formatCurrency(currentPrice)}) is ${priceDiffPct.toFixed(1)}% above the market average (${formatCurrency(avgPrice)}).`,
            facts: [
              `Your Listed Price: ${formatCurrency(currentPrice)}/${prod.unit}`,
              `Market Average Price (${prod.category}): ${formatCurrency(avgPrice)}/${prod.unit}`,
              `Market Min Price: ${formatCurrency(marketPriceData.minPrice)}, Max Price: ${formatCurrency(marketPriceData.maxPrice)}`,
              `Active Market Competitors: ${marketPriceData.sampleCount}`
            ],
            reasoning: [
              isUnderpriced
                ? "Your price is significantly lower than competitors. You may be under-monetizing your yield."
                : "Your price is higher than average. Ensure your product grade or organic certification justifies the premium.",
              "Adjusting price closer to market balance can optimize your total margin."
            ],
            metadata: {
              entityId: prod.id,
              productName: prod.name,
              currentPrice,
              marketAvgPrice: avgPrice,
              actionSuggestion: {
                type: "UPDATE_PRODUCT_PRICE",
                productId: prod.id,
                productName: prod.name,
                currentPrice,
                proposedPrice: proposedNewPrice
              }
            }
          });
        }
      }
    }

    // 3. DEMAND ALERTS (Real Order Velocity & Volume Data)
    const demandStats = await query.all(
      `SELECT p.id as productId, p.name as productName, COUNT(oi.id) as orderCount, SUM(oi.qty) as totalQty
       FROM order_items oi
       JOIN products p ON oi.productId = p.id
       JOIN orders o ON oi.orderId = o.id
       WHERE oi.farmerId = ? AND o.createdAt >= ?
       GROUP BY p.id, p.name`,
      [userId, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()]
    );

    for (const stat of demandStats) {
      if (stat.orderCount >= 2 || stat.totalQty >= 50) {
        await saveInsightIfNew({
          type: "demand",
          severity: "info",
          title: `High Demand Detected: ${stat.productName}`,
          message: `${stat.productName} has recorded ${stat.orderCount} orders totalling ${stat.totalQty} units in the last 30 days.`,
          facts: [
            `Product: ${stat.productName}`,
            `30-Day Total Orders: ${stat.orderCount}`,
            `30-Day Total Units Sold: ${stat.totalQty}`
          ],
          reasoning: [
            `Buyer demand for ${stat.productName} is currently active.`,
            "Consider maintaining reliable stock levels to fulfill ongoing vendor demand."
          ],
          metadata: {
            entityId: stat.productId,
            productName: stat.productName,
            orderCount: stat.orderCount,
            totalQty: stat.totalQty
          }
        });
      }
    }

    // 4. PENDING ORDERS ALERT
    const pendingOrders = await query.get(
      `SELECT COUNT(DISTINCT o.id) as pendingCount
       FROM orders o
       JOIN order_items oi ON o.id = oi.orderId
       WHERE oi.farmerId = ? AND o.status = 'Pending'`,
      [userId]
    );

    if (pendingOrders && pendingOrders.pendingCount > 0) {
      await saveInsightIfNew({
        type: "order",
        severity: "warning",
        title: "Pending Buyer Orders Awaiting Dispatch",
        message: `You have ${pendingOrders.pendingCount} pending order(s) awaiting confirmation and shipment.`,
        facts: [
          `Pending Orders Count: ${pendingOrders.pendingCount}`,
          `Action Required: Review and confirm order dispatch in Farmer Orders tab.`
        ],
        reasoning: [
          "Timely order dispatch builds buyer trust and prevents automatic order cancellations.",
          "Fast fulfillment improves your farmer performance rating on FarmConnect."
        ],
        metadata: {
          pendingCount: pendingOrders.pendingCount
        }
      });
    }

    // 5. WEATHER AGRICULTURAL ALERTS (Real Open-Meteo Integration)
    const weatherResult = await getLiveWeatherForecast({
      lat: user.lat,
      lng: user.lng,
      district: user.district,
      region: user.region,
      countryName: user.countryName
    });

    if (weatherResult.success && weatherResult.data) {
      const w = weatherResult.data;
      const agriculturalRisk = w.agriculturalIndicators || {};

      if (agriculturalRisk.rainExpectedNext48h || agriculturalRisk.heatRisk || w.current.windSpeedKmh > 30) {
        let riskDesc = [];
        if (agriculturalRisk.rainExpectedNext48h) riskDesc.push("Rainfall expected in next 48 hours");
        if (agriculturalRisk.heatRisk) riskDesc.push(`Extreme heat observed (${w.current.temperatureC}°C)`);
        if (w.current.windSpeedKmh > 30) riskDesc.push(`High wind speed (${w.current.windSpeedKmh} km/h)`);

        await saveInsightIfNew({
          type: "weather",
          severity: agriculturalRisk.rainExpectedNext48h || agriculturalRisk.heatRisk ? "warning" : "info",
          title: `Weather Advisory: ${w.location}`,
          message: `Advisory for ${w.location}: ${riskDesc.join("; ")}.`,
          facts: [
            `Location: ${w.location}`,
            `Current Temperature: ${w.current.temperatureC}°C (${w.current.condition})`,
            `Humidity: ${w.current.humidityPct}%, Wind: ${w.current.windSpeedKmh} km/h`,
            `Rain Expected Next 48h: ${agriculturalRisk.rainExpectedNext48h ? "YES" : "NO"}`
          ],
          reasoning: [
            agriculturalRisk.rainExpectedNext48h
              ? "Postpone pesticide spraying or sensitive open-field harvests to avoid wash-off."
              : "Ensure irrigation schedules account for high temperature levels.",
            "Always inspect local field drainage conditions prior to heavy precipitation."
          ],
          metadata: {
            location: w.location,
            temperatureC: w.current.temperatureC,
            condition: w.current.condition,
            rainExpected: agriculturalRisk.rainExpectedNext48h
          },
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        });
      }

      // 6. SELLING OPPORTUNITY INSIGHTS (Synthesis of Price + Demand + Weather + Inventory)
      if (farmerProducts.length > 0 && agriculturalRisk.favorableHarvestingConditions) {
        const topProd = farmerProducts[0];
        await saveInsightIfNew({
          type: "selling",
          severity: "info",
          title: `Optimal Selling Window: ${topProd.name}`,
          message: `Clear weather in ${w.location} and active market pricing offer good harvest & listing conditions.`,
          facts: [
            `Product: ${topProd.name}`,
            `Your Price: ${formatCurrency(topProd.price)}/${topProd.unit}`,
            `Current Weather: ${w.current.condition}, ${w.current.temperatureC}°C`,
            `48h Rain Forecast: None expected`
          ],
          reasoning: [
            "Clear weather allows safe field harvesting and uninterrupted transit to buyers.",
            "Listing freshly harvested stock during clear weather windows minimizes post-harvest spoilage risk."
          ],
          metadata: {
            entityId: topProd.id,
            productName: topProd.name
          }
        });
      }
    }

    return {
      success: true,
      count: generatedInsights.length,
      insights: generatedInsights
    };
  } catch (err) {
    console.error("[ProactiveInsightService Error]:", err.message);
    throw err;
  }
}

/**
 * Retrieves stored proactive insights for a user, expiring stale items automatically
 * @param {string} userId - Authenticated user ID
 * @param {string} lang - Selected language ('en', 'ta', 'hi', 'tanglish')
 * @param {string} status - Optional status filter ('active', 'read', 'expired', 'all')
 */
export async function getUserProactiveInsights(userId, lang = "en", status = "active") {
  if (!userId) throw new Error("userId required");

  // 1. Auto-expire outdated insights
  const now = new Date().toISOString();
  await query.run(
    `UPDATE ai_proactive_insights 
     SET status = 'expired' 
     WHERE userId = ? AND status = 'active' AND expiresAt IS NOT NULL AND expiresAt < ?`,
    [userId, now]
  );

  // 2. Fetch insights
  let sql = `SELECT * FROM ai_proactive_insights WHERE userId = ?`;
  const params = [userId];

  if (status !== "all") {
    sql += ` AND status = ?`;
    params.push(status);
  }

  sql += ` ORDER BY createdAt DESC LIMIT 50`;

  const rows = await query.all(sql, params);

  // 3. Translate dynamic outputs if language is specified
  const formatted = rows.map((r) => {
    let facts = [];
    let reasoning = [];
    let metadata = {};

    try { facts = JSON.parse(r.facts); } catch { facts = [r.facts]; }
    try { reasoning = JSON.parse(r.reasoning); } catch { reasoning = [r.reasoning]; }
    try { metadata = JSON.parse(r.metadata); } catch { metadata = {}; }

    // Multilingual enrichment if translation template exists
    let title = r.title;
    let message = r.message;

    if (TRANSLATIONS[r.type] && TRANSLATIONS[r.type][lang]) {
      const tObj = TRANSLATIONS[r.type][lang];
      if (metadata.productName && lang !== "en") {
        title = `${tObj.title}: ${metadata.productName}`;
      } else {
        title = tObj.title;
      }
    }

    return {
      id: r.id,
      userId: r.userId,
      type: r.type,
      severity: r.severity,
      title,
      message,
      facts,
      reasoning,
      metadata,
      status: r.status,
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
      readAt: r.readAt
    };
  });

  return {
    success: true,
    count: formatted.length,
    insights: formatted
  };
}

/**
 * Marks a specific insight as read
 */
export async function markInsightAsRead(userId, insightId) {
  if (!userId || !insightId) throw new Error("userId and insightId required");

  const existing = await query.get(
    "SELECT id FROM ai_proactive_insights WHERE id = ? AND userId = ?",
    [insightId, userId]
  );

  if (!existing) {
    const err = new Error("Insight not found or access denied");
    err.status = 404;
    throw err;
  }

  const now = new Date().toISOString();
  await query.run(
    "UPDATE ai_proactive_insights SET status = 'read', readAt = ? WHERE id = ?",
    [now, insightId]
  );

  return { success: true, id: insightId, status: "read", readAt: now };
}
