// Copyright 2022 Foursquare Labs, Inc. All Rights Reserved.

import {DataTableModal} from '@sqlrooms/data-table';
import {makeQualifiedTableName, TableNodeObject} from '@sqlrooms/duckdb';
import {cn, useDisclosure} from '@sqlrooms/ui';
import {formatCount} from '@sqlrooms/utils';
import {CopyIcon, EyeIcon, TableIcon, ViewIcon} from 'lucide-react';
import {FC} from 'react';
import {BaseTreeNode} from './BaseTreeNode';
import {
  TreeNodeActionsMenu,
  TreeNodeActionsMenuItem,
} from './TreeNodeActionsMenu';

export const defaultRenderTableNodeMenuItems = (
  nodeObject: TableNodeObject,
  viewTableModal?: ReturnType<typeof useDisclosure>,
) => {
  const {database, schema, name, sql, isView} = nodeObject;
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
          View data
        </TreeNodeActionsMenuItem>
      )}
      <TreeNodeActionsMenuItem
        onClick={() => {
          navigator.clipboard.writeText(qualifiedTableName.table);
        }}
      >
        <CopyIcon width="15px" />
        Copy {isView ? 'view' : 'table'} name
      </TreeNodeActionsMenuItem>

      <TreeNodeActionsMenuItem
        onClick={() => {
          navigator.clipboard.writeText(qualifiedTableName.toString());
        }}
      >
        <CopyIcon width="15px" />
        Copy qualified {isView ? 'view' : 'table'} name
      </TreeNodeActionsMenuItem>

      <TreeNodeActionsMenuItem
        onClick={() => {
          navigator.clipboard.writeText(`SELECT * FROM ${qualifiedTableName}`);
        }}
      >
        <CopyIcon width="15px" />
        Copy SELECT query
      </TreeNodeActionsMenuItem>

      <TreeNodeActionsMenuItem
        onClick={() => {
          if (sql) {
            navigator.clipboard.writeText(sql);
          }
        }}
        disabled={!sql}
      >
        <CopyIcon width="15px" />
        Copy CREATE {isView ? 'VIEW' : 'TABLE'}
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
  const {database, schema, name, rowCount, isView} = nodeObject;
  const qualifiedTableName = makeQualifiedTableName({
    database,
    schema,
    table: name,
  });
  const sqlQuery = `SELECT * FROM ${qualifiedTableName}`;

  return (
    <>
      <BaseTreeNode asChild className={className} nodeObject={nodeObject}>
        <div className="relative flex w-full items-center space-x-2">
          {isView ? (
            <ViewIcon size="16px" className="shrink-0 text-blue-500" />
          ) : (
            <TableIcon size="16px" className="shrink-0 text-blue-500" />
          )}
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
            <span
              className={cn(
                'shrink-0 truncate',
                rowCount !== undefined && rowCount > 0 && 'max-w-[70%]',
              )}
              title={name}
            >
              {name}
            </span>
            {rowCount !== undefined && rowCount > 0 && (
              <span className="text-muted-foreground/50 ml-auto mr-1 truncate whitespace-nowrap text-xs">
                {formatCount(rowCount)} {rowCount === 1 ? 'row' : 'rows'}
              </span>
            )}
          </div>
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
