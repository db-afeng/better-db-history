"""
Table history retrieval from Databricks Delta Lake.
"""

import json
import re
from datetime import datetime
from typing import Any

from .databricks_client import get_connection


def _validate_table_name(table_name: str) -> bool:
    """
    Validate table name to prevent SQL injection.
    
    Accepts formats:
    - table_name
    - schema.table_name
    - catalog.schema.table_name
    
    Each part must be a valid identifier (alphanumeric + underscore, not starting with number).
    Backtick-quoted identifiers are also allowed.
    
    Args:
        table_name: The table name to validate
        
    Returns:
        bool: True if valid, False otherwise
    """
    # Pattern for unquoted identifier: starts with letter or underscore, followed by alphanumeric or underscore
    unquoted_pattern = r'[a-zA-Z_][a-zA-Z0-9_]*'
    # Pattern for backtick-quoted identifier
    quoted_pattern = r'`[^`]+`'
    # Either quoted or unquoted
    identifier_pattern = f'(?:{unquoted_pattern}|{quoted_pattern})'
    # Full pattern: 1-3 parts separated by dots
    full_pattern = f'^{identifier_pattern}(?:\\.{identifier_pattern}){{0,2}}$'
    
    return bool(re.match(full_pattern, table_name))


def _parse_json_field(value: Any) -> Any:
    """
    Parse a JSON string field, returning None if empty or invalid.
    
    Args:
        value: The value to parse (may be string, dict, or None)
        
    Returns:
        Parsed JSON object or None
    """
    if value is None:
        return None
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        if not value or value == "null":
            return None
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return None
    return None


def _format_timestamp(value: Any) -> str | None:
    """
    Format a timestamp value to ISO 8601 string.
    
    Args:
        value: Timestamp value (datetime or string)
        
    Returns:
        ISO 8601 formatted string or None
    """
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, str):
        return value
    return str(value)


def _transform_job_info(job_data: dict | None) -> dict | None:
    """
    Transform job info to match TypeScript JobInfo interface.
    
    Args:
        job_data: Raw job data from Databricks
        
    Returns:
        Transformed job info or None
    """
    if not job_data:
        return None
    
    return {
        "jobId": str(job_data.get("jobId", "")),
        "jobName": job_data.get("jobName"),
        "runId": str(job_data.get("runId")) if job_data.get("runId") else None,
        "jobOwnerId": str(job_data.get("jobOwnerId")) if job_data.get("jobOwnerId") else None,
        "triggerType": job_data.get("triggerType"),
    }


def _transform_notebook_info(notebook_data: dict | None) -> dict | None:
    """
    Transform notebook info to match TypeScript NotebookInfo interface.
    
    Args:
        notebook_data: Raw notebook data from Databricks
        
    Returns:
        Transformed notebook info or None
    """
    if not notebook_data:
        return None
    
    return {
        "notebookId": str(notebook_data.get("notebookId", "")),
        "notebookPath": notebook_data.get("notebookPath"),
    }


def _transform_row(row: tuple, columns: list[str]) -> dict:
    """
    Transform a single history row to match TypeScript TableHistoryRecord interface.
    
    Args:
        row: Tuple of values from the database
        columns: List of column names
        
    Returns:
        Dictionary matching TableHistoryRecord interface
    """
    # Create a dict from columns and row values
    raw = dict(zip(columns, row))
    
    return {
        "version": raw.get("version"),
        "timestamp": _format_timestamp(raw.get("timestamp")),
        "userId": raw.get("userId"),
        "userName": raw.get("userName"),
        "operation": raw.get("operation"),
        "operationParameters": _parse_json_field(raw.get("operationParameters")) or {},
        "job": _transform_job_info(_parse_json_field(raw.get("job"))),
        "notebook": _transform_notebook_info(_parse_json_field(raw.get("notebook"))),
        "clusterId": raw.get("clusterId"),
        "readVersion": raw.get("readVersion"),
        "isolationLevel": raw.get("isolationLevel"),
        "isBlindAppend": raw.get("isBlindAppend"),
        "operationMetrics": _parse_json_field(raw.get("operationMetrics")),
        "userMetadata": raw.get("userMetadata"),
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
    if not _validate_table_name(table_name):
        raise ValueError(f"Invalid table name: {table_name}")
    
    with get_connection() as conn:
        with conn.cursor() as cursor:
            # Execute DESCRIBE HISTORY command
            cursor.execute(f"DESCRIBE HISTORY {table_name}")
            
            # Get column names from cursor description
            columns = [desc[0] for desc in cursor.description]
            
            # Fetch all rows and transform them
            rows = cursor.fetchall()
            return [_transform_row(row, columns) for row in rows]
