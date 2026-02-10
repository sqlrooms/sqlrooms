// Copyright 2022 Foursquare Labs, Inc. All Rights Reserved.

import {ColumnTypeBadge} from '@sqlrooms/data-table';
import {ColumnNodeObject} from '@sqlrooms/duckdb';
import {cn} from '@sqlrooms/ui';
import {CopyIcon} from 'lucide-react';
import {FC} from 'react';
import {BaseTreeNode} from './BaseTreeNode';
import {
  TreeNodeActionsMenu,
  TreeNodeActionsMenuItem,
} from './TreeNodeActionsMenu';

export const ColumnTreeNode: FC<{
  className?: string;
  nodeObject: ColumnNodeObject;
  additionalMenuItems?: React.ReactNode;
}> = (props) => {
  const {className, nodeObject, additionalMenuItems} = props;
  return (
    <BaseTreeNode asChild className={cn(className)} nodeObject={nodeObject}>
      <div className="relative flex w-full items-center space-x-2">
        <ColumnTypeBadge
          className="flex opacity-60"
          columnType={nodeObject.columnType}
          typeCategory={nodeObject.columnTypeCategory}
        />
        <span
          className="truncate whitespace-nowrap text-xs"
          title={nodeObject.name}
        >
          {nodeObject.name}
        </span>
      </div>
      <TreeNodeActionsMenu>
        <TreeNodeActionsMenuItem
          onClick={() => navigator.clipboard.writeText(nodeObject.name)}
        >
          <CopyIcon width="15px" />
          Copy column name
        </TreeNodeActionsMenuItem>
        {additionalMenuItems}
      </TreeNodeActionsMenu>
    </BaseTreeNode>
  );
};
