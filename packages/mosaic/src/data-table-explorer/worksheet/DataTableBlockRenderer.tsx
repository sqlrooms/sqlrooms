import type {DataTable} from '@sqlrooms/db';
import type {BlockDocumentStatefulBlockRendererProps} from '@sqlrooms/documents';
import {SpinnerPane} from '@sqlrooms/ui';
import {FC, useCallback} from 'react';
import {useStoreWithMosaic} from '../../MosaicSlice';
import {DataTableSelectorEmptyState} from '../../components/DataTableSelector';
import {useDataTable} from '../../hooks/useDataTable';
import {useTablesWithColumns} from '../../hooks/useTablesWithColumns';
import {DataTableExplorer} from '../DataTableExplorer';
import {DataTableBlockHeader} from './DataTableBlockHeader';

export const DataTableBlockRenderer: FC<
  BlockDocumentStatefulBlockRendererProps
> = ({
  blockId,
  blockInstanceId,
  blockType,
  caption,
  documentId,
  onCaptionChange,
  onTitleChange,
  readOnly,
  title,
}) => {
  const connection = useStoreWithMosaic((state) => state.mosaic.connection);

  const tables = useTablesWithColumns();
  const selectedTable = useDataTable(title);

  const selectionName = `block-document:${documentId}:data-table:${blockId}:brush`;
  const selection = useStoreWithMosaic(
    (state) => state.mosaic.selections[selectionName],
  );
  const getSelection = useStoreWithMosaic((state) => state.mosaic.getSelection);
  const handleTableChange = useCallback(
    (table: DataTable) => {
      (selection ?? getSelection(selectionName, 'crossfilter')).reset();
      onTitleChange?.(table.table.toString());
    },
    [getSelection, onTitleChange, selection, selectionName],
  );

  if (!blockInstanceId || blockType !== 'data-table') {
    return (
      <div className="text-muted-foreground p-4 text-sm">
        Unsupported stateful block type: {blockType || 'Unconfigured'}
      </div>
    );
  }

  if (!selectedTable) {
    return (
      <DataTableSelectorEmptyState
        disabled={readOnly || !onTitleChange}
        onChange={handleTableChange}
        tables={tables}
      />
    );
  }

  if (connection.status === 'loading') {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <SpinnerPane className="min-h-0 flex-1" />
      </div>
    );
  }

  if (connection.status !== 'ready') {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="text-muted-foreground flex min-h-0 flex-1 items-center justify-center p-4 text-sm">
          Mosaic connection is not ready.
        </div>
      </div>
    );
  }

  return (
    <DataTableExplorer
      pageSize={25}
      selectionName={selectionName}
      tableName={selectedTable}
    >
      <div className="flex h-full min-h-0 flex-col">
        <DataTableBlockHeader
          caption={caption}
          onCaptionChange={onCaptionChange}
          selectedTable={selectedTable}
          readOnly={readOnly}
          tables={tables}
          onTableChange={handleTableChange}
        />
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
