import {useState, useCallback} from 'react';
import {Table} from 'apache-arrow';
import {useArrowDataTable} from '@sqlrooms/data-table';
import {useStoreWithSqlEditor} from '../SqlEditorSlice';

/**
 * Hook for executing SQL queries and managing results
 */
export function useQueryExecution(schema: string = 'main') {
  const [results, setResults] = useState<Table>();
  const resultsTableData = useArrowDataTable(results);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get functions from SqlEditorSlice directly
  const executeQueryFromSlice = useStoreWithSqlEditor(
    (s) => s.sqlEditor.executeQuery,
  );
  const exportResultsToCsv = useStoreWithSqlEditor(
    (s) => s.sqlEditor.exportResultsToCsv,
  );

  /**
   * Execute a SQL query
   */
  const runQuery = useCallback(
    async (q: string) => {
      try {
        setLoading(true);
        setError(null);

        const {results: queryResults, error: queryError} =
          await executeQueryFromSlice(q, schema);

        if (queryError) {
          setError(queryError);
          setResults(undefined);
        } else if (queryResults) {
          setResults(queryResults);
        }

        return queryResults;
      } finally {
        setLoading(false);
      }
    },
    [executeQueryFromSlice, schema],
  );

  /**
   * Export query results to CSV
   */
  const exportResults = useCallback(() => {
    if (!results) return;
    exportResultsToCsv(results);
  }, [exportResultsToCsv, results]);

  /**
   * Clear current query results
   */
  const clearResults = useCallback(() => {
    setResults(undefined);
    setError(null);
  }, []);

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
