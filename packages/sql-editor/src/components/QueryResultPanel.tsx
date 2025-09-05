import {DataTablePaginated, useArrowDataTable} from '@sqlrooms/data-table';
import type {Row} from '@tanstack/react-table';
import {
  cn,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SpinnerPane,
} from '@sqlrooms/ui';
import {formatCount} from '@sqlrooms/utils';
import React from 'react';
import {isQueryWithResult, useStoreWithSqlEditor} from '../SqlEditorSlice';

export interface QueryResultPanelProps {
  /** Custom class name for styling */
  className?: string;
  /** Custom actions to render in the query result panel */
  renderActions?: (query: string) => React.ReactNode;
  /** Custom font size for the table e.g. text-xs, text-sm, text-md, text-lg, text-base */
  fontSize?: string;
  /**
   * Called when a row in the results table is clicked.
   */
  onRowClick?: (args: {
    row: Row<any>;
    event: React.MouseEvent<HTMLTableRowElement>;
  }) => void;
  /**
   * Called when a row in the results table is double-clicked.
   */
  onRowDoubleClick?: (args: {
    row: Row<any>;
    event: React.MouseEvent<HTMLTableRowElement>;
  }) => void;
}

export const QueryResultPanel: React.FC<QueryResultPanelProps> = ({
  className,
  renderActions,
  fontSize = 'text-xs',
  onRowClick,
  onRowDoubleClick,
}) => {
  const queryResult = useStoreWithSqlEditor((s) => s.sqlEditor.queryResult);
  const setQueryResultLimit = useStoreWithSqlEditor(
    (s) => s.sqlEditor.setQueryResultLimit,
  );
  const queryResultLimit = useStoreWithSqlEditor(
    (s) => s.sqlEditor.queryResultLimit,
  );
  const queryResultLimitOptions = useStoreWithSqlEditor(
    (s) => s.sqlEditor.queryResultLimitOptions,
  );
  const limitOptions = React.useMemo(() => {
    if (!queryResultLimitOptions.includes(queryResultLimit)) {
      return [queryResultLimit, ...queryResultLimitOptions];
    }
    return queryResultLimitOptions;
  }, [queryResultLimitOptions, queryResultLimit]);
  const arrowTableData = useArrowDataTable(
    isQueryWithResult(queryResult) ? queryResult.result : undefined,
  );

  if (!queryResult) {
    return null;
  }

  if (queryResult?.status === 'loading') {
    return <SpinnerPane h="100%" />;
  }

  if (queryResult?.status === 'aborted') {
    return (
      <div className="p-5 font-mono text-xs leading-tight text-red-500">
        Query was aborted
      </div>
    );
  }
  if (queryResult?.status === 'error') {
    return (
      <div className="h-full w-full overflow-auto p-5">
        <pre className="whitespace-pre-wrap text-xs leading-tight text-red-500">
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
        {isQueryWithResult(queryResult) ? (
          <div className="flex h-full w-full flex-col">
            <DataTablePaginated
              {...arrowTableData}
              className="flex-grow overflow-hidden"
              fontSize={fontSize}
              isFetching={false}
              onRowClick={onRowClick}
              onRowDoubleClick={onRowDoubleClick}
            />
            <div className="bg-background flex w-full items-center gap-2 px-4 py-1">
              {queryResult.result ? (
                <>
                  <div className="font-mono text-xs">
                    {`${formatCount(queryResult.result.numRows ?? 0)} rows`}
                  </div>

                  <Select
                    value={queryResultLimit.toString()}
                    onValueChange={(value) =>
                      setQueryResultLimit(parseInt(value))
                    }
                  >
                    <SelectTrigger className="h-6 w-fit">
                      <div className="text-xs text-gray-500">
                        {`Limit results to ${formatCount(queryResultLimit)} rows`}
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {limitOptions.map((limit) => (
                        <SelectItem key={limit} value={limit.toString()}>
                          {`${formatCount(limit)} rows`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              ) : null}
              <div className="flex-1" />
              {renderActions
                ? renderActions(queryResult.lastQueryStatement)
                : undefined}
            </div>
          </div>
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
