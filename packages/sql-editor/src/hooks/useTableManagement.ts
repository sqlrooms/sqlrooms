import {DataTable} from '@sqlrooms/duckdb';
import {useCallback, useMemo, useState} from 'react';
import {useStoreWithSqlEditor} from '../SqlEditorSlice';

/**
 * Hook to manage SQL tables, their schemas, and sample data
 */
export function useTableManagement() {
  // Get data from the store without refs
  const rawTables = useStoreWithSqlEditor((s) => s.db.tables);
  const tables = useMemo(
    () => rawTables.map((t: DataTable) => t.tableName),
    [rawTables],
  );
  const refreshTableSchemas = useStoreWithSqlEditor(
    (s) => s.db.refreshTableSchemas,
  );

  // Use the DataTable[] directly without transforming it
  const tableSchemas = useMemo(() => rawTables || [], [rawTables]);

  const [tablesLoading, setTablesLoading] = useState(false);
  const [tablesError, setTablesError] = useState<Error | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | undefined>();

  // Handler for selecting a table
  const handleSelectTable = useCallback((table: string | undefined) => {
    setSelectedTable(table);
  }, []);

   return {
    tables,
    tablesLoading,
    tablesError,
    tableSchemas,
    selectedTable,
    handleSelectTable,
    refreshTableSchemas
  };
}
