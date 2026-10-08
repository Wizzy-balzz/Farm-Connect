"""
Security and dispatcher tests for Python tool execution.
Tests unauthorized access, unknown tools, malformed arguments, array truncation,
sensitive field scrubbing, and database read-only protection.
"""

import pytest
from app.tools.dispatcher import dispatch_tool, sanitize_output_data
from app.database.connection import db


@pytest.mark.asyncio
async def test_unknown_tool_returns_tool_not_found():
    user = {"id": "farmer_1", "role": "farmer"}
    result = await dispatch_tool(user, "nonExistentTool", {"foo": "bar"})
    assert result.success is False
    assert result.error is not None
    assert result.error["code"] == "TOOL_NOT_FOUND"


@pytest.mark.asyncio
async def test_unauthorized_role_returns_forbidden():
    user = {"id": "hacker", "role": "blacklisted_role"}
    result = await dispatch_tool(user, "searchProducts", {"queryText": "Tomato"})
    assert result.success is False
    assert result.error is not None
    assert result.error["code"] == "FORBIDDEN"


@pytest.mark.asyncio
async def test_malformed_arguments_returns_invalid_tool_arguments():
    user = {"id": "farmer_1", "role": "farmer"}
    # Pass negative price to searchProducts
    result = await dispatch_tool(user, "searchProducts", {"maxPrice": -50.0})
    assert result.success is False
    assert result.error is not None
    assert result.error["code"] == "INVALID_TOOL_ARGUMENTS"


def test_sanitize_output_data_truncates_large_arrays():
    large_list = list(range(25))
    sanitized = sanitize_output_data({"items": large_list}, max_array_items=10)
    assert len(sanitized["items"]) == 10
    assert sanitized["items"] == list(range(10))


def test_sanitize_output_data_removes_sensitive_keys():
    raw_data = {
        "id": "u1",
        "name": "Ramesh",
        "password": "supersecretpassword",
        "password_hash": "$2b$10$xyz...",
        "token": "jwt.header.payload",
        "jwt": "bearer token",
        "otp": "123456",
        "api_key": "FC_INTERNAL_SECRET",
        "nested": {
            "secret": "db_pass",
            "salt": "random_salt",
            "email": "farmer@example.com"
        }
    }
    cleaned = sanitize_output_data(raw_data)
    assert "password" not in cleaned
    assert "password_hash" not in cleaned
    assert "token" not in cleaned
    assert "jwt" not in cleaned
    assert "otp" not in cleaned
    assert "api_key" not in cleaned
    assert "secret" not in cleaned["nested"]
    assert "salt" not in cleaned["nested"]
    assert cleaned["id"] == "u1"
    assert cleaned["nested"]["email"] == "farmer@example.com"


@pytest.mark.asyncio
async def test_sql_injection_attempt_is_safely_handled():
    user = {"id": "farmer_1", "role": "farmer"}
    # Attempt SQL injection via queryText
    sql_inj = "' OR '1'='1' --; DROP TABLE products;"
    result = await dispatch_tool(user, "searchProducts", {"queryText": sql_inj})
    # Should execute safely using parameterized query and return structured products or empty
    assert result.success is True
    assert isinstance(result.data, list)



def test_database_manager_blocks_mutation_queries():
    # Verify that Python database manager strictly forbids write operations against business tables
    with pytest.raises(PermissionError):
        db.query_all("UPDATE products SET price = 0 WHERE id = 'p1'")

    with pytest.raises(PermissionError):
        db.query_all("DELETE FROM users WHERE id = 'u1'")

    with pytest.raises(PermissionError):
        db.query_all("INSERT INTO orders (id) VALUES ('o1')")
