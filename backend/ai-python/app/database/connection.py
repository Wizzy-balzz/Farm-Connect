import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional
import pymysql
import pymysql.cursors

from app.core.config import settings
from app.core.logging import logger

# Path to local SQLite fallback if MySQL is unreachable during tests
SQLITE_DB_PATH = Path(__file__).resolve().parent.parent.parent.parent / "database.sqlite"

# Read-only tables that Python AI must never mutate
RESTRICTED_MUTATION_TABLES = {
    "users", "products", "orders", "order_items", "payments",
    "delivery_pricing_rules", "otp_verifications",
    "ai_user_memory", "ai_farming_goals", "ai_followups",
    "ai_action_audit", "ai_pending_actions", "ai_proactive_insights"
}


class DatabaseManager:
    """Manages database connectivity for FarmConnect AI subsystem."""

    def __init__(self):
        self._pool = None
        self._is_mysql_active = False

    def get_connection(self):
        """Returns a database connection (MySQL preferred, SQLite fallback)."""
        try:
            conn = pymysql.connect(
                host=settings.DB_HOST,
                port=settings.DB_PORT,
                user=settings.DB_USER,
                password=settings.DB_PASSWORD,
                database=settings.DB_NAME,
                charset="utf8mb4",
                cursorclass=pymysql.cursors.DictCursor,
                connect_timeout=3
            )
            self._is_mysql_active = True
            return conn, "mysql"
        except Exception as e:
            logger.debug(f"MySQL unavailable ({e}), falling back to SQLite: {SQLITE_DB_PATH}")
            if SQLITE_DB_PATH.exists():
                conn = sqlite3.connect(str(SQLITE_DB_PATH))
                conn.row_factory = sqlite3.Row
                self._is_mysql_active = False
                return conn, "sqlite"
            raise RuntimeError(f"Database connection failed. MySQL error: {e}, SQLite missing.")

    def check_health(self) -> Dict[str, Any]:
        """Checks and returns the current database connectivity status."""
        try:
            conn, db_type = self.get_connection()
            if db_type == "mysql":
                with conn.cursor() as cursor:
                    cursor.execute("SELECT 1 as healthy")
                    row = cursor.fetchone()
                conn.close()
                return {"connected": True, "engine": "mysql", "host": settings.DB_HOST, "database": settings.DB_NAME}
            else:
                cursor = conn.cursor()
                cursor.execute("SELECT 1 as healthy")
                row = cursor.fetchone()
                conn.close()
                return {"connected": True, "engine": "sqlite", "path": str(SQLITE_DB_PATH)}
        except Exception as err:
            return {"connected": False, "engine": "none", "error": str(err)}

    def query_all(self, sql: str, params: Optional[List[Any]] = None) -> List[Dict[str, Any]]:
        """Executes a SELECT query returning all matching rows as dictionaries."""
        clean_sql = sql.strip().upper()
        for restricted in RESTRICTED_MUTATION_TABLES:
            r_up = restricted.upper()
            if (
                f"INTO {r_up}" in clean_sql
                or f"UPDATE {r_up}" in clean_sql
                or f"DELETE FROM {r_up}" in clean_sql
                or f"DROP TABLE" in clean_sql
                or f"TRUNCATE" in clean_sql
            ):
                raise PermissionError(
                    f"AI_MUTATION_PROHIBITED: Python AI service is strictly forbidden from mutating '{restricted}'."
                )

        conn, db_type = self.get_connection()
        params = params or []
        try:
            if db_type == "mysql":
                formatted_sql = sql.replace("?", "%s")
                with conn.cursor() as cursor:
                    cursor.execute(formatted_sql, params)
                    return cursor.fetchall()
            else:
                cursor = conn.cursor()
                cursor.execute(sql, params)
                rows = cursor.fetchall()
                return [dict(ix) for ix in rows]
        finally:
            conn.close()

    def query_get(self, sql: str, params: Optional[List[Any]] = None) -> Optional[Dict[str, Any]]:
        """Executes a SELECT query returning the first matching row."""
        rows = self.query_all(sql, params)
        return rows[0] if rows else None

    def query_run(self, sql: str, params: Optional[List[Any]] = None) -> Dict[str, Any]:
        """
        Executes an INSERT, UPDATE, or DELETE query.
        Guarantees that Python cannot mutate core business tables.
        """
        clean_sql = sql.strip().upper()
        for restricted in RESTRICTED_MUTATION_TABLES:
            r_up = restricted.upper()
            if (
                f"INTO {r_up}" in clean_sql
                or f"UPDATE {r_up}" in clean_sql
                or f"DELETE FROM {r_up}" in clean_sql
                or f"DROP TABLE" in clean_sql
                or f"TRUNCATE" in clean_sql
            ):
                raise PermissionError(
                    f"AI_MUTATION_PROHIBITED: Python AI service is strictly forbidden from mutating '{restricted}'."
                )

        conn, db_type = self.get_connection()
        params = params or []
        try:
            if db_type == "mysql":
                formatted_sql = sql.replace("?", "%s")
                with conn.cursor() as cursor:
                    affected = cursor.execute(formatted_sql, params)
                    last_id = cursor.lastrowid
                conn.commit()
                return {"affectedRows": affected, "lastInsertId": last_id}
            else:
                cursor = conn.cursor()
                cursor.execute(sql, params)
                conn.commit()
                return {"affectedRows": cursor.rowcount, "lastInsertId": cursor.lastrowid}
        finally:
            conn.close()


db = DatabaseManager()
