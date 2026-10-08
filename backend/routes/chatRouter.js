import express from "express";
import { query } from "../database.js";
import { requireAuth } from "../middleware/auth.js";
import { broadcastEventToUser } from "../services/realtimeService.js";

const router = express.Router();

function generateId(prefix = "c") {
  return `${prefix}_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
}

function sendError(res, statusCode, code, message) {
  return res.status(statusCode).json({
    success: false,
    error: { code, message }
  });
}

// GET /api/conversations (List user's active conversations)
router.get("/", requireAuth, async (req, res) => {
  const userId = req.user.id;

  try {
    const rawConvs = await query.all(
      `SELECT c.*, 
        p.name as productName, p.price as productPrice, p.unit as productUnit, p.imageUrl as productImg,
        o.totalAmount as orderTotal, o.status as orderStatus
       FROM conversations c
       LEFT JOIN products p ON c.productId = p.id
       LEFT JOIN orders o ON c.orderId = o.id
       WHERE c.farmerId = ? OR c.vendorId = ?
       ORDER BY c.updatedAt DESC`,
      [userId, userId]
    );

    const conversations = [];

    for (const c of rawConvs) {
      const counterpartyId = c.farmerId === userId ? c.vendorId : c.farmerId;
      const counterparty = await query.get(
        "SELECT id, name, role, farmName, region, rating FROM users WHERE id = ?",
        [counterpartyId]
      );

      const lastMsg = await query.get(
        "SELECT * FROM messages WHERE conversationId = ? ORDER BY createdAt DESC LIMIT 1",
        [c.id]
      );

      const unreadCountRow = await query.get(
        "SELECT COUNT(*) as unread FROM messages WHERE conversationId = ? AND senderId != ? AND isRead = 0",
        [c.id, userId]
      );

      conversations.push({
        id: c.id,
        farmerId: c.farmerId,
        vendorId: c.vendorId,
        productId: c.productId,
        orderId: c.orderId,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        counterparty: counterparty || { id: counterpartyId, name: "User" },
        product: c.productId ? { id: c.productId, name: c.productName, price: c.productPrice, unit: c.productUnit, imageUrl: c.productImg } : null,
        order: c.orderId ? { id: c.orderId, totalAmount: c.orderTotal, status: c.orderStatus } : null,
        lastMessage: lastMsg || null,
        unreadCount: unreadCountRow ? unreadCountRow.unread : 0
      });
    }

    res.json({ success: true, conversations });
  } catch (err) {
    console.error("Fetch conversations error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to fetch conversations.");
  }
});

// POST /api/conversations (Find or create conversation)
router.post("/", requireAuth, async (req, res) => {
  let { farmerId, vendorId, productId, orderId } = req.body || {};

  try {
    // If orderId is provided, look up participants from orders and order_items if not explicitly given
    if (orderId) {
      if (!vendorId) {
        const orderRow = await query.get("SELECT vendorId FROM orders WHERE id = ?", [orderId]);
        if (orderRow) vendorId = orderRow.vendorId;
      }
      if (!farmerId) {
        const itemRow = await query.get("SELECT farmerId FROM order_items WHERE orderId = ? LIMIT 1", [orderId]);
        if (itemRow) farmerId = itemRow.farmerId;
      }
    }

    // If productId is provided, look up farmerId from products if not explicitly given
    if (productId && !farmerId) {
      const prodRow = await query.get("SELECT farmerId FROM products WHERE id = ?", [productId]);
      if (prodRow) farmerId = prodRow.farmerId;
    }

    // Determine identity safely from user role
    if (req.user.role === "farmer") {
      farmerId = req.user.id;
    } else if (req.user.role === "vendor") {
      vendorId = req.user.id;
    }

    if (!farmerId || !vendorId) {
      return sendError(res, 400, "INVALID_INPUT", "Both farmerId and vendorId are required.");
    }

    if (farmerId === vendorId) {
      return sendError(res, 400, "INVALID_INPUT", "Cannot start a conversation with yourself.");
    }
    // Check if matching conversation already exists
    let existing = null;
    if (productId) {
      existing = await query.get(
        "SELECT * FROM conversations WHERE farmerId = ? AND vendorId = ? AND productId = ?",
        [farmerId, vendorId, productId]
      );
    } else if (orderId) {
      existing = await query.get(
        "SELECT * FROM conversations WHERE farmerId = ? AND vendorId = ? AND orderId = ?",
        [farmerId, vendorId, orderId]
      );
    } else {
      existing = await query.get(
        "SELECT * FROM conversations WHERE farmerId = ? AND vendorId = ?",
        [farmerId, vendorId]
      );
    }

    if (existing) {
      return res.json({ success: true, conversation: existing, created: false });
    }

    const now = new Date().toISOString();
    const convId = generateId("conv");

    await query.run(
      `INSERT INTO conversations (id, farmerId, vendorId, productId, orderId, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [convId, farmerId, vendorId, productId || null, orderId || null, now, now]
    );

    const created = await query.get("SELECT * FROM conversations WHERE id = ?", [convId]);
    res.status(201).json({ success: true, conversation: created, created: true });
  } catch (err) {
    console.error("Create conversation error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to create conversation.");
  }
});

// GET /api/conversations/:id (Fetch single conversation details with membership verification)
router.get("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const conv = await query.get("SELECT * FROM conversations WHERE id = ?", [id]);
    if (!conv) {
      return sendError(res, 404, "NOT_FOUND", "Conversation not found.");
    }

    if (conv.farmerId !== userId && conv.vendorId !== userId && req.user.role !== "admin") {
      return sendError(res, 403, "FORBIDDEN", "You are not authorized to view this conversation.");
    }

    const counterpartyId = conv.farmerId === userId ? conv.vendorId : conv.farmerId;
    const counterparty = await query.get(
      "SELECT id, name, role, farmName, region, rating FROM users WHERE id = ?",
      [counterpartyId]
    );

    let product = null;
    if (conv.productId) {
      product = await query.get("SELECT id, name, price, unit, stock, imageUrl FROM products WHERE id = ?", [conv.productId]);
    }

    let order = null;
    if (conv.orderId) {
      order = await query.get("SELECT id, totalAmount, currency, status, createdAt FROM orders WHERE id = ?", [conv.orderId]);
    }

    res.json({
      success: true,
      conversation: {
        ...conv,
        counterparty: counterparty || { id: counterpartyId, name: "User" },
        product,
        order
      }
    });
  } catch (err) {
    console.error("Get conversation error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to fetch conversation.");
  }
});

// GET /api/conversations/:id/messages (Fetch messages history)
router.get("/:id/messages", requireAuth, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const conv = await query.get("SELECT * FROM conversations WHERE id = ?", [id]);
    if (!conv) {
      return sendError(res, 404, "NOT_FOUND", "Conversation not found.");
    }

    if (conv.farmerId !== userId && conv.vendorId !== userId && req.user.role !== "admin") {
      return sendError(res, 403, "FORBIDDEN", "You are not authorized to view messages in this conversation.");
    }

    const messages = await query.all(
      "SELECT * FROM messages WHERE conversationId = ? ORDER BY createdAt ASC",
      [id]
    );

    res.json({ success: true, messages });
  } catch (err) {
    console.error("Fetch messages error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to fetch messages.");
  }
});

// POST /api/conversations/:id/messages (Send message)
router.post("/:id/messages", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { message, messageType = "text", productId, orderId } = req.body || {};
  const senderId = req.user.id;

  if (!message || !message.trim()) {
    return sendError(res, 400, "INVALID_INPUT", "Message text cannot be empty.");
  }

  try {
    const conv = await query.get("SELECT * FROM conversations WHERE id = ?", [id]);
    if (!conv) {
      return sendError(res, 404, "NOT_FOUND", "Conversation not found.");
    }

    if (conv.farmerId !== senderId && conv.vendorId !== senderId) {
      return sendError(res, 403, "FORBIDDEN", "You are not a participant in this conversation.");
    }

    const recipientId = conv.farmerId === senderId ? conv.vendorId : conv.farmerId;

    // Check if sender is blocked by recipient
    const isBlocked = await query.get(
      "SELECT id FROM blocked_users WHERE userId = ? AND blockedUserId = ?",
      [recipientId, senderId]
    );

    if (isBlocked) {
      return sendError(res, 403, "BLOCKED", "You cannot send messages to this user.");
    }

    const now = new Date().toISOString();
    const msgId = generateId("msg");

    await query.run(
      `INSERT INTO messages (id, conversationId, senderId, message, messageType, isRead, status, productId, orderId, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, 0, 'delivered', ?, ?, ?, ?)`,
      [msgId, id, senderId, message.trim(), messageType, productId || null, orderId || null, now, now]
    );

    // Update conversation updatedAt timestamp
    await query.run("UPDATE conversations SET updatedAt = ? WHERE id = ?", [now, id]);

    const createdMsg = await query.get("SELECT * FROM messages WHERE id = ?", [msgId]);

    // Broadcast real-time SSE event to recipient
    broadcastEventToUser(recipientId, "chat:message", {
      conversationId: id,
      message: createdMsg,
      senderName: req.user.name
    });

    res.status(201).json({ success: true, message: createdMsg });
  } catch (err) {
    console.error("Send message error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to send message.");
  }
});

// PUT /api/conversations/:id/read (Mark messages as read)
router.put("/:id/read", requireAuth, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const conv = await query.get("SELECT * FROM conversations WHERE id = ?", [id]);
    if (!conv) {
      return sendError(res, 404, "NOT_FOUND", "Conversation not found.");
    }

    if (conv.farmerId !== userId && conv.vendorId !== userId) {
      return sendError(res, 403, "FORBIDDEN", "You are not authorized.");
    }

    await query.run(
      "UPDATE messages SET isRead = 1, status = 'read' WHERE conversationId = ? AND senderId != ?",
      [id, userId]
    );

    const recipientId = conv.farmerId === userId ? conv.vendorId : conv.farmerId;
    broadcastEventToUser(recipientId, "chat:read", { conversationId: id, readBy: userId });

    res.json({ success: true, message: "Messages marked as read." });
  } catch (err) {
    console.error("Mark read error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to mark messages as read.");
  }
});

// POST /api/conversations/:id/block (Block user)
router.post("/:id/block", requireAuth, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const conv = await query.get("SELECT * FROM conversations WHERE id = ?", [id]);
    if (!conv) {
      return sendError(res, 404, "NOT_FOUND", "Conversation not found.");
    }

    const targetUserId = conv.farmerId === userId ? conv.vendorId : conv.farmerId;
    const blockId = generateId("blk");

    await query.run(
      "INSERT IGNORE INTO blocked_users (id, userId, blockedUserId, createdAt) VALUES (?, ?, ?, ?)",
      [blockId, userId, targetUserId, new Date().toISOString()]
    );

    res.json({ success: true, message: "User blocked successfully." });
  } catch (err) {
    console.error("Block user error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to block user.");
  }
});

// POST /api/conversations/:id/report (Report conversation)
router.post("/:id/report", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body || {};
  const userId = req.user.id;

  try {
    const reportId = generateId("rep");
    await query.run(
      "INSERT INTO message_reports (id, conversationId, reportedBy, reason, status, createdAt) VALUES (?, ?, ?, ?, 'pending', ?)",
      [reportId, id, userId, reason || "Inappropriate conduct", new Date().toISOString()]
    );

    res.json({ success: true, message: "Report submitted successfully." });
  } catch (err) {
    console.error("Report conversation error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to submit report.");
  }
});

// POST /api/ai/suggest-reply (AI draft reply generator)
router.post("/suggest-reply", requireAuth, async (req, res) => {
  const { conversationId, lastMessage } = req.body || {};

  try {
    let contextText = "Yes, I can supply your requested order quantity promptly.";

    if (conversationId) {
      const conv = await query.get("SELECT * FROM conversations WHERE id = ?", [conversationId]);
      if (conv && conv.productId) {
        const product = await query.get("SELECT name, price, unit, stock FROM products WHERE id = ?", [conv.productId]);
        if (product) {
          contextText = `Yes, I currently have ${product.stock} ${product.unit} of ${product.name} available at ₹${product.price}/${product.unit}.`;
        }
      }
    }

    res.json({
      success: true,
      suggestedReply: contextText
    });
  } catch (err) {
    console.error("Suggest reply error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to generate suggested reply.");
  }
});

export default router;
