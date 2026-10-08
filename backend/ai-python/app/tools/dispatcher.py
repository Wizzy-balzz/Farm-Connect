"""
Tool Dispatcher for Python AI Tools.
Handles tool lookup, RBAC permissions, Pydantic argument validation,
safe execution, array truncation, and structured error handling.
"""

import inspect
import logging
from typing import Any, Dict, List, Optional
from pydantic import ValidationError

from app.tools.registry import TOOL_REGISTRY, get_tool
from app.tools.permissions import is_tool_allowed, sanitize_tool_params
from app.tools.schemas import ToolExecutionResult

logger = logging.getLogger("farmconnect.tools.dispatcher")

MAX_ARRAY_ITEMS = 10
SENSITIVE_KEYS = {
    "password", "password_hash", "passwordhash", "secret", "token", 
    "jwt", "otp", "auth_token", "api_key", "apikey", "refresh_token",
    "private_key", "salt", "credentials"
}


def sanitize_output_data(data: Any, max_array_items: int = MAX_ARRAY_ITEMS) -> Any:
    """
    Recursively sanitize output data:
    1. Truncate oversized arrays (> max_array_items) to prevent context explosion.
    2. Remove sensitive fields (passwords, tokens, secrets).
    """
    if isinstance(data, dict):
        cleaned = {}
        for k, v in data.items():
            if str(k).lower() in SENSITIVE_KEYS:
                continue
            cleaned[k] = sanitize_output_data(v, max_array_items)
        return cleaned
    elif isinstance(data, list):
        truncated = data[:max_array_items]
        return [sanitize_output_data(item, max_array_items) for item in truncated]
    return data


async def dispatch_tool(
    user: Dict[str, Any],
    tool_name: str,
    args: Optional[Dict[str, Any]] = None,
) -> ToolExecutionResult:
    """
    Execute a tool call with strict RBAC, validation, and sanitization.

    Args:
        user: Context dict containing at least 'id'/'user_id' and 'role'
        tool_name: Name of the registered tool
        args: Unvalidated dictionary of arguments

    Returns:
        ToolExecutionResult with success, data/error, and metadata
    """
    if args is None:
        args = {}

    # 1. Tool Lookup
    tool_def = get_tool(tool_name)
    if not tool_def:
        logger.warning(f"Tool not found: '{tool_name}'")
        return ToolExecutionResult(
            success=False,
            tool_name=tool_name,
            error={
                "code": "TOOL_NOT_FOUND",
                "message": f"Tool '{tool_name}' is not recognized or not available in Python.",
            },
        )

    # 2. Permission Validation
    if not is_tool_allowed(user, tool_name):
        user_role = user.get("role", "unknown")
        logger.warning(f"Forbidden: role '{user_role}' denied tool '{tool_name}'")
        return ToolExecutionResult(
            success=False,
            tool_name=tool_name,
            error={
                "code": "FORBIDDEN",
                "message": f"User with role '{user_role}' is not authorized to execute '{tool_name}'.",
            },
        )

    # 3. Argument Sanitization & Location Fallback
    sanitized_args = sanitize_tool_params(tool_name, args, user)

    # 4. Pydantic Argument Validation
    try:
        validated_input = tool_def.input_schema(**sanitized_args)
    except ValidationError as val_err:
        errors = val_err.errors()
        err_msg = "; ".join(f"{e.get('loc', ('param',))[-1]}: {e.get('msg', 'invalid')}" for e in errors)
        logger.warning(f"Invalid tool arguments for '{tool_name}': {err_msg}")
        return ToolExecutionResult(
            success=False,
            tool_name=tool_name,
            error={
                "code": "INVALID_TOOL_ARGUMENTS",
                "message": f"Invalid arguments for '{tool_name}': {err_msg}",
            },
        )
    except Exception as e:
        logger.warning(f"Unexpected argument parsing error for '{tool_name}': {e}")
        return ToolExecutionResult(
            success=False,
            tool_name=tool_name,
            error={
                "code": "INVALID_TOOL_ARGUMENTS",
                "message": f"Malformed arguments: {str(e)}",
            },
        )

    # 5. Handler Execution
    try:
        input_dict = validated_input.model_dump()
        handler = tool_def.handler

        # Pass user context if handler explicitly accepts it
        sig = inspect.signature(handler)
        kwargs = dict(input_dict)
        if "user" in sig.parameters:
            kwargs["user"] = user

        if inspect.iscoroutinefunction(handler):
            raw_result = await handler(**kwargs)
        else:
            raw_result = handler(**kwargs)

        # 6. Check for structured domain errors from handlers (e.g. WEATHER_UNAVAILABLE)
        if isinstance(raw_result, dict) and raw_result.get("error"):
            err_dict = raw_result["error"]
            if isinstance(err_dict, dict) and err_dict.get("code"):
                return ToolExecutionResult(
                    success=False,
                    tool_name=tool_name,
                    error=err_dict,
                )

        # 7. Output Sanitization & Truncation
        # Proposal tools return structured contracts — increase limit to avoid truncation
        _big_output_tools = (
            "getMyAiMemory", "getMyFarmingGoals", "getMyFollowUps", "executeCopilotPlan",
            "proposeUpdateProductPrice", "proposeUpdateInventory", "proposeCreateProductListing",
            "proposeCancelOrder", "proposeSendMessage",
        )
        max_items = 50 if tool_name in _big_output_tools else MAX_ARRAY_ITEMS
        safe_data = sanitize_output_data(raw_result, max_array_items=max_items)

        return ToolExecutionResult(
            success=True,
            tool_name=tool_name,
            data=safe_data,
        )

    except PermissionError as pe:
        logger.warning(f"Permission denied executing tool '{tool_name}': {pe}")
        return ToolExecutionResult(
            success=False,
            tool_name=tool_name,
            error={
                "code": "FORBIDDEN",
                "message": str(pe),
            },
        )
    except Exception as exc:
        logger.error(f"Error executing tool '{tool_name}': {exc}", exc_info=True)
        # Never expose stack traces to end users or Gemini
        return ToolExecutionResult(
            success=False,
            tool_name=tool_name,
            error={
                "code": "TOOL_EXECUTION_ERROR",
                "message": f"Execution of tool '{tool_name}' failed due to an internal error.",
            },
        )
