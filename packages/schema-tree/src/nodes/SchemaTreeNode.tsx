// Copyright 2022 Foursquare Labs, Inc. All Rights Reserved.

import {SchemaNodeData} from '@sqlrooms/duckdb';
import {CopyIcon, FolderIcon} from 'lucide-react';
import {FC} from 'react';
import {BaseTreeNode} from './BaseTreeNode';
import {
  TreeNodeActionsMenu,
  TreeNodeActionsMenuItem,
} from './TreeNodeActionsMenu';

export const SchemaTreeNode: FC<{
  className?: string;
  nodeData: SchemaNodeData;
  additionalMenuItems?: React.ReactNode;
}> = (props) => {
  const {className, nodeData, additionalMenuItems} = props;
  return (
    <BaseTreeNode asChild className={className} nodeData={nodeData}>
      <div className="flex w-full items-center space-x-2">
        <FolderIcon size="16px" className="min-w-[16px] text-yellow-500" />
        <span className="text-sm">{nodeData.name}</span>
      </div>
      <TreeNodeActionsMenu>
        <TreeNodeActionsMenuItem
          onClick={() => navigator.clipboard.writeText(nodeData.name)}
        >
          <CopyIcon width="15px" />
          Copy schema name
        </TreeNodeActionsMenuItem>
        {additionalMenuItems}
      </TreeNodeActionsMenu>
    </BaseTreeNode>
  );
};
