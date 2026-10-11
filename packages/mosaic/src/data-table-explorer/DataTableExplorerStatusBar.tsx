import type {FC, ReactNode} from 'react';
import {Button, cn} from '@sqlrooms/ui';
import {ChevronLeftIcon, ChevronRightIcon} from 'lucide-react';
import type {UseDataTableExplorerReturn} from './types';

export type DataTableExplorerStatusBarProps = {
  className?: string;
  explorer: Pick<
    UseDataTableExplorerReturn,
    | 'filteredRowCount'
    | 'pagination'
    | 'setPagination'
    | 'sql'
    | 'totalRowCount'
  >;
  renderActions?: (sql: string) => ReactNode;
};

export const DataTableExplorerStatusBar: FC<
  DataTableExplorerStatusBarProps
> = ({className, explorer, renderActions}) => {
  const actions = renderActions?.(explorer.sql);
  const totalPages =
    explorer.filteredRowCount !== undefined
      ? Math.max(
          1,
          Math.ceil(explorer.filteredRowCount / explorer.pagination.pageSize),
        )
      : undefined;
  const canGoPrevious = explorer.pagination.pageIndex > 0;
  const canGoNext =
    totalPages !== undefined && explorer.pagination.pageIndex < totalPages - 1;
  const showPaginationLabel = totalPages !== undefined;

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 border-t px-3 py-2 text-sm',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 whitespace-nowrap">
          <Button
            variant="ghost"
            size="xs"
            className="h-6 w-6 p-0"
            aria-label="Previous page"
            disabled={!canGoPrevious}
            onClick={() => {
              explorer.setPagination((prev) => ({
                ...prev,
                pageIndex: Math.max(0, prev.pageIndex - 1),
              }));
            }}
          >
            <ChevronLeftIcon size={14} />
          </Button>
          {showPaginationLabel ? (
            <span className="text-muted-foreground min-w-14 text-center text-[11px]">
              {explorer.pagination.pageIndex + 1} / {totalPages}
            </span>
          ) : null}
          <Button
            variant="ghost"
            size="xs"
            className="h-6 w-6 p-0"
            aria-label="Next page"
            disabled={!canGoNext}
            onClick={() => {
              explorer.setPagination((prev) => ({
                ...prev,
                pageIndex:
                  totalPages === undefined
                    ? prev.pageIndex
                    : Math.min(totalPages - 1, prev.pageIndex + 1),
              }));
            }}
          >
            <ChevronRightIcon size={14} />
          </Button>
        </div>
        <span className="text-muted-foreground text-xs">
          {explorer.filteredRowCount?.toLocaleString() ?? '0'}
          {explorer.totalRowCount !== undefined
            ? ` of ${explorer.totalRowCount.toLocaleString()} rows`
            : ' rows'}
        </span>
      </div>
      {actions ? <div>{actions}</div> : null}
    </div>
  );
};
