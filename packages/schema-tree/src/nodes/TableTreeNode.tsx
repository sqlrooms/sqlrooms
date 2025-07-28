// Copyright 2022 Foursquare Labs, Inc. All Rights Reserved.

import {makeQualifiedTableName, TableNodeObject} from '@sqlrooms/duckdb';
import {CopyIcon, EyeIcon, SquareTerminalIcon, TableIcon} from 'lucide-react';
import {FC} from 'react';
import {useDisclosure} from '@sqlrooms/ui';
import {DataTableModal} from '@sqlrooms/data-table';
import {BaseTreeNode} from './BaseTreeNode';
import {
  TreeNodeActionsMenu,
  TreeNodeActionsMenuItem,
} from './TreeNodeActionsMenu';

export const defaultRenderTableNodeMenuItems = (
  nodeObject: TableNodeObject,
  viewTableModal?: ReturnType<typeof useDisclosure>,
) => {
  const {database, schema, name} = nodeObject;
  const qualifiedTableName = makeQualifiedTableName({
    database,
    schema,
    table: name,
  });
  return (
    <>
      {viewTableModal && (
        <TreeNodeActionsMenuItem
          onClick={() => {
            viewTableModal.onOpen();
          }}
        >
          <EyeIcon width="15px" />
          View table
        </TreeNodeActionsMenuItem>
      )}
      <TreeNodeActionsMenuItem
        onClick={() => {
          navigator.clipboard.writeText(qualifiedTableName.table);
        }}
      >
        <CopyIcon width="15px" />
        Copy table name
      </TreeNodeActionsMenuItem>

      <TreeNodeActionsMenuItem
        onClick={() => {
          navigator.clipboard.writeText(qualifiedTableName.toString());
        }}
      >
        <CopyIcon width="15px" />
        Copy qualified table name
      </TreeNodeActionsMenuItem>

      <TreeNodeActionsMenuItem
        onClick={() => {
          navigator.clipboard.writeText(`SELECT * FROM ${qualifiedTableName}`);
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
  renderMenuItems?: (
    nodeObject: TableNodeObject,
    tableModal: ReturnType<typeof useDisclosure>,
  ) => React.ReactNode;
}> = (props) => {
  const {
    className,
    nodeObject,
    renderMenuItems = defaultRenderTableNodeMenuItems,
  } = props;

  const tableModal = useDisclosure();
  const {database, schema, name} = nodeObject;
  const qualifiedTableName = makeQualifiedTableName({
    database,
    schema,
    table: name,
  });
  const sqlQuery = `SELECT * FROM ${qualifiedTableName}`;

  return (
    <>
      <BaseTreeNode asChild className={className} nodeObject={nodeObject}>
        <div className="flex w-full items-center space-x-2">
          <TableIcon size="16px" className="shrink-0 text-blue-500" />
          <span className="text-sm">{nodeObject.name}</span>
        </div>
        <TreeNodeActionsMenu>
          {renderMenuItems(nodeObject, tableModal)}
        </TreeNodeActionsMenu>
      </BaseTreeNode>
      <DataTableModal
        title={qualifiedTableName.table}
        query={sqlQuery}
        tableModal={tableModal}
      />
    </>
  );
};
