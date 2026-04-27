import {DbSchemaNode} from '@sqlrooms/duckdb';
import {cn, Tree} from '@sqlrooms/ui';
import {FC, useMemo} from 'react';
import {ColumnTreeNode} from './nodes/ColumnTreeNode';
import {DatabaseTreeNode} from './nodes/DatabaseTreeNode';
import {RefreshButton} from './nodes/RefreshButton';
import {SchemaTreeNode} from './nodes/SchemaTreeNode';
import {TableTreeNode} from './nodes/TableTreeNode';

export const defaultRenderTableSchemaNode = (node: DbSchemaNode) => {
  const {object: nodeObject} = node;
  switch (nodeObject.type) {
    case 'database':
      return <DatabaseTreeNode nodeObject={nodeObject} />;
    case 'schema':
      return <SchemaTreeNode nodeObject={nodeObject} />;
    case 'table':
      return <TableTreeNode nodeObject={nodeObject} />;
    case 'column':
      return <ColumnTreeNode nodeObject={nodeObject} />;
    default:
      return null;
  }
};

const TableSchemaTreeRoot: FC<{
  className?: string;
  schemaTrees: DbSchemaNode[] | undefined;
  renderNode?: (node: DbSchemaNode, isOpen: boolean) => React.ReactNode;
  skipSingleDatabaseOrSchema?: boolean;
}> = ({
  className,
  schemaTrees,
  renderNode = defaultRenderTableSchemaNode,
  skipSingleDatabaseOrSchema = false,
}) => {
  const trees = useMemo(() => {
    if (!schemaTrees) return [];
    if (!skipSingleDatabaseOrSchema) {
      return schemaTrees;
    }
    if (schemaTrees.length > 1) {
      return schemaTrees;
    }
    const dbNode = schemaTrees[0];
    const schemaChildren = dbNode?.children;
    if (!schemaChildren?.length) {
      return schemaTrees;
    }
    if (schemaChildren.length > 1) {
      return schemaChildren;
    }
    // Single database, single schema: if there are no tables yet, show the schema
    const onlySchema = schemaChildren[0];
    if (!onlySchema) {
      return schemaTrees;
    }
    const tableChildren = onlySchema.children ?? [];
    if (tableChildren.length === 0) {
      return [onlySchema];
    }
    return tableChildren;
  }, [schemaTrees, skipSingleDatabaseOrSchema]);

  if (!trees?.length) {
    return (
      <div
        className={cn(
          'text-muted-foreground/50 flex h-full items-center justify-center p-4 text-xs',
          className,
        )}
      >
        No tables found
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex h-full flex-col gap-2 overflow-auto p-0 text-sm',
        className,
      )}
    >
      {trees.map((subtree) => (
        <Tree
          key={subtree.object.name}
          treeData={subtree}
          renderNode={renderNode}
        />
      ))}
    </div>
  );
};

export const TableSchemaTree = Object.assign(TableSchemaTreeRoot, {
  RefreshButton: RefreshButton,
});
