// Copyright 2022 Foursquare Labs, Inc. All Rights Reserved.

import {ColumnTypeBadge} from '@sqlrooms/data-table';
import {ColumnNodeData} from '@sqlrooms/duckdb';
import {CopyIcon} from 'lucide-react';
import {FC} from 'react';
import {BaseTreeNode} from './BaseTreeNode';
import {
  TreeNodeActionsMenu,
  TreeNodeActionsMenuItem,
} from './TreeNodeActionsMenu';

export const ColumnTreeNode: FC<{
  className?: string;
  nodeData: ColumnNodeData;
  additionalMenuItems?: React.ReactNode;
}> = (props) => {
  const {className, nodeData, additionalMenuItems} = props;
  return (
    <BaseTreeNode asChild className={className} nodeData={nodeData}>
      <div className="flex w-full items-center space-x-2">
        <ColumnTypeBadge
          className="opacity-50"
          columnType={nodeData.columnType}
          typeCategory={nodeData.columnTypeCategory}
        />
        <span className="text-xs">{nodeData.name}</span>
      </div>
      <TreeNodeActionsMenu>
        <TreeNodeActionsMenuItem
          onClick={() => navigator.clipboard.writeText(nodeData.name)}
        >
          <CopyIcon width="15px" />
          Copy column name
        </TreeNodeActionsMenuItem>
        {additionalMenuItems}
      </TreeNodeActionsMenu>
    </BaseTreeNode>
  );
};
