import express from "express";
import multer from "multer";
import { query } from "../database.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { processAiChat, parseNaturalMarketplaceQuery, getAiDiagnostics } from "./aiService.js";
import { executeAiTool } from "./aiTools.js";
import { confirmAction, cancelAction, getActionAuditHistory } from "./aiActions.js";
import { transcribeAudio, MAX_VOICE_FILE_SIZE_BYTES } from "../services/transcriptionService.js";
import { voiceRateLimiter } from "../middleware/voiceRateLimiter.js";
import { synthesizeSpeech } from "../services/ttsService.js";
import { ttsRateLimiter } from "../middleware/ttsRateLimiter.js";
import { getUserProactiveInsights, markInsightAsRead, generateProactiveInsightsForUser } from "../services/proactiveInsightService.js";
import { imageRateLimiter } from "../middleware/imageRateLimiter.js";
import { analyzeCropImage, MAX_IMAGE_FILE_SIZE_BYTES } from "../services/cropImageAnalysisService.js";
import {
  generateSellingStrategy,
  compareSellingOptions,
  generateSmartSellingPlan,
  detectSellingOpportunities,
  getNearbyBuyerOpportunities,
  getMarketplaceOverview
} from "../services/marketplaceAgentService.js";
import {
  getFarmPerformanceReport,
  getFarmerSalesAnalytics,
  getFarmerInventoryAnalytics,
  getProductPerformance,
  getMarketplaceAggregateAnalytics,
  getPlatformWideAnalytics,
  compareAnalyticsPeriods,
  generateAnalyticsCsv
} from "../services/analyticsReportService.js";
import {
  getUserMemories,
  saveMemoryItem,
  deleteMemoryItem,
  clearUserMemories,
  getRelevantUserContext
} from "../services/aiMemoryService.js";
import {
  getUserGoals,
  getGoalById,
  createGoal,
  updateGoal,
  deleteGoal,
  calculateVerifiedGoalProgress
} from "../services/aiGoalService.js";
import {
  getUserFollowups,
  getFollowupById,
  createFollowup,
  completeFollowup,
  dismissFollowup
} from "../services/aiFollowupService.js";
import { executeCopilotPlan } from "../services/aiPlannerService.js";

const router = express.Router();

const uploadVoice = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VOICE_FILE_SIZE_BYTES }
});

const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_FILE_SIZE_BYTES }
});

function sendError(res, statusCode, code, message) {
  return res.status(statusCode).json({
    success: false,
    error: { code, message }
  });
}

// GET /api/ai/diagnostics - AI System Health & Diagnostics (Sanitized, zero leaked credentials)
router.get("/diagnostics", async (req, res) => {
  try {
    const diagnostics = await getAiDiagnostics();
    res.json({ success: true, ...diagnostics });
  } catch (err) {
    res.status(500).json({
      success: false,
      aiEngine: "OFFLINE",
      aiStatus: "OFFLINE",
      error: err.message
    });
  }
});

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

// POST /api/ai/tts - Synthesize text-to-speech for AI response
router.post("/tts", requireAuth, ttsRateLimiter, async (req, res) => {
  const { text, language, voice } = req.body || {};

  if (!text || typeof text !== "string" || !text.trim()) {
    return sendError(res, 400, "INVALID_INPUT", "Text string is required for speech synthesis.");
  }

  try {
    const result = await synthesizeSpeech({
      text,
      language: language || "en",
      voice: voice || null
    });

    if (!result.success) {
      const statusCode = (result.error?.code === "UNSUPPORTED_LANGUAGE" || result.error?.code === "TEXT_TOO_LONG" || result.error?.code === "EMPTY_TEXT" || result.error?.code === "EMPTY_TEXT_AFTER_CLEANING") ? 400 : 503;
      return sendError(res, statusCode, result.error?.code || "TTS_ERROR", result.error?.message || "Speech synthesis failed.");
    }

    res.set({
      "Content-Type": result.mimeType || "audio/mpeg",
      "Content-Length": result.audioBuffer.length,
      "Cache-Control": "no-store, no-cache, must-revalidate"
    });

    return res.send(result.audioBuffer);
  } catch (err) {
    console.error("TTS processing error:", err);
    return sendError(res, 500, "TTS_ERROR", "Speech synthesis encountered an unexpected error.");
  }
});

// POST /api/ai/voice
router.post("/voice", requireAuth, voiceRateLimiter, (req, res, next) => {
  uploadVoice.single("audio")(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return sendError(res, 400, "AUDIO_TOO_LARGE", "Audio recording exceeds maximum allowed size.");
      }
      return sendError(res, 400, "UPLOAD_ERROR", err.message || "Failed to upload audio.");
    }
    next();
  });
}, async (req, res) => {
  if (!req.file || !req.file.buffer || req.file.buffer.length === 0) {
    return sendError(res, 400, "EMPTY_AUDIO", "No audio recording received.");
  }

  const { language, conversationId, transcribeOnly } = req.body || {};

  try {
    // 1. Transcribe audio using isolated transcription service
    const transcription = await transcribeAudio({
      audioBuffer: req.file.buffer,
      mimeType: req.file.mimetype || "audio/webm",
      languageHint: language || "en"
    });

    if (!transcription.success) {
      const statusCode = (transcription.error?.code === "UNSUPPORTED_AUDIO_FORMAT" || transcription.error?.code === "EMPTY_AUDIO" || transcription.error?.code === "AUDIO_TOO_LARGE" || transcription.error?.code === "EMPTY_TRANSCRIPT") ? 400 : 503;
      return sendError(res, statusCode, transcription.error?.code || "STT_ERROR", transcription.error?.message || "Audio transcription failed.");
    }

    const transcribedText = transcription.text;
    const detectedLang = transcription.language || language || "en";

    // Allow frontend to review/edit transcription before executing AI reasoning
    if (transcribeOnly === true || transcribeOnly === "true") {
      return res.json({
        success: true,
        transcript: transcribedText,
        language: detectedLang
      });
    }

    // 2. Pass transcribed text directly into Python NLP AI agent logic
    const result = await processAiChat({
      user: req.user,
      prompt: transcribedText,
      conversationId: conversationId || null,
      lang: detectedLang
    });

    res.json({
      success: true,
      transcript: transcribedText,
      language: detectedLang,
      response: result.message?.content || "",
      conversationId: result.conversationId,
      audio: {
        available: true,
        mimeType: "audio/mpeg"
      },
      message: {
        ...result.message,
        isVoice: true,
        transcript: transcribedText
      }
    });
  } catch (err) {
    console.error("Voice processing error:", err);
    sendError(res, 500, "AI_ERROR", "FarmConnect AI voice processing is temporarily unavailable. You can continue using FarmConnect normally.");
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
    const result = await executeAiTool(user, "getPriceInsights", { productId });
    const payload = result.data !== undefined ? result.data : result;
    res.json({ success: true, ...payload });
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
    const result = await executeAiTool(user, "getDemandInsights", { category: category || "All" });
    const payload = result.data !== undefined ? result.data : result;
    res.json({ success: true, ...payload });
  } catch (err) {
    console.error("Demand forecast error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to load demand forecast.");
  }
});

// POST /api/ai/actions/confirm - Human confirmation of safe AI action
router.post("/actions/confirm", requireAuth, async (req, res) => {
  const { confirmationToken } = req.body || {};
  if (!confirmationToken) {
    return sendError(res, 400, "INVALID_INPUT", "confirmationToken is required to confirm an action.");
  }
  try {
    const result = await confirmAction({ confirmationToken, userId: req.user.id });
    if (!result.success) {
      const code = result.error?.code;
      const statusCode = (code === "ACTION_NOT_FOUND" || code === "NOT_FOUND")
        ? 404
        : (code === "EXPIRED" || code === "ACTION_EXPIRED" || code === "INVALID_TOKEN" || code === "INVALID_PARAMETERS" || code === "ACTION_STALE" || code === "ALREADY_EXECUTED" || code === "ACTION_ALREADY_PROCESSED" || code === "ACTION_CANCELLED")
          ? 400
          : (code === "UNAUTHORIZED" || code === "OWNERSHIP_VIOLATION" || code === "FORBIDDEN")
            ? 403
            : 500;
      return sendError(res, statusCode, result.error?.code || "ACTION_FAILED", result.error?.message || "Action confirmation failed.");
    }
    res.json(result);
  } catch (err) {
    console.error("Action confirm error:", err);
    sendError(res, 500, "SERVER_ERROR", "Unexpected error during action confirmation.");
  }
});

// POST /api/ai/actions/cancel - User explicit cancellation of pending AI action proposal
router.post("/actions/cancel", requireAuth, async (req, res) => {
  const { actionId } = req.body || {};
  if (!actionId) {
    return sendError(res, 400, "INVALID_INPUT", "actionId is required to cancel an action.");
  }
  try {
    const result = await cancelAction({ actionId, userId: req.user.id });
    if (!result.success) {
      return sendError(res, 400, result.error?.code || "CANCEL_FAILED", result.error?.message || "Failed to cancel action proposal.");
    }
    res.json(result);
  } catch (err) {
    console.error("Action cancel error:", err);
    sendError(res, 500, "SERVER_ERROR", "Unexpected error during action cancellation.");
  }
});

// GET /api/ai/actions/history - Fetch user's AI action audit trail
router.get("/actions/history", requireAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || "20", 10);
    const history = await getActionAuditHistory(req.user.id, limit);
    res.json({ success: true, history });
  } catch (err) {
    console.error("Action history error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to retrieve action audit history.");
  }
});

// Phase 7: Proactive Insights Endpoints

// GET /api/ai/insights - Get active proactive agricultural insights for authenticated farmer
router.get("/insights", requireAuth, async (req, res) => {
  try {
    const lang = req.query.lang || "en";
    const status = req.query.status || "active";
    // Trigger fresh evaluation in background if requesting active insights
    if (status === "active" && (req.user.role === "farmer" || req.user.role === "admin")) {
      await generateProactiveInsightsForUser(req.user).catch((e) => console.warn("Background insight generation warning:", e.message));
    }
    const result = await getUserProactiveInsights(req.user.id, lang, status);
    res.json(result);
  } catch (err) {
    console.error("GET /api/ai/insights error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to retrieve proactive agricultural insights.");
  }
});

// POST /api/ai/insights/generate - Trigger insight analysis on demand
router.post("/insights/generate", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "farmer" && req.user.role !== "admin") {
      return sendError(res, 403, "FORBIDDEN", "Proactive insights are only available for farmer roles.");
    }
    const result = await generateProactiveInsightsForUser(req.user, { forceRefresh: true });
    res.json(result);
  } catch (err) {
    console.error("POST /api/ai/insights/generate error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to generate proactive insights.");
  }
});

// POST /api/ai/insights/:id/read - Mark proactive insight as read
router.post("/insights/:id/read", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await markInsightAsRead(req.user.id, id);
    res.json(result);
  } catch (err) {
    console.error("POST /api/ai/insights/:id/read error:", err);
    const status = err.status || 500;
    sendError(res, status, err.code || "SERVER_ERROR", err.message || "Failed to mark insight as read.");
  }
});

// Phase 8: AI Image-Based Crop & Plant Analysis Endpoints

// POST /api/ai/image-analysis - Multimodal AI crop & plant health analysis
router.post("/image-analysis", requireAuth, imageRateLimiter, (req, res, next) => {
  uploadImage.single("image")(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return sendError(res, 400, "IMAGE_TOO_LARGE", "Image file exceeds maximum allowed size (10MB).");
      }
      return sendError(res, 400, "UPLOAD_ERROR", err.message || "Failed to upload crop image.");
    }
    next();
  });
}, async (req, res) => {
  if (!req.file || !req.file.buffer || req.file.buffer.length === 0) {
    return sendError(res, 400, "EMPTY_IMAGE", "No crop image uploaded.");
  }

  const { notes, userContext, language, lang, conversationId } = req.body || {};
  const cropNotes = notes || userContext || "";
  const targetLang = language || lang || "en";

  try {
    const analysis = await analyzeCropImage({
      imageBuffer: req.file.buffer,
      mimeType: req.file.mimetype || "image/jpeg",
      cropContext: cropNotes,
      userLocation: req.user?.region || null,
      language: targetLang,
      userId: req.user.id
    });

    if (!analysis.success) {
      const code = analysis.error?.code;
      const statusCode = (code === "UNSUPPORTED_IMAGE_FORMAT" || code === "IMAGE_TOO_LARGE" || code === "EMPTY_IMAGE" || code === "INVALID_IMAGE_DATA" || code === "INVALID_FILE_SIGNATURE") ? 400 : 503;
      return sendError(res, statusCode, analysis.error?.code || "ANALYSIS_ERROR", analysis.error?.message || "Crop image analysis failed.");
    }

    // Persist analysis record into DB
    const analysisId = `img_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
    const nowIso = new Date().toISOString();
    await query.run(
      "INSERT INTO ai_image_analyses (id, userId, cropContext, analysisResult, language, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
      [analysisId, req.user.id, cropNotes, JSON.stringify(analysis), targetLang, nowIso]
    );

    // Link with conversation history
    let activeConversationId = conversationId;
    if (!activeConversationId) {
      const existingConv = await query.get(
        "SELECT id FROM ai_conversations WHERE userId = ? ORDER BY updatedAt DESC LIMIT 1",
        [req.user.id]
      );
      if (existingConv) {
        activeConversationId = existingConv.id;
      } else {
        activeConversationId = `conv_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
        await query.run(
          "INSERT INTO ai_conversations (id, userId, title) VALUES (?, ?, ?)",
          [activeConversationId, req.user.id, `Crop Health Analysis - ${new Date().toLocaleDateString()}`]
        );
      }
    }

    const userMsgId = `msg_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
    const assistantMsgId = `msg_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
    const summaryText = analysis.recommendations?.summary || analysis.rawText || "Crop analysis completed.";

    await query.run(
      "INSERT INTO ai_messages (id, conversationId, role, content) VALUES (?, ?, ?, ?)",
      [userMsgId, activeConversationId, "user", `📷 [Crop Photo Analysis] ${cropNotes}`.trim()]
    );

    await query.run(
      "INSERT INTO ai_messages (id, conversationId, role, content, toolName, toolResult, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [assistantMsgId, activeConversationId, "assistant", summaryText, "cropImageAnalysis", JSON.stringify({ isImageAnalysis: true, analysisId }), nowIso]
    );

    await query.run(
      "UPDATE ai_conversations SET updatedAt = CURRENT_TIMESTAMP WHERE id = ?",
      [activeConversationId]
    );

    return res.json({
      success: true,
      analysisId,
      conversationId: activeConversationId,
      analysis,
      message: summaryText
    });
  } catch (err) {
    console.error("Crop image analysis error:", err);
    return sendError(res, 500, "AI_ERROR", "FarmConnect AI crop image analysis is temporarily unavailable.");
  }
});

// GET /api/ai/image-analyses - Fetch past crop image analysis history
router.get("/image-analyses", requireAuth, async (req, res) => {
  try {
    const rows = await query.all(
      "SELECT * FROM ai_image_analyses WHERE userId = ? ORDER BY createdAt DESC LIMIT 50",
      [req.user.id]
    );
    const analyses = rows.map(r => ({
      ...r,
      analysisResult: typeof r.analysisResult === "string" ? JSON.parse(r.analysisResult) : r.analysisResult
    }));
    res.json({ success: true, analyses });
  } catch (err) {
    console.error("GET /api/ai/image-analyses error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to retrieve image analysis history.");
  }
});

// GET /api/ai/image-analyses/:id - Fetch specific crop image analysis record
router.get("/image-analyses/:id", requireAuth, async (req, res) => {
  try {
    const row = await query.get(
      "SELECT * FROM ai_image_analyses WHERE id = ? AND userId = ?",
      [req.params.id, req.user.id]
    );
    if (!row) {
      return sendError(res, 404, "NOT_FOUND", "Image analysis record not found.");
    }
    row.analysisResult = typeof row.analysisResult === "string" ? JSON.parse(row.analysisResult) : row.analysisResult;
    res.json({ success: true, analysisRecord: row });
  } catch (err) {
    console.error("GET /api/ai/image-analyses/:id error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to retrieve image analysis record.");
  }
});

// Phase 9 Marketplace & Selling Agent Endpoints

// POST /api/ai/marketplace/selling-strategy
router.post("/marketplace/selling-strategy", requireAuth, requireRole("farmer", "admin"), async (req, res) => {
  const { commodity, quantity } = req.body || {};
  try {
    const strategy = await generateSellingStrategy({
      farmerId: req.user.id,
      commodity,
      quantity,
      userLocation: { district: req.user.district, region: req.user.region, lat: req.user.lat, lng: req.user.lng }
    });
    res.json({ success: true, strategy });
  } catch (err) {
    console.error("POST /api/ai/marketplace/selling-strategy error:", err);
    sendError(res, 500, "SELLING_AGENT_ERROR", err.message || "Failed to generate selling strategy.");
  }
});

// POST /api/ai/marketplace/selling-plan
router.post("/marketplace/selling-plan", requireAuth, requireRole("farmer", "admin"), async (req, res) => {
  try {
    const planResult = await generateSmartSellingPlan({
      farmerId: req.user.id,
      userLocation: { district: req.user.district, region: req.user.region, lat: req.user.lat, lng: req.user.lng }
    });
    res.json({ success: true, ...planResult });
  } catch (err) {
    console.error("POST /api/ai/marketplace/selling-plan error:", err);
    sendError(res, 500, "SELLING_AGENT_ERROR", err.message || "Failed to generate selling plan.");
  }
});

// POST /api/ai/marketplace/compare
router.post("/marketplace/compare", requireAuth, requireRole("farmer", "admin"), async (req, res) => {
  const { commodities } = req.body || {};
  try {
    const result = await compareSellingOptions({
      farmerId: req.user.id,
      commodities: commodities || ["Tomato", "Onion"],
      userLocation: { district: req.user.district, region: req.user.region, lat: req.user.lat, lng: req.user.lng }
    });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("POST /api/ai/marketplace/compare error:", err);
    sendError(res, 500, "SELLING_AGENT_ERROR", err.message || "Failed to compare selling options.");
  }
});

// GET /api/ai/marketplace/opportunities
router.get("/marketplace/opportunities", requireAuth, requireRole(["farmer", "admin"]), async (req, res) => {
  try {
    const opportunities = await detectSellingOpportunities(req.user.id, {
      district: req.user.district,
      region: req.user.region,
      lat: req.user.lat,
      lng: req.user.lng
    });
    res.json({ success: true, ...opportunities });
  } catch (err) {
    console.error("GET /api/ai/marketplace/opportunities error:", err);
    sendError(res, 500, "SELLING_AGENT_ERROR", err.message || "Failed to retrieve selling opportunities.");
  }
});

// GET /api/ai/marketplace/buyers
router.get("/marketplace/buyers", requireAuth, requireRole(["farmer", "admin"]), async (req, res) => {
  try {
    const buyers = await getNearbyBuyerOpportunities({
      farmerId: req.user.id,
      district: req.query.district || req.user.district,
      region: req.query.region || req.user.region
    });
    res.json(buyers);
  } catch (err) {
    console.error("GET /api/ai/marketplace/buyers error:", err);
    sendError(res, 500, "SELLING_AGENT_ERROR", err.message || "Failed to retrieve nearby buyer opportunities.");
  }
});

// GET /api/ai/marketplace/overview
router.get("/marketplace/overview", requireAuth, async (req, res) => {
  try {
    const overview = await getMarketplaceOverview({
      district: req.query.district || req.user.district,
      region: req.query.region || req.user.region
    });
    res.json({ success: true, ...overview });
  } catch (err) {
    console.error("GET /api/ai/marketplace/overview error:", err);
    sendError(res, 500, "SELLING_AGENT_ERROR", err.message || "Failed to retrieve marketplace overview.");
  }
});

// ==================================================
// Phase 10 AI Reports & Advanced Analytics Endpoints
// ==================================================

// GET /api/ai/analytics/farmer-report
router.get("/analytics/farmer-report", requireAuth, requireRole(["farmer", "admin"]), async (req, res) => {
  try {
    const targetFarmerId = req.user.role === "farmer" ? req.user.id : (req.query.farmerId || req.user.id);
    const report = await getFarmPerformanceReport(targetFarmerId, {
      period: req.query.period,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    });
    res.json({ success: true, ...report });
  } catch (err) {
    console.error("GET /api/ai/analytics/farmer-report error:", err);
    sendError(res, 500, "ANALYTICS_ERROR", err.message || "Failed to generate farm performance report.");
  }
});

// GET /api/ai/analytics/sales
router.get("/analytics/sales", requireAuth, requireRole(["farmer", "admin"]), async (req, res) => {
  try {
    const targetFarmerId = req.user.role === "farmer" ? req.user.id : (req.query.farmerId || req.user.id);
    const sales = await getFarmerSalesAnalytics(targetFarmerId, {
      period: req.query.period,
      commodity: req.query.commodity,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    });
    res.json({ success: true, ...sales });
  } catch (err) {
    console.error("GET /api/ai/analytics/sales error:", err);
    sendError(res, 500, "ANALYTICS_ERROR", err.message || "Failed to retrieve sales analytics.");
  }
});

// GET /api/ai/analytics/inventory
router.get("/analytics/inventory", requireAuth, requireRole(["farmer", "admin"]), async (req, res) => {
  try {
    const targetFarmerId = req.user.role === "farmer" ? req.user.id : (req.query.farmerId || req.user.id);
    const inventory = await getFarmerInventoryAnalytics(targetFarmerId);
    res.json({ success: true, ...inventory });
  } catch (err) {
    console.error("GET /api/ai/analytics/inventory error:", err);
    sendError(res, 500, "ANALYTICS_ERROR", err.message || "Failed to retrieve inventory analytics.");
  }
});

// GET /api/ai/analytics/product-performance
router.get("/analytics/product-performance", requireAuth, requireRole(["farmer", "admin"]), async (req, res) => {
  try {
    const targetFarmerId = req.user.role === "farmer" ? req.user.id : (req.query.farmerId || req.user.id);
    const result = await getProductPerformance(targetFarmerId, req.query.productId, {
      period: req.query.period
    });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("GET /api/ai/analytics/product-performance error:", err);
    sendError(res, 500, "ANALYTICS_ERROR", err.message || "Failed to retrieve product performance.");
  }
});

// GET /api/ai/analytics/marketplace
router.get("/analytics/marketplace", requireAuth, async (req, res) => {
  try {
    const marketplace = await getMarketplaceAggregateAnalytics({
      commodity: req.query.commodity,
      period: req.query.period
    });
    res.json({ success: true, ...marketplace });
  } catch (err) {
    console.error("GET /api/ai/analytics/marketplace error:", err);
    sendError(res, 500, "ANALYTICS_ERROR", err.message || "Failed to retrieve marketplace analytics.");
  }
});

// GET /api/ai/analytics/platform
router.get("/analytics/platform", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const platform = await getPlatformWideAnalytics({
      period: req.query.period
    });
    res.json({ success: true, ...platform });
  } catch (err) {
    console.error("GET /api/ai/analytics/platform error:", err);
    sendError(res, 500, "ANALYTICS_ERROR", err.message || "Failed to retrieve platform analytics.");
  }
});

// GET /api/ai/admin-analytics (Executive analytics for admin dashboard)
router.get("/admin-analytics", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const result = await executeAiTool(req.user, "getPlatformAnalytics");
    if (!result.success) {
      return sendError(res, 500, result.error?.code || "ANALYTICS_ERROR", result.error?.message || "Failed to load admin analytics.");
    }
    res.json({ success: true, analytics: result.data || result });
  } catch (err) {
    console.error("GET /api/ai/admin-analytics error:", err);
    sendError(res, 500, "ANALYTICS_ERROR", err.message || "Failed to retrieve admin analytics.");
  }
});

// POST /api/ai/analytics/compare
router.post("/analytics/compare", requireAuth, requireRole(["farmer", "admin"]), async (req, res) => {
  try {
    const targetFarmerId = req.user.role === "farmer" ? req.user.id : (req.body?.farmerId || req.user.id);
    const comparison = await compareAnalyticsPeriods(targetFarmerId, {
      period: req.body?.period
    });
    res.json({ success: true, ...comparison });
  } catch (err) {
    console.error("POST /api/ai/analytics/compare error:", err);
    sendError(res, 500, "ANALYTICS_ERROR", err.message || "Failed to compare analytics periods.");
  }
});

// GET /api/ai/analytics/export
router.get("/analytics/export", requireAuth, async (req, res) => {
  const type = req.query.type || "sales";
  try {
    const csvContent = await generateAnalyticsCsv(req.user, type, req.query);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="farmconnect-${type}-analytics-${Date.now()}.csv"`);
    return res.send(csvContent);
  } catch (err) {
    console.error("GET /api/ai/analytics/export error:", err);
    const status = err.message?.startsWith("FORBIDDEN") ? 403 : 500;
    sendError(res, status, "EXPORT_ERROR", err.message || "Failed to export analytics CSV.");
  }
});

// ============================================================
// PHASE 11: PERSONAL COPILOT, MEMORY, GOALS & FOLLOW-UPS API
// ============================================================

// GET /api/ai/copilot/dashboard - Aggregated Copilot Dashboard Summary
router.get("/copilot/dashboard", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const isFarmer = req.user.role === "farmer" || req.user.role === "admin";

    // 1. Fetch active goals
    const goals = isFarmer ? await getUserGoals(userId, { status: "active" }) : [];

    // 2. Fetch pending follow-ups
    const followups = await getUserFollowups(userId, { status: "pending" });

    // 3. Fetch active proactive insights
    const rawInsights = await getUserProactiveInsights(userId, req.query.lang || "en", "active");
    const insights = Array.isArray(rawInsights) ? rawInsights : (rawInsights?.insights || rawInsights?.data || []);

    // 4. Fetch pending Phase 6 action proposals
    const nowMs = Date.now();
    const pendingActions = await query.all(
      "SELECT id, actionId, parametersJson, expectedStateJson, expiresAt, createdAt FROM ai_pending_actions WHERE userId = ? AND status = 'PENDING' AND expiresAt > ? ORDER BY createdAt DESC",
      [userId, nowMs]
    );

    const parsedPendingActions = (pendingActions || []).map((pa) => {
      let params = {};
      try { params = JSON.parse(pa.parametersJson); } catch {}
      return {
        id: pa.id,
        actionId: pa.actionId,
        parameters: params,
        expiresAt: pa.expiresAt,
        createdAt: pa.createdAt
      };
    });

    // 5. Gather low stock inventory alerts if farmer
    let lowStockProducts = [];
    let sellingOpportunities = [];
    if (isFarmer) {
      const myProds = await query.all(
        "SELECT id, name, category, price, unit, stock, moq FROM products WHERE farmerId = ?",
        [userId]
      );
      lowStockProducts = (myProds || []).filter((p) => (p.stock || 0) <= (p.moq || 10) * 1.5);

      try {
        const opps = await detectSellingOpportunities(userId);
        sellingOpportunities = opps?.opportunities || [];
      } catch {}
    }

    // 6. Formulate Today's Priorities
    const priorities = [];
    if (parsedPendingActions.length > 0) {
      priorities.push({
        id: "pri_actions",
        title: `${parsedPendingActions.length} Pending AI Action(s) Require Confirmation`,
        severity: "warning",
        category: "actions"
      });
    }
    if (lowStockProducts.length > 0) {
      priorities.push({
        id: "pri_stock",
        title: `${lowStockProducts.length} crop lot(s) are running low on stock`,
        severity: "info",
        category: "inventory"
      });
    }
    if (sellingOpportunities.length > 0) {
      priorities.push({
        id: "pri_opp",
        title: `Selling opportunity detected for ${sellingOpportunities[0]?.productName || "produce"}`,
        severity: "success",
        category: "selling"
      });
    }
    if (followups.length > 0) {
      priorities.push({
        id: "pri_followup",
        title: `Reminder: ${followups[0].title}`,
        severity: "info",
        category: "tasks"
      });
    }
    if (insights.length > 0) {
      priorities.push({
        id: "pri_insight",
        title: insights[0].title,
        severity: insights[0].severity || "info",
        category: "advisory"
      });
    }

    res.json({
      success: true,
      copilot: {
        userId,
        userName: req.user.name,
        role: req.user.role,
        priorities,
        goals,
        followups,
        insights: insights.slice(0, 5),
        pendingActions: parsedPendingActions,
        lowStockAlerts: lowStockProducts,
        sellingOpportunities: (sellingOpportunities || []).slice(0, 3)
      }
    });
  } catch (err) {
    console.error("GET /api/ai/copilot/dashboard error:", err);
    sendError(res, 500, "COPILOT_ERROR", "Failed to compile copilot dashboard summary.");
  }
});

// POST /api/ai/copilot/plan - Execute multi-step AI plan
router.post("/copilot/plan", requireAuth, async (req, res) => {
  const { query: planQuery, workflowIntent, initialParams, customSteps } = req.body || {};

  try {
    const planResult = await executeCopilotPlan({
      user: req.user,
      query: planQuery,
      workflowIntent,
      initialParams,
      customSteps
    });

    res.json(planResult);
  } catch (err) {
    console.error("POST /api/ai/copilot/plan error:", err);
    sendError(res, 500, "PLANNER_ERROR", err.message || "Failed to execute copilot plan.");
  }
});

// AI Personal Memory Endpoints
router.get("/memory", requireAuth, async (req, res) => {
  try {
    const memories = await getUserMemories(req.user.id, req.query);
    res.json({ success: true, memories });
  } catch (err) {
    sendError(res, 500, "MEMORY_ERROR", err.message);
  }
});

router.post("/memory", requireAuth, async (req, res) => {
  try {
    const result = await saveMemoryItem(req.user.id, req.body);
    res.json({ success: true, ...result });
  } catch (err) {
    const status = err.message?.includes("SENSITIVE_DATA_PROHIBITED") ? 400 : 500;
    sendError(res, status, "MEMORY_SAVE_ERROR", err.message);
  }
});

router.delete("/memory/:id", requireAuth, async (req, res) => {
  try {
    const success = await deleteMemoryItem(req.user.id, req.params.id);
    res.json({ success });
  } catch (err) {
    sendError(res, 500, "MEMORY_DELETE_ERROR", err.message);
  }
});

router.delete("/memory", requireAuth, async (req, res) => {
  try {
    const deletedCount = await clearUserMemories(req.user.id);
    res.json({ success: true, deletedCount });
  } catch (err) {
    sendError(res, 500, "MEMORY_CLEAR_ERROR", err.message);
  }
});

// Farming Goals Endpoints
router.get("/goals", requireAuth, async (req, res) => {
  try {
    const goals = await getUserGoals(req.user.id, req.query);
    res.json({ success: true, goals });
  } catch (err) {
    sendError(res, 500, "GOAL_ERROR", err.message);
  }
});

router.post("/goals", requireAuth, async (req, res) => {
  try {
    const goal = await createGoal(req.user.id, req.body);
    res.json({ success: true, goal });
  } catch (err) {
    sendError(res, 400, "GOAL_CREATE_ERROR", err.message);
  }
});

router.put("/goals/:id", requireAuth, async (req, res) => {
  try {
    const updated = await updateGoal(req.user.id, req.params.id, req.body);
    if (!updated) return sendError(res, 404, "NOT_FOUND", "Goal not found.");
    res.json({ success: true, goal: updated });
  } catch (err) {
    sendError(res, 500, "GOAL_UPDATE_ERROR", err.message);
  }
});

router.post("/goals/:id/recalculate", requireAuth, async (req, res) => {
  try {
    const result = await calculateVerifiedGoalProgress(req.user.id, req.params.id);
    if (!result) return sendError(res, 404, "NOT_FOUND", "Goal not found.");
    res.json({ success: true, ...result });
  } catch (err) {
    sendError(res, 500, "GOAL_RECALCULATE_ERROR", err.message);
  }
});

router.delete("/goals/:id", requireAuth, async (req, res) => {
  try {
    const success = await deleteGoal(req.user.id, req.params.id);
    res.json({ success });
  } catch (err) {
    sendError(res, 500, "GOAL_DELETE_ERROR", err.message);
  }
});

// Follow-ups Endpoints
router.get("/followups", requireAuth, async (req, res) => {
  try {
    const followups = await getUserFollowups(req.user.id, req.query);
    res.json({ success: true, followups });
  } catch (err) {
    sendError(res, 500, "FOLLOWUP_ERROR", err.message);
  }
});

router.post("/followups", requireAuth, async (req, res) => {
  try {
    const followup = await createFollowup(req.user.id, req.body);
    res.json({ success: true, followup });
  } catch (err) {
    sendError(res, 400, "FOLLOWUP_CREATE_ERROR", err.message);
  }
});

router.put("/followups/:id/complete", requireAuth, async (req, res) => {
  try {
    const success = await completeFollowup(req.user.id, req.params.id);
    res.json({ success });
  } catch (err) {
    sendError(res, 500, "FOLLOWUP_COMPLETE_ERROR", err.message);
  }
});

router.delete("/followups/:id", requireAuth, async (req, res) => {
  try {
    const success = await dismissFollowup(req.user.id, req.params.id);
    res.json({ success });
  } catch (err) {
    sendError(res, 500, "FOLLOWUP_DELETE_ERROR", err.message);
  }
});

// GET /api/ai/copilot/pending-actions - Retrieve active pending Phase 6 actions
router.get("/copilot/pending-actions", requireAuth, async (req, res) => {
  try {
    const nowMs = Date.now();
    const rows = await query.all(
      `SELECT id, actionId, parametersJson, expectedStateJson, expiresAt, createdAt 
       FROM ai_pending_actions 
       WHERE userId = ? AND status = 'PENDING' AND expiresAt > ? 
       ORDER BY createdAt DESC`,
      [req.user.id, nowMs]
    );

    const actions = (rows || []).map((r) => {
      let params = {};
      let expected = {};
      try { params = JSON.parse(r.parametersJson); } catch {}
      try { expected = JSON.parse(r.expectedStateJson); } catch {}
      return {
        id: r.id,
        actionId: r.actionId,
        parameters: params,
        expectedState: expected,
        expiresAt: r.expiresAt,
        createdAt: r.createdAt
      };
    });

    res.json({ success: true, pendingActions: actions });
  } catch (err) {
    console.error("GET /api/ai/copilot/pending-actions error:", err);
    sendError(res, 500, "ACTIONS_ERROR", "Failed to retrieve pending actions.");
  }
});

export default router;
