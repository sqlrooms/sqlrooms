import {DbSchemaNode} from '@sqlrooms/duckdb';
import {cn, Tree} from '@sqlrooms/ui';
import {FC} from 'react';
import {ColumnTreeNode} from './nodes/ColumnTreeNode';
import {DatabaseTreeNode} from './nodes/DatabaseTreeNode';
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

export const TableSchemaTree: FC<{
  className?: string;
  schemaTrees: DbSchemaNode[];
  renderNode?: (node: DbSchemaNode, isOpen: boolean) => React.ReactNode;
  skipSingleDatabaseOrSchema?: boolean;
}> = ({
  className,
  schemaTrees,
  renderNode = defaultRenderTableSchemaNode,
  skipSingleDatabaseOrSchema = false,
}) => {
  const trees = skipSingleDatabaseOrSchema
    ? schemaTrees.length > 1
      ? schemaTrees
      : schemaTrees[0]?.children && schemaTrees[0]?.children?.length > 1
        ? schemaTrees[0].children
        : schemaTrees[0]?.children?.[0]?.children
    : schemaTrees;

  return (
    <div
      className={cn(
        'flex h-full flex-col gap-2 overflow-auto p-0 text-sm',
        className,
      )}
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
