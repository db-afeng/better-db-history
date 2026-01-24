"""
Table history retrieval from Databricks Delta Lake.
"""

import re
from datetime import datetime
from typing import Any

from ..db import get_connection


def validate_table_name(table_name: str) -> bool:
    """
    Validate table name to prevent SQL injection.

    Accepts formats:
    - table_name
    - schema.table_name
    - catalog.schema.table_name

    Each part must be a valid identifier (alphanumeric + underscore, not starting with number).
    Backtick-quoted identifiers are also allowed.
    """
    unquoted = r'[a-zA-Z_][a-zA-Z0-9_]*'
    quoted = r'`[^`]+`'
    identifier = f'(?:{unquoted}|{quoted})'
    pattern = f'^{identifier}(?:\\.{identifier}){{0,2}}$'
    return bool(re.match(pattern, table_name))


def _to_dict(value: Any) -> dict | None:
    """
    Convert a value to dict. Handles list of tuples from Databricks.

    Databricks returns operationMetrics/operationParameters as lists of tuples:
    [('key1', 'value1'), ('key2', 'value2')] -> {'key1': 'value1', ...}
    """
    if value is None:
        return None
    if isinstance(value, dict):
        return value
    if isinstance(value, list) and value:
        if all(isinstance(item, (tuple, list)) and len(item) == 2 for item in value):
            return {k: v for k, v in value}
    return None


def _transform_row(row: Any) -> dict:
    """
    Transform a single history row to match TypeScript TableHistoryRecord interface.
    """
    raw = row.asDict() if hasattr(row, "asDict") else row

    timestamp = raw.get("timestamp")
    if isinstance(timestamp, datetime):
        timestamp = timestamp.isoformat()

    return {
        "version": raw.get("version"),
        "timestamp": timestamp,
        "userId": raw.get("userId"),
        "userName": raw.get("userName"),
        "operation": raw.get("operation"),
        "operationParameters": _to_dict(raw.get("operationParameters")) or {},
        "job": raw.get("job"),
        "notebook": raw.get("notebook"),
        "clusterId": raw.get("clusterId"),
        "readVersion": raw.get("readVersion"),
        "isolationLevel": raw.get("isolationLevel"),
        "isBlindAppend": raw.get("isBlindAppend"),
        "operationMetrics": _to_dict(raw.get("operationMetrics")),
        "userMetadata": raw.get("userMetadata"),
        "engineInfo": raw.get("engineInfo"),
    }


def get_table_history(table_name: str) -> list[dict]:
    """
    Fetch table history from Databricks using DESCRIBE HISTORY.

    Args:
        table_name: Full table name (e.g., "catalog.schema.table")

    Returns:
        List of history records matching TableHistoryRecord interface

    Raises:
        ValueError: If table name is invalid
        Exception: If database query fails
    """
    if not validate_table_name(table_name):
        raise ValueError(f"Invalid table name: {table_name}")

    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(f"DESCRIBE HISTORY {table_name}")
            rows = cursor.fetchall()
            return [_transform_row(row) for row in rows]
