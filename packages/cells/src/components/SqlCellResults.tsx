import {
  DataTablePaginated,
  QueryDataTableActionsMenu,
  useArrowDataTable,
} from '@sqlrooms/data-table';
import type {PaginationState, SortingState} from '@tanstack/react-table';
import React, {useEffect, useRef, useState} from 'react';
import {cn} from '@sqlrooms/ui';
import {CollapsibleSectionButton} from './CollapsibleSectionButton';
import {CellResultData} from '../types';

export interface SqlCellResultsProps {
  cellId: string;
  cellResult?: CellResultData | undefined;
  resultName?: string;
  isRunning?: boolean;
  errorMessage?: string;
  resultVersion: number;
  fetchCellResultPage: (
    cellId: string,
    pagination: PaginationState,
    sorting: SortingState,
  ) => void;
}

/**
 * SQL query results display with collapse/expand functionality
 */
export const SqlCellResults: React.FC<SqlCellResultsProps> = ({
  cellId,
  cellResult,
  resultName,
  isRunning,
  errorMessage,
  resultVersion,
  fetchCellResultPage,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const arrowTableData = useArrowDataTable(cellResult?.arrowTable);

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
      fetchCellResultPage(cellId, pagination, sorting);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination, sorting, cellId, fetchCellResultPage]);

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

  if (!errorMessage && !resultName && !arrowTableData) {
    return null;
  }

  return (
    <div className="group relative w-full">
      <CollapsibleSectionButton
        isCollapsed={isCollapsed}
        onToggle={() => setIsCollapsed(!isCollapsed)}
      />
      {isCollapsed ? (
        <div className="ml-5 px-2 py-1 text-xs">
          {errorMessage ? (
            <span className="font-normal text-red-600">{errorMessage}</span>
          ) : cellResult?.totalRows !== undefined ? (
            <span className="text-muted-foreground font-normal">
              {cellResult.totalRows.toLocaleString()} rows
            </span>
          ) : null}
        </div>
      ) : (
        <>
          {errorMessage ? (
            <div className="relative max-h-[400px] overflow-auto p-4">
              <span className="font-mono text-xs whitespace-pre-wrap text-red-600">
                {errorMessage}
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
                className={cn(
                  'bg-background/45 pointer-events-none absolute inset-0 z-10 transition-opacity duration-200',
                  isRunning ? 'animate-pulse opacity-100' : 'opacity-0',
                )}
              />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
};
