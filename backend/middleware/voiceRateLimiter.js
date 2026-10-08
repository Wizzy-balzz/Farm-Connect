/**
 * In-memory sliding window rate limiter for Voice / STT requests.
 * Protects against excessive audio uploads and transcription abuse.
 */

const userRequestsMap = new Map();

// Configuration
export const RATE_LIMIT_PER_MINUTE = parseInt(process.env.VOICE_RATE_LIMIT_PER_MINUTE, 10) || 10;
export const RATE_LIMIT_PER_HOUR = parseInt(process.env.VOICE_RATE_LIMIT_PER_HOUR, 10) || 60;

/**
 * Resets the rate limiter store (useful for automated testing)
 */
export function resetVoiceRateLimiter() {
  userRequestsMap.clear();
}

/**
 * Voice rate limit check middleware
 */
export function voiceRateLimiter(req, res, next) {
  const identifier = (req.user && req.user.id) || req.ip || req.connection?.remoteAddress || "unknown_client";
  const now = Date.now();

  const userHistory = userRequestsMap.get(identifier) || [];

  // Prune timestamps older than 1 hour (3600000 ms)
  const oneHourAgo = now - 3600000;
  const recentHistory = userHistory.filter(ts => ts > oneHourAgo);

  // Check 1-minute window
  const oneMinuteAgo = now - 60000;
  const requestsInLastMinute = recentHistory.filter(ts => ts > oneMinuteAgo).length;
  if (requestsInLastMinute >= RATE_LIMIT_PER_MINUTE) {
    return res.status(429).json({
      success: false,
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: `Voice request rate limit of ${RATE_LIMIT_PER_MINUTE} requests/minute exceeded. Please wait a moment before recording again.`
      }
    });
  }

  // Check 1-hour window
  if (recentHistory.length >= RATE_LIMIT_PER_HOUR) {
    return res.status(429).json({
      success: false,
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: `Voice request rate limit of ${RATE_LIMIT_PER_HOUR} requests/hour exceeded. Please try again later.`
      }
    });
  }

  // Record this request timestamp
  recentHistory.push(now);
  userRequestsMap.set(identifier, recentHistory);

  next();
}
