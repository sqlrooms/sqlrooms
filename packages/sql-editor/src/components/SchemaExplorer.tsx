import {TableSchemaTree} from '@sqlrooms/schema-tree';
import {cn, ScrollArea, ScrollBar} from '@sqlrooms/ui';
import React from 'react';
import {useStoreWithSqlEditor} from '../SqlEditorSlice';

export interface SchemaExplorerProps {
  className?: string;
  children?: React.ReactNode;
}

function SchemaExplorerRoot({className, children}: SchemaExplorerProps) {
  const schemaTrees = useStoreWithSqlEditor((s) => s.db.schemaTrees);

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
        <div className="flex items-center gap-0.5">
          {children}
          <TableSchemaTree.RefreshButton />
        </div>
      </div>

      <TableSchemaTree schemaTrees={schemaTrees} className="h-full" />
      <ScrollBar orientation="vertical" />
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

export const SchemaExplorer = Object.assign(SchemaExplorerRoot, {
  RefreshButton: TableSchemaTree.RefreshButton,
});
