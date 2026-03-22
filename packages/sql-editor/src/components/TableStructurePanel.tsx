import {TableSchemaTree} from '@sqlrooms/schema-tree';
import {cn, ScrollArea, ScrollBar} from '@sqlrooms/ui';
import React, {useMemo} from 'react';
import {useStoreWithSqlEditor} from '../SqlEditorSlice';

export interface TableStructurePanelProps {
  /** Custom class name for styling */
  className?: string;
  /** The database schema to use. Defaults to '*'.
   * If '*' is provided, all tables will be shown.
   * If a function is provided, it will be used to filter the tables. */
  schema?: string | ((name: string) => boolean);
}

export const TableStructurePanel: React.FC<TableStructurePanelProps> = ({
  className,
  schema = '*',
}) => {
  // Get state from store
  const schemaTrees = useStoreWithSqlEditor((s) => s.db.schemaTrees);
  const filteredSchemaTrees = useMemo(() => {
    if (schema === '*') {
      return schemaTrees ?? [];
    }
    if (typeof schema === 'function') {
      return schemaTrees?.filter((tree) => schema(tree.object.name)) ?? [];
    }
    return schemaTrees?.filter((tree) => tree.object.name === schema) ?? [];
  }, [schema, schemaTrees]);

  return (
    <ScrollArea
      className={cn(
        'relative flex h-full flex-col gap-2 overflow-auto p-2',
        className,
      )}
    >
      <div className="flex items-center justify-between pb-2">
        <h2 className="text-muted-foreground text-xs font-medium uppercase">
          Schema Explorer
        </h2>
        <TableSchemaTree.RefreshButton />
      </div>

      <TableSchemaTree schemaTrees={filteredSchemaTrees} className="h-full" />
      <ScrollBar orientation="vertical" />
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
};
