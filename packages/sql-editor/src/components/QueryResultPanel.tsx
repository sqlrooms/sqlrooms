import {
  DataTablePaginated,
  useArrowDataTable,
  ArrowDataTableValueFormatter,
} from '@sqlrooms/data-table';
import type {Row} from '@tanstack/react-table';
import {
  cn,
  SpinnerPane,
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@sqlrooms/ui';
import {formatCount} from '@sqlrooms/utils';
import React from 'react';
import {isQueryWithResult, useStoreWithSqlEditor} from '../SqlEditorSlice';
import {MessageCircleQuestion} from 'lucide-react';
import {QueryResultLimitSelect} from './QueryResultLimitSelect';

/**
 * Turns DuckDB's EXPLAIN result table into a readable plan string.
 * Prefer the `explain_value` column (DuckDB default); otherwise fall back
 * to the first column and join all rows with newlines.
 */
function arrowTableToExplainText(result: any): string {
  if (!result) return '';

  const numRows: number = result.numRows ?? 0;
  const fields: {name: string}[] = result.schema?.fields ?? [];
  const fieldNames = fields.map((f) => f.name);

  const hasExplainValueColumn = fieldNames.includes('explain_value');
  const columnName = hasExplainValueColumn ? 'explain_value' : fieldNames[0];
  if (!columnName) return '';

  const col = result.getChild?.(columnName);
  if (!col) return '';

  const lines: string[] = [];
  for (let i = 0; i < numRows; i++) {
    const v = col.get(i);
    if (v != null && String(v).length > 0) lines.push(String(v));
  }
  return lines.join('\n');
}

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
  /** Custom content to render in the error state (e.g., QueryResultPanel.AskAi) */
  children?: React.ReactNode;
  /**
   * @deprecated Use children with QueryResultPanel.AskAi instead
   * Called when the "Ask AI" button is clicked on an error message.
   * Receives the current query and error text.
   */
  onAskAiAboutError?: (query: string, error: string) => void;
  /** Custom value formatter for arrow data */
  formatValue?: ArrowDataTableValueFormatter;
}

const QueryResultPanelRoot: React.FC<QueryResultPanelProps> = ({
  className,
  renderActions,
  fontSize = 'text-xs',
  onRowClick,
  onRowDoubleClick,
  children,
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

  const tableForDataTable =
    isQueryWithResult(queryResult) && queryResult.type !== 'explain'
      ? queryResult.result
      : undefined;

  const arrowTableData = useArrowDataTable(tableForDataTable, {formatValue});

  const explainText = React.useMemo(() => {
    if (queryResult?.status !== 'success' || queryResult.type !== 'explain') {
      return undefined;
    }
    return arrowTableToExplainText(queryResult.result);
  }, [queryResult]);

  const handleAskAiAboutError = React.useCallback(() => {
    if (queryResult?.status === 'error' && onAskAiAboutError) {
      const currentQuery = getCurrentQuery();
      const errorText = queryResult.error;
      onAskAiAboutError?.(currentQuery, errorText);
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
    // Backward compat: if no children but onAskAiAboutError is provided, render default button
    const errorActions = children ?? (onAskAiAboutError && (
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={handleAskAiAboutError}
        title="Ask AI for help"
      >
        <MessageCircleQuestion className="h-4 w-4" />
      </Button>
    ));

    return (
      <div className="relative h-full w-full overflow-auto p-5">
        {errorActions && (
          <div className="absolute top-2 right-2">
            {errorActions}
          </div>
        )}
        <pre
          className={cn(
            'text-xs leading-tight whitespace-pre-wrap text-red-500',
            errorActions && 'pr-12',
          )}
        >
          {queryResult.error}
        </pre>
      </div>
    );
  }

  if (queryResult?.status === 'success') {
    const contentWrapperClassName = cn(
      'relative flex h-full w-full grow flex-col overflow-hidden',
      className,
    );

    // Result shows the EXPLAIN schema
    if (queryResult.type === 'explain') {
      return (
        <div className={contentWrapperClassName}>
          <div className="flex h-full w-full flex-col overflow-hidden">
            <pre className="flex-1 overflow-auto p-4 font-mono text-xs leading-tight wrap-break-word whitespace-pre-wrap">
              {explainText}
            </pre>
            <div className="bg-background flex w-full items-center gap-2 px-4 py-1">
              <div className="font-mono text-xs">EXPLAIN</div>
              <div className="flex-1" />
              {renderActions
                ? renderActions(queryResult.lastQueryStatement)
                : undefined}
            </div>
          </div>
        </div>
      );
    }

    // Result shows the SELECT/PRAGMA table
    if (isQueryWithResult(queryResult)) {
      return (
        <div className={contentWrapperClassName}>
          <div className="flex h-full w-full flex-col">
            <DataTablePaginated
              {...arrowTableData}
              className="grow overflow-hidden"
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

                  {queryResult.type === 'select' ? (
                    <QueryResultLimitSelect
                      value={queryResultLimit}
                      onChange={setQueryResultLimit}
                      options={queryResultLimitOptions}
                    />
                  ) : null}
                </>
              ) : null}
              <div className="flex-1" />
              {renderActions
                ? renderActions(queryResult.lastQueryStatement)
                : undefined}
            </div>
          </div>
        </div>
      );
    }

    // Fallback message to show when the query result is not a SELECT/PRAGMA or EXPLAIN
    return (
      <div className={contentWrapperClassName}>
        <pre className="p-4 text-xs leading-tight text-green-500">
          Successfully executed query
        </pre>
      </div>
    );
  }

  return null;
};

export interface QueryResultPanelAskAiProps {
  /** Called when clicked with the current query and error message */
  onClick?: (query: string, error: string) => void;
  /** Custom icon (defaults to MessageCircleQuestion) */
  icon?: React.ReactNode;
  /** Custom className */
  className?: string;
  /** Tooltip text to display on hover */
  tooltipContent?: string;
}

const QueryResultPanelAskAi = React.forwardRef<
  HTMLButtonElement,
  QueryResultPanelAskAiProps
>(({onClick, icon, className, tooltipContent = 'Ask AI for help'}, ref) => {
  const queryResult = useStoreWithSqlEditor((s) => {
    const selectedId = s.sqlEditor.config.selectedQueryId;
    return s.sqlEditor.queryResultsById[selectedId];
  });
  const getCurrentQuery = useStoreWithSqlEditor(
    (s) => s.sqlEditor.getCurrentQuery,
  );

  // Only render in error state
  if (queryResult?.status !== 'error') return null;

  const handleClick = () => {
    onClick?.(getCurrentQuery(), queryResult.error);
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            ref={ref}
            variant="ghost"
            size="icon"
            className={cn('h-8 w-8', className)}
            onClick={handleClick}
          >
            {icon ?? <MessageCircleQuestion className="h-4 w-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{tooltipContent}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});
QueryResultPanelAskAi.displayName = 'QueryResultPanel.AskAi';

export const QueryResultPanel = Object.assign(QueryResultPanelRoot, {
  AskAi: QueryResultPanelAskAi,
});
