import type {DataTable} from '@sqlrooms/db';
import type {BlockDocumentStatefulBlockRendererProps} from '@sqlrooms/documents';
import {SpinnerPane} from '@sqlrooms/ui';
import {useMemo} from 'react';
import {useStoreWithMosaic} from '../MosaicSlice';
import {
  DataTableExplorer,
  type DataTableExplorerProps,
} from './DataTableExplorer';

function findTableByName(
  tables: DataTable[],
  tableName: string | undefined,
): DataTable | undefined {
  if (!tableName) return undefined;

  return tables.find(
    (table) =>
      table.table.table === tableName ||
      table.tableName === tableName ||
      table.table.toString() === tableName,
  );
}

function getFirstUsableTable(tables: DataTable[]): DataTable | undefined {
  return tables.find((table) => table.columns.length > 0);
}

export const DataTableBlockRenderer = ({
  blockId,
  blockInstanceId,
  blockType,
  caption,
  documentId,
  title,
}: BlockDocumentStatefulBlockRendererProps) => {
  const connection = useStoreWithMosaic((state) => state.mosaic.connection);
  const tables = useStoreWithMosaic((state) => state.db.tables);

  const selectedTable = useMemo(
    () => findTableByName(tables, title) ?? getFirstUsableTable(tables),
    [tables, title],
  );
  const tableName = selectedTable?.table.table;
  const selectionName = `block-document:${documentId}:data-table:${blockId}:brush`;

  if (!blockInstanceId || blockType !== 'data-table') {
    return (
      <div className="text-muted-foreground p-4 text-sm">
        Unsupported stateful block type: {blockType || 'Unconfigured'}
      </div>
    );
  }

  if (!tableName) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-sm">
        Data Table blocks require a table source.
      </div>
    );
  }

  if (connection.status === 'loading') {
    return <SpinnerPane className="h-full w-full" />;
  }

  if (connection.status !== 'ready') {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-sm">
        Mosaic connection is not ready.
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
        {caption ? (
          <div className="border-border shrink-0 border-b px-3 py-2 text-sm font-medium">
            {caption}
          </div>
        ) : null}
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
