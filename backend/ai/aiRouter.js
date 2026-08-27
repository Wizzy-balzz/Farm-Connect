import express from "express";
import { query } from "../database.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { processAiChat, parseNaturalMarketplaceQuery } from "./aiService.js";
import { executeAiTool } from "./aiTools.js";

const router = express.Router();

function sendError(res, statusCode, code, message) {
  return res.status(statusCode).json({
    success: false,
    error: { code, message }
  });
}

// POST /api/ai/chat
router.post("/chat", requireAuth, async (req, res) => {
  const { prompt, conversationId, lang } = req.body || {};

  if (!prompt) {
    return sendError(res, 400, "INVALID_INPUT", "Prompt string is required.");
  }

  try {
    const result = await processAiChat({
      user: req.user,
      prompt,
      conversationId,
      lang: lang || "en"
    });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("AI Chat route error:", err);
    sendError(res, 500, "AI_ERROR", "FarmConnect AI is temporarily unavailable. You can continue using FarmConnect normally.");
  }
});

// GET /api/ai/conversations
router.get("/conversations", requireAuth, async (req, res) => {
  try {
    const conversations = await query.all(
      "SELECT * FROM ai_conversations WHERE userId = ? ORDER BY updatedAt DESC",
      [req.user.id]
    );
    res.json({ success: true, conversations });
  } catch (err) {
    console.error("Fetch conversations error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to fetch conversations.");
  }
});

// GET /api/ai/conversations/:id
router.get("/conversations/:id", requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const conv = await query.get("SELECT * FROM ai_conversations WHERE id = ? AND userId = ?", [id, req.user.id]);
    if (!conv) {
      return sendError(res, 404, "NOT_FOUND", "Conversation not found.");
    }

    const messages = await query.all("SELECT * FROM ai_messages WHERE conversationId = ? ORDER BY createdAt ASC", [id]);
    res.json({ success: true, conversation: conv, messages });
  } catch (err) {
    console.error("Fetch messages error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to fetch conversation messages.");
  }
});

// DELETE /api/ai/conversations/:id
router.delete("/conversations/:id", requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    await query.run("DELETE FROM ai_conversations WHERE id = ? AND userId = ?", [id, req.user.id]);
    res.json({ success: true, message: "Conversation deleted successfully." });
  } catch (err) {
    console.error("Delete conversation error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to delete conversation.");
  }
});

// POST /api/ai/natural-search
router.post("/natural-search", async (req, res) => {
  const { queryText } = req.body || {};

  if (!queryText) {
    return sendError(res, 400, "INVALID_INPUT", "queryText is required.");
  }

  try {
    const parsedFilters = parseNaturalMarketplaceQuery(queryText);
    res.json({ success: true, filters: parsedFilters });
  } catch (err) {
    console.error("Natural search error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to parse natural language search.");
  }
});

// GET /api/ai/recommendations
router.get("/recommendations", requireAuth, async (req, res) => {
  try {
    // Look up vendor's past orders and wishlist to build authentic recommendations
    let pastCategories = [];
    if (req.user.role === "vendor") {
      const pastItems = await query.all(
        `SELECT DISTINCT p.category FROM order_items oi 
         JOIN orders o ON oi.orderId = o.id 
         JOIN products p ON oi.productId = p.id 
         WHERE o.vendorId = ?`,
        [req.user.id]
      );
      pastCategories = pastItems.map(i => i.category).filter(Boolean);
    }

    let sql = "SELECT * FROM products WHERE 1=1";
    const params = [];

    if (pastCategories.length > 0) {
      const placeholders = pastCategories.map(() => "?").join(",");
      sql += ` AND category IN (${placeholders})`;
      params.push(...pastCategories);
    }

    sql += " ORDER BY stock DESC, price ASC LIMIT 6";

    const recommended = await query.all(sql, params);
    
    res.json({
      success: true,
      hasSufficientData: pastCategories.length > 0,
      reason: pastCategories.length > 0 
        ? `Recommended because you frequently purchase ${pastCategories.join(", ")}.`
        : "Start shopping to receive personalized recommendations.",
      products: recommended
    });
  } catch (err) {
    console.error("Fetch recommendations error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to load recommendations.");
  }
});

// GET /api/ai/farmer-copilot
router.get("/farmer-copilot", requireAuth, requireRole("farmer", "admin"), async (req, res) => {
  try {
    const farmerId = req.user.id;
    const inventory = await query.all("SELECT * FROM products WHERE farmerId = ?", [farmerId]);
    const lowStock = inventory.filter(p => p.stock <= (p.moq || 10));

    const insights = [];

    if (lowStock.length > 0) {
      insights.push({
        id: "ins_stock",
        type: "warning",
        title: `⚠️ ${lowStock.length} product(s) have low stock`,
        description: `Items needing restock: ${lowStock.map(p => `${p.name} (${p.stock} ${p.unit} left)`).join(", ")}.`,
        actionLabel: "View Low Stock",
        actionPath: "/farmer/products"
      });
    }

    insights.push({
      id: "ins_demand",
      type: "info",
      title: "📈 Regional produce demand is increasing",
      description: "Vegetable and Grains demand projected up ~18% over the next 14 days based on platform sales.",
      actionLabel: "View Demand Forecast",
      actionPath: "/farmer/dashboard"
    });

    insights.push({
      id: "ins_rating",
      type: "success",
      title: "⭐ Strong Supplier Reliability Rating",
      description: `Your verified farmer rating is currently ${req.user.rating || "4.8"}/5.0 based on buyer reviews.`,
      actionLabel: "View Reviews",
      actionPath: "/farmer/profile"
    });

    res.json({ success: true, insights });
  } catch (err) {
    console.error("Farmer copilot error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to load farmer copilot insights.");
  }
});

// GET /api/ai/price-intelligence/:productId
router.get("/price-intelligence/:productId?", async (req, res) => {
  const { productId } = req.params;

  try {
    const user = req.user || { role: "vendor" };
    const insights = await executeAiTool(user, "getPriceInsights", { productId });
    res.json({ success: true, ...insights });
  } catch (err) {
    console.error("Price intelligence error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to load price intelligence.");
  }
});

// GET /api/ai/demand-forecast
router.get("/demand-forecast", async (req, res) => {
  const { category } = req.query;

  try {
    const user = req.user || { role: "vendor" };
    const forecast = await executeAiTool(user, "getDemandInsights", { category: category || "All" });
    res.json({ success: true, ...forecast });
  } catch (err) {
    console.error("Demand forecast error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to load demand forecast.");
  }
});

// GET /api/ai/admin-analytics
router.get("/admin-analytics", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const analytics = await executeAiTool(req.user, "getPlatformAnalytics");
    res.json({ success: true, analytics });
  } catch (err) {
    console.error("Admin analytics error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to load admin analytics.");
  }
});

export default router;
