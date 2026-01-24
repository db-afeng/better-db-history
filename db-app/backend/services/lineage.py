"""
Table lineage retrieval from Databricks system tables.
"""

from datetime import datetime
from typing import Any

from ..db import get_connection
from .history import validate_table_name


def _transform_lineage_row(row: Any) -> dict:
    """
    Transform a single lineage row to match TypeScript NotebookLineageEvent interface.
    """
    raw = row.asDict() if hasattr(row, "asDict") else row

    event_time = raw.get("event_time")
    if isinstance(event_time, datetime):
        event_time = event_time.isoformat()

    return {
        "workspaceId": str(raw.get("workspace_id")) if raw.get("workspace_id") is not None else None,
        "entityType": raw.get("entity_type"),
        "entityId": raw.get("entity_id"),
        "entityRunId": raw.get("entity_run_id"),
        "sourceTableFullName": raw.get("source_table_full_name"),
        "targetTableFullName": raw.get("target_table_full_name"),
        "sourcePath": raw.get("source_path"),
        "sourceType": raw.get("source_type"),
        "targetPath": raw.get("target_path"),
        "targetType": raw.get("target_type"),
        "createdBy": raw.get("created_by"),
        "eventTime": event_time,
    }


def get_notebook_lineage_events(table_name: str) -> list[dict]:
    """
    Fetch notebook lineage events from Databricks system.access.table_lineage.

    Args:
        table_name: Full table name (e.g., "catalog.schema.table")

    Returns:
        List of lineage events matching NotebookLineageEvent interface

    Raises:
        ValueError: If table name is invalid
        Exception: If database query fails
    """
    if not validate_table_name(table_name):
        raise ValueError(f"Invalid table name: {table_name}")

    query = """
        SELECT
            workspace_id,
            entity_type,
            entity_id,
            entity_run_id,
            source_table_full_name,
            target_table_full_name,
            source_path,
            source_type,
            target_path,
            target_type,
            created_by,
            event_time
        FROM
            system.access.table_lineage
        WHERE
            (source_table_full_name = ? OR target_table_full_name = ?)
            AND entity_type = 'NOTEBOOK'
    """

    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(query, (table_name, table_name))
            rows = cursor.fetchall()
            return [_transform_lineage_row(row) for row in rows]
