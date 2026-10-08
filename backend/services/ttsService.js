/**
 * FarmConnect Phase 5 Text-to-Speech (TTS) Service
 * 
 * Provides isolated, backend-driven speech synthesis for final AI responses.
 * Native support for English (en), Tamil (ta), and Hindi (hi).
 * 
 * CRITICAL ARCHITECTURAL CONSTRAINTS:
 * 1. Single source of truth: Synthesizes ONLY after processAiChat() produces the final text response.
 * 2. Never decides facts, executes tools, or alters agricultural meaning.
 * 3. In-memory buffer delivery; zero persistent disk storage of audio files.
 */

export const MAX_TTS_TEXT_LENGTH = parseInt(process.env.MAX_TTS_TEXT_LENGTH, 10) || 5000;
export const SUPPORTED_TTS_LANGUAGES = ["en", "ta", "hi"];

/**
 * Strips markdown styling, backticks, headings, and non-speech visual emojis
 * while strictly preserving all factual content, numbers, currency symbols, and units.
 */
export function cleanTextForTts(text, language = "en") {
  if (!text || typeof text !== "string") return "";

  let cleaned = text;

  // 1. Remove Markdown headers (#, ##, ###, etc.)
  cleaned = cleaned.replace(/^#{1,6}\s+/gm, "");

  // 2. Remove Markdown bold/italic markers (**text**, *text*, __text__, _text_)
  cleaned = cleaned.replace(/(\*\*|__)(.*?)\1/g, "$2");
  cleaned = cleaned.replace(/(\*|_)(.*?)\1/g, "$2");

  // 3. Remove Markdown code blocks & inline backticks
  cleaned = cleaned.replace(/```[\s\S]*?```/g, "");
  cleaned = cleaned.replace(/`([^`]+)`/g, "$1");

  // 4. Remove Markdown links [text](url) -> text
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // 5. Remove bullet point markers at start of lines (*, -, +, •) and numbered lists
  cleaned = cleaned.replace(/^\s*[-*+•]\s+/gm, "");
  cleaned = cleaned.replace(/^\s*\d+\.\s+/gm, "");

  // 6. Remove common visual-only agricultural and UI emojis to avoid awkward TTS reading
  // (e.g. 🍅, 🌾, 📈, 📉, ⚠️, ⭐, 🛒, 📦, 🌧️, ☀️, 💡, 🏷️, 🔍, 🚨, ℹ️, 💰, 🚚, etc.)
  // Keep punctuation, digits, currencies, and alphabets completely intact.
  cleaned = cleaned.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "");

  // 7. Normalize multiple spaces, tabs, and excessive newlines into clean sentence pauses
  cleaned = cleaned.replace(/\r\n|\r/g, "\n");
  cleaned = cleaned.replace(/\n{2,}/g, ". ");
  cleaned = cleaned.replace(/\n/g, ", ");
  cleaned = cleaned.replace(/\s{2,}/g, " ");

  // 8. Trim and ensure text ends cleanly
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Splits text into sentence-sized chunks appropriate for TTS engines.
 */
export function splitTextIntoChunks(text, maxChunkLength = 180) {
  if (!text) return [];
  if (text.length <= maxChunkLength) return [text];

  // Match sentences ending in punctuation (. ! ? । etc.)
  const regex = /[^.!?।\n]+[.!?।\n]*/g;
  const rawSentences = text.match(regex) || [text];

  const chunks = [];
  let currentChunk = "";

  for (const sentence of rawSentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    if (currentChunk.length + trimmed.length + 1 <= maxChunkLength) {
      currentChunk = currentChunk ? `${currentChunk} ${trimmed}` : trimmed;
    } else {
      if (currentChunk) chunks.push(currentChunk);

      if (trimmed.length <= maxChunkLength) {
        currentChunk = trimmed;
      } else {
        // Fallback: split long sentences by comma or space
        const words = trimmed.split(" ");
        currentChunk = "";
        for (const word of words) {
          if (currentChunk.length + word.length + 1 <= maxChunkLength) {
            currentChunk = currentChunk ? `${currentChunk} ${word}` : word;
          } else {
            if (currentChunk) chunks.push(currentChunk);
            currentChunk = word;
          }
        }
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Synthesizes a text string into playable audio bytes.
 * 
 * @param {Object} params
 * @param {string} params.text - The AI generated text response to speak
 * @param {string} [params.language] - Language code ('en', 'ta', 'hi')
 * @param {string} [params.voice] - Optional voice name/identifier
 * @param {string} [params.provider] - Optional provider override ('google', 'gemini', 'mock')
 * @returns {Promise<{success: boolean, audioBuffer?: Buffer, mimeType?: string, language?: string, provider?: string, error?: {code: string, message: string}}>}
 */
export async function synthesizeSpeech({ text, language = "en", voice = null, provider = null }) {
  // 1. Validate text presence
  if (!text || typeof text !== "string" || !text.trim()) {
    return {
      success: false,
      error: {
        code: "EMPTY_TEXT",
        message: "Text string is required for speech synthesis."
      }
    };
  }

  // 2. Validate maximum text length
  if (text.length > MAX_TTS_TEXT_LENGTH) {
    return {
      success: false,
      error: {
        code: "TEXT_TOO_LONG",
        message: `Text exceeds maximum allowed length of ${MAX_TTS_TEXT_LENGTH} characters.`
      }
    };
  }

  // 3. Normalize & validate language
  let cleanLang = (language || "en").toLowerCase().trim();
  
  // Script-based language fallback: if text has Tamil or Devanagari script, respect the script
  if (/[\u0B80-\u0BFF]/.test(text)) {
    cleanLang = "ta";
  } else if (/[\u0900-\u097F]/.test(text)) {
    cleanLang = "hi";
  }

  if (!SUPPORTED_TTS_LANGUAGES.includes(cleanLang)) {
    return {
      success: false,
      error: {
        code: "UNSUPPORTED_LANGUAGE",
        message: `Language '${cleanLang}' is not supported for voice replies. Supported: en, ta, hi.`
      }
    };
  }

  // 4. Clean text of markdown and non-spoken formatting
  const speechText = cleanTextForTts(text, cleanLang);
  if (!speechText) {
    return {
      success: false,
      error: {
        code: "EMPTY_TEXT_AFTER_CLEANING",
        message: "Text content contains no readable speech."
      }
    };
  }

  const KNOWN_PROVIDERS = ["python", "python-tts", "local", "google", "google-tts", "mock", "fallback"];
  if (provider && !KNOWN_PROVIDERS.includes(provider.toLowerCase())) {
    return {
      success: false,
      error: {
        code: "TTS_PROVIDER_ERROR",
        message: `Configured TTS provider '${provider}' is not supported.`
      }
    };
  }

  let activeProvider = provider || process.env.TTS_PROVIDER || "python";
  if (activeProvider === "gemini") {
    activeProvider = "python";
  }

  // 5. Mock Provider for Unit & CI Testing
  if (activeProvider === "mock") {
    // Generate deterministic dummy audio/mpeg byte stream
    const dummyMp3Header = Buffer.from([0xFF, 0xFB, 0x90, 0x64, 0x00, 0x00, 0x00, 0x00]);
    const textBuffer = Buffer.from(`MOCK_AUDIO_${cleanLang}_${speechText.slice(0, 40)}`, "utf8");
    const audioBuffer = Buffer.concat([dummyMp3Header, textBuffer]);

    return {
      success: true,
      audioBuffer,
      mimeType: "audio/mpeg",
      language: cleanLang,
      provider: "mock"
    };
  }

  // 6. Python Local TTS Provider (Primary)
  try {
    const { synthesizeSpeechWithPython } = await import("../ai/pythonAiClient.js");
    const pyResult = await synthesizeSpeechWithPython(speechText, cleanLang, voice);
    if (pyResult.ok && pyResult.buffer) {
      return {
        success: true,
        audioBuffer: pyResult.buffer,
        mimeType: pyResult.contentType || "audio/mpeg",
        language: cleanLang,
        provider: "python-tts"
      };
    }
  } catch (pyErr) {
    console.warn("[TtsService Notice]: Local Python TTS endpoint notice:", pyErr.message);
  }

  // 7. Fallback: Local Speech Synthesis Provider
  try {
    const chunks = splitTextIntoChunks(speechText, 180);
    const audioBuffers = [];

    for (const chunk of chunks) {
      if (!chunk.trim()) continue;
      const encoded = encodeURIComponent(chunk.trim());
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=${cleanLang}&client=tw-ob`;

      const res = await fetch(ttsUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        signal: AbortSignal.timeout(8000)
      });

      if (!res.ok) {
        throw new Error(`Local TTS fallback endpoint responded with HTTP ${res.status}`);
      }

      const arrayBuffer = await res.arrayBuffer();
      audioBuffers.push(Buffer.from(arrayBuffer));
    }

    if (audioBuffers.length === 0) {
      throw new Error("No audio chunks received from fallback TTS");
    }

    const combinedAudio = Buffer.concat(audioBuffers);

    return {
      success: true,
      audioBuffer: combinedAudio,
      mimeType: "audio/mpeg",
      language: cleanLang,
      provider: "local-fallback"
    };
  } catch (err) {
    console.error("[TtsService Error]:", err.message || err);
    return {
      success: false,
      error: {
        code: "TTS_UNAVAILABLE",
        message: "Speech synthesis service is temporarily unavailable. Please try again later."
      }
    };
  }

  // 8. Unsupported Provider Configured
  return {
    success: false,
    error: {
      code: "TTS_PROVIDER_ERROR",
      message: `Configured TTS provider '${activeProvider}' is not supported.`
    }
  };
}
