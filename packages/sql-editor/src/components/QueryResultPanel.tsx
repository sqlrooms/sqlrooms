import {
  DataTableArrowPaginated,
  DataTablePaginatedProps,
} from '@sqlrooms/data-table';
import {cn, SpinnerPane} from '@sqlrooms/ui';
import React from 'react';
import {useStoreWithSqlEditor} from '../SqlEditorSlice';
import {QueryResultTable} from './QueryResultTable';

export interface QueryResultPanelProps {
  /** Custom class name for styling */
  className?: string;
  /** Custom actions to render in the query result panel */
  renderActions?: (query: string) => React.ReactNode;
  /** Custom font size for the table e.g. text-xs, text-sm, text-md, text-lg, text-base */
  fontSize?: DataTablePaginatedProps<any>['fontSize'];
}

export const QueryResultPanel: React.FC<QueryResultPanelProps> = ({
  className,
  renderActions,
  fontSize = 'text-xs',
}) => {
  const queryResult = useStoreWithSqlEditor((s) => s.sqlEditor.queryResult);

  if (!queryResult) {
    return null;
  }

  if (queryResult?.status === 'loading') {
    return <SpinnerPane h="100%" />;
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
        {queryResult.type === 'select' ? (
          <QueryResultTable
            className={cn('overflow-hidden', className)}
            fontSize={fontSize}
            queryResult={queryResult}
            renderActions={renderActions}
          />
        ) : queryResult.type === 'pragma' || queryResult.type === 'explain' ? (
          <DataTableArrowPaginated table={queryResult.result} />
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
