import { query } from "../database.js";
import { executeAiTool } from "./aiTools.js";

function generateId(prefix = "ai") {
  return `${prefix}_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
}

/**
 * Natural Language Marketplace Query Parser
 */
export function parseNaturalMarketplaceQuery(prompt, userLocation = null) {
  if (!prompt || typeof prompt !== "string") return {};

  const lower = prompt.toLowerCase();
  const filters = {
    queryText: "",
    category: "All",
    organic: false,
    maxPrice: null,
    moq: null
  };

  // Organic detection (English / Tamil / Hindi)
  if (lower.includes("organic") || lower.includes("ஆர்கானிக்") || lower.includes("ऑर्गेनिक") || lower.includes("जैविक")) {
    filters.organic = true;
  }

  // Price extraction (e.g. "under 50", "below ₹60", "₹45")
  const priceMatch = lower.match(/(?:under|below|<|₹|\$|rs\.?|inr)?\s*(\d+)\s*(?:rs|inr|₹|\/kg|per kg)?/i);
  if (priceMatch && priceMatch[1]) {
    const pVal = parseInt(priceMatch[1], 10);
    if (pVal > 0 && pVal < 10000) {
      filters.maxPrice = pVal;
    }
  }

  // MOQ extraction
  const moqMatch = lower.match(/moq\s*(?:under|below|<)?\s*(\d+)/i);
  if (moqMatch && moqMatch[1]) {
    filters.moq = parseInt(moqMatch[1], 10);
  }

  // Commodity / Category detection
  if (lower.includes("tomato") || lower.includes("தக்காளி") || lower.includes("टमाटर")) {
    filters.category = "Vegetables";
    filters.queryText = "Tomato";
  } else if (lower.includes("onion") || lower.includes("வெங்காயம்") || lower.includes("प्याज")) {
    filters.category = "Vegetables";
    filters.queryText = "Onion";
  } else if (lower.includes("spinach") || lower.includes("கீரை") || lower.includes("पालक")) {
    filters.category = "Vegetables";
    filters.queryText = "Spinach";
  } else if (lower.includes("rice") || lower.includes("அரிசி") || lower.includes("चावल") || lower.includes("basmati")) {
    filters.category = "Grains";
    filters.queryText = "Rice";
  } else if (lower.includes("wheat") || lower.includes("கோதுமை") || lower.includes("गेहूं")) {
    filters.category = "Grains";
    filters.queryText = "Wheat";
  } else if (lower.includes("pepper") || lower.includes("மிளகு") || lower.includes("मिर्च")) {
    filters.category = "Spices";
    filters.queryText = "Pepper";
  } else if (lower.includes("vegetable") || lower.includes("காய்கறி") || lower.includes("सब्जी")) {
    filters.category = "Vegetables";
  } else if (lower.includes("grain") || lower.includes("தானியம்") || lower.includes("अनाज")) {
    filters.category = "Grains";
  } else if (lower.includes("spice") || lower.includes("மசாலா") || lower.includes("मसाला")) {
    filters.category = "Spices";
  }

  return filters;
}

/**
 * Handle AI Assistant Conversation Chat
 */
export async function processAiChat({ user, prompt, conversationId = null, lang = "en" }) {
  if (!user || !user.id) {
    throw new Error("UNAUTHENTICATED: Authentication required for FarmConnect AI.");
  }

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    throw new Error("INVALID_INPUT: Chat prompt cannot be empty.");
  }

  const now = new Date().toISOString();

  // 1. Resolve or create AI conversation
  let activeConvId = conversationId;
  if (!activeConvId) {
    activeConvId = generateId("conv");
    const title = prompt.trim().substring(0, 40) + (prompt.length > 40 ? "..." : "");
    await query.run(
      "INSERT INTO ai_conversations (id, userId, title, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)",
      [activeConvId, user.id, title, now, now]
    );
  } else {
    // Verify conversation ownership
    const conv = await query.get("SELECT * FROM ai_conversations WHERE id = ? AND userId = ?", [activeConvId, user.id]);
    if (!conv) {
      activeConvId = generateId("conv");
      const title = prompt.trim().substring(0, 40) + "...";
      await query.run(
        "INSERT INTO ai_conversations (id, userId, title, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)",
        [activeConvId, user.id, title, now, now]
      );
    }
  }

  // 2. Save user message in SQLite database
  const userMsgId = generateId("msg");
  await query.run(
    "INSERT INTO ai_messages (id, conversationId, role, content, createdAt) VALUES (?, ?, 'user', ?, ?)",
    [userMsgId, activeConvId, prompt.trim(), now]
  );

  // 3. Determine tool intent and execute backend tool
  let toolName = null;
  let toolResult = null;
  let responseText = "";
  let actionSuggestion = null;

  const lowerPrompt = prompt.toLowerCase();
  const role = user.role;

  try {
    // Intent Routing based on Role and Query keywords
    if (role === "farmer") {
      if (lowerPrompt.includes("selling fastest") || lowerPrompt.includes("top products") || lowerPrompt.includes("revenue") || lowerPrompt.includes("sales") || lowerPrompt.includes("விற்பனை")) {
        toolName = "getMySales";
        toolResult = await executeAiTool(user, "getMySales");
        responseText = `Here is your current sales performance summary:\n- Total Revenue: ₹${toolResult.revenue.toLocaleString()}\n- Total Completed Orders: ${toolResult.orders}\n- Total Quantity Sold: ${toolResult.quantitySold} units`;
      } else if (lowerPrompt.includes("stock") || lowerPrompt.includes("low stock") || lowerPrompt.includes("restock") || lowerPrompt.includes("இருப்பு")) {
        toolName = "getMyInventory";
        toolResult = await executeAiTool(user, "getMyInventory");
        const lowStockList = toolResult.filter(p => p.stock <= (p.moq || 10));
        if (lowStockList.length > 0) {
          responseText = `⚠️ Warning: You have ${lowStockList.length} products running low on stock:\n` + lowStockList.map(p => `- ${p.name}: ${p.stock} ${p.unit} remaining (MOQ: ${p.moq})`).join("\n");
        } else {
          responseText = `All your products are currently well-stocked. You have ${toolResult.length} active listed produce lots.`;
        }
        actionSuggestion = { type: "NAVIGATE", path: "/farmer/products", label: "View My Products" };
      } else if (lowerPrompt.includes("order") || lowerPrompt.includes("pending") || lowerPrompt.includes("ஆர்டர்")) {
        toolName = "getMyOrders";
        toolResult = await executeAiTool(user, "getMyOrders");
        const pending = toolResult.filter(o => o.status === "Pending");
        responseText = `You currently have ${pending.length} pending order(s) awaiting processing out of ${toolResult.length} total orders.`;
        actionSuggestion = { type: "NAVIGATE", path: "/farmer/orders", label: "Open Farmer Orders" };
      } else if (lowerPrompt.includes("price") || lowerPrompt.includes("underpriced") || lowerPrompt.includes("விலை")) {
        toolName = "getPriceInsights";
        toolResult = await executeAiTool(user, "getPriceInsights");
        responseText = `🌱 FarmConnect Price Insights:\n- Recommended Price Range: ${toolResult.recommendedRange}\n- Platform Average: ${toolResult.platformAverage}\n- Confidence: ${toolResult.confidence}\n(${toolResult.basis})`;
      } else {
        toolName = "getMyInventory";
        toolResult = await executeAiTool(user, "getMyInventory");
        responseText = `Hello ${user.name}! I am your FarmConnect AI Assistant. You have ${toolResult.length} produce lots currently listed on the marketplace. How can I help with your inventory or sales today?`;
      }
    } else if (role === "vendor") {
      if (lowerPrompt.includes("find") || lowerPrompt.includes("search") || lowerPrompt.includes("tomato") || lowerPrompt.includes("rice") || lowerPrompt.includes("onion") || lowerPrompt.includes("ஆர்கானிக்") || lowerPrompt.includes("தக்காளி")) {
        toolName = "searchProducts";
        const parsed = parseNaturalMarketplaceQuery(prompt);
        toolResult = await executeAiTool(user, "searchProducts", parsed);
        if (toolResult.length > 0) {
          responseText = `Found ${toolResult.length} matching produce options on the marketplace:\n` + toolResult.slice(0, 3).map(p => `- ${p.name}: ₹${p.price}/${p.unit} (Stock: ${p.stock} ${p.unit})`).join("\n");
          actionSuggestion = { type: "APPLY_FILTER", filters: parsed, label: "View Matching Results in Marketplace" };
        } else {
          responseText = "No exact matches were found for your search criteria. Try broadening your price range or location filters.";
        }
      } else if (lowerPrompt.includes("order") || lowerPrompt.includes("purchases") || lowerPrompt.includes("history") || lowerPrompt.includes("ஆர்டர்")) {
        toolName = "getMyOrders";
        toolResult = await executeAiTool(user, "getMyOrders");
        responseText = `You have placed ${toolResult.length} B2B procurement orders. Your recent purchases include ${toolResult.slice(0, 2).map(o => o.id + ' (' + o.status + ')').join(', ')}.`;
        actionSuggestion = { type: "NAVIGATE", path: "/vendor/orders", label: "View Order History" };
      } else if (lowerPrompt.includes("compare") || lowerPrompt.includes("cheapest") || lowerPrompt.includes("rated")) {
        toolName = "searchProducts";
        toolResult = await executeAiTool(user, "searchProducts", { category: "Vegetables" });
        const sorted = [...toolResult].sort((a, b) => a.price - b.price);
        responseText = `Here are the top competitive suppliers on FarmConnect:\n` + sorted.slice(0, 3).map(p => `- ${p.name}: ₹${p.price}/${p.unit}`).join("\n");
      } else {
        toolName = "searchProducts";
        toolResult = await executeAiTool(user, "searchProducts", {});
        responseText = `Hello ${user.name}! I am your FarmConnect B2B Sourcing AI. There are currently ${toolResult.length} active harvest lots available. What produce are you looking to procure today?`;
      }
    } else if (role === "admin") {
      toolName = "getPlatformAnalytics";
      toolResult = await executeAiTool(user, "getPlatformAnalytics");
      responseText = `📊 Platform Governance Executive Summary:\n- Total Users: ${toolResult.users} (${toolResult.farmers} Farmers, ${toolResult.vendors} Buyers)\n- Active Product Listings: ${toolResult.products}\n- Total Orders Executed: ${toolResult.orders}\n- Settled Trade Volume: ₹${toolResult.deliveredRevenue.toLocaleString()}`;
    } else {
      responseText = "Hello! I am FarmConnect AI. How can I assist you with your agricultural trade today?";
    }
  } catch (err) {
    console.error("AI Assistant execution error:", err);
    responseText = "FarmConnect AI is temporarily unavailable. You can continue using FarmConnect normally.";
  }

  // 4. Save AI assistant response message in SQLite database
  const aiMsgId = generateId("msg");
  await query.run(
    "INSERT INTO ai_messages (id, conversationId, role, content, toolName, toolResult, createdAt) VALUES (?, ?, 'assistant', ?, ?, ?, ?)",
    [aiMsgId, activeConvId, responseText, toolName || null, toolResult ? JSON.stringify(toolResult) : null, new Date().toISOString()]
  );

  // Update conversation timestamp
  await query.run("UPDATE ai_conversations SET updatedAt = ? WHERE id = ?", [new Date().toISOString(), activeConvId]);

  return {
    conversationId: activeConvId,
    message: {
      id: aiMsgId,
      role: "assistant",
      content: responseText,
      toolName,
      toolResult,
      actionSuggestion,
      createdAt: new Date().toISOString()
    }
  };
}
