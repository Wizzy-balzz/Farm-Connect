import { query } from "../database.js";

// Active client SSE connections map: userId -> Set of Response objects
const activeClients = new Map();

/**
 * Handle SSE Stream Connection for authenticated user
 */
export function handleSseStream(req, res) {
  const user = req.user;
  if (!user || !user.id) {
    return res.status(401).json({ error: "Authentication required for real-time stream." });
  }

  const userId = user.id;

  // Set SSE response headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no" // Disable proxy buffering for instant delivery
  });

  res.write(`event: connected\ndata: ${JSON.stringify({ message: "Connected to FarmConnect Real-Time Stream", userId })}\n\n`);

  if (!activeClients.has(userId)) {
    activeClients.set(userId, new Set());
  }
  activeClients.get(userId).add(res);

  // Keep-alive heartbeat every 20 seconds to prevent timeout
  const heartbeatTimer = setInterval(() => {
    try {
      res.write(": heartbeat\n\n");
    } catch {
      clearInterval(heartbeatTimer);
    }
  }, 20000);

  // Clean up on disconnect
  req.on("close", () => {
    clearInterval(heartbeatTimer);
    if (activeClients.has(userId)) {
      const userConnections = activeClients.get(userId);
      userConnections.delete(res);
      if (userConnections.size === 0) {
        activeClients.delete(userId);
      }
    }
  });
}

/**
 * Broadcast real-time event to specific user
 */
export async function broadcastEventToUser(userId, eventName, data) {
  if (!userId) return;

  const eventPayload = {
    id: `ev_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`,
    userId,
    event: eventName,
    data,
    createdAt: new Date().toISOString()
  };

  // 1. Store event in SQLite database for history/audit
  try {
    await query.run(
      "INSERT INTO real_time_events (id, userId, event, data, `read`, createdAt) VALUES (?, ?, ?, ?, 0, ?)",
      [eventPayload.id, userId, eventName, JSON.stringify(data), eventPayload.createdAt]
    );
  } catch (err) {
    console.error("Failed to store real-time event:", err);
  }

  // 2. Broadcast immediately over active SSE streams
  if (activeClients.has(userId)) {
    const connections = activeClients.get(userId);
    const sseFormatted = `event: ${eventName}\ndata: ${JSON.stringify(eventPayload)}\n\n`;

    for (const clientRes of connections) {
      try {
        clientRes.write(sseFormatted);
      } catch (err) {
        console.error("Failed to write to client SSE stream:", err);
      }
    }
  }
}

/**
 * Broadcast real-time event to all users matching a specific role
 */
export async function broadcastEventToRole(role, eventName, data) {
  try {
    const users = await query.all("SELECT id FROM users WHERE role = ?", [role]);
    for (const u of users) {
      await broadcastEventToUser(u.id, eventName, data);
    }
  } catch (err) {
    console.error("Failed to broadcast role event:", err);
  }
}
