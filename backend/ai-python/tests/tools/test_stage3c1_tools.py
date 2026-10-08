"""
FarmConnect — Phase 3C-1: Copilot Memory Read-Only Tool Test Suite.
Tests all 3 approved migrated read-only tools:
1. getMyAiMemory
2. searchMyAiMemory
3. getRelevantUserContext

Validates:
- Parameterized SQL and zero mutations
- Strict user context isolation (Anti-IDOR / Anti-Spoofing)
- Sensitive secret sanitization
- RBAC permissions across farmer, vendor, admin, and unauthorized roles
- Gemini function declarations
- Node/Python parity
"""

import pytest
from datetime import datetime, timezone
from typing import Any, Dict, List

from app.database.connection import db
from app.tools.dispatcher import dispatch_tool
from app.tools.registry import get_tool, get_gemini_tools_for_role, TOOL_REGISTRY
from app.tools.permissions import is_tool_allowed
from app.tools.read_tools.copilot_memory import (
    get_my_ai_memory,
    search_my_ai_memory,
    get_relevant_user_context,
    sanitize_memory_content,
)


TEST_FARMER = {
    "id": "usr_farmer_stage3c1",
    "role": "farmer",
    "name": "Murugan Farmer",
    "district": "Coimbatore",
    "region": "Tamil Nadu"
}

TEST_VENDOR = {
    "id": "usr_vendor_stage3c1",
    "role": "vendor",
    "name": "Kovai Mart",
    "district": "Coimbatore",
    "region": "Tamil Nadu"
}

TEST_ROGUE = {
    "id": "usr_rogue_stage3c1",
    "role": "vendor",
    "name": "Attacker",
    "district": "Unknown",
    "region": "Unknown"
}


@pytest.fixture(autouse=True)
def setup_teardown_test_memories():
    """Setup and teardown test user memories and parent users directly via raw database cursor."""
    conn, db_type = db.get_connection()
    now_iso = datetime.now(timezone.utc).isoformat()
    cursor = conn.cursor()

    try:
        # Cleanup any old test rows
        if db_type == "mysql":
            cursor.execute("DELETE FROM ai_user_memory WHERE userId IN (%s, %s, %s)",
                           [TEST_FARMER["id"], TEST_VENDOR["id"], TEST_ROGUE["id"]])
            cursor.execute("DELETE FROM users WHERE id IN (%s, %s, %s)",
                           [TEST_FARMER["id"], TEST_VENDOR["id"], TEST_ROGUE["id"]])

            # Insert parent users
            cursor.execute(
                """INSERT INTO users (id, name, email, role, region, district, createdAt)
                   VALUES (%s, %s, %s, %s, %s, %s, %s)""",
                [TEST_FARMER["id"], TEST_FARMER["name"], "murugan_3c1@test.com", "farmer", TEST_FARMER["region"], TEST_FARMER["district"], now_iso]
            )
            cursor.execute(
                """INSERT INTO users (id, name, email, role, region, district, createdAt)
                   VALUES (%s, %s, %s, %s, %s, %s, %s)""",
                [TEST_VENDOR["id"], TEST_VENDOR["name"], "kovai_3c1@test.com", "vendor", TEST_VENDOR["region"], TEST_VENDOR["district"], now_iso]
            )
            cursor.execute(
                """INSERT INTO users (id, name, email, role, region, district, createdAt)
                   VALUES (%s, %s, %s, %s, %s, %s, %s)""",
                [TEST_ROGUE["id"], TEST_ROGUE["name"], "rogue_3c1@test.com", "vendor", TEST_ROGUE["region"], TEST_ROGUE["district"], now_iso]
            )

            # Insert test fixtures for farmer
            cursor.execute(
                """INSERT INTO ai_user_memory
                   (id, userId, memoryType, `key`, `value`, confidence, source, createdAt, updatedAt, isActive)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 1)""",
                ["mem_f1", TEST_FARMER["id"], "preference", "preferred_crop", "Organic Tomatoes", "high", "user_explicit", now_iso, now_iso]
            )
            cursor.execute(
                """INSERT INTO ai_user_memory
                   (id, userId, memoryType, `key`, `value`, confidence, source, createdAt, updatedAt, isActive)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 1)""",
                ["mem_f2", TEST_FARMER["id"], "strategy", "selling_preference", "Prefers direct wholesale sales", "high", "user_explicit", now_iso, now_iso]
            )
            # Insert test fixture for vendor
            cursor.execute(
                """INSERT INTO ai_user_memory
                   (id, userId, memoryType, `key`, `value`, confidence, source, createdAt, updatedAt, isActive)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 1)""",
                ["mem_v1", TEST_VENDOR["id"], "preference", "buying_budget", "Under ₹50/kg", "high", "user_explicit", now_iso, now_iso]
            )
            conn.commit()
        else:
            cursor.execute("DELETE FROM ai_user_memory WHERE userId IN (?, ?, ?)",
                           [TEST_FARMER["id"], TEST_VENDOR["id"], TEST_ROGUE["id"]])
            cursor.execute("DELETE FROM users WHERE id IN (?, ?, ?)",
                           [TEST_FARMER["id"], TEST_VENDOR["id"], TEST_ROGUE["id"]])

            cursor.execute(
                """INSERT INTO users (id, name, email, role, region, district, createdAt)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                [TEST_FARMER["id"], TEST_FARMER["name"], "murugan_3c1@test.com", "farmer", TEST_FARMER["region"], TEST_FARMER["district"], now_iso]
            )
            cursor.execute(
                """INSERT INTO users (id, name, email, role, region, district, createdAt)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                [TEST_VENDOR["id"], TEST_VENDOR["name"], "kovai_3c1@test.com", "vendor", TEST_VENDOR["region"], TEST_VENDOR["district"], now_iso]
            )
            cursor.execute(
                """INSERT INTO users (id, name, email, role, region, district, createdAt)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                [TEST_ROGUE["id"], TEST_ROGUE["name"], "rogue_3c1@test.com", "vendor", TEST_ROGUE["region"], TEST_ROGUE["district"], now_iso]
            )

            cursor.execute(
                """INSERT INTO ai_user_memory
                   (id, userId, memoryType, `key`, `value`, confidence, source, createdAt, updatedAt, isActive)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)""",
                ["mem_f1", TEST_FARMER["id"], "preference", "preferred_crop", "Organic Tomatoes", "high", "user_explicit", now_iso, now_iso]
            )
            cursor.execute(
                """INSERT INTO ai_user_memory
                   (id, userId, memoryType, `key`, `value`, confidence, source, createdAt, updatedAt, isActive)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)""",
                ["mem_f2", TEST_FARMER["id"], "strategy", "selling_preference", "Prefers direct wholesale sales", "high", "user_explicit", now_iso, now_iso]
            )
            cursor.execute(
                """INSERT INTO ai_user_memory
                   (id, userId, memoryType, `key`, `value`, confidence, source, createdAt, updatedAt, isActive)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)""",
                ["mem_v1", TEST_VENDOR["id"], "preference", "buying_budget", "Under ₹50/kg", "high", "user_explicit", now_iso, now_iso]
            )
            conn.commit()

        yield

    finally:
        try:
            if db_type == "mysql":
                cursor.execute("DELETE FROM ai_user_memory WHERE userId IN (%s, %s, %s)",
                               [TEST_FARMER["id"], TEST_VENDOR["id"], TEST_ROGUE["id"]])
                cursor.execute("DELETE FROM users WHERE id IN (%s, %s, %s)",
                               [TEST_FARMER["id"], TEST_VENDOR["id"], TEST_ROGUE["id"]])
            else:
                cursor.execute("DELETE FROM ai_user_memory WHERE userId IN (?, ?, ?)",
                               [TEST_FARMER["id"], TEST_VENDOR["id"], TEST_ROGUE["id"]])
                cursor.execute("DELETE FROM users WHERE id IN (?, ?, ?)",
                               [TEST_FARMER["id"], TEST_VENDOR["id"], TEST_ROGUE["id"]])
            conn.commit()
        except Exception:
            pass
        finally:
            conn.close()


# -------------------------------------------------------------
# 1. getMyAiMemory Tests
# -------------------------------------------------------------
@pytest.mark.asyncio
async def test_get_my_ai_memory_basic():
    """Verify getMyAiMemory returns all active memories for authenticated user."""
    res = await dispatch_tool(TEST_FARMER, "getMyAiMemory", {})
    assert res.success is True
    data = res.data
    assert isinstance(data, list)
    assert len(data) == 2
    keys = {m["key"] for m in data}
    assert "preferred_crop" in keys
    assert "selling_preference" in keys


@pytest.mark.asyncio
async def test_get_my_ai_memory_empty():
    """Verify getMyAiMemory returns empty list for user with no memories."""
    res = await dispatch_tool(TEST_ROGUE, "getMyAiMemory", {})
    assert res.success is True
    assert res.data == []


@pytest.mark.asyncio
async def test_get_my_ai_memory_filter_type():
    """Verify getMyAiMemory filters correctly by memoryType."""
    res = await dispatch_tool(TEST_FARMER, "getMyAiMemory", {"memoryType": "strategy"})
    assert res.success is True
    data = res.data
    assert len(data) == 1
    assert data[0]["key"] == "selling_preference"
    assert data[0]["memoryType"] == "strategy"


@pytest.mark.asyncio
async def test_get_my_ai_memory_user_isolation():
    """Verify farmer cannot view vendor memory and vendor cannot view farmer memory."""
    f_res = await dispatch_tool(TEST_FARMER, "getMyAiMemory", {})
    v_res = await dispatch_tool(TEST_VENDOR, "getMyAiMemory", {})

    assert f_res.success is True and v_res.success is True
    f_keys = {m["key"] for m in f_res.data}
    v_keys = {m["key"] for m in v_res.data}

    assert "buying_budget" not in f_keys
    assert "preferred_crop" not in v_keys
    assert "selling_preference" not in v_keys


@pytest.mark.asyncio
async def test_get_my_ai_memory_anti_spoofing():
    """Verify that parameter-supplied userId or farmerId is strictly ignored."""
    res = await dispatch_tool(TEST_FARMER, "getMyAiMemory", {
        "userId": TEST_VENDOR["id"],
        "farmerId": TEST_VENDOR["id"]
    })
    assert res.success is True
    keys = {m["key"] for m in res.data}
    assert "buying_budget" not in keys
    assert "preferred_crop" in keys


# -------------------------------------------------------------
# 2. searchMyAiMemory Tests
# -------------------------------------------------------------
@pytest.mark.asyncio
async def test_search_my_ai_memory_basic():
    """Verify searchMyAiMemory finds relevant memories by keyword."""
    res = await dispatch_tool(TEST_FARMER, "searchMyAiMemory", {"query": "wholesale"})
    assert res.success is True
    assert len(res.data) == 1
    assert res.data[0]["key"] == "selling_preference"
    assert "wholesale" in res.data[0]["value"].lower()


@pytest.mark.asyncio
async def test_search_my_ai_memory_empty():
    """Verify searchMyAiMemory returns empty list when no keyword matches."""
    res = await dispatch_tool(TEST_FARMER, "searchMyAiMemory", {"query": "nonexistent_crop_xyz"})
    assert res.success is True
    assert res.data == []


@pytest.mark.asyncio
async def test_search_my_ai_memory_anti_spoofing():
    """Verify search cannot access other users' data even if user ID passed in args."""
    res = await dispatch_tool(TEST_FARMER, "searchMyAiMemory", {
        "query": "budget",
        "userId": TEST_VENDOR["id"]
    })
    assert res.success is True
    assert res.data == []


@pytest.mark.asyncio
async def test_search_my_ai_memory_sql_injection():
    """Verify SQL injection payloads in search query are handled safely without tampering SQL."""
    injection_query = "' OR '1'='1' -- "
    res = await dispatch_tool(TEST_FARMER, "searchMyAiMemory", {"query": injection_query})
    assert res.success is True
    assert res.data == []


@pytest.mark.asyncio
async def test_search_my_ai_memory_sensitive_pattern_rejected():
    """Verify searching for passwords, tokens, or credentials returns structured error."""
    res = await dispatch_tool(TEST_FARMER, "searchMyAiMemory", {"query": "what is the admin password?"})
    assert res.success is False
    assert res.error is not None
    assert res.error["code"] in ("SENSITIVE_DATA_PROHIBITED", "TOOL_EXECUTION_ERROR")


# -------------------------------------------------------------
# 3. getRelevantUserContext Tests
# -------------------------------------------------------------
@pytest.mark.asyncio
async def test_get_relevant_user_context_basic():
    """Verify getRelevantUserContext returns aggregated memories and prompt summary."""
    res = await dispatch_tool(TEST_FARMER, "getRelevantUserContext", {})
    assert res.success is True
    data = res.data
    assert "memories" in data
    assert "summary" in data
    assert len(data["memories"]) == 2
    assert "Known User Preferences & Context:" in data["summary"]
    assert "preferred_crop: Organic Tomatoes" in data["summary"]
    assert "selling_preference: Prefers direct wholesale sales" in data["summary"]


@pytest.mark.asyncio
async def test_get_relevant_user_context_empty():
    """Verify getRelevantUserContext handles users with zero memories with fallback summary."""
    res = await dispatch_tool(TEST_ROGUE, "getRelevantUserContext", {})
    assert res.success is True
    data = res.data
    assert data["memories"] == []
    assert "Role: vendor." in data["summary"]


@pytest.mark.asyncio
async def test_get_relevant_user_context_isolation():
    """Verify context summary never contains another user's preferences."""
    f_ctx = await dispatch_tool(TEST_FARMER, "getRelevantUserContext", {})
    v_ctx = await dispatch_tool(TEST_VENDOR, "getRelevantUserContext", {})

    assert "buying_budget" not in f_ctx.data["summary"]
    assert "preferred_crop" not in v_ctx.data["summary"]


@pytest.mark.asyncio
async def test_get_relevant_user_context_anti_spoofing():
    """Verify passing rogue userId does not change context generation."""
    res = await dispatch_tool(TEST_FARMER, "getRelevantUserContext", {"userId": TEST_VENDOR["id"]})
    assert res.success is True
    assert "preferred_crop" in res.data["summary"]
    assert "buying_budget" not in res.data["summary"]


# -------------------------------------------------------------
# 4. Security, RBAC & Declaration Tests
# -------------------------------------------------------------
def test_rbac_copilot_memory_tools():
    """Verify role permissions: farmer, vendor, admin allowed; guest rejected."""
    for tool_name in ["getMyAiMemory", "searchMyAiMemory", "getRelevantUserContext"]:
        assert is_tool_allowed("farmer", tool_name) is True
        assert is_tool_allowed("vendor", tool_name) is True
        assert is_tool_allowed("admin", tool_name) is True
        assert is_tool_allowed("guest", tool_name) is False
        assert is_tool_allowed("anonymous", tool_name) is False


def test_gemini_declarations_copilot_memory():
    """Verify Gemini tool declarations include copilot memory tools without internal userId."""
    admin_tools = get_gemini_tools_for_role("admin")
    assert len(admin_tools) > 0
    tool_map = {tool["name"]: tool for tool in admin_tools if isinstance(tool, dict) and "name" in tool}

    for name in ["getMyAiMemory", "searchMyAiMemory", "getRelevantUserContext"]:
        assert name in tool_map
        params = tool_map[name].get("parameters", {})
        props = getattr(params, "properties", {}) or {}
        assert "userId" not in props


@pytest.mark.asyncio
async def test_parameter_validation_missing_query():
    """Verify searchMyAiMemory rejects empty or missing query."""
    res = await dispatch_tool(TEST_FARMER, "searchMyAiMemory", {})
    assert res.success is False
    assert res.error["code"] == "INVALID_TOOL_ARGUMENTS"


def test_mutation_safety_ai_memory_table():
    """Verify Python AI database connection strictly prohibits mutations on ai_user_memory."""
    with pytest.raises(PermissionError) as exc_info:
        db.query_run("DELETE FROM ai_user_memory WHERE userId = 'test'")
    assert "AI_MUTATION_PROHIBITED" in str(exc_info.value)

    with pytest.raises(PermissionError) as exc_info2:
        db.query_run("UPDATE ai_user_memory SET `value` = 'x' WHERE id = '1'")
    assert "AI_MUTATION_PROHIBITED" in str(exc_info2.value)


@pytest.mark.asyncio
async def test_node_python_output_parity():
    """Verify Python tool output schema has complete field parity with Node aiMemoryService."""
    res = await dispatch_tool(TEST_FARMER, "getMyAiMemory", {})
    assert res.success is True
    item = res.data[0]
    expected_fields = {"id", "userId", "memoryType", "key", "value", "confidence", "source", "createdAt", "updatedAt", "isActive"}
    for field in expected_fields:
        assert field in item
