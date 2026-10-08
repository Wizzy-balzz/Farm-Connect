/**
 * In-memory sliding window rate limiter for Text-to-Speech (TTS) requests.
 * Protects speech synthesis endpoints against resource exhaustion and abuse.
 */

const userRequestsMap = new Map();

// Configuration
export const TTS_RATE_LIMIT_PER_MINUTE = parseInt(process.env.TTS_RATE_LIMIT_PER_MINUTE, 10) || 20;
export const TTS_RATE_LIMIT_PER_HOUR = parseInt(process.env.TTS_RATE_LIMIT_PER_HOUR, 10) || 100;

/**
 * Resets the TTS rate limiter store (useful for automated testing)
 */
export function resetTtsRateLimiter() {
  userRequestsMap.clear();
}

/**
 * TTS rate limit check middleware
 */
export function ttsRateLimiter(req, res, next) {
  const identifier = (req.user && req.user.id) || req.ip || req.connection?.remoteAddress || "unknown_client";
  const now = Date.now();

  const userHistory = userRequestsMap.get(identifier) || [];

  // Prune timestamps older than 1 hour (3600000 ms)
  const oneHourAgo = now - 3600000;
  const recentHistory = userHistory.filter(ts => ts > oneHourAgo);

  // Check 1-minute window
  const oneMinuteAgo = now - 60000;
  const requestsInLastMinute = recentHistory.filter(ts => ts > oneMinuteAgo).length;
  if (requestsInLastMinute >= TTS_RATE_LIMIT_PER_MINUTE) {
    return res.status(429).json({
      success: false,
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: `TTS request rate limit of ${TTS_RATE_LIMIT_PER_MINUTE} requests/minute exceeded. Please wait a moment before requesting speech again.`
      }
    });
  }

  // Check 1-hour window
  if (recentHistory.length >= TTS_RATE_LIMIT_PER_HOUR) {
    return res.status(429).json({
      success: false,
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: `TTS request rate limit of ${TTS_RATE_LIMIT_PER_HOUR} requests/hour exceeded. Please try again later.`
      }
    });
  }

  // Record this request timestamp
  recentHistory.push(now);
  userRequestsMap.set(identifier, recentHistory);

  next();
}
