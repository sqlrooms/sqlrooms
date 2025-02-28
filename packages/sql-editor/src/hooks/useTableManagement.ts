import {DataTable, TableColumn} from '@sqlrooms/duckdb';
import {useCallback, useMemo, useState} from 'react';
import {useStoreWithSqlEditor} from '../SqlEditorSlice';

/**
 * Hook to manage SQL tables, their schemas, and sample data
 */
export function useTableManagement() {
  // Get data from the store without refs
  const rawTables = useStoreWithSqlEditor((s) => s.project.tables);
  const tables = useMemo(
    () => rawTables.map((t: DataTable) => t.tableName),
    [rawTables],
  );
  const refreshTableSchemas = useStoreWithSqlEditor(
    (s) => s.project.refreshTableSchemas,
  );

  // Then memoize the transformation of that data
  const tableSchemas = useMemo(() => {
    if (!rawTables) return {};

    // Convert DataTable[] to the format needed by SqlMonacoEditor
    return rawTables.reduce(
      (acc: Record<string, Record<string, string>>, table: DataTable) => {
        // Correctly access column data from the DataTable structure
        // Each DataTable has a 'columns' array of TableColumn objects with 'name' and 'type'
        const columns = table.columns || [];

        // Create a map of column name to column type
        acc[table.tableName] = columns.reduce(
          (cols: Record<string, string>, column: TableColumn) => {
            cols[column.name] = column.type;
            return cols;
          },
          {},
        );

        return acc;
      },
      {} as Record<string, Record<string, string>>,
    );
  }, [rawTables]); // Depend only on the raw tables data

  const [tablesLoading, setTablesLoading] = useState(false);
  const [tablesError, setTablesError] = useState<Error | null>(null);
  const [tableSamples, setTableSamples] = useState<Record<string, string[]>>(
    {},
  );
  const [selectedTable, setSelectedTable] = useState<string | undefined>();

  // Function to fetch table samples for autocompletion
  const fetchTableSamples = useCallback(
    async (tableName: string) => {
      // If we already have samples for this table, don't fetch again
      if (tableSamples[tableName]) return tableSamples[tableName];

      // Skip if we don't have schema information
      const tableSchema = tableSchemas[tableName];
      if (!tableSchema) return [];

      // This would require DuckDB access, but we'll delegate this to the original implementation
      // For now, we return an empty array
      return [];
    },
    [tableSamples, tableSchemas],
  );

  // Handler for selecting a table
  const handleSelectTable = useCallback((table: string | undefined) => {
    setSelectedTable(table);
  }, []);

  // The fetchTables method now just refreshes the schemas from ProjectStore
  const fetchTables = useCallback(async () => {
    try {
      setTablesLoading(true);
      setTablesError(null);
      if (refreshTableSchemas) await refreshTableSchemas();
    } catch (error) {
      console.error('Error refreshing tables:', error);
      setTablesError(error as Error);
    } finally {
      setTablesLoading(false);
    }
  }, [refreshTableSchemas]);

  return {
    tables,
    tablesLoading,
    tablesError,
    tableSchemas,
    tableSamples,
    selectedTable,
    fetchTables,
    fetchTableSamples,
    handleSelectTable,
  };
}
