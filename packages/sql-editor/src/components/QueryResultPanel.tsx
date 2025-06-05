import {
  DataTablePaginated,
  DataTablePaginatedProps,
  useArrowDataTable,
} from '@sqlrooms/data-table';
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
  fontSize?: DataTablePaginatedProps<any>['fontSize'];
}

export const QueryResultPanel: React.FC<QueryResultPanelProps> = ({
  className,
  renderActions,
  fontSize = 'text-xs',
}) => {
  const queryResult = useStoreWithSqlEditor((s) => s.sqlEditor.queryResult);
  const setQueryResultLimit = useStoreWithSqlEditor(
    (s) => s.sqlEditor.setQueryResultLimit,
  );
  const queryResultLimit = useStoreWithSqlEditor(
    (s) => s.sqlEditor.queryResultLimit,
  );
  const arrowTableData = useArrowDataTable(
    isQueryWithResult(queryResult) ? queryResult.result : undefined,
  );

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
        {isQueryWithResult(queryResult) ? (
          <div className="flex h-full w-full flex-col">
            <DataTablePaginated
              {...arrowTableData}
              className="flex-grow overflow-hidden"
              fontSize={fontSize}
              isFetching={false}
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
                      {[100, 500, 1000].map((limit) => (
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
