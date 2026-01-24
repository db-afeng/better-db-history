/**
 * Details of the job that ran the operation
 * (only present when operation was run from a job)
 */
export interface JobInfo {
  jobId: string;
  jobName?: string;
  runId?: string;
  jobOwnerId?: string;
  triggerType?: string;
}

/**
 * Details of the notebook from which the operation was run
 * (only present when operation was run from a notebook)
 */
export interface NotebookInfo {
  notebookId: string;
  notebookPath?: string;
}

/**
 * Parameters of the operation (varies by operation type)
 * Common parameters include predicates, mode, partitionBy, etc.
 */
export interface OperationParameters {
  mode?: string;                    // e.g., "Append", "Overwrite", "ErrorIfExists"
  partitionBy?: string;             // JSON string of partition columns, e.g., "[\"date\"]"
  predicate?: string;               // For DELETE/UPDATE operations
  matchedPredicates?: string;       // For MERGE operations
  notMatchedPredicates?: string;    // For MERGE operations
  notMatchedBySourcePredicates?: string;
  [key: string]: unknown;           // Allow additional parameters
}

/**
 * Metrics of the operation - keys vary by operation type
 */
export interface OperationMetrics {
  // WRITE, CREATE TABLE AS SELECT, REPLACE TABLE AS SELECT, COPY INTO
  numFiles?: string;              // Number of files written
  numOutputBytes?: string;        // Size in bytes of the written contents
  numOutputRows?: string;         // Number of rows written

  // STREAMING UPDATE, DELETE, UPDATE, OPTIMIZE, FSCK (common file metrics)
  numAddedFiles?: string;         // Number of files added
  numRemovedFiles?: string;       // Number of files removed

  // DELETE, UPDATE
  numDeletedRows?: string;        // Number of rows removed
  numCopiedRows?: string;         // Number of rows copied in the process
  executionTimeMs?: string;       // Time taken to execute the entire operation
  scanTimeMs?: string;            // Time taken to scan the files for matches
  rewriteTimeMs?: string;         // Time taken to rewrite the matched files

  // UPDATE
  numUpdatedRows?: string;        // Number of rows updated

  // MERGE
  numSourceRows?: string;         // Number of rows in the source DataFrame
  numTargetRowsInserted?: string; // Number of rows inserted into the target table
  numTargetRowsUpdated?: string;  // Number of rows updated in the target table
  numTargetRowsDeleted?: string;  // Number of rows deleted in the target table
  numTargetRowsCopied?: string;   // Number of target rows copied
  numTargetFilesAdded?: string;   // Number of files added to the sink(target)
  numTargetFilesRemoved?: string; // Number of files removed from the sink(target)

  // CONVERT
  numConvertedFiles?: string;     // Number of Parquet files that have been converted

  // OPTIMIZE
  numAddedBytes?: string;         // Number of bytes added after the table was optimized
  numRemovedBytes?: string;       // Number of bytes removed
  minFileSize?: string;           // Size of the smallest file after optimization
  p25FileSize?: string;           // Size of the 25th percentile file after optimization
  p50FileSize?: string;           // Median file size after optimization
  p75FileSize?: string;           // Size of the 75th percentile file after optimization
  maxFileSize?: string;           // Size of the largest file after optimization

  // CLONE
  sourceTableSize?: string;       // Size in bytes of the source table at the cloned version
  sourceNumOfFiles?: string;      // Number of files in the source table at the cloned version
  numCopiedFiles?: string;        // Number of files copied to the new location (0 for shallow clones)
  copiedFilesSize?: string;       // Total size in bytes of files copied (0 for shallow clones)

  // RESTORE
  tableSizeAfterRestore?: string; // Table size in bytes after restore
  numOfFilesAfterRestore?: string;// Number of files in the table after restore
  numRestoredFiles?: string;      // Number of files added as a result of the restore
  removedFilesSize?: string;      // Size in bytes of files removed
  restoredFilesSize?: string;     // Size in bytes of files added by the restore

  // VACUUM
  numDeletedFiles?: string;       // Number of deleted files
  numVacuumedDirectories?: string;// Number of vacuumed directories
  numFilesToDelete?: string;      // Number of files to delete

  // Catch-all for any other metrics
  [key: string]: string | undefined;
}

/**
 * Known Delta Lake operations
 */
export type DeltaOperation =
  | 'WRITE'
  | 'CREATE TABLE'
  | 'CREATE TABLE AS SELECT'
  | 'REPLACE TABLE'
  | 'REPLACE TABLE AS SELECT'
  | 'COPY INTO'
  | 'STREAMING UPDATE'
  | 'DELETE'
  | 'UPDATE'
  | 'MERGE'
  | 'OPTIMIZE'
  | 'VACUUM START'
  | 'VACUUM END'
  | 'RESTORE'
  | 'CLONE'
  | 'SET TBLPROPERTIES'
  | 'UNSET TBLPROPERTIES'
  | 'ADD CONSTRAINT'
  | 'DROP CONSTRAINT'
  | 'CHANGE COLUMN'
  | 'ADD COLUMNS'
  | 'DROP COLUMNS'
  | 'RENAME COLUMN'
  | 'CONVERT'
  | 'TRUNCATE'
  | string;  // Allow other operations not listed

/**
 * Isolation levels used for Delta operations
 */
export type IsolationLevel =
  | 'WriteSerializable'
  | 'Serializable'
  | 'SnapshotIsolation'
  | string;

/**
 * Complete interface for a single table history record
 * Based on: https://docs.databricks.com/aws/en/delta/history
 */
export interface TableHistoryRecord {
  /** Table version generated by the operation */
  version: number;

  /** When this version was committed (ISO 8601 timestamp string) */
  timestamp: string;

  /** ID of the user that ran the operation */
  userId: string | null;

  /** Name of the user that ran the operation */
  userName: string | null;

  /** Name of the operation (e.g., WRITE, DELETE, MERGE, UPDATE, OPTIMIZE) */
  operation: DeltaOperation;

  /** Parameters of the operation (e.g., predicates, mode, partitionBy) */
  operationParameters: OperationParameters;

  /** Details of the job that ran the operation (null if not run from a job) */
  job: JobInfo | null;

  /** Details of the notebook from which the operation was run (null if not from notebook) */
  notebook: NotebookInfo | null;

  /** ID of the cluster on which the operation ran */
  clusterId: string | null;

  /** Version of the table that was read to perform the write operation */
  readVersion: number | null;

  /** Isolation level used for this operation */
  isolationLevel: IsolationLevel | null;

  /** Whether this operation appended data (blind append = no read dependencies) */
  isBlindAppend: boolean | null;

  /** Metrics of the operation (e.g., number of rows and files modified) */
  operationMetrics: OperationMetrics | null;

  /** User-defined commit metadata if it was specified */
  userMetadata: string | null;

  /** Engine info string (e.g., "Databricks-Runtime/17.3.x-aarch64-photon-scala2.13") */
  engineInfo: string | null;
}

/**
 * Array of table history records (returned from DESCRIBE HISTORY)
 */
export type TableHistory = TableHistoryRecord[];
