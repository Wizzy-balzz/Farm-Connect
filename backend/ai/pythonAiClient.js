/**
 * FarmConnect Python AI Client Gateway
 * Authoritative communication bridge between Node.js Express backend
 * and local Python FastAPI AI/NLP microservice.
 * 
 * Features:
 * - Deterministic local NLP routing (Zero external Gemini dependencies)
 * - Safe internal service key authentication (X-Internal-Service-Key)
 * - Connection timeouts & transient error retries
 * - Subsystem health diagnostics & structured logging
 */

const DEFAULT_PYTHON_AI_URL = "http://127.0.0.1:8000";
const DEFAULT_INTERNAL_SECRET = "farmconnect_internal_ai_secret_dev_key";
const DEFAULT_TIMEOUT_MS = 15000;

export function getPythonAiBaseUrl() {
  return process.env.PYTHON_AI_URL || DEFAULT_PYTHON_AI_URL;
}

export function getInternalServiceKey() {
  return process.env.INTERNAL_API_SECRET || DEFAULT_INTERNAL_SECRET;
}

/**
 * Executes an HTTP request to the local Python AI service with retry and timeout.
 */
async function fetchPythonAi(endpoint, options = {}, retries = 1) {
  const baseUrl = getPythonAiBaseUrl().replace(/\/+$/, "");
  const url = `${baseUrl}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const internalKey = getInternalServiceKey();

  const headers = {
    "X-Internal-Service-Key": internalKey,
    ...(options.headers || {})
  };

  let lastError = null;
  const startTime = Date.now();

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        method: options.method || "GET",
        headers,
        body: options.body,
        signal: AbortSignal.timeout(timeoutMs)
      });

      const elapsed = Date.now() - startTime;

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        let parsedDetail = errorBody;
        try {
          const jsonErr = JSON.parse(errorBody);
          parsedDetail = jsonErr.detail?.message || jsonErr.detail || jsonErr.message || errorBody;
        } catch {
          // Keep raw text
        }
        console.warn(`[Python NLP] HTTP ${response.status} from ${endpoint} (${elapsed}ms): ${parsedDetail}`);
        return {
          ok: false,
          status: response.status,
          error: parsedDetail,
          elapsed
        };
      }

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = await response.json();
        return { ok: true, status: response.status, data, elapsed };
      } else {
        const buffer = Buffer.from(await response.arrayBuffer());
        return { ok: true, status: response.status, buffer, contentType, elapsed };
      }
    } catch (err) {
      lastError = err;
      const isTransient = err.name === "TimeoutError" || err.code === "ECONNREFUSED" || err.code === "ECONNRESET";
      if (attempt < retries && isTransient) {
        console.warn(`[Python NLP] Transient connection issue on attempt ${attempt + 1}, retrying in 300ms...`);
        await new Promise((r) => setTimeout(r, 300));
        continue;
      }
      break;
    }
  }

  const totalElapsed = Date.now() - startTime;
  console.error(`[Python NLP Error] Failed to connect to Python AI service at ${url} (${totalElapsed}ms):`, lastError?.message || lastError);
  return {
    ok: false,
    status: 503,
    error: `Python AI service unreachable: ${lastError?.message || "Connection refused"}`,
    elapsed: totalElapsed
  };
}

/**
 * Health check querying the local Python NLP service.
 */
export async function checkPythonAiHealth(timeoutMs = 3000) {
  const result = await fetchPythonAi("/health", { timeoutMs }, 0);
  if (result.ok && result.data) {
    return {
      status: "ONLINE",
      database: result.data.database,
      version: result.data.version,
      elapsed: result.elapsed
    };
  }
  return {
    status: "OFFLINE",
    error: result.error,
    elapsed: result.elapsed
  };
}

/**
 * Subsystem diagnostics query.
 */
export async function getPythonAiDiagnostics(timeoutMs = 4000) {
  const result = await fetchPythonAi("/api/ai/diagnostics", { timeoutMs }, 0);
  if (result.ok && result.data) {
    return {
      success: true,
      aiEngine: result.data.aiEngine || "ONLINE",
      nlpEngine: result.data.nlpEngine || "ONLINE",
      intentClassifier: result.data.intentClassifier || "READY",
      toolRouter: result.data.toolRouter || "READY",
      memory: result.data.memory || "READY",
      planner: result.data.planner || "READY",
      sttProvider: result.data.sttProvider || "local",
      ttsProvider: result.data.ttsProvider || "local",
      fallback: "ENABLED",
      latencyMs: result.elapsed,
      diagnosticsDetails: result.data.diagnosticsDetails || "Local Python NLP microservice active."
    };
  }
  return {
    success: false,
    aiEngine: "FALLBACK",
    nlpEngine: "OFFLINE",
    intentClassifier: "FALLBACK",
    toolRouter: "FALLBACK",
    memory: "FALLBACK",
    planner: "FALLBACK",
    sttProvider: "local",
    ttsProvider: "local",
    fallback: "ENABLED",
    latencyMs: result.elapsed,
    diagnosticsDetails: "Python AI service is offline. Local deterministic fallback active."
  };
}

/**
 * Sends chat prompt to Python NLP engine.
 */
export async function sendChatToPythonAi({ user, prompt, conversationId, lang = "en" }, timeoutMs = 25000) {
  const payload = {
    prompt,
    conversationId,
    lang,
    user: user ? {
      id: user.id,
      role: user.role,
      name: user.name || "User",
      email: user.email || null,
      region: user.region || null,
      district: user.district || user.region || null
    } : null
  };

  const result = await fetchPythonAi("/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    timeoutMs
  });

  return result;
}

/**
 * Transcribes audio via Python AI voice endpoint.
 */
export async function transcribeAudioWithPython(audioBuffer, mimeType = "audio/wav", language = "en", conversationId = null) {
  const formData = new FormData();
  const blob = new Blob([audioBuffer], { type: mimeType });
  formData.append("audio", blob, "voice_input.wav");
  if (language) formData.append("language", language);
  if (conversationId) formData.append("conversationId", conversationId);

  const result = await fetchPythonAi("/api/ai/voice", {
    method: "POST",
    body: formData,
    timeoutMs: 15000
  });

  return result;
}

/**
 * Synthesizes speech via Python AI TTS endpoint.
 */
export async function synthesizeSpeechWithPython(text, language = "en", voice = null) {
  const result = await fetchPythonAi("/api/ai/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, language, voice }),
    timeoutMs: 10000
  });

  return result;
}

/**
 * Analyzes crop image via Python AI vision endpoint.
 */
export async function analyzeCropImageWithPython(imageBuffer, mimeType = "image/jpeg", notes = "", language = "en", userId = null) {
  const formData = new FormData();
  const blob = new Blob([imageBuffer], { type: mimeType });
  formData.append("image", blob, "crop_image.jpg");
  if (notes) formData.append("notes", notes);
  if (language) formData.append("language", language);
  if (userId) formData.append("userId", userId);

  const result = await fetchPythonAi("/api/ai/image-analysis", {
    method: "POST",
    body: formData,
    timeoutMs: 20000
  });

  return result;
}
