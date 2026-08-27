import { useState, useEffect, useRef, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth.js";
import { useNotifications } from "../../hooks/useNotifications.js";
import { apiFetch } from "../../services/api.js";
import { Button } from "../common/Button.jsx";
import { Badge } from "../common/Badge.jsx";
import { Card } from "../common/Card.jsx";
import { Avatar } from "../common/Avatar.jsx";
import { Sprout, Check, Search, AlertTriangle, ArrowLeft } from "../icons/Icons.jsx";

const SUGGESTED_PROMPTS = {
  farmer: [
    "Which products are selling fastest?",
    "Which products are low in stock?",
    "How much revenue did I make this month?",
    "Show my pending orders.",
    "Compare my prices with recent sales."
  ],
  vendor: [
    "Find 500 kg organic tomatoes.",
    "Find suppliers within 100 km.",
    "Find the cheapest supplier.",
    "Show my previous tomato purchases."
  ],
  admin: [
    "Summarize this week's platform performance.",
    "Which district has the most orders?",
    "Which categories are growing?",
    "Show unusual order activity."
  ]
};

function AiChatDrawerBase() {
  const { user, isAuthenticated } = useAuth();
  const { notifySuccess, notifyError } = useNotifications();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputPrompt, setInputPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [listening, setListening] = useState(false);
  const [actionConfirm, setActionConfirm] = useState(null);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Fetch conversation history when drawer opens
  const fetchConversations = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const data = await apiFetch("/api/ai/conversations");
      if (data && data.conversations) {
        setConversations(data.conversations);
      }
    } catch {
      /* ignore fetch history error */
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isOpen) {
      fetchConversations();
    }
  }, [isOpen, fetchConversations]);

  // Load specific conversation thread
  const loadConversation = async (convId) => {
    try {
      setLoading(true);
      const data = await apiFetch(`/api/ai/conversations/${convId}`);
      if (data && data.messages) {
        setConversationId(convId);
        setMessages(
          data.messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            toolName: m.toolName,
            createdAt: m.createdAt
          }))
        );
        setShowHistory(false);
      }
    } catch {
      notifyError("Failed to load conversation history.");
    } finally {
      setLoading(false);
    }
  };

  // Start new conversation thread
  const handleNewConversation = () => {
    setConversationId(null);
    setMessages([]);
    setShowHistory(false);
  };

  // Send message to AI Assistant
  const handleSendMessage = async (textToSend) => {
    const promptText = textToSend || inputPrompt;
    if (!promptText || !promptText.trim() || loading) return;

    const userMsg = {
      id: `u_${Date.now()}`,
      role: "user",
      content: promptText.trim(),
      createdAt: new Date().toISOString()
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputPrompt("");
    setLoading(true);

    try {
      const data = await apiFetch("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({
          prompt: promptText.trim(),
          conversationId,
          lang: localStorage.getItem("farmconnect-language") || "en"
        })
      });

      if (data && data.message) {
        if (!conversationId && data.conversationId) {
          setConversationId(data.conversationId);
          fetchConversations();
        }

        const aiMsg = data.message;
        setMessages((prev) => [...prev, aiMsg]);

        if (aiMsg.actionSuggestion) {
          setActionConfirm(aiMsg.actionSuggestion);
        }
      }
    } catch {
      const fallbackMsg = {
        id: `err_${Date.now()}`,
        role: "assistant",
        content: "FarmConnect AI is temporarily unavailable. You can continue using FarmConnect normally.",
        createdAt: new Date().toISOString()
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setLoading(false);
    }
  };

  // Web Speech API Voice Input
  const handleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      notifyError("Voice input is not supported in this browser.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = localStorage.getItem("farmconnect-language") === "ta" ? "ta-IN" : (localStorage.getItem("farmconnect-language") === "hi" ? "hi-IN" : "en-US");
      recognition.interimResults = false;

      recognition.onstart = () => setListening(true);
      recognition.onend = () => setListening(false);
      recognition.onerror = () => {
        setListening(false);
        notifyError("Voice input failed or was denied.");
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputPrompt(transcript);
          handleSendMessage(transcript);
        }
      };

      recognition.start();
    } catch {
      notifyError("Voice input initialization failed.");
    }
  };

  // Handle AI action confirmation
  const handleConfirmAction = (action) => {
    setActionConfirm(null);
    if (action.type === "NAVIGATE" && action.path) {
      navigate(action.path);
      setIsOpen(false);
      notifySuccess(`Navigated to ${action.label}`);
    } else if (action.type === "APPLY_FILTER") {
      navigate("/vendor/marketplace", { state: { filters: action.filters } });
      setIsOpen(false);
      notifySuccess("Applied AI filters to Marketplace");
    }
  };

  if (!isAuthenticated || !user) return null;

  const prompts = SUGGESTED_PROMPTS[user.role] || SUGGESTED_PROMPTS.vendor;

  return (
    <>
      {/* Floating Trigger Button */}
      <div
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          zIndex: 9990
        }}
      >
        <Button
          variant="primary"
          onClick={() => setIsOpen(true)}
          style={{
            borderRadius: "30px",
            padding: "12px 20px",
            fontWeight: 800,
            fontSize: "14px",
            boxShadow: "0 8px 24px rgba(46, 125, 50, 0.35)",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <Sprout size={18} />
          <span>🌱 FarmConnect AI</span>
        </Button>
      </div>

      {/* Slide-out Chat Drawer */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0, 0, 0, 0.4)",
            backdropFilter: "blur(2px)",
            zIndex: 9999,
            display: "flex",
            justifyContent: "flex-end"
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          <div
            className="fc-fade-in"
            style={{
              width: "100%",
              maxWidth: "440px",
              height: "100%",
              background: "var(--surface)",
              display: "flex",
              flexDirection: "column",
              boxShadow: "var(--shadow-lg)",
              borderLeft: "1px solid var(--border)"
            }}
          >
            {/* Drawer Header */}
            <div
              style={{
                padding: "18px 20px",
                borderBottom: "1px solid var(--border)",
                background: "var(--bg-soft)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    background: "var(--brand-light)",
                    color: "var(--brand)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <Sprout size={20} />
                </div>
                <div>
                  <h3 style={{ fontFamily: "var(--font-heading)", fontSize: "16px", fontWeight: 800, margin: 0, color: "var(--text)" }}>
                    FarmConnect AI
                  </h3>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Badge variant={user.role === "admin" ? "success" : user.role === "farmer" ? "info" : "warning"} style={{ fontSize: "10px", padding: "1px 6px" }}>
                      {user.role?.toUpperCase()} AI
                    </Badge>
                    <span className="fc-soft" style={{ fontSize: "11px" }}>Authorized</span>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Button size="sm" variant="outline" onClick={() => setShowHistory(!showHistory)} style={{ fontSize: "12px" }}>
                  {showHistory ? "Chat" : "History"}
                </Button>
                <button
                  onClick={() => setIsOpen(false)}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "20px",
                    cursor: "pointer",
                    color: "var(--text-soft)"
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Conversation History List Panel */}
            {showHistory ? (
              <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                  <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 700 }}>Saved Conversations</h4>
                  <Button size="sm" variant="primary" onClick={handleNewConversation}>
                    + New Chat
                  </Button>
                </div>
                {conversations.length === 0 ? (
                  <p className="fc-muted" style={{ fontSize: "13px", fontStyle: "italic" }}>No previous conversations stored.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {conversations.map((c) => (
                      <Card
                        key={c.id}
                        onClick={() => loadConversation(c.id)}
                        style={{
                          padding: "12px",
                          cursor: "pointer",
                          borderColor: conversationId === c.id ? "var(--brand)" : "var(--border)",
                          background: conversationId === c.id ? "var(--brand-light)" : "var(--surface)"
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "4px" }}>{c.title || "Conversation"}</div>
                        <div className="fc-soft" style={{ fontSize: "11px" }}>{new Date(c.updatedAt).toLocaleDateString()}</div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Chat Messages Panel */
              <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "14px" }}>
                {messages.length === 0 && (
                  <div>
                    <Card style={{ padding: "16px", background: "var(--bg-soft)", marginBottom: "16px" }}>
                      <h4 style={{ margin: "0 0 6px 0", fontSize: "14px", fontWeight: 700 }}>
                        Welcome {user.name}!
                      </h4>
                      <p className="fc-muted" style={{ fontSize: "12.5px", margin: 0, lineHeight: 1.4 }}>
                        Ask me about produce inventory, sales analytics, market price advisories, or natural product search.
                      </p>
                    </Card>

                    <span className="fc-soft" style={{ fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "8px" }}>
                      Suggested Questions:
                    </span>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {prompts.map((p, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSendMessage(p)}
                          style={{
                            textAlign: "left",
                            padding: "10px 12px",
                            borderRadius: "var(--radius-sm)",
                            border: "1px solid var(--border)",
                            background: "var(--surface)",
                            fontSize: "12.5px",
                            cursor: "pointer",
                            transition: "all 0.15s"
                          }}
                        >
                          💬 {p}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: m.role === "user" ? "flex-end" : "flex-start"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", maxWidth: "90%" }}>
                      {m.role !== "user" && <Avatar name="AI" role="admin" size="sm" />}
                      <div
                        style={{
                          padding: "12px 14px",
                          borderRadius: "14px",
                          borderTopLeftRadius: m.role === "user" ? "14px" : "2px",
                          borderTopRightRadius: m.role === "user" ? "2px" : "14px",
                          background: m.role === "user" ? "var(--brand)" : "var(--bg-soft)",
                          color: m.role === "user" ? "#ffffff" : "var(--text)",
                          fontSize: "13px",
                          lineHeight: "1.5",
                          whiteSpace: "pre-line",
                          border: m.role === "user" ? "none" : "1px solid var(--border)"
                        }}
                      >
                        {m.content}
                      </div>
                    </div>

                    <span className="fc-soft" style={{ fontSize: "10px", marginTop: "4px", padding: "0 4px" }}>
                      {m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                    </span>
                  </div>
                ))}

                {/* Interactive Action Confirmation Banner */}
                {actionConfirm && (
                  <Card style={{ padding: "14px", background: "var(--brand-light)", borderColor: "var(--brand)" }}>
                    <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "8px", color: "var(--brand-dark)" }}>
                      💡 Suggested AI Action: {actionConfirm.label}
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <Button size="sm" variant="primary" onClick={() => handleConfirmAction(actionConfirm)}>
                        Confirm
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setActionConfirm(null)}>
                        Cancel
                      </Button>
                    </div>
                  </Card>
                )}

                {loading && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-soft)", fontSize: "12.5px" }}>
                    <Sprout size={16} className="animate-spin" />
                    <span>FarmConnect AI is thinking...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}

            {/* Input Bar */}
            <div
              style={{
                padding: "14px 16px",
                borderTop: "1px solid var(--border)",
                background: "var(--surface)",
                display: "flex",
                gap: "8px",
                alignItems: "center"
              }}
            >
              <button
                type="button"
                onClick={handleVoiceInput}
                title="Voice Input"
                style={{
                  background: listening ? "var(--danger)" : "var(--bg-soft)",
                  color: listening ? "#fff" : "var(--text)",
                  border: "1px solid var(--border)",
                  borderRadius: "50%",
                  width: "36px",
                  height: "36px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer"
                }}
              >
                🎤
              </button>

              <input
                className="fc-input"
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSendMessage();
                }}
                placeholder={listening ? "Listening..." : "Ask FarmConnect AI..."}
                disabled={loading}
                style={{ flex: 1, fontSize: "13px" }}
              />

              <Button
                variant="primary"
                onClick={() => handleSendMessage()}
                disabled={loading || !inputPrompt.trim()}
                style={{ padding: "8px 14px", fontWeight: 700 }}
              >
                Send
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export const AiChatDrawer = memo(AiChatDrawerBase);
export default AiChatDrawer;
