import {SpinnerPane} from '@sqlrooms/ui';
import React, {useCallback, useMemo} from 'react';
import {useStoreWithSqlEditor} from '../SqlEditorSlice';
import {TablesList} from '../TablesList';

export interface TableStructurePanelProps {
  /** Custom class name for styling */
  className?: string;
  /** The database schema to use. Defaults to 'main' */
  schema?: string;
  /** Callback when a table is selected */
  onTableSelect?: (table: string | undefined) => void;
}

export const TableStructurePanel: React.FC<TableStructurePanelProps> = ({
  className,
  schema = 'main',
  onTableSelect,
}) => {
  // Get state from store
  const tables = useStoreWithSqlEditor((s) => s.db.tables);
  const tableNames = useMemo(() => tables.map((t) => t.tableName), [tables]);
  const selectedTable = useStoreWithSqlEditor((s) => s.sqlEditor.selectedTable);
  const isLoading = useStoreWithSqlEditor((s) => s.sqlEditor.isTablesLoading);
  const error = useStoreWithSqlEditor((s) => s.sqlEditor.tablesError);

  // Get methods from store
  const selectTable = useStoreWithSqlEditor((s) => s.sqlEditor.selectTable);

  // Memoize the table selection handler
  const handleTableSelect = useCallback(
    (table: string | undefined) => {
      selectTable(table);
      onTableSelect?.(table);
    },
    [selectTable, onTableSelect],
  );

  if (isLoading) {
    return <SpinnerPane h="100%" />;
  }

  if (error) {
    return (
      <div className="p-4 text-red-500">Error loading tables: {error}</div>
    );
  }

  return (
    <div className={className}>
      <TablesList
        schema={schema}
        tableNames={tableNames}
        selectedTable={selectedTable}
        onSelect={handleTableSelect}
      />
    </div>
  );
};
