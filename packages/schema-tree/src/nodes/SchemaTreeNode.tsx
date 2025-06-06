// Copyright 2022 Foursquare Labs, Inc. All Rights Reserved.

import {SchemaNodeObject} from '@sqlrooms/duckdb';
import {CopyIcon, FolderIcon} from 'lucide-react';
import {FC} from 'react';
import {BaseTreeNode} from './BaseTreeNode';
import {
  TreeNodeActionsMenu,
  TreeNodeActionsMenuItem,
} from './TreeNodeActionsMenu';

export const SchemaTreeNode: FC<{
  className?: string;
  nodeObject: SchemaNodeObject;
  additionalMenuItems?: React.ReactNode;
}> = (props) => {
  const {className, nodeObject, additionalMenuItems} = props;
  return (
    <BaseTreeNode asChild className={className} nodeObject={nodeObject}>
      <div className="flex w-full items-center space-x-2">
        <FolderIcon size="16px" className="shrink-0 text-yellow-500" />
        <span className="text-sm">{nodeObject.name}</span>
      </div>
      <TreeNodeActionsMenu>
        <TreeNodeActionsMenuItem
          onClick={() => navigator.clipboard.writeText(nodeObject.name)}
        >
          <CopyIcon width="15px" />
          Copy schema name
        </TreeNodeActionsMenuItem>
        {additionalMenuItems}
      </TreeNodeActionsMenu>
    </BaseTreeNode>
  );
};
