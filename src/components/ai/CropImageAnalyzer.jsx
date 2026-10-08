import { useState, useRef, useCallback, memo } from "react";
import { useLanguage } from "../../hooks/useLanguage.js";
import { useNotifications } from "../../hooks/useNotifications.js";
import { apiFetch, apiFetchBlob } from "../../services/api.js";
import { Button } from "../common/Button.jsx";
import { Badge } from "../common/Badge.jsx";
import { Card } from "../common/Card.jsx";

const LABELS = {
  en: {
    title: "AI Crop & Plant Health Diagnostics",
    subtitle: "Upload a photo of damaged leaves, stems, or fruits for instant multimodal AI analysis.",
    uploadArea: "Click or drag crop image here",
    uploadFormats: "JPEG, PNG, WEBP (Max 10MB)",
    cameraBtn: "📷 Take Photo",
    chooseFileBtn: "📁 Choose Image",
    notesPlaceholder: "Optional details (e.g., Tomato crop, leaves turning yellow after 3 days of heavy rain)...",
    analyzeBtn: "🔍 Analyze Crop Health",
    analyzing: "Analyzing Crop Image with Gemini Vision...",
    newAnalysis: "🔄 Analyze Another Photo",
    observedSymptoms: "🔍 Observed Symptoms (Facts)",
    possibleIssues: "🩺 Possible Issues & Causes (AI Analysis)",
    nextSteps: "📋 Recommended Next Steps",
    prevention: "🛡️ Prevention & Management",
    confidence: "Analytical Confidence",
    limitations: "Analysis Limitations",
    disclaimer: "⚠️ AI-assisted preliminary assessment — not a definitive agricultural diagnosis. Consult a local agronomic extension officer before applying high-potency chemicals.",
    readAloud: "🔊 Read Aloud",
    stopAudio: "⏹️ Stop Audio",
    saveInsight: "💾 Save to Farm Insights",
    savedSuccess: "Assessment saved to your farm insights!",
    askChat: "💬 Discuss with FarmConnect AI",
    errorNoImage: "Please choose or take a photo of the affected plant.",
    errorTooLarge: "Image size exceeds 10MB limit.",
    severityLow: "Low Risk",
    severityMed: "Moderate Attention",
    severityHigh: "High Severity",
    severityCritical: "Critical Action Needed"
  },
  ta: {
    title: "பயிர் & தாவர சுகாதார செயற்கை நுண்ணறிவு கண்டறிதல்",
    subtitle: "பாதிக்கப்பட்ட இலைகள், தண்டுகள் அல்லது பழங்களின் புகைப்படத்தைப் பதிவேற்றி உடனடி பகுப்பாய்வு பெறுங்கள்.",
    uploadArea: "பயிர் புகைப்படத்தை இங்கே கிளிக் செய்யவும் அல்லது இழுத்து விடவும்",
    uploadFormats: "JPEG, PNG, WEBP (அதிகபட்சம் 10MB)",
    cameraBtn: "📷 புகைப்படம் எடு",
    chooseFileBtn: "📁 படம் தேர்வு செய்",
    notesPlaceholder: "கூடுதல் விவரங்கள் (எ.கா. தக்காளி பயிர், 3 நாட்கள் தொடர் மழையால் இலைகள் மஞ்சள் நிறமாக மாறுகின்றன)...",
    analyzeBtn: "🔍 பயிர் ஆரோக்கியத்தை பகுப்பாய்வு செய்",
    analyzing: "பயிர் படம் பகுப்பாய்வு செய்யப்படுகிறது...",
    newAnalysis: "🔄 மற்றொரு புகைப்படத்தை பகுப்பாய்",
    observedSymptoms: "🔍 கவனிக்கப்பட்ட அறிகுறிகள்",
    possibleIssues: "🩺 சாத்தியமான நோய்கள் & காரணங்கள்",
    nextSteps: "📋 பரிந்துரைக்கப்பட்ட அடுத்த நடவடிக்கைகள்",
    prevention: "🛡️ தடுப்பு & மேலாண்மை",
    confidence: "பகுப்பாய்வு நம்பகத்தன்மை",
    limitations: "பகுப்பாய்வு வரம்புகள்",
    disclaimer: "⚠️ இது AI-உதவி ஆரம்ப மதிப்பீடு மட்டுமே — இறுதியான வேளாண்மை நோயறிதல் அல்ல. ரசாயனங்களைப் பயன்படுத்துவதற்கு முன் உள்ளூர் வேளாண் அலுவலரிடம் ஆலோசிக்கவும்.",
    readAloud: "🔊 வாசித்து காட்டு",
    stopAudio: "⏹️ ஆடியோவை நிறுத்து",
    saveInsight: "💾 குறிப்புகளில் சேமி",
    savedSuccess: "மதிப்பீடு உங்கள் பண்ணை குறிப்புகளில் சேமிக்கப்பட்டது!",
    askChat: "💬 AI உடன் பேசு",
    errorNoImage: "தயவுசெய்து ஒரு தாவர புகைப்படத்தை தேர்வு செய்யவும்.",
    errorTooLarge: "படத்தின் அளவு 10MB வரம்பை தாண்டியுள்ளது.",
    severityLow: "குறைந்த ஆபத்து",
    severityMed: "மிதமான கவனம் தேவை",
    severityHigh: "அதிக தீவிரம்",
    severityCritical: "உடனடி நடவடிக்கை தேவை"
  },
  hi: {
    title: "एआई फसल एवं पादप स्वास्थ्य निदान",
    subtitle: "रोगग्रस्त पत्तियों, तनों या फलों की तस्वीर अपलोड कर तत्काल बहुआयामी एआई विश्लेषण प्राप्त करें।",
    uploadArea: "फसल की तस्वीर यहाँ क्लिक करें या खींचें",
    uploadFormats: "JPEG, PNG, WEBP (अधिकतम 10MB)",
    cameraBtn: "📷 फोटो खींचें",
    chooseFileBtn: "📁 फोटो चुनें",
    notesPlaceholder: "वैकल्पिक विवरण (उदा. टमाटर की फसल, लगातार 3 दिन की भारी बारिश के बाद पत्तियां पीली पड़ रही हैं)...",
    analyzeBtn: "🔍 फसल स्वास्थ्य का विश्लेषण करें",
    analyzing: "जेमिनी विजन के साथ फसल की तस्वीर का विश्लेषण हो रहा है...",
    newAnalysis: "🔄 दूसरी फोटो जांचें",
    observedSymptoms: "🔍 देखे गए लक्षण (तथ्य)",
    possibleIssues: "🩺 संभावित समस्याएं और कारण (एआई विश्लेषण)",
    nextSteps: "📋 अनुशंसित अगले कदम",
    prevention: "🛡️ रोकथाम और प्रबंधन",
    confidence: "विश्लेषण आत्मविश्वास",
    limitations: "विश्लेषण सीमाएं",
    disclaimer: "⚠️ यह केवल एआई-सहायता प्राप्त प्रारंभिक मूल्यांकन है — कोई अंतिम कृषि निदान नहीं। उच्च क्षमता वाले कीटनाशकों के प्रयोग से पहले स्थानीय कृषि अधिकारी से परामर्श लें।",
    readAloud: "🔊 बोलकर सुनाएं",
    stopAudio: "⏹️ ऑडियो रोकें",
    saveInsight: "💾 रिकॉर्ड में सहेजें",
    savedSuccess: "मूल्यांकन सफलतापूर्वक सहेज लिया गया!",
    askChat: "💬 एआई सहायक से पूछें",
    errorNoImage: "कृपया पौधे की एक स्पष्ट फोटो चुनें।",
    errorTooLarge: "फोटो का आकार 10MB से अधिक नहीं होना चाहिए।",
    severityLow: "कम जोखिम",
    severityMed: "मध्यम ध्यान दें",
    severityHigh: "गंभीर स्थिति",
    severityCritical: "तत्काल कार्रवाई आवश्यक"
  }
};

function CropImageAnalyzerBase({ onAskChat = null, conversationId = null }) {
  const { lang: currentLang } = useLanguage();
  const { notifySuccess, notifyError } = useNotifications();

  const labels = LABELS[currentLang] || LABELS.en;

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState("facts");
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [savedInsight, setSavedInsight] = useState(false);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const activeAudioRef = useRef(null);
  const activeAudioUrlRef = useRef(null);

  const handleFileSelect = useCallback((file) => {
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      notifyError(labels.errorTooLarge);
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      notifyError("Unsupported file format. Please upload JPEG, PNG, or WEBP.");
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setResult(null);
    setSavedInsight(false);
  }, [labels.errorTooLarge, notifyError]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const clearSelection = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setResult(null);
    setSavedInsight(false);
  };

  const handleAnalyze = async () => {
    if (!selectedFile) {
      notifyError(labels.errorNoImage);
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("image", selectedFile);
      if (notes.trim()) {
        formData.append("notes", notes.trim());
      }
      formData.append("language", currentLang || "en");
      if (conversationId) {
        formData.append("conversationId", conversationId);
      }

      const data = await apiFetch("/api/ai/image-analysis", {
        method: "POST",
        body: formData
      });

      if (!data || !data.success) {
        throw new Error(data?.error?.message || "Crop image analysis failed.");
      }

      setResult(data.analysis);
      notifySuccess("Crop analysis completed successfully!");
    } catch (err) {
      console.error("Crop image analysis error:", err);
      notifyError(err.message || "Failed to analyze crop image.");
    } finally {
      setLoading(false);
    }
  };

  const stopAudio = useCallback(() => {
    if (activeAudioRef.current) {
      try {
        activeAudioRef.current.pause();
        activeAudioRef.current.currentTime = 0;
      } catch {
        /* ignore */
      }
      activeAudioRef.current = null;
    }
    if (activeAudioUrlRef.current) {
      try {
        URL.revokeObjectURL(activeAudioUrlRef.current);
      } catch {
        /* ignore */
      }
      activeAudioUrlRef.current = null;
    }
    setIsAudioPlaying(false);
    setLoadingAudio(false);
  }, []);

  const handlePlayTts = async () => {
    if (isAudioPlaying) {
      stopAudio();
      return;
    }

    if (!result || (!result.recommendations?.summary && !result.rawText)) return;

    stopAudio();
    setLoadingAudio(true);

    try {
      const textToSpeak = result.recommendations?.summary || result.rawText;
      const blob = await apiFetchBlob("/api/ai/tts", {
        method: "POST",
        body: JSON.stringify({
          text: textToSpeak,
          language: currentLang || "en"
        })
      });

      const audioUrl = URL.createObjectURL(blob);
      activeAudioUrlRef.current = audioUrl;

      const audio = new Audio(audioUrl);
      activeAudioRef.current = audio;

      audio.onended = () => {
        stopAudio();
      };

      await audio.play();
      setIsAudioPlaying(true);
    } catch (err) {
      console.error("TTS playback error:", err);
      notifyError("Voice playback failed.");
      stopAudio();
    } finally {
      setLoadingAudio(false);
    }
  };

  const handleSaveInsight = () => {
    setSavedInsight(true);
    notifySuccess(labels.savedSuccess);
  };

  const getSeverityBadgeVariant = (severity) => {
    const sev = (severity || "").toLowerCase();
    if (sev === "critical" || sev === "high") return "danger";
    if (sev === "medium" || sev === "moderate") return "warning";
    return "success";
  };

  const getSeverityLabel = (severity) => {
    const sev = (severity || "").toLowerCase();
    if (sev === "critical") return labels.severityCritical;
    if (sev === "high") return labels.severityHigh;
    if (sev === "medium" || sev === "moderate") return labels.severityMed;
    return labels.severityLow;
  };

  return (
    <Card padded={false} style={{ background: "var(--surface)", border: "1px solid var(--border)", overflow: "hidden" }}>
      {/* Header Banner */}
      <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", background: "var(--brand-light)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{ width: "42px", height: "42px", borderRadius: "var(--radius-md)", background: "var(--brand)", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", fontWeight: "bold", flexShrink: 0 }}>
            🌱
          </div>
          <div>
            <h2 className="fc-h2" style={{ margin: "0 0 2px 0", color: "var(--brand-dark)" }}>{labels.title}</h2>
            <p className="fc-muted" style={{ margin: 0, fontSize: "13px" }}>{labels.subtitle}</p>
          </div>
        </div>
      </div>

      <div style={{ padding: "20px 24px" }}>
        {/* Upload & Controls Section */}
        {!result ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Dropzone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => !previewUrl && fileInputRef.current?.click()}
              style={{
                border: "2px dashed var(--border-strong)",
                borderRadius: "var(--radius-md)",
                padding: "24px",
                textAlign: "center",
                cursor: previewUrl ? "default" : "pointer",
                background: previewUrl ? "var(--surface)" : "var(--bg-soft)",
                transition: "all 0.2s ease"
              }}
            >
              {previewUrl ? (
                <div style={{ position: "relative", display: "inline-block" }}>
                  <img
                    src={previewUrl}
                    alt="Crop Preview"
                    style={{ maxHeight: "240px", borderRadius: "var(--radius-sm)", objectFit: "contain", margin: "0 auto", border: "1px solid var(--border)" }}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearSelection();
                    }}
                    style={{
                      position: "absolute",
                      top: "-8px",
                      right: "-8px",
                      background: "var(--danger)",
                      color: "#ffffff",
                      borderRadius: "50%",
                      width: "26px",
                      height: "26px",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "12px",
                      fontWeight: "bold",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "var(--shadow-sm)"
                    }}
                    title="Remove Image"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div style={{ padding: "16px 0" }}>
                  <div style={{ fontSize: "36px", marginBottom: "8px" }}>📸</div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text)" }}>{labels.uploadArea}</div>
                  <div className="fc-soft" style={{ fontSize: "12px", marginTop: "4px" }}>{labels.uploadFormats}</div>
                </div>
              )}
            </div>

            {/* Hidden File Inputs */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              accept="image/jpeg,image/png,image/webp"
              style={{ display: "none" }}
            />
            <input
              type="file"
              ref={cameraInputRef}
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              accept="image/*"
              capture="environment"
              style={{ display: "none" }}
            />

            {/* Upload buttons */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", justifyContent: "center" }}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                {labels.chooseFileBtn}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => cameraInputRef.current?.click()}
              >
                {labels.cameraBtn}
              </Button>
            </div>

            {/* Optional Crop Notes */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-muted)" }}>
                Crop & Symptom Details (Optional)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={labels.notesPlaceholder}
                className="fc-input"
                style={{ width: "100%", padding: "8px 12px", fontSize: "13px", resize: "vertical" }}
              />
            </div>

            {/* Submit Button */}
            <Button
              type="button"
              variant="primary"
              size="lg"
              disabled={!selectedFile || loading}
              onClick={handleAnalyze}
              style={{ width: "100%", fontWeight: 700 }}
            >
              {loading ? (
                <>
                  <span className="animate-spin" style={{ marginRight: 6 }}>⏳</span>
                  <span>{labels.analyzing}</span>
                </>
              ) : (
                <span>{labels.analyzeBtn}</span>
              )}
            </Button>
          </div>
        ) : (
          /* Results View */
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Main Assessment Header Card */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "18px", display: "flex", flexDirection: "column", gap: "12px", boxShadow: "var(--shadow-sm)" }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <Badge variant={getSeverityBadgeVariant(result.healthStatus?.severity)}>
                    {getSeverityLabel(result.healthStatus?.severity)}
                  </Badge>
                  <span className="fc-muted" style={{ fontSize: "12px" }}>
                    {labels.confidence}: <strong style={{ color: "var(--brand)" }}>{result.healthStatus?.confidence || "Moderate"}</strong>
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearSelection}
                >
                  {labels.newAnalysis}
                </Button>
              </div>

              {/* Assessment Summary */}
              <div>
                <h3 className="fc-h3" style={{ margin: "0 0 6px 0", color: "var(--text)" }}>
                  {result.healthStatus?.primaryCondition || "Crop Health Assessment"}
                </h3>
                <p style={{ margin: 0, fontSize: "13.5px", lineHeight: "1.6", color: "var(--text-secondary)" }}>
                  {result.recommendations?.summary || result.rawText}
                </p>
              </div>

              {/* Action Bar: TTS, Save Insight, Ask Chat */}
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px", paddingTop: "12px", borderTop: "1px solid var(--border)" }}>
                <Button
                  type="button"
                  variant={isAudioPlaying ? "danger" : "outline"}
                  size="sm"
                  disabled={loadingAudio}
                  onClick={handlePlayTts}
                >
                  {loadingAudio ? (
                    <span>⏳ Loading audio...</span>
                  ) : isAudioPlaying ? (
                    <span>{labels.stopAudio}</span>
                  ) : (
                    <span>{labels.readAloud}</span>
                  )}
                </Button>

                <Button
                  type="button"
                  variant={savedInsight ? "secondary" : "outline"}
                  size="sm"
                  disabled={savedInsight}
                  onClick={handleSaveInsight}
                >
                  {savedInsight ? "✓ Saved" : labels.saveInsight}
                </Button>

                {onAskChat && (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => onAskChat(result)}
                    style={{ marginLeft: "auto" }}
                  >
                    {labels.askChat}
                  </Button>
                )}
              </div>
            </div>

            {/* Facts vs Reasoning Tabs */}
            <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-md)", overflow: "hidden", background: "var(--surface)" }}>
              <div style={{ display: "flex", borderBottom: "1px solid var(--border)", background: "var(--bg-soft)" }}>
                <button
                  type="button"
                  onClick={() => setActiveTab("facts")}
                  style={{
                    flex: 1,
                    padding: "10px 14px",
                    fontSize: "12.5px",
                    fontWeight: 700,
                    border: "none",
                    background: activeTab === "facts" ? "var(--surface)" : "transparent",
                    color: activeTab === "facts" ? "var(--brand)" : "var(--text-muted)",
                    borderBottom: activeTab === "facts" ? "2px solid var(--brand)" : "2px solid transparent",
                    cursor: "pointer"
                  }}
                >
                  {labels.observedSymptoms}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("reasoning")}
                  style={{
                    flex: 1,
                    padding: "10px 14px",
                    fontSize: "12.5px",
                    fontWeight: 700,
                    border: "none",
                    background: activeTab === "reasoning" ? "var(--surface)" : "transparent",
                    color: activeTab === "reasoning" ? "var(--brand)" : "var(--text-muted)",
                    borderBottom: activeTab === "reasoning" ? "2px solid var(--brand)" : "2px solid transparent",
                    cursor: "pointer"
                  }}
                >
                  {labels.possibleIssues}
                </button>
              </div>

              <div style={{ padding: "16px", fontSize: "13px" }}>
                {activeTab === "facts" ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <h5 style={{ margin: 0, fontWeight: 700, color: "var(--brand-dark)" }}>Directly Observed Features:</h5>
                    {Array.isArray(result.observedSymptoms) && result.observedSymptoms.length > 0 ? (
                      <ul style={{ margin: "4px 0 0 0", paddingLeft: "18px", display: "flex", flexDirection: "column", gap: "6px" }}>
                        {result.observedSymptoms.map((sym, idx) => (
                          <li key={idx} style={{ lineHeight: "1.5", color: "var(--text)" }}>{sym}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="fc-soft" style={{ margin: 0, fontStyle: "italic" }}>No specific physical symptoms identified.</p>
                    )}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {Array.isArray(result.possibleDiagnoses) && result.possibleDiagnoses.length > 0 ? (
                      result.possibleDiagnoses.map((diag, idx) => (
                        <div key={idx} style={{ padding: "10px 12px", borderRadius: "var(--radius-sm)", background: "var(--bg-soft)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "4px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontWeight: 700, color: "var(--text)" }}>{diag.condition || diag.name || `Diagnosis #${idx + 1}`}</span>
                            <span style={{ fontSize: "11px", color: "var(--accent)", fontWeight: 700 }}>{diag.likelihood || "Possible"}</span>
                          </div>
                          {diag.reasoning && (
                            <p style={{ margin: 0, fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.5" }}>{diag.reasoning}</p>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="fc-soft" style={{ margin: 0, fontStyle: "italic" }}>Analysis complete. Check recommendations below.</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Recommended Next Steps Card */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "18px", display: "flex", flexDirection: "column", gap: "12px", boxShadow: "var(--shadow-sm)" }}>
              <h4 style={{ margin: 0, fontSize: "13px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--brand-dark)" }}>
                {labels.nextSteps}
              </h4>
              {Array.isArray(result.recommendations?.immediateActions) && result.recommendations.immediateActions.length > 0 ? (
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "8px" }}>
                  {result.recommendations.immediateActions.map((action, idx) => (
                    <li key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "8px", background: "var(--bg-soft)", padding: "10px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", fontSize: "12.5px" }}>
                      <span style={{ color: "var(--brand)", fontWeight: "bold" }}>•</span>
                      <span style={{ lineHeight: "1.5", color: "var(--text)" }}>{action}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="fc-soft" style={{ margin: 0, fontSize: "12.5px", fontStyle: "italic" }}>No immediate chemical/biological intervention required.</p>
              )}

              {/* Prevention & Long-Term Advice */}
              {Array.isArray(result.recommendations?.preventativeMeasures) && result.recommendations.preventativeMeasures.length > 0 && (
                <div style={{ paddingTop: "12px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <h5 style={{ margin: 0, fontSize: "12px", fontWeight: 700, color: "var(--text-muted)" }}>
                    {labels.prevention}
                  </h5>
                  <ul style={{ margin: 0, paddingLeft: "18px", display: "flex", flexDirection: "column", gap: "4px" }}>
                    {result.recommendations.preventativeMeasures.map((prev, idx) => (
                      <li key={idx} style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.5" }}>{prev}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Safety Disclaimer Banner */}
            <div style={{ background: "var(--accent-light)", border: "1px solid var(--accent-border)", borderRadius: "var(--radius-sm)", padding: "12px 14px", fontSize: "11.5px", color: "var(--accent-dark)", lineHeight: "1.5" }}>
              {labels.disclaimer}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

export const CropImageAnalyzer = memo(CropImageAnalyzerBase);
export default CropImageAnalyzer;
