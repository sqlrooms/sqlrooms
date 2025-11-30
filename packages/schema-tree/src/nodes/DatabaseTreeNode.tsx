// Copyright 2022 Foursquare Labs, Inc. All Rights Reserved.

import {DatabaseNodeObject} from '@sqlrooms/duckdb';
import {CopyIcon, DatabaseIcon} from 'lucide-react';
import {FC} from 'react';
import {BaseTreeNode} from './BaseTreeNode';
import {
  TreeNodeActionsMenu,
  TreeNodeActionsMenuItem,
} from './TreeNodeActionsMenu';

export const DatabaseTreeNode: FC<{
  className?: string;
  nodeObject: DatabaseNodeObject;
  additionalMenuItems?: React.ReactNode;
}> = (props) => {
  const {className, nodeObject, additionalMenuItems} = props;
  return (
    <BaseTreeNode asChild className={className} nodeObject={nodeObject}>
      <div className="flex w-full items-center space-x-2">
        <DatabaseIcon size="16px" className="shrink-0 text-green-500" />
        <span className="truncate whitespace-nowrap" title={nodeObject.name}>
          {nodeObject.name}
        </span>
      </div>
      <TreeNodeActionsMenu>
        <TreeNodeActionsMenuItem
          onClick={() => navigator.clipboard.writeText(nodeObject.name)}
        >
          <CopyIcon width="15px" />
          Copy database name
        </TreeNodeActionsMenuItem>
        {additionalMenuItems}
      </TreeNodeActionsMenu>
    </BaseTreeNode>
  );
};
