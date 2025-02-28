import {useState} from 'react';
import {Table} from 'apache-arrow';
import {DuckQueryError, useDuckDb} from '@sqlrooms/duckdb';
import {useArrowDataTable} from '@sqlrooms/data-table';
import {saveAs} from 'file-saver';
import {csvFormat} from 'd3-dsv';
import {genRandomStr} from '@sqlrooms/utils';

/**
 * Hook for executing SQL queries and managing results
 */
export function useQueryExecution(schema: string = 'main') {
  const duckConn = useDuckDb();
  const [results, setResults] = useState<Table>();
  const resultsTableData = useArrowDataTable(results);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Execute a SQL query
   */
  const runQuery = async (q: string) => {
    const conn = duckConn.conn;
    if (!conn) {
      setError('No DuckDB connection available');
      return;
    }

    try {
      setError(null);
      setLoading(true);
      await conn.query(`SET search_path = ${schema}`);
      const results = await conn.query(q);
      await conn.query(`SET search_path = main`);
      setResults(results);
      return results;
    } catch (e) {
      setResults(undefined);
      setError(
        (e instanceof DuckQueryError
          ? e.getMessageForUser()
          : 'Query failed') || String(e),
      );
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Export query results to CSV
   */
  const exportResults = () => {
    if (!results) return;
    const blob = new Blob([csvFormat(results.toArray())], {
      type: 'text/plain;charset=utf-8',
    });
    saveAs(blob, `export-${genRandomStr(5)}.csv`);
  };

  /**
   * Clear current query results
   */
  const clearResults = () => {
    setResults(undefined);
    setError(null);
  };

  return {
    results,
    resultsTableData,
    loading,
    error,
    runQuery,
    exportResults,
    clearResults,
  };
}
