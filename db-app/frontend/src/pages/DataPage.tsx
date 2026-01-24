import { useState, useEffect } from 'react';
import { fetchTableHistory, fetchNotebookLineageEvents } from '@shared/api/historyApi';

const DEFAULT_TABLE = 'zacdav.macq.bronze_trade_ss';

interface ApiOption {
  name: string;
  description: string;
  fetchFn: (tableName: string) => Promise<unknown>;
}

const API_OPTIONS: ApiOption[] = [
  {
    name: 'fetchTableHistory',
    description: 'Fetch Delta table history',
    fetchFn: (tableName) => fetchTableHistory(tableName),
  },
  {
    name: 'fetchNotebookLineageEvents',
    description: 'Fetch notebook lineage events',
    fetchFn: (tableName) => fetchNotebookLineageEvents(tableName),
  },
];

export function DataPage() {
  const [tableName, setTableName] = useState(DEFAULT_TABLE);
  const [selectedApi, setSelectedApi] = useState<string>(API_OPTIONS[0].name);
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const api = API_OPTIONS.find((a) => a.name === selectedApi);
    if (!api || !tableName) return;

    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await api.fetchFn(tableName);
        if (!cancelled) {
          setData(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [selectedApi]);

  return (
    <div className="data-page">
      <h1>API Explorer</h1>

      <div className="controls">
        <input
          type="text"
          value={tableName}
          onChange={(e) => setTableName(e.target.value)}
          placeholder="catalog.schema.table"
        />

        <select
          value={selectedApi}
          onChange={(e) => setSelectedApi(e.target.value)}
        >
          {API_OPTIONS.map((api) => (
            <option key={api.name} value={api.name}>
              {api.name} - {api.description}
            </option>
          ))}
        </select>
      </div>

      {loading && <div className="loading">Loading...</div>}

      {error && <div className="error">Error: {error}</div>}

      {data !== null && (
        <pre className="json-output">{JSON.stringify(data, null, 2)}</pre>
      )}
    </div>
  );
}
