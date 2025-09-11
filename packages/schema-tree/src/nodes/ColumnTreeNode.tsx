// Copyright 2022 Foursquare Labs, Inc. All Rights Reserved.

import {ColumnTypeBadge} from '@sqlrooms/data-table';
import {ColumnNodeObject} from '@sqlrooms/duckdb';
import {CopyIcon} from 'lucide-react';
import {FC} from 'react';
import {BaseTreeNode} from './BaseTreeNode';
import {
  TreeNodeActionsMenu,
  TreeNodeActionsMenuItem,
} from './TreeNodeActionsMenu';
import {cn} from '@sqlrooms/ui';

export const ColumnTreeNode: FC<{
  className?: string;
  nodeObject: ColumnNodeObject;
  additionalMenuItems?: React.ReactNode;
}> = (props) => {
  const {className, nodeObject, additionalMenuItems} = props;
  return (
    <BaseTreeNode
      asChild
      className={cn(className, 'h-[18px]')}
      nodeObject={nodeObject}
    >
      <div className="flex w-full items-center space-x-2">
        <ColumnTypeBadge
          className="opacity-50"
          columnType={nodeObject.columnType}
          typeCategory={nodeObject.columnTypeCategory}
        />
        <span className="text-xs">{nodeObject.name}</span>
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
