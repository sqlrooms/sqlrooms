import {DbSchemaNode} from '@sqlrooms/duckdb';
import {cn, Tree} from '@sqlrooms/ui';
import {FC} from 'react';
import {ColumnTreeNode} from './nodes/ColumnTreeNode';
import {DatabaseTreeNode} from './nodes/DatabaseTreeNode';
import {SchemaTreeNode} from './nodes/SchemaTreeNode';
import {TableTreeNode} from './nodes/TableTreeNode';

export const defaultRenderTableSchemaNode = (node: DbSchemaNode) => {
  const {object: nodeData} = node;
  switch (nodeData.type) {
    case 'database':
      return <DatabaseTreeNode nodeData={nodeData} />;
    case 'schema':
      return <SchemaTreeNode nodeData={nodeData} />;
    case 'table':
      return <TableTreeNode nodeData={nodeData} />;
    case 'column':
      return <ColumnTreeNode nodeData={nodeData} />;
    default:
      return null;
  }
};

export const TableSchemaTree: FC<{
  className?: string;
  databaseTrees: DbSchemaNode[];
  renderNode?: (node: DbSchemaNode, isOpen: boolean) => React.ReactNode;
  skipSingleDatabaseOrSchema?: boolean;
}> = ({
  className,
  databaseTrees,
  renderNode = defaultRenderTableSchemaNode,
  skipSingleDatabaseOrSchema = false,
}) => {
  const trees = skipSingleDatabaseOrSchema
    ? databaseTrees.length > 1
      ? databaseTrees
      : databaseTrees[0]?.children && databaseTrees[0]?.children?.length > 1
        ? databaseTrees[0].children
        : databaseTrees[0]?.children?.[0]?.children
    : databaseTrees;

  return (
    <div
      className={cn('flex h-full flex-col gap-2 overflow-auto p-0', className)}
    >
      {trees?.map((subtree) => (
        <Tree
          key={subtree.object.name}
          treeData={subtree}
          renderNode={renderNode}
        />
      ))}
    </div>
  );
};
