import { verifyJwt } from "../utils/security.js";
import { query } from "../database.js";

/**
 * Helper to parse cookies from request headers
 */
export function parseCookies(req) {
  const list = {};
  const cookieHeader = req.headers.cookie;

  if (!cookieHeader) return list;

  cookieHeader.split(";").forEach((cookie) => {
    let [name, ...rest] = cookie.split("=");
    name = name?.trim();
    if (!name) return;
    const value = rest.join("=").trim();
    list[name] = decodeURIComponent(value);
  });

  return list;
}

/**
 * Extract auth token from httpOnly cookie or Authorization Bearer header
 */
export function getAuthToken(req) {
  // 1. Check httpOnly cookie first
  const cookies = parseCookies(req);
  if (cookies.fc_token) {
    return cookies.fc_token;
  }

  // 2. Fallback check for Authorization header: Bearer <token>
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7).trim();
  }

  return null;
}

/**
 * Authentication Middleware: Requires a valid session token
 */
export async function requireAuth(req, res, next) {
  const token = getAuthToken(req);

  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHENTICATED",
        message: "Authentication required. Please log in."
      }
    });
  }

  const decoded = verifyJwt(token);
  if (!decoded || !decoded.id) {
    return res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHENTICATED",
        message: "Invalid or expired session. Please log in again."
      }
    });
  }

  try {
    const user = await query.get("SELECT * FROM users WHERE id = ?", [decoded.id]);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHENTICATED",
          message: "User account no longer exists."
        }
      });
    }

    // Attach authenticated user to request
    req.user = user;
    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    return res.status(500).json({
      success: false,
      error: {
        code: "SERVER_ERROR",
        message: "Internal authentication error."
      }
    });
  }
}

/**
 * Role-Based Authorization Middleware: Restricts route to specific user roles
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHENTICATED",
          message: "Authentication required."
        }
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: `Access denied. Requires one of the following roles: ${allowedRoles.join(", ")}.`
        }
      });
    }

    next();
  };
}
