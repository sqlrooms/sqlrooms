// Copyright 2022 Foursquare Labs, Inc. All Rights Reserved.

import {TableNodeData} from '@sqlrooms/duckdb';
import {CopyIcon, SquareTerminalIcon, TableIcon} from 'lucide-react';
import {FC} from 'react';
import {BaseTreeNode} from './BaseTreeNode';
import {
  TreeNodeActionsMenu,
  TreeNodeActionsMenuItem,
} from './TreeNodeActionsMenu';

export const defaultRenderTableNodeMenuItems = (nodeData: TableNodeData) => {
  const {database, schema, name} = nodeData;
  return (
    <>
      <TreeNodeActionsMenuItem
        onClick={(evt) => {
          evt.stopPropagation();
          navigator.clipboard.writeText(
            nodeData.schema == 'main'
              ? nodeData.name
              : `${nodeData.schema}.${nodeData.name}`,
          );
        }}
      >
        <CopyIcon width="15px" />
        Copy table name
      </TreeNodeActionsMenuItem>

      <TreeNodeActionsMenuItem
        onClick={(evt) => {
          evt.stopPropagation();
          navigator.clipboard.writeText(
            [
              `SELECT * FROM `,
              database === 'memory' ? '' : `${database}.`,
              schema === 'main' ? '' : `${schema}.`,
              name,
            ].join(''),
          );
        }}
      >
        <SquareTerminalIcon width="15px" />
        Copy SELECT query
      </TreeNodeActionsMenuItem>
    </>
  );
};

export const TableTreeNode: FC<{
  className?: string;
  nodeData: TableNodeData;
  renderMenuItems?: (nodeData: TableNodeData) => React.ReactNode;
}> = (props) => {
  const {
    className,
    nodeData,
    renderMenuItems = defaultRenderTableNodeMenuItems,
  } = props;
  return (
    <BaseTreeNode asChild className={className} nodeData={nodeData}>
      <div className="flex w-full items-center space-x-2">
        <TableIcon size="16px" className="shrink-0 text-blue-500" />
        <span className="text-sm">{nodeData.name}</span>
      </div>
      <TreeNodeActionsMenu>{renderMenuItems(nodeData)}</TreeNodeActionsMenu>
    </BaseTreeNode>
  );
};
