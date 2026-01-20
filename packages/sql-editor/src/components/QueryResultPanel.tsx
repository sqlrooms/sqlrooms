import {
  DataTablePaginated,
  useArrowDataTable,
  ArrowDataTableValueFormatter,
} from '@sqlrooms/data-table';
import type {Row} from '@tanstack/react-table';
import {cn, SpinnerPane, Button} from '@sqlrooms/ui';
import {formatCount} from '@sqlrooms/utils';
import React from 'react';
import {isQueryWithResult, useStoreWithSqlEditor} from '../SqlEditorSlice';
import {MessageCircleQuestion} from 'lucide-react';
import {QueryResultLimitSelect} from './QueryResultLimitSelect';

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
  /**
   * Called when the "Ask AI" button is clicked on an error message.
   * Receives the current query and error text.
   */
  onAskAiAboutError?: (query: string, error: string) => void;
  /** Custom value formatter for arrow data */
  formatValue?: ArrowDataTableValueFormatter;
}

export const QueryResultPanel: React.FC<QueryResultPanelProps> = ({
  className,
  renderActions,
  fontSize = 'text-xs',
  onRowClick,
  onRowDoubleClick,
  onAskAiAboutError,
  formatValue,
}) => {
  const queryResult = useStoreWithSqlEditor((s) => {
    const selectedId = s.sqlEditor.config.selectedQueryId;
    return s.sqlEditor.queryResultsById[selectedId];
  });
  const getCurrentQuery = useStoreWithSqlEditor(
    (s) => s.sqlEditor.getCurrentQuery,
  );
  const setQueryResultLimit = useStoreWithSqlEditor(
    (s) => s.sqlEditor.setQueryResultLimit,
  );
  const queryResultLimit = useStoreWithSqlEditor(
    (s) => s.sqlEditor.queryResultLimit,
  );
  const queryResultLimitOptions = useStoreWithSqlEditor(
    (s) => s.sqlEditor.queryResultLimitOptions,
  );

  const arrowTableData = useArrowDataTable(
    isQueryWithResult(queryResult) ? queryResult.result : undefined,
    {formatValue},
  );

  const handleAskAiAboutError = React.useCallback(() => {
    if (queryResult?.status === 'error' && onAskAiAboutError) {
      const currentQuery = getCurrentQuery();
      const errorText = queryResult.error;
      onAskAiAboutError(currentQuery, errorText);
    }
  }, [queryResult, getCurrentQuery, onAskAiAboutError]);

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
      <div className="relative h-full w-full overflow-auto p-5">
        {onAskAiAboutError && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-8 w-8"
            onClick={handleAskAiAboutError}
            title="Ask AI for help"
          >
            <MessageCircleQuestion className="h-4 w-4" />
          </Button>
        )}
        <pre
          className={cn(
            'text-xs leading-tight whitespace-pre-wrap text-red-500',
            onAskAiAboutError && 'pr-12',
          )}
        >
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

                  <QueryResultLimitSelect
                    value={queryResultLimit}
                    onChange={setQueryResultLimit}
                    options={queryResultLimitOptions}
                  />
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
