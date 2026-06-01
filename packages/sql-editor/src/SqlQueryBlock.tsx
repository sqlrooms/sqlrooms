import type {
  StatefulBlockDefinition,
  StatefulBlockRenderProps,
} from '@sqlrooms/blocks';
import type {BaseRoomStoreState} from '@sqlrooms/room-shell';
import {formatDateTime} from '@sqlrooms/utils';
import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  cn,
  Spinner,
} from '@sqlrooms/ui';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  Code2Icon,
  PlayIcon,
  SquareIcon,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type FC,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import {SqlQuery} from './SqlQuery';
import {
  useStoreWithSqlEditor,
  type QueryResult,
  type SqlEditorSliceState,
} from './SqlEditorSlice';

export type SqlQueryBlockProps = Partial<StatefulBlockRenderProps> & {
  queryId?: string;
  className?: string;
  editorClassName?: string;
  resultsClassName?: string;
  compact?: boolean;
};

export const SQL_QUERY_BLOCK_TYPE = 'sql-query';

export const SqlQueryBlock: FC<SqlQueryBlockProps> = ({
  blockId,
  queryId,
  title,
  readOnly,
  className,
  editorClassName,
  resultsClassName,
  compact,
}) => {
  const resolvedQueryId = queryId ?? blockId;

  if (!resolvedQueryId) {
    return (
      <div className="text-muted-foreground p-4 text-sm">
        SQL query block is missing a query id.
      </div>
    );
  }

  if (compact) {
    return (
      <CompactSqlQueryBlock
        queryId={resolvedQueryId}
        title={title}
        readOnly={readOnly}
        className={className}
        editorClassName={editorClassName}
        resultsClassName={resultsClassName}
      />
    );
  }

  return (
    <SqlQuery.Root
      queryId={resolvedQueryId}
      name={title ?? 'SQL Query'}
      readOnly={readOnly}
      className={cn('bg-background h-full min-h-[420px]', className)}
    >
      <SqlQuery.Header title={title ?? 'SQL Query'}>
        <SqlQuery.Actions />
      </SqlQuery.Header>
      <div className="min-h-[220px] flex-1">
        <SqlQuery.Editor className={cn('min-h-[220px]', editorClassName)} />
      </div>
      <div
        className={cn('border-border min-h-[220px] border-t', resultsClassName)}
      >
        <SqlQuery.Results />
      </div>
    </SqlQuery.Root>
  );
};

type CompactSqlQueryBlockProps = {
  queryId: string;
  title?: string;
  readOnly?: boolean;
  className?: string;
  editorClassName?: string;
  resultsClassName?: string;
};

const CompactSqlQueryBlock: FC<CompactSqlQueryBlockProps> = ({
  queryId,
  title,
  readOnly,
  className,
  editorClassName,
  resultsClassName,
}) => {
  const runQueryById = useStoreWithSqlEditor(
    (state) => state.sqlEditor.runQueryById,
  );
  const abortQueryById = useStoreWithSqlEditor(
    (state) => state.sqlEditor.abortQueryById,
  );
  const queryResult = useStoreWithSqlEditor(
    (state) => state.sqlEditor.queryResultsById[queryId],
  );
  const isLoading = queryResult?.status === 'loading';
  const isCancelling = isLoading && queryResult.isBeingAborted;
  const [now, setNow] = useState(() => Date.now());
  const resultCompletedAt = getQueryResultCompletedAt(queryResult);
  const displayNow = Math.max(now, resultCompletedAt ?? now);
  const resultLabel = getCompactResultLabel(queryResult, displayNow);
  const resultTooltip = getCompactResultTooltip(queryResult, displayNow);
  const [isQueryCollapsed, setIsQueryCollapsed] = useState(false);
  const [isResultCollapsed, setIsResultCollapsed] = useState(false);
  const [resultHeight, setResultHeight] = useState(256);
  const resizeCleanupRef = useRef<(() => void) | null>(null);

  const handleResizeMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const startY = event.clientY;
      const startHeight = resultHeight;
      resizeCleanupRef.current?.();

      const handleMouseMove = (moveEvent: MouseEvent) => {
        setResultHeight(
          Math.max(128, Math.round(startHeight + moveEvent.clientY - startY)),
        );
      };

      const handleMouseUp = (upEvent: MouseEvent) => {
        setResultHeight(
          Math.max(128, Math.round(startHeight + upEvent.clientY - startY)),
        );
        resizeCleanupRef.current?.();
      };

      resizeCleanupRef.current = () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        resizeCleanupRef.current = null;
      };
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [resultHeight],
  );

  useEffect(() => {
    return () => {
      resizeCleanupRef.current?.();
    };
  }, []);

  useEffect(() => {
    if (!resultCompletedAt) return;
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 30_000);
    return () => window.clearInterval(intervalId);
  }, [resultCompletedAt]);

  return (
    <SqlQuery.Root
      queryId={queryId}
      name={title ?? 'SQL Query'}
      readOnly={readOnly}
      className={cn(
        'bg-background relative min-h-0 overflow-visible rounded-md',
        className,
      )}
    >
      <Button
        size="icon"
        variant="ghost"
        className="absolute top-2 -left-6 h-5 w-5 shrink-0 p-0"
        onClick={() => setIsQueryCollapsed((collapsed) => !collapsed)}
        aria-expanded={!isQueryCollapsed}
        aria-label={isQueryCollapsed ? 'Expand query' : 'Collapse query'}
      >
        {isQueryCollapsed ? (
          <ChevronRightIcon className="h-3 w-3" />
        ) : (
          <ChevronDownIcon className="h-3 w-3" />
        )}
      </Button>
      <div
        className={cn(
          'flex items-start gap-2 pr-2 pl-0',
          isQueryCollapsed ? 'py-1' : 'py-2',
        )}
      >
        {isQueryCollapsed ? (
          <div className="text-muted-foreground min-w-0 flex-1 py-1 pl-4 text-xs italic">
            Query collapsed
          </div>
        ) : (
          <div className="min-w-0 flex-1">
            <SqlQuery.Editor
              autoHeight
              compact
              className={cn(
                'text-sm [&_.cm-content]:pl-0 [&_.cm-line]:pl-0',
                editorClassName,
              )}
            />
          </div>
        )}
        {readOnly ? null : (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant={isLoading ? 'destructive' : 'secondary'}
                  className={cn(
                    'shrink-0 rounded-md p-0',
                    isQueryCollapsed ? 'mt-0.5 h-5 w-5' : 'mt-1 h-6 w-6',
                  )}
                  onClick={() =>
                    isLoading
                      ? abortQueryById(queryId)
                      : void runQueryById(queryId)
                  }
                  disabled={isCancelling}
                  aria-label={isLoading ? 'Cancel query' : 'Run query'}
                >
                  {isCancelling ? (
                    <Spinner
                      className={cn(
                        'text-current',
                        isQueryCollapsed ? 'h-2.5 w-2.5' : 'h-3 w-3',
                      )}
                    />
                  ) : isLoading ? (
                    <SquareIcon
                      className={isQueryCollapsed ? 'h-2.5 w-2.5' : 'h-3 w-3'}
                    />
                  ) : (
                    <PlayIcon
                      className={isQueryCollapsed ? 'h-2.5 w-2.5' : 'h-3 w-3'}
                    />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent align="end">
                {isLoading ? 'Cancel query' : 'Run query'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      {queryResult ? (
        <div className={cn('border-border relative border-t', resultsClassName)}>
          <Button
            size="icon"
            variant="ghost"
            className="absolute top-2 -left-6 h-5 w-5 shrink-0 p-0"
            onClick={() => setIsResultCollapsed((collapsed) => !collapsed)}
            aria-expanded={!isResultCollapsed}
            aria-label={isResultCollapsed ? 'Expand result' : 'Collapse result'}
          >
            {isResultCollapsed ? (
              <ChevronRightIcon className="h-3 w-3" />
            ) : (
              <ChevronDownIcon className="h-3 w-3" />
            )}
          </Button>
          {isResultCollapsed ? (
            <div className="bg-background flex items-center gap-2 py-2 pr-4 pl-4">
              <div className="text-muted-foreground min-w-0 flex-1 text-xs italic">
                Result collapsed
              </div>
              {resultTooltip ? (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="text-muted-foreground cursor-default text-right text-xs">
                        {resultLabel}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent align="start" className="space-y-1 text-xs">
                      {resultTooltip.map((line) => (
                        <div key={line}>{line}</div>
                      ))}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <div className="text-muted-foreground text-right text-xs">
                  {resultLabel}
                </div>
              )}
            </div>
          ) : (
            <div
              className="relative min-h-32"
              style={{height: resultHeight}}
            >
              <SqlQuery.Results
                className="h-full"
                footerDetails={
                  resultTooltip ? (
                    <CompactResultTimestampTooltip
                      label={resultLabel}
                      lines={resultTooltip}
                    />
                  ) : (
                    <span className="text-muted-foreground text-xs">
                      {resultLabel}
                    </span>
                  )
                }
              />
              <div
                className="absolute right-0 -bottom-4 left-0 z-10 flex h-3 cursor-row-resize items-start justify-center"
                onMouseDown={handleResizeMouseDown}
                role="separator"
                aria-orientation="horizontal"
                aria-label="Resize query result height"
              >
                <div className="bg-muted-foreground/50 mt-0.5 h-1 w-10 rounded-full" />
              </div>
            </div>
          )}
        </div>
      ) : null}
    </SqlQuery.Root>
  );
};

function CompactResultTimestampTooltip({
  label,
  lines,
}: {
  label: string;
  lines: string[];
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-muted-foreground cursor-default text-xs">
            {label}
          </span>
        </TooltipTrigger>
        <TooltipContent align="start" className="space-y-1 text-xs">
          {lines.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function getCompactResultLabel(queryResult: QueryResult | undefined, now: number) {
  if (!queryResult) return '';
  if (queryResult.status === 'loading') return 'Running query...';
  if (!queryResult.completedAt) return 'Last run';
  return formatCompactRelativeTime(queryResult.completedAt, now);
}

function getCompactResultTooltip(
  queryResult: QueryResult | undefined,
  now: number,
) {
  if (!queryResult || queryResult.status === 'loading') return undefined;
  const completedAt = queryResult.completedAt;
  const lines: string[] = [];
  if (completedAt) {
    lines.push(`Last run: ${formatCompactRelativeTime(completedAt, now)}`);
    lines.push(`Completed: ${formatDateTime(completedAt)}`);
  }
  if (queryResult.durationMs != null) {
    lines.push(`Query time: ${formatQueryDuration(queryResult.durationMs)}`);
  }
  if (queryResult.status === 'error') lines.push('Status: Failed');
  if (queryResult.status === 'aborted') lines.push('Status: Cancelled');
  return lines.length > 0 ? lines : undefined;
}

function getQueryResultCompletedAt(queryResult: QueryResult | undefined) {
  return queryResult?.status === 'loading' ? undefined : queryResult?.completedAt;
}

function formatCompactRelativeTime(timestamp: number, now: number) {
  const elapsedMs = Math.max(0, now - timestamp);
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  if (elapsedSeconds < 60) return 'Just now';

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;

  const elapsedDays = Math.floor(elapsedHours / 24);
  return `${elapsedDays}d ago`;
}

function formatQueryDuration(durationMs: number) {
  if (durationMs < 1000) return `${durationMs.toFixed(2)} ms`;
  return `${(durationMs / 1000).toFixed(2)} s`;
}

export type CreateSqlQueryBlockDefinitionOptions<
  TRoomState extends BaseRoomStoreState & SqlEditorSliceState,
> = {
  label?: string;
  defaultTitle?: string;
  render?: ComponentType<StatefulBlockRenderProps<TRoomState>>;
};

export function createSqlQueryBlockDefinition<
  TRoomState extends BaseRoomStoreState & SqlEditorSliceState,
>({
  label = 'SQL Query',
  defaultTitle = 'SQL Query',
  render = SqlQueryBlock as ComponentType<StatefulBlockRenderProps<TRoomState>>,
}: CreateSqlQueryBlockDefinitionOptions<TRoomState> = {}): StatefulBlockDefinition<TRoomState> {
  return {
    type: SQL_QUERY_BLOCK_TYPE,
    label,
    defaultTitle,
    icon: Code2Icon,
    capabilities: {
      stateful: true,
      executable: true,
    },
    ensureState: ({blockId, title, getState}) => {
      getState().sqlEditor.ensureQuery(blockId, {
        name: title ?? defaultTitle,
      });
    },
    deleteState: ({blockId, getState}) => {
      getState().sqlEditor.removeQuery(blockId);
    },
    rename: ({blockId, title, getState}) => {
      getState().sqlEditor.renameQuery(blockId, title);
    },
    render,
  };
}
