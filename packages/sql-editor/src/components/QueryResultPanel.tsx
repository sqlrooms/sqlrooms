import React, {useMemo} from 'react';
import {Button, cn, SpinnerPane} from '@sqlrooms/ui';
import {DataTableVirtualized, QueryDataTable} from '@sqlrooms/data-table';
import {DownloadIcon, PlusIcon} from 'lucide-react';
import {useStoreWithSqlEditor} from '../SqlEditorSlice';
import {escapeId} from '@sqlrooms/duckdb';

export interface QueryResultPanelProps {
  /** Custom class name for styling */
  className?: string;
  /** The database schema to use. Defaults to 'main' */
  schema?: string;
  /** Callback when create table button is clicked */
  onCreateTable?: () => void;
}

export const QueryResultPanel: React.FC<QueryResultPanelProps> = ({
  className,
  schema = 'main',
  onCreateTable,
}) => {
  // Get state and methods from the store
  const selectedTable = useStoreWithSqlEditor((s) => s.sqlEditor.selectedTable);
  const results = useStoreWithSqlEditor((s) => s.sqlEditor.queryResults);
  const error = useStoreWithSqlEditor((s) => s.sqlEditor.queryError);
  const isLoading = useStoreWithSqlEditor((s) => s.sqlEditor.isQueryLoading);

  const exportResultsToCsv = useStoreWithSqlEditor(
    (s) => s.sqlEditor.exportResultsToCsv,
  );
  const resultsTableData = useMemo(
    () => (results ? {data: results.toArray()} : undefined),
    [results],
  );

  // Handle export results
  const handleExport = () => {
    if (results) {
      exportResultsToCsv(results);
    }
  };

  if (isLoading) {
    return <SpinnerPane h="100%" />;
  }

  if (selectedTable) {
    return (
      <div className={className}>
        <QueryDataTable
          query={`SELECT * FROM ${schema}.${escapeId(selectedTable)}`}
          // limit={100}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full w-full overflow-auto p-5">
        <pre className="text-xs leading-tight text-red-500">{error}</pre>
      </div>
    );
  }

  if (resultsTableData) {
    return (
      <div
        className={cn(
          'relative flex h-full w-full flex-grow flex-col overflow-hidden',
          className,
        )}
      >
        <DataTableVirtualized {...resultsTableData} />
        <div className="absolute bottom-0 right-0 flex gap-2">
          <Button size="sm" onClick={onCreateTable}>
            <PlusIcon className="mr-2 h-4 w-4" />
            Create table
          </Button>
          <Button size="sm" onClick={handleExport}>
            <DownloadIcon className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>
    );
  }

  return null;
};
