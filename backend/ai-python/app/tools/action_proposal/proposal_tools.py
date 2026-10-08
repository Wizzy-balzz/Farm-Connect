"""
Phase 3C-4: Action Proposal Contract Tools

Python side ONLY formulates structured action proposals.
ALL execution, token generation, token validation, persistence,
confirmation, transactions, row locks, and mutations remain
EXCLUSIVELY in Node.js (backend/ai/aiActions.js).

This module is the Python "prepare / validate / propose" layer only.
It returns a structured ProposalContract that Node MUST validate
independently before any mutation is executed.

Security guarantees:
- Identity (userId) is always derived from the authenticated user context.
- Python NEVER generates confirmation tokens.
- Python NEVER persists to ai_pending_actions.
- Python NEVER executes UPDATE/INSERT/DELETE business SQL.
- Python NEVER bypasses Node confirmation authority.
- Proposal parameters are validated but Node MUST re-validate independently.
- Gemini output is treated as untrusted input and passes through validation.
- The database connection's own mutation guard blocks any mutation attempt.
"""

from typing import Any, Dict, Optional
from app.database.connection import db

# Forbidden identity fields that must NEVER be passed through from untrusted input
FORBIDDEN_IDENTITY_OVERRIDE_FIELDS = {
    "userId", "farmerId", "vendorId", "accountId",
    "user_id", "farmer_id", "vendor_id",
}

# Fields that could bypass confirmation — MUST be stripped from proposal
FORBIDDEN_BYPASS_FIELDS = {
    "confirmationToken", "tokenHash", "confirmation_token", "token_hash",
    "skipConfirmation", "bypassConfirmation", "autoExecute", "force",
    "sqlOverride", "transactionId", "lockTarget",
}

# Role authorization for each action type
ACTION_ROLES = {
    "UPDATE_PRODUCT_PRICE": ["farmer", "admin"],
    "UPDATE_INVENTORY": ["farmer", "admin"],
    "CREATE_PRODUCT_LISTING": ["farmer", "admin"],
    "CANCEL_ORDER": ["farmer", "vendor", "admin"],
    "SEND_MESSAGE": ["farmer", "vendor", "admin"],
}


def _check_rbac(user: Dict[str, Any], action_id: str) -> Optional[Dict[str, str]]:
    """Verify user role is authorized for the action. Returns error dict or None."""
    role = (user.get("role") or "").lower()
    allowed_roles = ACTION_ROLES.get(action_id, [])
    if role not in allowed_roles:
        return {
            "code": "FORBIDDEN",
            "message": f"Role '{role}' is not authorized to propose '{action_id}'."
        }
    return None


def _validate_price(price: Any) -> Optional[str]:
    """Validate a price value. Returns error message string or None."""
    try:
        p = float(price)
    except (TypeError, ValueError):
        return "Price must be a valid positive number."
    if p <= 0:
        return "Price must be greater than zero."
    if p > 100000:
        return "Price exceeds the maximum platform limit (₹1,00,000)."
    return None


async def propose_update_product_price(
    user: Dict[str, Any],
    commodity: Optional[str] = None,
    productId: Optional[str] = None,
    newPrice: Optional[float] = None,
    price: Optional[float] = None,
    **kwargs
) -> Dict[str, Any]:
    """
    Formulate a structured proposal to update a product's selling price.

    SECURITY:
    - Identity derived strictly from user context — not from parameters.
    - productId/commodity looked up READ-ONLY — no mutation made.
    - Proposal returned is a structured contract for Node to validate and execute.
    - Node MUST independently re-validate ownership, stale state, and RBAC before any mutation.
    """
    rbac_err = _check_rbac(user, "UPDATE_PRODUCT_PRICE")
    if rbac_err:
        return {"success": False, "error": rbac_err}

    proposed_price_raw = newPrice if newPrice is not None else price
    price_err = _validate_price(proposed_price_raw)
    if price_err:
        return {"success": False, "error": {"code": "INVALID_PARAMETERS", "message": price_err}}

    proposed_price = float(proposed_price_raw)
    authenticated_user_id = str(user.get("id") or user.get("user_id") or "")

    # Look up product for context (read-only, no lock, no mutation)
    product = None
    try:
        if productId:
            product = db.query_get(
                "SELECT id, name, price, stock, unit, farmerId FROM products WHERE id = ?",
                [productId]
            )
        if not product and commodity:
            normalized = commodity.strip()
            product = db.query_get(
                "SELECT id, name, price, stock, unit, farmerId FROM products "
                "WHERE farmerId = ? AND (name LIKE ? OR category LIKE ?) "
                "ORDER BY createdAt DESC LIMIT 1",
                [authenticated_user_id, f"%{normalized}%", f"%{normalized}%"]
            )
    except PermissionError:
        raise
    except Exception:
        pass

    if not product:
        return {
            "success": False,
            "error": {
                "code": "RESOURCE_NOT_FOUND",
                "message": f"No active product listing found for '{commodity or productId}'."
            }
        }

    # Anti-IDOR: Python enforces ownership before formulating proposal
    product_farmer_id = str(product.get("farmerId") or product.get("farmerid") or "")
    role = (user.get("role") or "").lower()
    if product_farmer_id != authenticated_user_id and role != "admin":
        return {
            "success": False,
            "error": {
                "code": "OWNERSHIP_VIOLATION",
                "message": "You are not authorized to update products belonging to another farmer."
            }
        }

    current_price = float(product.get("price") or 0)
    product_id = str(product.get("id") or "")
    product_name = str(product.get("name") or "")
    product_unit = str(product.get("unit") or "kg")

    return {
        "success": True,
        "requiresNodeExecution": True,
        "proposal": {
            "actionId": "UPDATE_PRODUCT_PRICE",
            "riskLevel": "SENSITIVE",
            "authenticatedUserId": authenticated_user_id,
            "authenticatedUserRole": role,
            "parameters": {
                "productId": product_id,
                "proposedPrice": proposed_price,
            },
            "context": {
                "productName": product_name,
                "currentPrice": current_price,
                "unit": product_unit,
            },
            "humanReadableSummary": (
                f"Update price for '{product_name}' from "
                f"₹{current_price}/{product_unit} to "
                f"₹{proposed_price}/{product_unit}."
            ),
            "nodeValidationRequired": [
                "re-verify product ownership in transaction",
                "re-verify stale state (price may have changed)",
                "acquire row lock (SELECT ... FOR UPDATE)",
                "generate confirmation token",
                "persist pending action to ai_pending_actions",
            ],
            "pythonMutationStatus": "NONE — Python did not mutate any data",
        }
    }


async def propose_update_inventory(
    user: Dict[str, Any],
    commodity: Optional[str] = None,
    productId: Optional[str] = None,
    quantityDelta: Optional[float] = None,
    newStock: Optional[float] = None,
    stock: Optional[float] = None,
    **kwargs
) -> Dict[str, Any]:
    """
    Formulate a structured proposal to update inventory quantity.

    SECURITY: Read-only lookup. Strict ownership check.
    No mutation whatsoever.
    """
    rbac_err = _check_rbac(user, "UPDATE_INVENTORY")
    if rbac_err:
        return {"success": False, "error": rbac_err}

    if newStock is None and stock is None and quantityDelta is None:
        return {
            "success": False,
            "error": {"code": "INVALID_PARAMETERS", "message": "Provide newStock, stock, or quantityDelta."}
        }

    authenticated_user_id = str(user.get("id") or user.get("user_id") or "")
    role = (user.get("role") or "").lower()

    product = None
    try:
        if productId:
            product = db.query_get(
                "SELECT id, name, price, stock, unit, farmerId FROM products WHERE id = ?",
                [productId]
            )
        if not product and commodity:
            normalized = commodity.strip()
            product = db.query_get(
                "SELECT id, name, price, stock, unit, farmerId FROM products "
                "WHERE farmerId = ? AND (name LIKE ? OR category LIKE ?) "
                "ORDER BY createdAt DESC LIMIT 1",
                [authenticated_user_id, f"%{normalized}%", f"%{normalized}%"]
            )
    except PermissionError:
        raise
    except Exception:
        pass

    if not product:
        return {
            "success": False,
            "error": {
                "code": "RESOURCE_NOT_FOUND",
                "message": f"No active product listing found for '{commodity or productId}'."
            }
        }

    product_farmer_id = str(product.get("farmerId") or product.get("farmerid") or "")
    if product_farmer_id != authenticated_user_id and role != "admin":
        return {
            "success": False,
            "error": {
                "code": "OWNERSHIP_VIOLATION",
                "message": "You are not authorized to modify inventory belonging to another farmer."
            }
        }

    current_stock = int(product.get("stock") or 0)
    if newStock is not None:
        target_stock = int(newStock)
    elif stock is not None:
        target_stock = int(stock)
    else:
        target_stock = current_stock + int(quantityDelta)

    if target_stock < 0:
        return {
            "success": False,
            "error": {"code": "INVALID_PARAMETERS", "message": "Inventory stock cannot be negative."}
        }

    product_id = str(product.get("id") or "")
    product_name = str(product.get("name") or "")
    product_unit = str(product.get("unit") or "kg")

    return {
        "success": True,
        "requiresNodeExecution": True,
        "proposal": {
            "actionId": "UPDATE_INVENTORY",
            "riskLevel": "SENSITIVE",
            "authenticatedUserId": authenticated_user_id,
            "authenticatedUserRole": role,
            "parameters": {
                "productId": product_id,
                "newStock": target_stock,
            },
            "context": {
                "productName": product_name,
                "currentStock": current_stock,
                "unit": product_unit,
                "delta": target_stock - current_stock,
            },
            "humanReadableSummary": (
                f"Update inventory for '{product_name}' from "
                f"{current_stock} to {target_stock} {product_unit}."
            ),
            "nodeValidationRequired": [
                "re-verify product ownership in transaction",
                "re-verify stale state (stock may have changed)",
                "acquire row lock (SELECT ... FOR UPDATE)",
                "generate confirmation token",
                "persist pending action to ai_pending_actions",
            ],
            "pythonMutationStatus": "NONE — Python did not mutate any data",
        }
    }


async def propose_create_product_listing(
    user: Dict[str, Any],
    name: Optional[str] = None,
    category: Optional[str] = None,
    price: Optional[float] = None,
    stock: Optional[float] = None,
    unit: Optional[str] = None,
    organic: Optional[bool] = None,
    description: Optional[str] = None,
    moq: Optional[float] = None,
    **kwargs
) -> Dict[str, Any]:
    """
    Formulate a structured proposal to create a new product listing.

    SECURITY: No INSERT is performed. authenticatedUserId is always
    the farmerId — never from parameters (Anti-IDOR).
    """
    rbac_err = _check_rbac(user, "CREATE_PRODUCT_LISTING")
    if rbac_err:
        return {"success": False, "error": rbac_err}

    authenticated_user_id = str(user.get("id") or user.get("user_id") or "")
    role = (user.get("role") or "").lower()

    if not name or not str(name).strip():
        return {"success": False, "error": {"code": "INVALID_PARAMETERS", "message": "Product name is required."}}

    price_err = _validate_price(price)
    if price_err:
        return {"success": False, "error": {"code": "INVALID_PARAMETERS", "message": price_err}}

    parsed_price = float(price)
    try:
        parsed_stock = int(stock)
    except (TypeError, ValueError):
        return {"success": False, "error": {"code": "INVALID_PARAMETERS", "message": "Valid positive stock quantity is required."}}

    if parsed_stock <= 0:
        return {"success": False, "error": {"code": "INVALID_PARAMETERS", "message": "Stock quantity must be positive."}}

    clean_name = str(name).strip()
    clean_category = str(category or "Vegetables").strip()
    clean_unit = str(unit or "kg").strip()
    clean_desc = str(description or f"Freshly harvested {clean_name}").strip()
    clean_moq = max(1, int(moq or 10))

    return {
        "success": True,
        "requiresNodeExecution": True,
        "proposal": {
            "actionId": "CREATE_PRODUCT_LISTING",
            "riskLevel": "SENSITIVE",
            "authenticatedUserId": authenticated_user_id,
            "authenticatedUserRole": role,
            "parameters": {
                # NOTE: farmerId MUST be injected by Node from authenticated session
                # It is intentionally NOT included here to prevent IDOR
                "name": clean_name,
                "category": clean_category,
                "price": parsed_price,
                "stock": parsed_stock,
                "unit": clean_unit,
                "moq": clean_moq,
                "organic": bool(organic),
                "description": clean_desc,
            },
            "context": {
                "noteForNode": "farmerId MUST be set from authenticated session, NOT from Python proposal"
            },
            "humanReadableSummary": (
                f"Create marketplace listing: '{clean_name}' "
                f"at ₹{parsed_price}/{clean_unit}, "
                f"{parsed_stock} {clean_unit} available."
            ),
            "nodeValidationRequired": [
                "verify authenticated farmerId from session (NOT from proposal parameters)",
                "validate required fields",
                "check business rules",
                "generate confirmation token",
                "persist pending action to ai_pending_actions",
            ],
            "pythonMutationStatus": "NONE — Python did not mutate any data",
        }
    }


async def propose_cancel_order(
    user: Dict[str, Any],
    orderId: Optional[str] = None,
    reason: Optional[str] = None,
    **kwargs
) -> Dict[str, Any]:
    """
    Formulate a structured proposal to cancel a pending order.

    SECURITY: No UPDATE is performed. Ownership and order status
    validated read-only. Node MUST re-validate with transaction + row lock.
    """
    rbac_err = _check_rbac(user, "CANCEL_ORDER")
    if rbac_err:
        return {"success": False, "error": rbac_err}

    if not orderId:
        return {"success": False, "error": {"code": "INVALID_PARAMETERS", "message": "Order ID is required."}}

    authenticated_user_id = str(user.get("id") or user.get("user_id") or "")
    role = (user.get("role") or "").lower()

    try:
        order = db.query_get(
            "SELECT id, status, totalAmount, vendorId FROM orders WHERE id = ?",
            [orderId]
        )
    except PermissionError:
        raise
    except Exception:
        order = None

    if not order:
        return {
            "success": False,
            "error": {"code": "RESOURCE_NOT_FOUND", "message": f"Order #{orderId} was not found."}
        }

    # Authorization check (read-only)
    vendor_id = str(order.get("vendorId") or order.get("vendorid") or "")
    is_authorized = role == "admin" or vendor_id == authenticated_user_id

    if not is_authorized and role == "farmer":
        try:
            item = db.query_get(
                "SELECT id FROM order_items WHERE orderId = ? AND farmerId = ? LIMIT 1",
                [orderId, authenticated_user_id]
            )
            if item:
                is_authorized = True
        except Exception:
            pass

    if not is_authorized:
        return {
            "success": False,
            "error": {"code": "OWNERSHIP_VIOLATION", "message": "You are not authorized to cancel this order."}
        }

    current_status = str(order.get("status") or "")
    if current_status.lower() not in ("pending", "payment_pending"):
        return {
            "success": False,
            "error": {
                "code": "BUSINESS_RULE_VIOLATION",
                "message": (
                    f"Order #{orderId} cannot be cancelled (current status: '{current_status}'). "
                    "Only pending orders can be cancelled."
                )
            }
        }

    clean_reason = str(reason or "User requested cancellation via AI.").strip()[:500]
    total_amount = float(order.get("totalAmount") or 0)

    return {
        "success": True,
        "requiresNodeExecution": True,
        "proposal": {
            "actionId": "CANCEL_ORDER",
            "riskLevel": "SENSITIVE",
            "authenticatedUserId": authenticated_user_id,
            "authenticatedUserRole": role,
            "parameters": {
                "orderId": str(orderId),
                "reason": clean_reason,
            },
            "context": {
                "currentStatus": current_status,
                "totalAmount": total_amount,
            },
            "humanReadableSummary": (
                f"Cancel pending order #{orderId} "
                f"(total: ₹{total_amount}). "
                f"Reason: {clean_reason}"
            ),
            "nodeValidationRequired": [
                "re-verify authenticated user authorization",
                "re-verify order status (stale state check with FOR UPDATE)",
                "restock inventory items inside transaction",
                "generate confirmation token",
                "persist pending action to ai_pending_actions",
            ],
            "pythonMutationStatus": "NONE — Python did not mutate any data",
        }
    }


async def propose_send_message(
    user: Dict[str, Any],
    message: Optional[str] = None,
    conversationId: Optional[str] = None,
    recipientId: Optional[str] = None,
    **kwargs
) -> Dict[str, Any]:
    """
    Formulate a structured proposal to send a marketplace message.

    SECURITY: No INSERT is performed. Conversation membership validated
    read-only. senderId is always from authenticated context (never from params).
    """
    rbac_err = _check_rbac(user, "SEND_MESSAGE")
    if rbac_err:
        return {"success": False, "error": rbac_err}

    if not message or not str(message).strip():
        return {"success": False, "error": {"code": "INVALID_PARAMETERS", "message": "Message content cannot be empty."}}

    authenticated_user_id = str(user.get("id") or user.get("user_id") or "")
    role = (user.get("role") or "").lower()
    clean_message = str(message).strip()[:2000]

    conversation = None
    try:
        if conversationId:
            conversation = db.query_get(
                "SELECT id, farmerId, vendorId FROM conversations WHERE id = ?",
                [conversationId]
            )
        elif recipientId:
            conversation = db.query_get(
                "SELECT id, farmerId, vendorId FROM conversations "
                "WHERE (farmerId = ? AND vendorId = ?) OR (farmerId = ? AND vendorId = ?) LIMIT 1",
                [authenticated_user_id, recipientId, recipientId, authenticated_user_id]
            )
    except PermissionError:
        raise
    except Exception:
        conversation = None

    if not conversation:
        return {
            "success": False,
            "error": {"code": "RESOURCE_NOT_FOUND", "message": "Active conversation not found."}
        }

    conv_farmer_id = str(conversation.get("farmerId") or conversation.get("farmerid") or "")
    conv_vendor_id = str(conversation.get("vendorId") or conversation.get("vendorid") or "")

    is_participant = (
        authenticated_user_id in (conv_farmer_id, conv_vendor_id)
        or role == "admin"
    )

    if not is_participant:
        return {
            "success": False,
            "error": {"code": "OWNERSHIP_VIOLATION", "message": "You are not a participant in this conversation."}
        }

    counterparty_id = conv_vendor_id if authenticated_user_id == conv_farmer_id else conv_farmer_id
    conv_id = str(conversation.get("id") or "")

    return {
        "success": True,
        "requiresNodeExecution": True,
        "proposal": {
            "actionId": "SEND_MESSAGE",
            "riskLevel": "SENSITIVE",
            "authenticatedUserId": authenticated_user_id,
            "authenticatedUserRole": role,
            "parameters": {
                "conversationId": conv_id,
                "recipientId": counterparty_id,
                # senderId MUST be set by Node from authenticated session
                "message": clean_message,
            },
            "context": {
                "noteForNode": "senderId MUST be set from authenticated session, NOT from Python proposal"
            },
            "humanReadableSummary": (
                f"Send marketplace message in conversation #{conv_id}."
            ),
            "nodeValidationRequired": [
                "verify authenticated sender identity from session (NOT from proposal)",
                "verify conversation membership",
                "check message length and content constraints",
                "generate confirmation token",
                "persist pending action to ai_pending_actions",
            ],
            "pythonMutationStatus": "NONE — Python did not mutate any data",
        }
    }
