import {cn, SpinnerPane} from '@sqlrooms/ui';
import React, {useCallback, useMemo} from 'react';
import {useStoreWithSqlEditor} from '../SqlEditorSlice';
import {TableSchemaTree} from '@sqlrooms/schema-tree';

export interface TableStructurePanelProps {
  /** Custom class name for styling */
  className?: string;
  /** The database schema to use. Defaults to 'main'.
   * If '*' is provided, all tables will be shown.
   * If a function is provided, it will be used to filter the tables. */
  schema?: string | ((name: string) => boolean);
  /** Callback when a table is selected */
  onTableSelect?: (table: string | undefined) => void;
}

export const TableStructurePanel: React.FC<TableStructurePanelProps> = ({
  className,
  schema = '*',
}) => {
  // Get state from store
  const schemaTrees = useStoreWithSqlEditor((s) => s.db.schemaTrees);
  const filteredSchemaTrees = useMemo(() => {
    if (schema === '*') {
      return schemaTrees;
    }
    if (typeof schema === 'function') {
      return schemaTrees?.filter((tree) => schema(tree.object.name));
    }
    return schemaTrees?.filter((tree) => tree.object.name === schema);
  }, [schema, schemaTrees]);

  const isRefreshing = useStoreWithSqlEditor(
    (s) => s.db.isRefreshingTableSchemas,
  );

  // Get methods from store
  // const selectedTable = useStoreWithSqlEditor((s) => s.sqlEditor.selectedTable);
  // const selectTable = useStoreWithSqlEditor((s) => s.sqlEditor.selectTable);
  // // Memoize the table selection handler
  // const handleTableSelect = useCallback(
  //   (table: string | undefined) => {
  //     selectTable(table);
  //     onTableSelect?.(table);
  //   },
  //   [selectTable, onTableSelect],
  // );

  // if (error) {
  //   return (
  //     <div className="p-4 text-red-500">Error loading tables: {error}</div>
  //   );
  // }

  return (
    <div
      className={cn(
        'relative flex h-full flex-col gap-2 overflow-auto p-2',
        className,
      )}
    >
      {filteredSchemaTrees && (
        <TableSchemaTree schemaTrees={filteredSchemaTrees} />
      )}
      {isRefreshing && (
        <SpinnerPane className="bg-background/80 absolute inset-0 h-full" />
      )}
    </div>
  );
};
