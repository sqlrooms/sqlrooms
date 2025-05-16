// Copyright 2022 Foursquare Labs, Inc. All Rights Reserved.

import {TableNodeData} from '@sqlrooms/duckdb';
import {CopyIcon} from 'lucide-react';
import {FC} from 'react';
import {BaseTreeNode} from './BaseTreeNode';
import {
  TreeNodeActionsMenu,
  TreeNodeActionsMenuItem,
} from './TreeNodeActionsMenu';

export const TableTreeNode: FC<{
  className?: string;
  nodeData: TableNodeData;
  additionalMenuItems?: React.ReactNode;
}> = (props) => {
  const {className, nodeData, additionalMenuItems} = props;
  return (
    <BaseTreeNode asChild className={className} nodeData={nodeData}>
      <div className="flex w-full items-center space-x-2">
        <span className="text-sm">{nodeData.name}</span>
      </div>
      <TreeNodeActionsMenu>
        <TreeNodeActionsMenuItem
          onClick={() =>
            navigator.clipboard.writeText(
              nodeData.schema == 'main'
                ? nodeData.name
                : `${nodeData.schema}.${nodeData.name}`,
            )
          }
        >
          <CopyIcon width="15px" />
          Copy table name
        </TreeNodeActionsMenuItem>

        <TreeNodeActionsMenuItem
          onClick={() =>
            navigator.clipboard.writeText(
              `SELECT * FROM ${
                nodeData.schema === 'main'
                  ? nodeData.name
                  : `${nodeData.schema}.${nodeData.name}`
              }`,
            )
          }
        >
          <CopyIcon width="15px" />
          Copy SELECT query
        </TreeNodeActionsMenuItem>
        {additionalMenuItems}
      </TreeNodeActionsMenu>
    </BaseTreeNode>
  );
};
