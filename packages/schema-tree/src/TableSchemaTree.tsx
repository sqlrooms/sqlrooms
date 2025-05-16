import {DbSchemaNode} from '@sqlrooms/duckdb';
import {cn, Tree} from '@sqlrooms/ui';
import {FC} from 'react';
import {ColumnTreeNode} from './nodes/ColumnTreeNode';
import {SchemaTreeNode} from './nodes/SchemaTreeNode';
import {TableTreeNode} from './nodes/TableTreeNode';

export const defaultRenderTableSchemaNode = (node: DbSchemaNode) => {
  const {object: nodeData} = node;
  switch (nodeData.type) {
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
  schemaTrees: DbSchemaNode[];
  renderNode?: (node: DbSchemaNode, isOpen: boolean) => React.ReactNode;
}> = ({className, schemaTrees, renderNode = defaultRenderTableSchemaNode}) => {
  return (
    <div
      className={cn('flex h-full flex-col gap-2 overflow-auto p-2', className)}
    >
      {schemaTrees?.map((subtree) => (
        <Tree
          key={subtree.object.name}
          treeData={subtree}
          renderNode={renderNode}
        />
      ))}
    </div>
  );
};
