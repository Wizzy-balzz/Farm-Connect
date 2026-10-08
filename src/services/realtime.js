/**
 * Client-Side Real-Time Service using Server-Sent Events (SSE)
 */

let eventSource = null;
const listeners = new Set();

export function subscribeRealtimeEvents(callback) {
  listeners.add(callback);
  
  if (!eventSource) {
    initRealtimeConnection();
  }

  return () => {
    listeners.delete(callback);
    if (listeners.size === 0 && eventSource) {
      eventSource.close();
      eventSource = null;
    }
  };
}

function initRealtimeConnection() {
  try {
    // EventSource connects to SSE endpoint with session cookies
    eventSource = new EventSource("/api/realtime/stream", { withCredentials: true });

    const handleMessage = (event, eventName) => {
      try {
        const parsed = JSON.parse(event.data);
        const payloadData = (parsed && parsed.data !== undefined) ? { ...parsed, ...parsed.data } : parsed;
        listeners.forEach((cb) => {
          try {
            cb({ event: eventName, data: payloadData });
          } catch (cbErr) {
            console.error("Realtime listener error:", cbErr);
          }
        });
      } catch {
        /* ignore parse errors */
      }
    };

    eventSource.addEventListener("new_order", (e) => handleMessage(e, "new_order"));
    eventSource.addEventListener("order_status_change", (e) => handleMessage(e, "order_status_change"));
    eventSource.addEventListener("low_stock", (e) => handleMessage(e, "low_stock"));
    eventSource.addEventListener("new_review", (e) => handleMessage(e, "new_review"));
    eventSource.addEventListener("chat:message", (e) => handleMessage(e, "chat:message"));
    eventSource.addEventListener("chat:read", (e) => handleMessage(e, "chat:read"));

    eventSource.onerror = () => {
      // Reconnect automatically if closed
      if (eventSource && eventSource.readyState === EventSource.CLOSED) {
        eventSource.close();
        eventSource = null;
        setTimeout(() => {
          if (listeners.size > 0) initRealtimeConnection();
        }, 5000);
      }
    };
  } catch (err) {
    console.warn("Real-time stream connection notice:", err.message);
  }
}
