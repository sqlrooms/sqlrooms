import {Button, cn, Input, resolveFontSizeClass} from '@sqlrooms/ui';
import {formatCount} from '@sqlrooms/utils';
import {PaginationState, Table} from '@tanstack/react-table';
import {
  ChevronsLeftIcon as ChevronDoubleLeftIcon,
  ChevronsRightIcon as ChevronDoubleRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from 'lucide-react';
import {useState, JSX} from 'react';
import {PageSizeSelect} from './PageSizeSelect';

export type DataTablePaginatedFooterProps<Data extends object> = {
  fontSize?: string;
  isFetching?: boolean;
  pagination?: PaginationState | undefined;
  numRows?: number | undefined;
  footerActions?: React.ReactNode;
  table: Table<Data>;
};

/**
 * Footer component for DataTablePaginated with pagination controls and row count.
 */
export function DataTablePaginatedFooter<Data extends object>({
  fontSize = 'text-xs',
  isFetching,
  pagination,
  numRows,
  footerActions,
  table,
}: DataTablePaginatedFooterProps<Data>): JSX.Element | null {
  const fontSizeClass = resolveFontSizeClass(fontSize);

  const shouldShowFooter =
    Boolean(pagination) ||
    (numRows !== undefined && Number.isFinite(numRows)) ||
    footerActions != null;

  const [internalPageIndex, setInternalPageIndex] = useState(
    pagination?.pageIndex ?? 0,
  );
  const [prevPageIndex, setPrevPageIndex] = useState(pagination?.pageIndex);

  if (pagination?.pageIndex !== prevPageIndex) {
    setInternalPageIndex(pagination?.pageIndex ?? 0);
    setPrevPageIndex(pagination?.pageIndex);
  }

  if (!shouldShowFooter) {
    return null;
  }

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value) {
      const page = Math.max(
        0,
        Math.min(table.getPageCount() - 1, Number(value) - 1),
      );
      setInternalPageIndex(page);
    }
  };

  const handlePageInputBlur = () => {
    if (internalPageIndex !== pagination?.pageIndex) {
      table.setPageIndex(internalPageIndex);
    }
  };

  return (
    <div className="bg-background sticky bottom-0 left-0 flex h-[45px] items-center gap-2 border-t px-2">
      {isFetching ? (
        <div className="ml-2 text-xs">Loading...</div>
      ) : (
        <>
          {pagination ? (
            <>
              <div className="flex items-center gap-1 whitespace-nowrap">
                <Button
                  variant="ghost"
                  size="xs"
                  className="h-7 w-7"
                  onClick={() => table.setPageIndex(0)}
                  disabled={!table.getCanPreviousPage()}
                >
                  <ChevronDoubleLeftIcon size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  className="h-7 w-7"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  <ChevronLeftIcon size={16} />
                </Button>
                <div
                  className={cn('ml-1 flex items-center gap-1', fontSizeClass)}
                >
                  <div>Page</div>
                  <Input
                    type="number"
                    min={1}
                    max={table.getPageCount()}
                    className="no-spinner h-7 w-16"
                    value={internalPageIndex + 1}
                    onChange={handlePageInputChange}
                    onBlur={handlePageInputBlur}
                  />
                  <div>{`of ${formatCount(table.getPageCount())}`}</div>
                </div>
                <Button
                  variant="ghost"
                  size="xs"
                  className="h-7 w-7"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  <ChevronRightIcon size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  className="h-7 w-7"
                  onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                  disabled={!table.getCanNextPage()}
                >
                  <ChevronDoubleRightIcon size={16} />
                </Button>
                <PageSizeSelect
                  pageSize={table.getState().pagination.pageSize}
                  onPageSizeChange={(pageSize) => table.setPageSize(pageSize)}
                />
              </div>
              <div className="min-w-0 flex-1" />
            </>
          ) : null}

          {numRows !== undefined && Number.isFinite(numRows) ? (
            <div className={cn('min-w-fit font-normal', fontSizeClass)}>
              {`${formatCount(numRows)} rows`}
            </div>
          ) : null}
          {footerActions}
        </>
      )}
    </div>
  );
}
