import logging
import re
import sys
from typing import Optional
from app.core.config import settings

SECRET_PATTERNS = [
    re.compile(r"(?:key|secret|password|token|jwt|auth)=([^\s&]+)", re.IGNORECASE),
    re.compile(r"Bearer\s+([a-zA-Z0-9_\-\.]+)", re.IGNORECASE),
]


def sanitize_log_message(msg: str) -> str:
    """Sanitizes sensitive tokens, API keys, and credentials from log strings."""
    if not isinstance(msg, str):
        return str(msg)

    sanitized = msg
    api_key = getattr(settings, "GEMINI_API_KEY", "")
    if api_key and len(api_key) > 8:
        sanitized = sanitized.replace(api_key, "[REDACTED_API_KEY]")

    internal_secret = settings.INTERNAL_API_SECRET
    if internal_secret and len(internal_secret) > 4:
        sanitized = sanitized.replace(internal_secret, "[REDACTED_SECRET]")

    for pattern in SECRET_PATTERNS:
        sanitized = pattern.sub(r"\1=[REDACTED]", sanitized)

    return sanitized


class SanitizingFormatter(logging.Formatter):
    """Custom logging formatter that strips sensitive data before output."""

    def format(self, record: logging.LogRecord) -> str:
        record.msg = sanitize_log_message(str(record.msg))
        return super().format(record)


def setup_logger(name: str = "farmconnect-ai") -> logging.Logger:
    """Configures and returns a sanitized application logger."""
    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO))

    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        formatter = SanitizingFormatter(
            fmt="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)

    return logger


logger = setup_logger()
