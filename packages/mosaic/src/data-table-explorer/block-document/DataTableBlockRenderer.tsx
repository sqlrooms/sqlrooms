import {getTableIdentity, useDataTable, type DataTable} from '@sqlrooms/db';
import type {BlockDocumentStatefulBlockRendererProps} from '@sqlrooms/documents';
import {SelectablePanelWrapper} from '@sqlrooms/documents';
import {ScrollArea, ScrollBar, SpinnerPane} from '@sqlrooms/ui';
import {FC, useCallback} from 'react';
import {useStoreWithMosaic} from '../../MosaicSlice';
import {DataTableSelectorEmptyState} from '../../components/DataTableSelector';
import {useTablesWithColumns} from '../../hooks/useTablesWithColumns';
import {DataTableExplorer} from '../DataTableExplorer';
import {DataTableBlockHeader} from './DataTableBlockHeader';
import {DataTableBlockSettings} from './DataTableBlockSettings';

export const DataTableBlockRenderer: FC<
  BlockDocumentStatefulBlockRendererProps
> = ({
  blockId,
  blockInstanceId,
  blockType,
  caption,
  documentId,
  onCaptionChange,
  onTableNameChange,
  readOnly,
  tableName,
}) => {
  const connection = useStoreWithMosaic((state) => state.mosaic.connection);

  const tables = useTablesWithColumns();
  const selectedTable = useDataTable(tableName);

  const selectionName = `block-document:${documentId}:data-table:${blockId}:brush`;
  const selection = useStoreWithMosaic(
    (state) => state.mosaic.selections[selectionName],
  );
  const getSelection = useStoreWithMosaic((state) => state.mosaic.getSelection);
  const handleTableChange = useCallback(
    (table: DataTable) => {
      (selection ?? getSelection(selectionName, 'crossfilter')).reset();
      onTableNameChange?.(getTableIdentity(table.table));
    },
    [getSelection, onTableNameChange, selection, selectionName],
  );

  if (!blockInstanceId || blockType !== 'data-table') {
    return (
      <div className="text-muted-foreground p-4 text-sm">
        Unsupported stateful block type: {blockType || 'Unconfigured'}
      </div>
    );
  }

  const content = !selectedTable ? (
    <DataTableSelectorEmptyState
      disabled={readOnly || !onTableNameChange}
      onChange={handleTableChange}
      tables={tables}
    />
  ) : connection.status === 'loading' ? (
    <div className="flex h-full min-h-0 flex-col">
      <SpinnerPane className="min-h-0 flex-1" />
    </div>
  ) : connection.status !== 'ready' ? (
    <div className="flex h-full min-h-0 flex-col">
      <div className="text-muted-foreground flex min-h-0 flex-1 items-center justify-center p-4 text-sm">
        Mosaic connection is not ready.
      </div>
    </div>
  ) : (
    <DataTableExplorer
      pageSize={25}
      selectionName={selectionName}
      tableName={selectedTable.table}
    >
      <div className="flex h-full min-h-0 flex-col">
        <DataTableBlockHeader
          caption={caption}
          onCaptionChange={onCaptionChange}
          selectedTable={selectedTable}
          readOnly={readOnly}
        />
        <ScrollArea className="min-h-0 flex-1 px-0.5">
          <DataTableExplorer.Table>
            <DataTableExplorer.Header />
            <DataTableExplorer.Rows />
          </DataTableExplorer.Table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
        <DataTableExplorer.StatusBar />
      </div>
    </DataTableExplorer>
  );

  return (
    <SelectablePanelWrapper
      dashboardId={documentId}
      panelId={blockId}
      panelType="data-table"
      blockInstanceId={blockInstanceId}
      blockType="standalone-block"
      settingsComponent={DataTableBlockSettings}
    >
      {content}
    </SelectablePanelWrapper>
  );
};
