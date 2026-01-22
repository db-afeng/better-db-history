import { useEffect, useState } from 'react';
import { fetchTableHistory, HistoryApiError } from '../api/historyApi';
import type { TableHistoryRecord } from '../types/TableHistory';

export interface TableHistoryViewProps {
  /** Full table name (e.g., "catalog.schema.table") */
  tableName: string;
  /** Optional base URL for API requests (for cross-origin usage like extensions) */
  baseUrl?: string;
}

/**
 * React component that fetches and displays Delta table history
 * 
 * @example
 * // In db-app frontend
 * <TableHistoryView tableName="main.default.my_table" />
 * 
 * @example
 * // In extension
 * <TableHistoryView 
 *   tableName="main.default.my_table" 
 *   baseUrl="https://my-app.databricksapps.com" 
 * />
 */
export function TableHistoryView({ tableName, baseUrl }: TableHistoryViewProps) {
  const [history, setHistory] = useState<TableHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchTableHistory(tableName, baseUrl);
        if (!cancelled) {
          setHistory(data);
        }
      } catch (err) {
        if (!cancelled) {
          if (err instanceof HistoryApiError) {
            setError(err.message);
          } else {
            setError('An unexpected error occurred');
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadHistory();

    return () => {
      cancelled = true;
    };
  }, [tableName, baseUrl]);

  if (loading) {
    return <div className="table-history-loading">Loading table history...</div>;
  }

  if (error) {
    return <div className="table-history-error">Error: {error}</div>;
  }

  if (history.length === 0) {
    return <div className="table-history-empty">No history found for {tableName}</div>;
  }

  return (
    <div className="table-history-view">
      <h2>History for {tableName}</h2>
      <table className="table-history-table">
        <thead>
          <tr>
            <th>Version</th>
            <th>Timestamp</th>
            <th>Operation</th>
            <th>User</th>
            <th>Rows Affected</th>
          </tr>
        </thead>
        <tbody>
          {history.map((record) => (
            <tr key={record.version}>
              <td>{record.version}</td>
              <td>{new Date(record.timestamp).toLocaleString()}</td>
              <td>{record.operation}</td>
              <td>{record.userName ?? record.userId ?? '—'}</td>
              <td>
                {record.operationMetrics?.numOutputRows ??
                  record.operationMetrics?.numTargetRowsInserted ??
                  record.operationMetrics?.numUpdatedRows ??
                  record.operationMetrics?.numDeletedRows ??
                  '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
