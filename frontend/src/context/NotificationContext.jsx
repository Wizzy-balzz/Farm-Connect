/* eslint-disable react-refresh/only-export-components */
import { createContext, useEffect, useMemo, useCallback, useReducer } from "react";
import { uid } from "../utils/formatters.js";
import { useAuth } from "../hooks/useAuth.js";
import { apiFetch } from "../services/api.js";
import { subscribeRealtimeEvents } from "../services/realtime.js";
import { ToastStack } from "../components/common/Toast.jsx";

export const NotificationContext = createContext(null);

const initialState = {
  notifications: [],
  toasts: [],
};

function notificationReducer(state, action) {
  switch (action.type) {
    case "SET_NOTIFICATIONS":
      return { ...state, notifications: action.payload };
    case "ADD_NOTIFICATION":
      return { ...state, notifications: [action.payload, ...state.notifications] };
    case "MARK_ALL_READ":
      return {
        ...state,
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
      };
    case "ADD_TOAST":
      return { ...state, toasts: [...state.toasts, action.payload] };
    case "DISMISS_TOAST":
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.payload),
      };
    default:
      return state;
  }
}

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [state, dispatch] = useReducer(notificationReducer, initialState);

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      dispatch({ type: "SET_NOTIFICATIONS", payload: [] });
      return;
    }
    try {
      const data = await apiFetch("/api/notifications");
      if (Array.isArray(data)) {
        dispatch({ type: "SET_NOTIFICATIONS", payload: data });
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Subscribe to real-time SSE stream events
  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeRealtimeEvents(({ event, data }) => {
      fetchNotifications();

      if (event === "new_order") {
        const msg = `🔔 New Order ${data.orderId}: ${data.qty} ${data.unit} of ${data.productName} from ${data.vendorName}!`;
        const id = uid("toast");
        dispatch({ type: "ADD_TOAST", payload: { id, text: msg, variant: "success" } });
      } else if (event === "order_status_change") {
        const msg = `📦 Order ${data.orderId} status changed to ${data.status}`;
        const id = uid("toast");
        dispatch({ type: "ADD_TOAST", payload: { id, text: msg, variant: "info" } });
      } else if (event === "low_stock") {
        const msg = `⚠️ Low stock warning for ${data.productName} (${data.remainingStock} remaining)`;
        const id = uid("toast");
        dispatch({ type: "ADD_TOAST", payload: { id, text: msg, variant: "warning" } });
      } else if (event === "chat:message") {
        // Only show toast if user is not already looking at the chat page for that conversation
        if (window.location.pathname.indexOf("/chat") === -1) {
          const sender = data.senderName || "New message";
          const snippet = data.message?.message ? (data.message.message.length > 50 ? `${data.message.message.substring(0, 50)}...` : data.message.message) : "Sent an attachment";
          const id = uid("toast");
          dispatch({ type: "ADD_TOAST", payload: { id, text: `💬 ${sender}: ${snippet}`, variant: "info" } });
        }
      }
    });

    return () => unsubscribe();
  }, [user, fetchNotifications]);

  const addNotification = useCallback(
    async (text, type = "system") => {
      if (!user) return;
      try {
        const newNotif = await apiFetch("/api/notifications", {
          method: "POST",
          body: JSON.stringify({ userId: user.id, text, type }),
        });
        if (newNotif) {
          dispatch({ type: "ADD_NOTIFICATION", payload: newNotif });
        }
      } catch (err) {
        console.error("Failed to add notification:", err);
      }
    },
    [user]
  );

  const markAllRead = useCallback(async () => {
    if (!user) return;
    try {
      await apiFetch("/api/notifications/read-all", {
        method: "PUT"
      });
      dispatch({ type: "MARK_ALL_READ" });
    } catch (err) {
      console.error("Failed to mark all read:", err);
    }
  }, [user]);

  const addToast = useCallback((text, variant = "success") => {
    const id = uid("toast");
    dispatch({ type: "ADD_TOAST", payload: { id, text, variant } });
    return id;
  }, []);

  const dismissToast = useCallback((id) => {
    dispatch({ type: "DISMISS_TOAST", payload: id });
  }, []);

  const notifySuccess = useCallback(
    (text, alsoAsNotification = false) => {
      addToast(text, "success");
      if (alsoAsNotification && user) addNotification(text, "order");
    },
    [addToast, addNotification, user]
  );

  const notifyError = useCallback(
    (text) => addToast(text, "error"),
    [addToast]
  );

  const value = useMemo(
    () => ({
      notifications: state.notifications,
      toasts: state.toasts,
      addNotification,
      markAllRead,
      addToast,
      dismissToast,
      notifySuccess,
      notifyError,
    }),
    [
      state.notifications,
      state.toasts,
      addNotification,
      markAllRead,
      addToast,
      dismissToast,
      notifySuccess,
      notifyError,
    ]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <ToastStack />
    </NotificationContext.Provider>
  );
}
