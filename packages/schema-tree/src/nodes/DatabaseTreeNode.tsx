// Copyright 2022 Foursquare Labs, Inc. All Rights Reserved.

import {DatabaseNodeData} from '@sqlrooms/duckdb';
import {CopyIcon, DatabaseIcon} from 'lucide-react';
import {FC} from 'react';
import {BaseTreeNode} from './BaseTreeNode';
import {
  TreeNodeActionsMenu,
  TreeNodeActionsMenuItem,
} from './TreeNodeActionsMenu';

export const DatabaseTreeNode: FC<{
  className?: string;
  nodeData: DatabaseNodeData;
  additionalMenuItems?: React.ReactNode;
}> = (props) => {
  const {className, nodeData, additionalMenuItems} = props;
  return (
    <BaseTreeNode asChild className={className} nodeData={nodeData}>
      <div className="flex w-full items-center space-x-2">
        <DatabaseIcon size="16px" className="shrink-0 text-blue-500" />
        <span className="text-sm">{nodeData.name}</span>
      </div>
      <TreeNodeActionsMenu>
        <TreeNodeActionsMenuItem
          onClick={() => navigator.clipboard.writeText(nodeData.name)}
        >
          <CopyIcon width="15px" />
          Copy database name
        </TreeNodeActionsMenuItem>
        {additionalMenuItems}
      </TreeNodeActionsMenu>
    </BaseTreeNode>
  );
};
