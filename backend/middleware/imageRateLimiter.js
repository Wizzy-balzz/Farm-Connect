/**
 * In-memory sliding window rate limiter for Crop Image Analysis requests.
 * Limits: 5 requests / minute, 30 requests / hour per user identifier.
 */

const userRequestsMap = new Map();

export const IMAGE_RATE_LIMIT_PER_MINUTE = parseInt(process.env.IMAGE_RATE_LIMIT_PER_MINUTE, 10) || 5;
export const IMAGE_RATE_LIMIT_PER_HOUR = parseInt(process.env.IMAGE_RATE_LIMIT_PER_HOUR, 10) || 30;

/**
 * Resets the rate limiter store (useful for automated testing)
 */
export function resetImageRateLimiter() {
  userRequestsMap.clear();
}

/**
 * Image analysis rate limit check middleware
 */
export function imageRateLimiter(req, res, next) {
  const identifier = (req.user && req.user.id) || req.ip || req.connection?.remoteAddress || "unknown_client";
  const now = Date.now();

  const userHistory = userRequestsMap.get(identifier) || [];

  // Prune timestamps older than 1 hour (3600000 ms)
  const oneHourAgo = now - 3600000;
  const recentHistory = userHistory.filter(ts => ts > oneHourAgo);

  // Check 1-minute window
  const oneMinuteAgo = now - 60000;
  const requestsInLastMinute = recentHistory.filter(ts => ts > oneMinuteAgo).length;
  if (requestsInLastMinute >= IMAGE_RATE_LIMIT_PER_MINUTE) {
    return res.status(429).json({
      success: false,
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: `Image analysis rate limit of ${IMAGE_RATE_LIMIT_PER_MINUTE} requests/minute exceeded. Please wait a minute before analyzing another image.`
      }
    });
  }

  // Check 1-hour window
  if (recentHistory.length >= IMAGE_RATE_LIMIT_PER_HOUR) {
    return res.status(429).json({
      success: false,
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: `Image analysis rate limit of ${IMAGE_RATE_LIMIT_PER_HOUR} requests/hour exceeded. Please try again later.`
      }
    });
  }

  // Record this request timestamp
  recentHistory.push(now);
  userRequestsMap.set(identifier, recentHistory);

  next();
}
