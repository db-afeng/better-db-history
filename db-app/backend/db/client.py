"""
Databricks SQL connection management.
"""

import os
from contextlib import contextmanager
from databricks import sql
from databricks.sdk.core import Config

cfg = Config()  # Set the DATABRICKS_HOST environment variable when running locally

def get_connection_params() -> dict:
    """
    Get Databricks connection parameters from environment variables.
    
    Required environment variables:
    - DATABRICKS_SERVER_HOSTNAME: Databricks workspace host (e.g., my-workspace.cloud.databricks.com)
    - DATABRICKS_HTTP_PATH: SQL warehouse HTTP path (e.g., /sql/1.0/warehouses/abc123)
    
    Optional:
    - DATABRICKS_TOKEN: Personal access token (for local development; OAuth is used automatically in Databricks Apps)
    
    Returns:
        dict: Connection parameters for databricks.sql.connect()
    
    Raises:
        ValueError: If required environment variables are not set
    """
    server_hostname = os.getenv("DATABRICKS_HOST")
    warehouse_id = os.getenv("WAREHOUSE_ID")
    http_path = f"/sql/1.0/warehouses/{warehouse_id}"
    
    if not server_hostname:
        raise ValueError("DATABRICKS_SERVER_HOSTNAME environment variable is not set")
    if not warehouse_id:
        raise ValueError("DATABRICKS_HTTP_PATH environment variable is not set")
    
    params = {
        "server_hostname": server_hostname,
        "http_path": http_path,
        "credentials_provider": lambda: cfg.authenticate,
    }
    
    # Use token if provided (local dev), otherwise rely on OAuth (Databricks Apps)
    token = os.environ.get("DATABRICKS_TOKEN")
    if token:
        params["access_token"] = token
    
    return params


@contextmanager
def get_connection():
    """
    Context manager for Databricks SQL connection.
    
    Usage:
        with get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT 1")
                result = cursor.fetchall()
    
    Yields:
        databricks.sql.client.Connection: Active database connection
    """
    params = get_connection_params()
    connection = sql.connect(**params)
    try:
        yield connection
    finally:
        connection.close()
