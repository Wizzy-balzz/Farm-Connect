import { useState, useEffect, useRef, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth.js";
import { useLanguage } from "../../hooks/useLanguage.js";
import { useNotifications } from "../../hooks/useNotifications.js";
import { apiFetch, apiFetchBlob } from "../../services/api.js";
import { Button } from "../common/Button.jsx";
import { Badge } from "../common/Badge.jsx";
import { Card } from "../common/Card.jsx";
import { Avatar } from "../common/Avatar.jsx";
import { Sprout, X } from "../icons/Icons.jsx";
import { ActionConfirmationCard } from "./ActionConfirmationCard.jsx";

const SUGGESTED_PROMPTS = {
  farmer: [
    "Should I sell my tomatoes this week?",
    "Review farm health and selling opportunities.",
    "Which products are selling fastest?",
    "Which products are low in stock?",
    "How much revenue did I make this month?"
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

function createChatMessage(role, content) {
  return {
    id: `${role}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    role,
    content,
    createdAt: new Date().toISOString()
  };
}

function AiChatDrawerBase() {
  const { user, isAuthenticated } = useAuth();
  const { lang } = useLanguage();
  const { notifySuccess, notifyError } = useNotifications();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputPrompt, setInputPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [actionConfirm, setActionConfirm] = useState(null);
  const [unreadInsightsCount, setUnreadInsightsCount] = useState(0);

  // Phase 3D-2: Backend Voice STT (MediaRecorder) States
  const [recordingState, setRecordingState] = useState("idle"); // "idle" | "recording" | "transcribing"
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const mediaStreamRef = useRef(null);

  // Phase 3D-2: Backend Speech Synthesis (TTS) States
  const [playingMessageId, setPlayingMessageId] = useState(null);
  const [loadingAudioId, setLoadingAudioId] = useState(null);
  const activeAudioRef = useRef(null);
  const activeAudioUrlRef = useRef(null);

  const messagesEndRef = useRef(null);
  const isSubmittingRef = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Close drawer on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Contextual AI prompt listener (from Decision Cards, Signals, Opportunities)
  useEffect(() => {
    const handleOpenChat = (e) => {
      const prompt = e.detail?.prompt;
      setIsOpen(true);
      if (prompt && typeof prompt === "string") {
        setInputPrompt(prompt);
      }
    };
    window.addEventListener("fc-open-ai-chat", handleOpenChat);
    return () => window.removeEventListener("fc-open-ai-chat", handleOpenChat);
  }, []);

  // Fetch real active proactive agricultural insights count for notification badge
  useEffect(() => {
    let isSubscribed = true;
    async function loadInsights() {
      if (!isAuthenticated || !user) return;
      try {
        const data = await apiFetch(`/api/ai/insights?lang=${lang || "en"}&status=active`);
        if (isSubscribed && data && Array.isArray(data.insights)) {
          setUnreadInsightsCount(data.insights.length);
        }
      } catch {
        /* ignore - never show fake counts */
      }
    }

    void loadInsights();
    const handleUpdate = () => { void loadInsights(); };
    window.addEventListener("fc-insights-updated", handleUpdate);
    return () => {
      isSubscribed = false;
      window.removeEventListener("fc-insights-updated", handleUpdate);
    };
  }, [isAuthenticated, user, lang]);

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
    if (!isOpen || !isAuthenticated) return;
    let isSubscribed = true;
    async function loadConvs() {
      try {
        const data = await apiFetch("/api/ai/conversations");
        if (isSubscribed && data && data.conversations) {
          setConversations(data.conversations);
        }
      } catch {
        /* ignore fetch history error */
      }
    }
    void loadConvs();
    return () => {
      isSubscribed = false;
    };
  }, [isOpen, isAuthenticated]);

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
    if (!promptText || !promptText.trim()) return;
    if (loading || isSubmittingRef.current) return;

    isSubmittingRef.current = true;
    const userMsg = createChatMessage("user", promptText.trim());

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
    } catch (err) {
      console.warn("[AiChatDrawer] Chat request error:", err);

      let errorNotice = "FarmConnect AI is temporarily unavailable. You can continue using FarmConnect normally.";
      if (err?.status === 401) {
        errorNotice = "Your session has expired. Please log in again to use FarmConnect AI.";
      } else if (err?.status === 403) {
        errorNotice = "Your account role is not authorized for this AI action.";
      } else if (err?.status === 429) {
        errorNotice = "FarmConnect AI has reached its API usage limit. AI responses will resume when the quota resets.";
      } else if (import.meta.env.DEV && err?.status) {
        errorNotice += ` [HTTP ${err.status}]`;
      }

      const fallbackMsg = createChatMessage("assistant", errorNotice);
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      isSubmittingRef.current = false;
      setLoading(false);
    }
  };

  // Cleanup audio & recording on unmount or drawer close
  const stopAudio = useCallback(() => {
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current.src = "";
      activeAudioRef.current = null;
    }
    if (activeAudioUrlRef.current) {
      URL.revokeObjectURL(activeAudioUrlRef.current);
      activeAudioUrlRef.current = null;
    }
    setPlayingMessageId(null);
    setLoadingAudioId(null);
  }, []);

  const cleanupRecording = useCallback(() => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        /* noop */
      }
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    audioChunksRef.current = [];
    setRecordingState("idle");
    setRecordingDuration(0);
  }, []);

  useEffect(() => {
    return () => {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current.src = "";
        activeAudioRef.current = null;
      }
      if (activeAudioUrlRef.current) {
        URL.revokeObjectURL(activeAudioUrlRef.current);
        activeAudioUrlRef.current = null;
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current.src = "";
        activeAudioRef.current = null;
      }
      if (activeAudioUrlRef.current) {
        URL.revokeObjectURL(activeAudioUrlRef.current);
        activeAudioUrlRef.current = null;
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
    }
  }, [isOpen]);

  // Supported audio MIME types detector
  const getSupportedAudioMimeType = () => {
    if (typeof MediaRecorder === "undefined") return "";
    const types = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/mp4",
      "audio/wav"
    ];
    return types.find((type) => MediaRecorder.isTypeSupported(type)) || "";
  };

  // Phase 3D-2: Backend MediaRecorder Voice STT
  const startVoiceRecording = async () => {
    if (recordingState === "recording") {
      stopRecordingAndTranscribe();
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === "undefined") {
      notifyError("Voice audio recording is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const mimeType = getSupportedAudioMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstart = () => {
        setRecordingState("recording");
        setRecordingDuration(0);
        recordingTimerRef.current = setInterval(() => {
          setRecordingDuration((prev) => prev + 1);
        }, 1000);
      };

      recorder.start(250);
    } catch (err) {
      console.error("Microphone access error:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        notifyError("Microphone permission was denied. Please allow microphone access in your browser settings.");
      } else {
        notifyError("Could not access microphone.");
      }
      cleanupRecording();
    }
  };

  const cancelVoiceRecording = () => {
    cleanupRecording();
    notifySuccess("Voice recording cancelled.");
  };

  const stopRecordingAndTranscribe = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      cleanupRecording();
      return;
    }

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    setRecordingState("transcribing");

    recorder.onstop = async () => {
      try {
        const mimeType = recorder.mimeType || "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

        if (audioBlob.size === 0) {
          notifyError("No audio was recorded. Please speak clearly into your microphone.");
          setRecordingState("idle");
          return;
        }

        const ext = mimeType.includes("mp4") ? "mp4" : mimeType.includes("ogg") ? "ogg" : mimeType.includes("wav") ? "wav" : "webm";
        const formData = new FormData();
        formData.append("audio", audioBlob, `voice_recording.${ext}`);
        formData.append("language", lang || "en");
        formData.append("transcribeOnly", "true");
        if (conversationId) formData.append("conversationId", conversationId);

        const data = await apiFetch("/api/ai/voice", {
          method: "POST",
          body: formData
        });

        if (data && data.transcript) {
          setInputPrompt(data.transcript);
          notifySuccess("Speech transcribed! Review or edit before sending.");
        } else {
          notifyError("Could not transcribe speech. Please try again.");
        }
      } catch (err) {
        console.error("Voice transcription error:", err);
        notifyError(err.message || "Audio transcription failed.");
      } finally {
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }
        audioChunksRef.current = [];
        setRecordingState("idle");
        setRecordingDuration(0);
      }
    };

    recorder.stop();
  };

  // Phase 3D-2: Backend Speech Synthesis (TTS) Playback
  const handlePlayTts = async (messageId, text) => {
    if (playingMessageId === messageId) {
      stopAudio();
      return;
    }

    stopAudio();
    setLoadingAudioId(messageId);

    try {
      const cleanText = text
        .replace(/[*#_`~]/g, "")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .slice(0, 1000);

      const blob = await apiFetchBlob("/api/ai/tts", {
        method: "POST",
        body: JSON.stringify({
          text: cleanText,
          language: lang || "en"
        })
      });

      const audioUrl = URL.createObjectURL(blob);
      activeAudioUrlRef.current = audioUrl;

      const audio = new Audio(audioUrl);
      activeAudioRef.current = audio;

      audio.onended = () => {
        stopAudio();
      };

      audio.onerror = () => {
        notifyError("Voice synthesis playback failed.");
        stopAudio();
      };

      await audio.play();
      setPlayingMessageId(messageId);
    } catch (err) {
      console.error("TTS playback error:", err);
      notifyError(err.message || "Failed to synthesize speech audio.");
      stopAudio();
    } finally {
      setLoadingAudioId(null);
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
      {/* Dedicated Floating AI Launcher */}
      <div
        className={`fc-ai-launcher-wrap ${isOpen ? "fc-ai-launcher-hidden" : ""}`}
        aria-hidden={isOpen}
      >
        <button
          type="button"
          className="fc-ai-launcher-btn"
          onClick={() => setIsOpen(true)}
          aria-label="Open FarmConnect AI Assistant"
          title="Open FarmConnect AI Assistant"
        >
          <span className="fc-ai-launcher-icon-box" aria-hidden="true">
            <Sprout size={18} />
          </span>
          <span className="fc-ai-launcher-label">FarmConnect AI</span>
          {unreadInsightsCount > 0 && (
            <span
              className="fc-ai-launcher-badge"
              aria-label={`${unreadInsightsCount} unread smart insights`}
              title={`${unreadInsightsCount} unread proactive smart insights`}
            >
              {unreadInsightsCount > 9 ? "9+" : unreadInsightsCount}
            </span>
          )}
        </button>
      </div>

      {/* Slide-out Chat Drawer */}
      {isOpen && (
        <div
          className="fc-ai-drawer-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          <div
            className="fc-ai-drawer-panel fc-fade-in"
            role="dialog"
            aria-modal="true"
            aria-label="FarmConnect AI Assistant"
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
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigate("/profile");
                    setIsOpen(false);
                  }}
                  style={{ fontSize: "12px" }}
                  title="Manage AI Memory & Preferences in Profile"
                  aria-label="Manage AI Memory & Preferences in Profile"
                >
                  🧠 Memory
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowHistory(!showHistory)} style={{ fontSize: "12px" }}>
                  {showHistory ? "Chat" : "History"}
                </Button>
                <button
                  type="button"
                  className="fc-ai-drawer-close"
                  onClick={() => setIsOpen(false)}
                  aria-label="Close FarmConnect AI Drawer"
                  title="Close (Esc)"
                >
                  <X size={18} />
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

                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px", padding: "0 4px" }}>
                      <span className="fc-soft" style={{ fontSize: "10px" }}>
                        {m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                      </span>
                      {m.role !== "user" && m.content && (
                        <button
                          type="button"
                          onClick={() => handlePlayTts(m.id, m.content)}
                          disabled={loadingAudioId === m.id}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: playingMessageId === m.id ? "var(--brand)" : "var(--text-muted)",
                            cursor: "pointer",
                            padding: "2px 6px",
                            fontSize: "11px",
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3,
                            borderRadius: "4px"
                          }}
                          aria-label={playingMessageId === m.id ? "Stop audio playback" : "Listen to response via backend TTS"}
                          title={playingMessageId === m.id ? "Stop audio playback" : "Listen to response via backend TTS"}
                        >
                          {loadingAudioId === m.id ? (
                            "⏳ Synthesizing..."
                          ) : playingMessageId === m.id ? (
                            "⏹ Stop Audio"
                          ) : (
                            "🔊 Listen"
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {/* Interactive Action Confirmation Banner / Proposal Card */}
                {actionConfirm && actionConfirm.confirmationToken ? (
                  <div style={{ marginBottom: "14px" }}>
                    <ActionConfirmationCard
                      action={actionConfirm}
                      lang={lang}
                      onActionComplete={() => setActionConfirm(null)}
                    />
                  </div>
                ) : actionConfirm ? (
                  <Card style={{ padding: "14px", background: "var(--brand-light)", borderColor: "var(--brand)" }}>
                    <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "8px", color: "var(--brand-dark)" }}>
                      💡 Suggested AI Action: {actionConfirm.label || actionConfirm.title || "Confirmation Required"}
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
                ) : null}

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
                flexDirection: "column",
                gap: "8px"
              }}
            >
              {/* Active Recording / Transcribing Indicator Banner */}
              {recordingState === "recording" && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 12px",
                    background: "var(--danger-light)",
                    border: "1px solid var(--danger)",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "12.5px"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--danger)", fontWeight: 700 }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--danger)", display: "inline-block" }} />
                    Recording: 0:{String(recordingDuration).padStart(2, "0")}
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <Button size="sm" variant="ghost" onClick={cancelVoiceRecording} style={{ padding: "3px 8px", fontSize: "11.5px" }}>
                      Cancel
                    </Button>
                    <Button size="sm" variant="primary" onClick={stopRecordingAndTranscribe} style={{ padding: "3px 10px", fontSize: "11.5px", fontWeight: 700 }}>
                      Done (Transcribe)
                    </Button>
                  </div>
                </div>
              )}

              {recordingState === "transcribing" && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 12px",
                    background: "var(--brand-light)",
                    border: "1px solid var(--brand)",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "12px",
                    color: "var(--brand-dark)",
                    fontWeight: 600
                  }}
                >
                  <span>🎙️ Transcribing voice recording via backend STT service...</span>
                </div>
              )}

              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={recordingState === "recording" ? stopRecordingAndTranscribe : startVoiceRecording}
                  disabled={loading || recordingState === "transcribing"}
                  title={recordingState === "recording" ? "Stop recording & transcribe" : "Record Voice via Backend STT"}
                  aria-label={recordingState === "recording" ? "Stop recording & transcribe" : "Record Voice via Backend STT"}
                  style={{
                    background: recordingState === "recording" ? "var(--danger)" : "var(--bg-soft)",
                    color: recordingState === "recording" ? "#fff" : "var(--text)",
                    border: "1px solid var(--border)",
                    borderRadius: "50%",
                    width: "36px",
                    height: "36px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    flexShrink: 0,
                    transition: "all 0.2s"
                  }}
                >
                  {recordingState === "transcribing" ? "⏳" : recordingState === "recording" ? "⏹" : "🎤"}
                </button>

                <input
                  className="fc-input"
                  value={inputPrompt}
                  onChange={(e) => setInputPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder={
                    recordingState === "recording"
                      ? "Recording audio... speak now"
                      : recordingState === "transcribing"
                      ? "Transcribing voice input..."
                      : "Ask FarmConnect AI..."
                  }
                  disabled={loading || recordingState === "transcribing"}
                  style={{ flex: 1, fontSize: "13px" }}
                />

                <Button
                  variant="primary"
                  onClick={() => handleSendMessage()}
                  disabled={loading || !inputPrompt.trim() || recordingState === "transcribing"}
                  style={{ padding: "8px 14px", fontWeight: 700 }}
                >
                  Send
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export const AiChatDrawer = memo(AiChatDrawerBase);
export default AiChatDrawer;
