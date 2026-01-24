/**
 * Represents a single lineage event from a Databricks notebook.
 * Data sourced from system.access.table_lineage where entity_type = 'NOTEBOOK'
 */
export interface NotebookLineageEvent {
  /** Databricks workspace ID */
  workspaceId: string | null;

  /** Type of entity that triggered the lineage event (always 'NOTEBOOK' for this interface) */
  entityType: string;

  /** Notebook ID */
  entityId: string;

  /** Unique run ID for this notebook execution */
  entityRunId: string;

  /** Full name of the source table (catalog.schema.table), null if source is a path */
  sourceTableFullName: string | null;

  /** Full name of the target table (catalog.schema.table), null if target is a path */
  targetTableFullName: string | null;

  /** Source path (e.g., S3 path), null if source is a table */
  sourcePath: string | null;

  /** Type of the source (e.g., 'PATH', 'TABLE') */
  sourceType: string | null;

  /** Target path (e.g., S3 path), null if target is a table */
  targetPath: string | null;

  /** Type of the target (e.g., 'PATH', 'TABLE') */
  targetType: string | null;

  /** Email of the user who created this lineage event */
  createdBy: string;

  /** ISO 8601 timestamp of when the event occurred */
  eventTime: string;
}

/**
 * Array of notebook lineage events
 */
export type NotebookLineageEvents = NotebookLineageEvent[];
