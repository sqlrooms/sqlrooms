import {
  DataTablePaginated,
  QueryDataTableActionsMenu,
  useArrowDataTable,
} from '@sqlrooms/data-table';
import {useRoomStoreApi} from '@sqlrooms/room-store';
import {SqlMonacoEditor} from '@sqlrooms/sql-editor';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  EditableText,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@sqlrooms/ui';
import {convertToValidColumnOrTableName} from '@sqlrooms/utils';
import type {PaginationState, SortingState} from '@tanstack/react-table';
import {produce} from 'immer';
import {CornerDownRightIcon} from 'lucide-react';
import type * as Monaco from 'monaco-editor';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useCellsStore} from '../hooks';
import type {CellContainerProps, SqlCell, SqlCellData} from '../types';
import {getEffectiveResultName, isValidSqlIdentifier} from '../utils';
import {SqlCellRunButton} from './SqlCellRunButton';
import type {DbConnection} from '@sqlrooms/db';

export type SqlCellContentProps = {
  id: string;
  cell: SqlCell;
  renderContainer: (props: CellContainerProps) => React.ReactElement;
};

export const SqlCellContent: React.FC<SqlCellContentProps> = ({
  id,
  cell,
  renderContainer,
}) => {
  const storeApi = useRoomStoreApi();
  const updateCell = useCellsStore((s) => s.cells.updateCell);
  const runCell = useCellsStore((s) => s.cells.runCell);
  const cancelCell = useCellsStore((s) => s.cells.cancelCell);
  const getDownstream = useCellsStore((s) => s.cells.getDownstream);
  const currentSheetId = useCellsStore((s) => s.cells.config.currentSheetId);
  const cellsData = useCellsStore((s) => s.cells.config.data);
  const sheets = useCellsStore((s) => s.cells.config.sheets);
  const cellStatus = useCellsStore((s) => s.cells.status[id]);
  const resultVersion = useCellsStore((s) => s.cells.resultVersion?.[id] ?? 0);
  const pageVersion = useCellsStore((s) => s.cells.pageVersion?.[id] ?? 0);
  const getCellResult = useCellsStore((s) => s.cells.getCellResult);
  const fetchCellResultPage = useCellsStore((s) => s.cells.fetchCellResultPage);
  const dbConnections = useCellsStore((s) => s.dbx.config.connections);

  // Re-read the cache whenever resultVersion or pageVersion changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cellResult = useMemo(
    () => getCellResult(id),
    [getCellResult, id, resultVersion, pageVersion],
  );
  const arrowTableData = useArrowDataTable(cellResult?.arrowTable);

  const handleSqlChange = useCallback(
    (v: string | undefined) => {
      updateCell(id, (c) =>
        produce(c, (draft) => {
          if (draft.type === 'sql') {
            draft.data.sql = v || '';
          }
        }),
      );
    },
    [id, updateCell],
  );

  const handleRun = useCallback(() => {
    runCell(id);
  }, [id, runCell]);

  const handleConnectorChange = useCallback(
    (connectorId: string) => {
      updateCell(id, (c) =>
        produce(c, (draft) => {
          if (draft.type === 'sql') {
            (draft.data as SqlCellData).connectorId = connectorId || undefined;
          }
        }),
      );
    },
    [id, updateCell],
  );

  const handleCancel = useCallback(() => {
    cancelCell(id);
  }, [id, cancelCell]);

  const validateResultName = useCallback((value: string) => {
    const nextValue = value.trim();
    return Boolean(nextValue) && isValidSqlIdentifier(nextValue);
  }, []);

  const handleResultNameInputChange = useCallback(
    (value: string) => {
      setIsResultNameInvalid(!validateResultName(value));
    },
    [validateResultName],
  );

  const handleResultNameChange = useCallback(
    (value: string) => {
      const nextValue = value.trim();
      if (!validateResultName(nextValue)) {
        setIsResultNameInvalid(true);
        return;
      }

      updateCell(id, (c) =>
        produce(c, (draft) => {
          if (draft.type === 'sql') {
            draft.data.resultName = nextValue;
          }
        }),
      );
      setIsResultNameInvalid(false);
    },
    [id, updateCell, validateResultName],
  );

  const effectiveResultName = getEffectiveResultName(
    cell.data as SqlCellData,
    convertToValidColumnOrTableName,
  );
  const explicitResultName = (cell.data as SqlCellData).resultName || '';
  const selectedConnectorId =
    (cell.data as SqlCellData).connectorId || 'duckdb-core';
  const connectionOptions = useMemo(() => {
    const entries = Object.values(dbConnections);
    if (!entries.length) {
      return [{id: 'duckdb-core', title: 'Core DuckDB'}];
    }
    return entries.map((conn: DbConnection) => ({
      id: conn.id,
      title: conn.title || conn.id,
    }));
  }, [dbConnections]);
  const [dependentsMenuOpen, setDependentsMenuOpen] = useState(false);
  const [isResultNameInvalid, setIsResultNameInvalid] = useState(false);

  const downstreamCellIds = useMemo(() => {
    if (!currentSheetId) return [];
    return getDownstream(currentSheetId, id);
  }, [currentSheetId, getDownstream, id, cellsData, sheets]);

  const downstreamCells = useMemo(
    () =>
      downstreamCellIds.map((cellId) => {
        const downstreamCell = cellsData[cellId];
        return {
          id: cellId,
          label:
            (
              downstreamCell?.data as {title?: string} | undefined
            )?.title?.trim() || 'Untitled',
        };
      }),
    [cellsData, downstreamCellIds],
  );

  const scrollToDependentCell = useCallback((targetCellId: string) => {
    const selectorTargets = [
      `[data-cell-container-id="${targetCellId}"]`,
      `#cell-${targetCellId}`,
    ];
    const el =
      selectorTargets
        .map((selector) => document.querySelector<HTMLElement>(selector))
        .find(Boolean) ?? null;
    if (el) {
      el.scrollIntoView({behavior: 'smooth', block: 'center'});
    }
  }, []);

  const status =
    cellStatus?.type === 'sql'
      ? {
          state: cellStatus.status,
          message: cellStatus.lastError,
          resultName: cellStatus.resultView || cellStatus.resultName,
          lastRunTime: cellStatus.lastRunTime,
        }
      : undefined;

  const resultName = status?.resultName;
  const isRunning = status?.state === 'running';

  // Pagination and sorting state for the result table
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  // Fetch new page when pagination or sorting changes (not on initial render
  // since executeSqlCell already fetches the first page)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (resultName) {
      fetchCellResultPage(id, pagination, sorting);
    }
  }, [pagination, sorting, id, resultName, fetchCellResultPage]);

  // Reset pagination when a new result arrives (new run)
  const prevResultVersion = useRef(resultVersion);
  useEffect(() => {
    if (resultVersion !== prevResultVersion.current) {
      prevResultVersion.current = resultVersion;
      setPagination((prev) =>
        prev.pageIndex === 0 ? prev : {...prev, pageIndex: 0},
      );
      setSorting((prev) => (prev.length === 0 ? prev : []));
    }
  }, [resultVersion]);

  const handleRunRef = useRef(handleRun);
  useEffect(() => {
    handleRunRef.current = handleRun;
  }, [handleRun]);

  const handleSqlEditorMount = useCallback(
    (editor: Monaco.editor.IStandaloneCodeEditor, monaco: typeof Monaco) => {
      // Use onKeyDown instead of addCommand to scope the shortcut
      // to THIS specific editor instance. Monaco's addCommand registers
      // globally, so the last editor mounted wins -- breaking multi-cell
      // notebooks.
      editor.onKeyDown((e) => {
        if ((e.ctrlKey || e.metaKey) && e.keyCode === monaco.KeyCode.Enter) {
          e.preventDefault();
          e.stopPropagation();
          // Flush the current editor value directly to the store
          // synchronously before running. Monaco's onChange may not have
          // fired yet for the latest content, so we read the editor model
          // directly and write it to the Zustand store in a single
          // synchronous call, bypassing the async updateCell path.
          const currentSql = editor.getValue();
          storeApi.setState(
            produce(storeApi.getState(), (draft: any) => {
              const c = draft.cells?.config?.data?.[id];
              if (c && c.type === 'sql') {
                c.data.sql = currentSql;
              }
            }),
          );
          handleRunRef.current();
        }
      });
    },
    [id, storeApi],
  );

  const content = (
    <div className="flex flex-col">
      <div className="h-full w-full py-1">
        <div className="relative h-full min-h-[200px] w-full">
          <SqlMonacoEditor
            className="absolute inset-0 h-full w-full"
            value={cell.data.sql}
            onChange={handleSqlChange}
            onMount={handleSqlEditorMount}
            options={{
              minimap: {enabled: false},
              scrollBeyondLastLine: false,
              scrollbar: {
                alwaysConsumeMouseWheel: false,
              },
            }}
          />
        </div>
      </div>
      {status?.state === 'error' ? (
        <div className="relative max-h-[400px] overflow-auto p-4">
          <span className="whitespace-pre-wrap font-mono text-xs text-red-600">
            {status.message}
          </span>
        </div>
      ) : resultName && arrowTableData ? (
        <div className="relative min-h-[200px] overflow-hidden">
          <DataTablePaginated
            className="absolute inset-0 h-full w-full"
            fontSize="text-xs"
            data={arrowTableData.data}
            columns={arrowTableData.columns}
            numRows={cellResult?.totalRows}
            pagination={pagination}
            onPaginationChange={setPagination}
            sorting={sorting}
            onSortingChange={setSorting}
            isFetching={isRunning}
            footerActions={
              <QueryDataTableActionsMenu
                query={`SELECT * FROM ${resultName}`}
              />
            }
          />
          <div
            aria-hidden={!isRunning}
            className={`bg-background/45 pointer-events-none absolute inset-0 z-10 transition-opacity duration-200 ${
              isRunning ? 'animate-pulse opacity-100' : 'opacity-0'
            }`}
          />
        </div>
      ) : null}
    </div>
  );

  const footer = (
    <div className="text-muted-foreground flex items-center gap-1 px-2 py-1 text-xs">
      <CornerDownRightIcon className="h-3 w-3" />
      {downstreamCells.length > 0 ? (
        <DropdownMenu
          open={dependentsMenuOpen}
          onOpenChange={setDependentsMenuOpen}
        >
          <DropdownMenuTrigger asChild>
            <Button
              className="h-5"
              size="xs"
              variant="secondary"
              aria-label={`${downstreamCells.length} dependent cells`}
              onMouseEnter={() => setDependentsMenuOpen(true)}
            >
              {downstreamCells.length}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            onCloseAutoFocus={(e) => e.preventDefault()}
            onMouseLeave={() => setDependentsMenuOpen(false)}
          >
            <DropdownMenuLabel className="text-xs">
              Referenced in
            </DropdownMenuLabel>
            {downstreamCells.map((dependentCell) => (
              <DropdownMenuItem
                key={dependentCell.id}
                className="cursor-pointer text-xs"
                onSelect={(e) => {
                  e.preventDefault();
                  scrollToDependentCell(dependentCell.id);
                }}
              >
                {dependentCell.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      <Tooltip open={isResultNameInvalid}>
        <TooltipTrigger asChild>
          <div>
            <EditableText
              className={`h-6 w-40 font-mono text-xs text-green-500 shadow-none ${
                isResultNameInvalid
                  ? 'border-red-500 ring-1 ring-red-500 focus:border-red-500 focus:ring-red-500'
                  : ''
              }`}
              value={explicitResultName || effectiveResultName}
              onInputChange={handleResultNameInputChange}
              onChange={handleResultNameChange}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <span className="text-xs">Invalid result name</span>
        </TooltipContent>
      </Tooltip>
    </div>
  );

  return renderContainer({
    header: (
      <div className="flex w-full items-center gap-2">
        <div className="flex-1">
          <select
            className="border-input bg-background text-foreground h-7 rounded border px-2 text-xs"
            value={selectedConnectorId}
            onChange={(e) => handleConnectorChange(e.target.value)}
          >
            {connectionOptions.map((connection) => (
              <option key={connection.id} value={connection.id}>
                {connection.title}
              </option>
            ))}
          </select>
        </div>
        <SqlCellRunButton
          onRun={handleRun}
          onCancel={handleCancel}
          status={status}
          runLabel="Run"
        />
      </div>
    ),
    content,
    footer,
  });
};
