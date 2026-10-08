"""
Copilot Memory Read-Only Tools:
- getMyAiMemory
- searchMyAiMemory
- getRelevantUserContext

Exact port of read-only logic from backend/services/aiMemoryService.js and backend/ai/aiTools.js.
Strictly authenticated and isolated:
- User identity is ALWAYS extracted from trusted internal session context (user["id"]).
- Any user-supplied userId, farmerId, or vendorId in parameters is completely ignored.
- Parameterized SQL only.
- Strict sensitive content blacklisting and output scrubbing.
- Strictly read-only: NO database mutations allowed.
"""

import re
from typing import Any, Dict, List, Optional, Union
from app.database.connection import db

MAX_MEMORIES_PER_USER = 50
MAX_SEARCH_RESULTS = 10

ALLOWED_MEMORY_TYPES = {
    "preference",
    "crop_history",
    "strategy",
    "language",
    "unit",
    "notification",
    "general",
}

# Sensitive content blacklist to prevent credential/secret leakage or search
SENSITIVE_PATTERNS = [
    re.compile(r"password", re.IGNORECASE),
    re.compile(r"passwd", re.IGNORECASE),
    re.compile(r"jwt", re.IGNORECASE),
    re.compile(r"bearer\s+[a-zA-Z0-9_\-\.]+", re.IGNORECASE),
    re.compile(r"api[_-]?key", re.IGNORECASE),
    re.compile(r"secret", re.IGNORECASE),
    re.compile(r"token", re.IGNORECASE),
    re.compile(r"credit[_-]?card", re.IGNORECASE),
    re.compile(r"cvv", re.IGNORECASE),
    re.compile(r"otp", re.IGNORECASE),
    re.compile(r"private[_-]?key", re.IGNORECASE),
    re.compile(r"auth[_-]?header", re.IGNORECASE),
]

SENSITIVE_KEYS = {
    "password", "password_hash", "passwordhash", "secret", "token",
    "jwt", "otp", "auth_token", "api_key", "apikey", "refresh_token",
    "private_key", "salt", "credentials"
}


def sanitize_memory_content(text: str) -> str:
    """Validates text against sensitive secrets & prompt injection attacks."""
    if not text or not isinstance(text, str):
        return ""

    # Reject secrets
    for pattern in SENSITIVE_PATTERNS:
        if pattern.search(text):
            raise ValueError(
                "SENSITIVE_DATA_PROHIBITED: AI memory cannot store or search passwords, tokens, or security credentials."
            )

    # Strip script tags or injection attempts
    cleaned = re.sub(r"<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>", "", text, flags=re.IGNORECASE)
    cleaned = re.sub(r"javascript:", "", cleaned, flags=re.IGNORECASE).strip()
    return cleaned


def scrub_sensitive_dict(item: Dict[str, Any]) -> Dict[str, Any]:
    """Ensure no private user credentials leak from memory rows."""
    return {k: v for k, v in item.items() if str(k).lower() not in SENSITIVE_KEYS}


async def get_my_ai_memory(
    user: Dict[str, Any],
    memoryType: Optional[str] = None,
    **kwargs: Any
) -> List[Dict[str, Any]]:
    """
    Retrieve user's saved personal preferences, past crops, and copilot memory records.
    Strictly scoped to authenticated user["id"].
    """
    user_id = str(user.get("id") or user.get("user_id") or "").strip()
    if not user_id:
        return []

    sql = "SELECT * FROM ai_user_memory WHERE userId = ? AND isActive = 1"
    params: List[Any] = [user_id]

    if memoryType and str(memoryType).strip() in ALLOWED_MEMORY_TYPES:
        sql += " AND memoryType = ?"
        params.append(str(memoryType).strip())

    sql += " ORDER BY updatedAt DESC LIMIT ?"
    params.append(MAX_MEMORIES_PER_USER)

    rows = db.query_all(sql, params) or []
    return [scrub_sensitive_dict(row) for row in rows]


async def search_my_ai_memory(
    user: Dict[str, Any],
    query: str,
    **kwargs: Any
) -> Union[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Search user's saved personal preferences or memory records by keyword.
    Strictly scoped to authenticated user["id"].
    """
    user_id = str(user.get("id") or user.get("user_id") or "").strip()
    if not user_id or not query or not isinstance(query, str):
        return []

    try:
        clean_q = sanitize_memory_content(query).lower()
    except ValueError as ve:
        # Structured error if sensitive secret searched
        return {"error": {"code": "SENSITIVE_DATA_PROHIBITED", "message": str(ve)}}

    if not clean_q:
        return []

    sql = """
        SELECT * FROM ai_user_memory
        WHERE userId = ? AND isActive = 1
          AND (LOWER(`key`) LIKE ? OR LOWER(`value`) LIKE ?)
        ORDER BY updatedAt DESC LIMIT ?
    """
    like_param = f"%{clean_q}%"
    rows = db.query_all(sql, [user_id, like_param, like_param, MAX_SEARCH_RESULTS]) or []
    return [scrub_sensitive_dict(row) for row in rows]


async def get_relevant_user_context(
    user: Dict[str, Any],
    **kwargs: Any
) -> Dict[str, Any]:
    """
    Retrieve comprehensive summary of user profile, saved preferences, active goals, and ongoing farming context.
    Matches exact formatting and structure of Node's getRelevantUserContext.
    """
    user_id = str(user.get("id") or user.get("user_id") or "").strip()
    if not user_id:
        return {"memories": [], "summary": ""}

    memories = await get_my_ai_memory(user)
    if not memories:
        role = user.get("role") or "user"
        region = user.get("region") or "Not specified"
        return {
            "memories": [],
            "summary": f"Role: {role}. Region: {region}."
        }

    memory_lines = [
        f"- [{m.get('memoryType', 'general')}] {m.get('key', '')}: {m.get('value', '')} (Confidence: {m.get('confidence') or 'high'})"
        for m in memories
    ]
    summary = "Known User Preferences & Context:\n" + "\n".join(memory_lines)

    return {
        "memories": memories,
        "summary": summary
    }
