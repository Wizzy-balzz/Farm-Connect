import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth.js";
import { useNotifications } from "../../hooks/useNotifications.js";
import { apiFetch } from "../../services/api.js";
import { subscribeRealtimeEvents } from "../../services/realtime.js";
import { Button } from "../../components/common/Button.jsx";
import { Card } from "../../components/common/Card.jsx";
import { Badge } from "../../components/common/Badge.jsx";
import { Avatar } from "../../components/common/Avatar.jsx";
import { SearchBox } from "../../components/common/SearchBar.jsx";
import { Modal } from "../../components/common/Modal.jsx";
import { Sprout, Check, Search, ArrowLeft } from "../../components/icons/Icons.jsx";

function ChatPageBase() {
  const { user } = useAuth();
  const { notifySuccess, notifyError } = useNotifications();
  const navigate = useNavigate();
  const { conversationId: urlConvId } = useParams();

  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(urlConvId || null);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [suggestingAi, setSuggestingAi] = useState(false);

  // Modals & Menu states
  const [shareProductModalOpen, setShareProductModalOpen] = useState(false);
  const [myProducts, setMyProducts] = useState([]);
  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch list of user conversations
  const fetchConversations = useCallback(async () => {
    try {
      const data = await apiFetch("/api/conversations");
      if (data && data.conversations) {
        setConversations(data.conversations);
      }
    } catch (err) {
      console.error("Failed to load conversations:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Load specific conversation details & messages
  const loadActiveConversation = useCallback(async (convId) => {
    if (!convId) return;

    try {
      const [convData, msgData] = await Promise.all([
        apiFetch(`/api/conversations/${convId}`),
        apiFetch(`/api/conversations/${convId}/messages`)
      ]);

      if (convData && convData.conversation) {
        setActiveConv(convData.conversation);
      }

      if (msgData && msgData.messages) {
        setMessages(msgData.messages);
      }

      // Mark messages as read
      apiFetch(`/api/conversations/${convId}/read`, { method: "PUT" }).catch(() => {});
      fetchConversations();
    } catch (err) {
      console.error("Failed to load conversation details:", err);
      notifyError("Failed to open conversation.");
    }
  }, [fetchConversations, notifyError]);

  useEffect(() => {
    if (urlConvId) {
      setActiveConvId(urlConvId);
      loadActiveConversation(urlConvId);
    } else if (conversations.length > 0 && !activeConvId) {
      setActiveConvId(conversations[0].id);
      loadActiveConversation(conversations[0].id);
    }
  }, [urlConvId, conversations, activeConvId, loadActiveConversation]);

  // Real-time SSE stream events subscription
  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeRealtimeEvents(({ event, data }) => {
      if (event === "chat:message") {
        if (data.conversationId === activeConvId) {
          setMessages((prev) => [...prev, data.message]);
          apiFetch(`/api/conversations/${activeConvId}/read`, { method: "PUT" }).catch(() => {});
        }
        fetchConversations();
      } else if (event === "chat:read") {
        if (data.conversationId === activeConvId) {
          setMessages((prev) =>
            prev.map((m) => ({ ...m, isRead: 1, status: "read" }))
          );
        }
      }
    });

    return () => unsubscribe();
  }, [user, activeConvId, fetchConversations]);

  // Send new message
  const handleSendMessage = async (customText = null, customType = "text", customProdId = null) => {
    const textToSend = customText || inputText;
    if (!textToSend || !textToSend.trim() || !activeConvId || sending) return;

    setSending(true);
    try {
      const data = await apiFetch(`/api/conversations/${activeConvId}/messages`, {
        method: "POST",
        body: JSON.stringify({
          message: textToSend.trim(),
          messageType: customType,
          productId: customProdId
        })
      });

      if (data && data.message) {
        setMessages((prev) => [...prev, data.message]);
        if (!customText) setInputText("");
        fetchConversations();
      }
    } catch (err) {
      console.error("Send message error:", err);
      notifyError("Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  // AI Suggest Reply draft generator
  const handleAiSuggestReply = async () => {
    if (!activeConvId || suggestingAi) return;

    setSuggestingAi(true);
    try {
      const lastMsg = messages.length > 0 ? messages[messages.length - 1].message : "";
      const data = await apiFetch("/api/conversations/suggest-reply", {
        method: "POST",
        body: JSON.stringify({ conversationId: activeConvId, lastMessage: lastMsg })
      });

      if (data && data.suggestedReply) {
        setInputText(data.suggestedReply);
        notifySuccess("AI suggested draft loaded. Edit or click Send!");
      }
    } catch {
      notifyError("Failed to generate AI suggestion.");
    } finally {
      setSuggestingAi(false);
    }
  };

  // Block counterparty user
  const handleBlockUser = async () => {
    if (!activeConvId) return;
    try {
      await apiFetch(`/api/conversations/${activeConvId}/block`, { method: "POST" });
      notifySuccess("User blocked successfully.");
      setOptionsMenuOpen(false);
    } catch {
      notifyError("Failed to block user.");
    }
  };

  // Report conversation
  const handleReportConversation = async () => {
    if (!activeConvId) return;
    try {
      await apiFetch(`/api/conversations/${activeConvId}/report`, {
        method: "POST",
        body: JSON.stringify({ reason: "Inappropriate communication" })
      });
      notifySuccess("Conversation reported to admin.");
      setOptionsMenuOpen(false);
    } catch {
      notifyError("Failed to report conversation.");
    }
  };

  // Fetch my products to share in chat
  const fetchMyProducts = async () => {
    try {
      const data = await apiFetch("/api/products");
      if (Array.isArray(data)) {
        setMyProducts(data.filter((p) => String(p.farmerId) === String(user.id)));
      }
    } catch {
      /* ignore fetch error */
    }
  };

  // Filter conversations list by search query
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter(
      (c) =>
        c.counterparty?.name?.toLowerCase().includes(q) ||
        c.product?.name?.toLowerCase().includes(q) ||
        c.lastMessage?.message?.toLowerCase().includes(q)
    );
  }, [conversations, searchQuery]);

  return (
    <div className="fc-page-transition" style={{ height: "calc(100vh - 120px)", display: "flex", flexDirection: "column" }}>
      {/* Page Header */}
      <div style={{ marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "24px", fontWeight: 800, margin: 0, color: "var(--text)" }}>
            💬 Real-Time Direct Messaging
          </h1>
          <p className="fc-soft" style={{ fontSize: "13px", margin: "2px 0 0 0" }}>
            Direct B2B communication between verified farmers and commercial buyers.
          </p>
        </div>
      </div>

      {/* Main Chat Shell Container */}
      <div
        className="fc-panel"
        style={{
          flex: 1,
          display: "flex",
          overflow: "hidden",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border)",
          background: "var(--surface)"
        }}
      >
        {/* LEFT PANEL: Conversations List */}
        <div
          style={{
            width: "340px",
            borderRight: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            background: "var(--bg-soft)",
            ...(activeConvId && window.innerWidth < 768 ? { display: "none" } : {})
          }}
        >
          {/* Search Box Header */}
          <div style={{ padding: "14px", borderBottom: "1px solid var(--border)" }}>
            <SearchBox
              value={searchQuery}
              onChange={(val) => setSearchQuery(val)}
              placeholder="Search messages or contacts..."
              style={{ width: "100%" }}
            />
          </div>

          {/* Conversations List */}
          <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
            {filteredConversations.length === 0 ? (
              <div style={{ padding: "24px", textAlign: "center" }} className="fc-muted">
                <p style={{ fontSize: "13px", margin: 0 }}>No conversations found.</p>
              </div>
            ) : (
              filteredConversations.map((c) => (
                <div
                  key={c.id}
                  onClick={() => {
                    setActiveConvId(c.id);
                    navigate(`/chat/${c.id}`);
                  }}
                  style={{
                    padding: "12px 14px",
                    borderRadius: "var(--radius-sm)",
                    marginBottom: "4px",
                    cursor: "pointer",
                    background: c.id === activeConvId ? "var(--brand-light)" : "transparent",
                    border: c.id === activeConvId ? "1px solid var(--brand)" : "1px solid transparent",
                    transition: "all 0.15s ease",
                    display: "flex",
                    gap: "12px",
                    alignItems: "center"
                  }}
                >
                  <Avatar name={c.counterparty?.name || "User"} role={c.counterparty?.role} size="md" />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ fontWeight: 700, fontSize: "13.5px", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {c.counterparty?.name || "User"}
                      </span>
                      {c.lastMessage && (
                        <span className="fc-soft" style={{ fontSize: "10.5px" }}>
                          {new Date(c.lastMessage.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2px" }}>
                      <span className="fc-soft" style={{ fontSize: "12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {c.lastMessage ? c.lastMessage.message : "Tap to view conversation"}
                      </span>
                      {c.unreadCount > 0 && (
                        <Badge variant="success" style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "999px" }}>
                          {c.unreadCount}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT PANEL: Active Conversation Thread */}
        {activeConvId && activeConv ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--surface)" }}>
            {/* Conversation Header */}
            <div
              style={{
                padding: "14px 20px",
                borderBottom: "1px solid var(--border)",
                background: "var(--bg-soft)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <Button size="sm" variant="outline" onClick={() => setActiveConvId(null)} style={{ display: "flex", alignItems: "center" }}>
                  <ArrowLeft size={14} /> Back
                </Button>

                <Avatar name={activeConv.counterparty?.name} role={activeConv.counterparty?.role} size="md" verified />

                <div>
                  <h3 style={{ fontFamily: "var(--font-heading)", fontSize: "15px", fontWeight: 800, margin: 0 }}>
                    {activeConv.counterparty?.name}
                  </h3>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "11px", color: "var(--brand)", fontWeight: 700 }}>🟢 Online</span>
                    <span className="fc-soft" style={{ fontSize: "11px" }}>• {activeConv.counterparty?.farmName || "FarmConnect Member"}</span>
                  </div>
                </div>
              </div>

              {/* Header Actions & Dropdown */}
              <div style={{ position: "relative" }}>
                <Button size="sm" variant="outline" onClick={() => setOptionsMenuOpen(!optionsMenuOpen)}>
                  ⋮
                </Button>

                {optionsMenuOpen && (
                  <div
                    style={{
                      position: "absolute",
                      right: 0,
                      top: "100%",
                      marginTop: "6px",
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-sm)",
                      boxShadow: "var(--shadow-lg)",
                      zIndex: 50,
                      minWidth: "160px",
                      overflow: "hidden"
                    }}
                  >
                    <button
                      onClick={handleReportConversation}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "10px 14px",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "12.5px",
                        color: "var(--text)"
                      }}
                    >
                      🚩 Report Conversation
                    </button>
                    <button
                      onClick={handleBlockUser}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "10px 14px",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "12.5px",
                        color: "var(--danger)"
                      }}
                    >
                      🚫 Block User
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Context Banners (Product or Order) */}
            {activeConv.product && (
              <div
                style={{
                  padding: "10px 20px",
                  background: "var(--brand-light)",
                  borderBottom: "1px solid var(--brand)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Sprout size={16} color="var(--brand)" />
                  <span style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--brand-dark)" }}>
                    Regarding Produce: {activeConv.product.name} (₹{activeConv.product.price}/{activeConv.product.unit})
                  </span>
                </div>
                <Button size="sm" variant="outline" onClick={() => navigate(`/vendor/products/${activeConv.product.id}`)} style={{ fontSize: "11.5px" }}>
                  View Product →
                </Button>
              </div>
            )}

            {activeConv.order && (
              <div
                style={{
                  padding: "10px 20px",
                  background: "var(--info-light)",
                  borderBottom: "1px solid var(--info)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}
              >
                <span style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--info-dark)" }}>
                  Regarding Order #{activeConv.order.id} • Status: {activeConv.order.status}
                </span>
                <Button size="sm" variant="outline" onClick={() => navigate(`/vendor/orders`)} style={{ fontSize: "11.5px" }}>
                  View Order →
                </Button>
              </div>
            )}

            {/* Message Thread History */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
              {messages.map((m) => {
                const isMe = String(m.senderId) === String(user.id);
                return (
                  <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
                    <div
                      style={{
                        maxWidth: "75%",
                        padding: "12px 14px",
                        borderRadius: "14px",
                        borderTopLeftRadius: isMe ? "14px" : "2px",
                        borderTopRightRadius: isMe ? "2px" : "14px",
                        background: isMe ? "var(--brand)" : "var(--bg-soft)",
                        color: isMe ? "#ffffff" : "var(--text)",
                        fontSize: "13px",
                        lineHeight: 1.45,
                        border: isMe ? "none" : "1px solid var(--border)",
                        boxShadow: "var(--shadow-xs)"
                      }}
                    >
                      {m.message}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "3px", fontSize: "10px" }} className="fc-soft">
                      <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      {isMe && (
                        <span>
                          {m.isRead === 1 ? " ✓✓ Read" : m.status === "delivered" ? " ✓✓ Delivered" : " ✓ Sent"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input & Composer Bar */}
            <div style={{ padding: "14px 18px", borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
              {/* Toolbar Buttons */}
              <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                <Button size="sm" variant="outline" onClick={handleAiSuggestReply} disabled={suggestingAi} style={{ fontSize: "12px" }}>
                  ✨ {suggestingAi ? "Generating..." : "AI Suggest Reply"}
                </Button>
                {user.role === "farmer" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      fetchMyProducts();
                      setShareProductModalOpen(true);
                    }}
                    style={{ fontSize: "12px" }}
                  >
                    + Share Crop
                  </Button>
                )}
              </div>

              {/* Text Input Row */}
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <input
                  className="fc-input"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSendMessage();
                  }}
                  placeholder="Type a message..."
                  disabled={sending}
                  style={{ flex: 1, fontSize: "13.5px" }}
                />
                <Button variant="primary" onClick={() => handleSendMessage()} disabled={sending || !inputText.trim()} style={{ fontWeight: 700 }}>
                  Send
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* Empty Active Conversation Placeholder */
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px" }} className="fc-muted">
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "40px", marginBottom: "12px" }}>💬</div>
              <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 6px 0", color: "var(--text)" }}>
                Select a conversation
              </h3>
              <p style={{ fontSize: "13px", margin: 0 }}>
                Choose a contact from the left list or click "Chat with Farmer" on any product page.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Share Crop Modal */}
      {shareProductModalOpen && (
        <Modal isOpen={shareProductModalOpen} onClose={() => setShareProductModalOpen(false)} title="Share Listed Crop">
          <div style={{ padding: "16px" }}>
            <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: 700 }}>Select a crop listing to share in chat:</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "280px", overflowY: "auto" }}>
              {myProducts.map((p) => (
                <Card
                  key={p.id}
                  onClick={() => {
                    handleSendMessage(`I can offer ${p.name} at ₹${p.price}/${p.unit} (Stock: ${p.stock} ${p.unit}).`, "product", p.id);
                    setShareProductModalOpen(false);
                  }}
                  style={{ padding: "12px", cursor: "pointer" }}
                >
                  <div style={{ fontWeight: 700, fontSize: "13.5px" }}>{p.name}</div>
                  <div className="fc-soft" style={{ fontSize: "12px" }}>
                    ₹{p.price}/{p.unit} • {p.stock} {p.unit} available
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export const ChatPage = memo(ChatPageBase);
export default ChatPage;
