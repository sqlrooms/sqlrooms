import {QueryDataTable} from '@sqlrooms/data-table';
import {escapeId} from '@sqlrooms/duckdb';
import {cn, SpinnerPane} from '@sqlrooms/ui';
import React from 'react';
import {useStoreWithSqlEditor} from '../SqlEditorSlice';

export interface QueryResultPanelProps {
  /** Custom class name for styling */
  className?: string;
  /** Custom actions to render in the query result panel */
  customActions?: React.ReactNode;
}

export const QueryResultPanel: React.FC<QueryResultPanelProps> = ({
  className,
  customActions,
}) => {
  // Get state and methods from the store
  const selectedTable = useStoreWithSqlEditor((s) => s.sqlEditor.selectedTable);
  const queryResult = useStoreWithSqlEditor((s) => s.sqlEditor.queryResult);

  if (queryResult?.status === 'loading') {
    return <SpinnerPane h="100%" />;
  }

  if (selectedTable) {
    return (
      <QueryDataTable
        className={className}
        fontSize="text-xs"
        query={`SELECT * FROM ${escapeId(selectedTable)}`}
      />
    );
  }

  if (queryResult?.status === 'error') {
    return (
      <div className="h-full w-full overflow-auto p-5">
        <pre className="whitespace-pre-line text-xs leading-tight text-red-500">
          {queryResult.error}
        </pre>
      </div>
    );
  }

  if (queryResult?.status === 'success') {
    return (
      <div
        className={cn(
          'relative flex h-full w-full flex-grow flex-col overflow-hidden',
          className,
        )}
      >
        {queryResult.isSelect ? (
          <QueryDataTable
            fontSize="text-xs"
            className={cn('overflow-hidden', className)}
            query={queryResult.lastQueryStatement}
            customActions={customActions}
          />
        ) : (
          <pre className="p-4 text-xs leading-tight text-green-500">
            Successfully executed query
          </pre>
        )}
      </div>
    );
  }

  return null;
};
