import type {DataTable} from '@sqlrooms/db';
import type {BlockDocumentStatefulBlockRendererProps} from '@sqlrooms/documents';
import {SpinnerPane} from '@sqlrooms/ui';
import {FC, useCallback, useMemo} from 'react';
import {useStoreWithMosaic} from '../MosaicSlice';
import {
  DataTableExplorer,
  type DataTableExplorerProps,
} from './DataTableExplorer';
import {
  DataTableSelector,
  DataTableSelectorEmptyState,
  getDataTableSelectorReference,
} from './DataTableSelector';

function findTableByName(
  tables: DataTable[],
  tableName: string | undefined,
): DataTable | undefined {
  if (!tableName) return undefined;

  return tables.find(
    (table) =>
      getDataTableSelectorReference(table) === tableName ||
      table.table.table === tableName ||
      table.tableName === tableName ||
      table.table.toString() === tableName,
  );
}

export const DataTableBlockRenderer: FC<
  BlockDocumentStatefulBlockRendererProps
> = ({
  blockId,
  blockInstanceId,
  blockType,
  caption,
  documentId,
  onTitleChange,
  readOnly,
  title,
}) => {
  const connection = useStoreWithMosaic((state) => state.mosaic.connection);
  const tables = useStoreWithMosaic((state) => state.db.tables);
  const selectableTables = useMemo(
    () => tables.filter((table) => table.columns.length > 0),
    [tables],
  );

  const selectedTable = useMemo(
    () => findTableByName(selectableTables, title),
    [selectableTables, title],
  );
  const tableName = selectedTable
    ? getDataTableSelectorReference(selectedTable)
    : undefined;
  const selectionName = `block-document:${documentId}:data-table:${blockId}:brush`;
  const selection = useStoreWithMosaic(
    (state) => state.mosaic.selections[selectionName],
  );
  const getSelection = useStoreWithMosaic((state) => state.mosaic.getSelection);
  const handleTableNameChange = useCallback(
    (nextTableName: string) => {
      (selection ?? getSelection(selectionName, 'crossfilter')).reset();
      onTitleChange?.(nextTableName);
    },
    [getSelection, onTitleChange, selection, selectionName],
  );
  const tableSelector = (
    <DataTableSelector
      className="max-w-full"
      disabled={readOnly || !onTitleChange}
      onChange={handleTableNameChange}
      tables={selectableTables}
      value={tableName}
    />
  );
  const header = (
    <div className="border-border flex shrink-0 items-center gap-2 border-b px-3 py-2">
      {tableSelector}
      {caption ? (
        <div className="min-w-0 truncate text-sm font-medium">{caption}</div>
      ) : null}
    </div>
  );

  if (!blockInstanceId || blockType !== 'data-table') {
    return (
      <div className="text-muted-foreground p-4 text-sm">
        Unsupported stateful block type: {blockType || 'Unconfigured'}
      </div>
    );
  }

  if (!tableName) {
    return (
      <DataTableSelectorEmptyState
        disabled={readOnly || !onTitleChange}
        onChange={handleTableNameChange}
        tables={selectableTables}
        value={tableName}
      />
    );
  }

  if (connection.status === 'loading') {
    return (
      <div className="flex h-full min-h-0 flex-col">
        {header}
        <SpinnerPane className="min-h-0 flex-1" />
      </div>
    );
  }

  if (connection.status !== 'ready') {
    return (
      <div className="flex h-full min-h-0 flex-col">
        {header}
        <div className="text-muted-foreground flex min-h-0 flex-1 items-center justify-center p-4 text-sm">
          Mosaic connection is not ready.
        </div>
      </div>
    );
  }

  const dataTableExplorerProps = {
    tableName,
    pageSize: 25,
    selectionName,
  } satisfies DataTableExplorerProps;

  return (
    <DataTableExplorer {...dataTableExplorerProps}>
      <div className="flex h-full min-h-0 flex-col">
        {header}
        <div className="min-h-0 flex-1 overflow-auto">
          <DataTableExplorer.Table>
            <DataTableExplorer.Header />
            <DataTableExplorer.Rows />
          </DataTableExplorer.Table>
        </div>
        <DataTableExplorer.StatusBar />
      </div>
    </DataTableExplorer>
  );
};
