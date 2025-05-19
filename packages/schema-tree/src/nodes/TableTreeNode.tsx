// Copyright 2022 Foursquare Labs, Inc. All Rights Reserved.

import {TableNodeData} from '@sqlrooms/duckdb';
import {CopyIcon, TableIcon} from 'lucide-react';
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
  const {database, schema, name} = nodeData;
  return (
    <BaseTreeNode asChild className={className} nodeData={nodeData}>
      <div className="flex w-full items-center space-x-2">
        <TableIcon size="16px" className="min-w-[16px] text-green-500" />
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
          <CopyIcon width="15px" />
          Copy SELECT query
        </TreeNodeActionsMenuItem>
        {additionalMenuItems}
      </TreeNodeActionsMenu>
    </BaseTreeNode>
  );
};
