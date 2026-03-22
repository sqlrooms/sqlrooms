import {TableSchemaTree} from '@sqlrooms/schema-tree';
import {cn, ScrollArea, ScrollBar} from '@sqlrooms/ui';
import React from 'react';
import {useStoreWithSqlEditor} from '../SqlEditorSlice';

export interface SchemaExplorerRootProps {
  className?: string;
  children?: React.ReactNode;
}

function SchemaExplorerRoot({className, children}: SchemaExplorerRootProps) {
  return (
    <ScrollArea
      className={cn(
        'relative flex h-full flex-col gap-2 overflow-auto p-2',
        className,
      )}
    >
      {children}
      <ScrollBar orientation="vertical" />
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

export interface SchemaExplorerHeaderProps {
  title?: string;
  children?: React.ReactNode;
}

function SchemaExplorerHeader({
  title = 'Schema Explorer',
  children,
}: SchemaExplorerHeaderProps) {
  return (
    <div className="flex items-center justify-between pb-2">
      <h2 className="text-muted-foreground text-xs font-medium uppercase">
        {title}
      </h2>
      <div className="flex items-center gap-0.5">{children}</div>
    </div>
  );
}

export interface SchemaExplorerTreeProps {
  className?: string;
}

function SchemaExplorerTree({className}: SchemaExplorerTreeProps) {
  const schemaTrees = useStoreWithSqlEditor((s) => s.db.schemaTrees);
  return (
    <TableSchemaTree schemaTrees={schemaTrees ?? []} className={className} />
  );
}

export const SchemaExplorer = Object.assign(SchemaExplorerRoot, {
  Header: SchemaExplorerHeader,
  Tree: SchemaExplorerTree,
  RefreshButton: TableSchemaTree.RefreshButton,
});
