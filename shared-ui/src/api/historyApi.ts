import type { TableHistory } from '../types/TableHistory';

/**
 * Error thrown when the API request fails
 */
export class HistoryApiError extends Error {
  status?: number;
  statusText?: string;

  constructor(message: string, status?: number, statusText?: string) {
    super(message);
    this.name = 'HistoryApiError';
    this.status = status;
    this.statusText = statusText;
  }
}

/**
 * Fetches table history from the Flask backend
 *
 * @param tableName - Full table name (e.g., "catalog.schema.table")
 * @param baseUrl - Optional base URL for the API (defaults to relative path for same-origin requests)
 * @returns Promise resolving to array of TableHistoryRecord
 * @throws HistoryApiError if the request fails
 *
 * @example
 * // From db-app frontend (same origin)
 * const history = await fetchTableHistory('main.default.my_table');
 *
 * @example
 * // From extension (different origin)
 * const history = await fetchTableHistory('main.default.my_table', 'https://my-app.databricksapps.com');
 *
 * @example
 * // For local dev, set VITE_DATABRICKS_TOKEN in your .env file
 * // VITE_DATABRICKS_TOKEN=dapi...
 */
export async function fetchTableHistory(
  tableName: string,
  baseUrl: string = import.meta.env.DATABRICKS_APP_URL ?? ''
): Promise<TableHistory> {
  const url = `${baseUrl}/api/history/${encodeURIComponent(tableName)}`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw new HistoryApiError(
      `Network error while fetching table history: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  if (!response.ok) {
    throw new HistoryApiError(
      `Failed to fetch table history: ${response.status} ${response.statusText}`,
      response.status,
      response.statusText
    );
  }

  const data: TableHistory = await response.json();
  return data;
}
