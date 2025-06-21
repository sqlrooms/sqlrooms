// Copyright 2022 Foursquare Labs, Inc. All Rights Reserved.

import {TableNodeObject} from '@sqlrooms/duckdb';
import {CopyIcon, SquareTerminalIcon, TableIcon} from 'lucide-react';
import {FC} from 'react';
import {BaseTreeNode} from './BaseTreeNode';
import {
  TreeNodeActionsMenu,
  TreeNodeActionsMenuItem,
} from './TreeNodeActionsMenu';

export const defaultRenderTableNodeMenuItems = (
  nodeObject: TableNodeObject,
) => {
  const {database, schema, name} = nodeObject;
  return (
    <>
      <TreeNodeActionsMenuItem
        onClick={() => {
          navigator.clipboard.writeText(
            nodeObject.schema == 'main'
              ? nodeObject.name
              : `${nodeObject.schema}.${nodeObject.name}`,
          );
        }}
      >
        <CopyIcon width="15px" />
        Copy table name
      </TreeNodeActionsMenuItem>

      <TreeNodeActionsMenuItem
        onClick={() => {
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
  nodeObject: TableNodeObject;
  renderMenuItems?: (nodeObject: TableNodeObject) => React.ReactNode;
}> = (props) => {
  const {
    className,
    nodeObject,
    renderMenuItems = defaultRenderTableNodeMenuItems,
  } = props;
  return (
    <BaseTreeNode asChild className={className} nodeObject={nodeObject}>
      <div className="flex w-full items-center space-x-2">
        <TableIcon size="16px" className="shrink-0 text-blue-500" />
        <span className="text-sm">{nodeObject.name}</span>
      </div>
      <TreeNodeActionsMenu>{renderMenuItems(nodeObject)}</TreeNodeActionsMenu>
    </BaseTreeNode>
  );
};
