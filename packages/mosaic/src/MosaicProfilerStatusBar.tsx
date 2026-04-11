import type {ReactNode} from 'react';
import {Button, cn} from '@sqlrooms/ui';
import {ChevronLeftIcon, ChevronRightIcon} from 'lucide-react';
import type {UseMosaicProfilerReturn} from './profiler/types';

export type MosaicProfilerStatusBarProps = {
  className?: string;
  profiler: Pick<
    UseMosaicProfilerReturn,
    | 'filteredRowCount'
    | 'hasFilters'
    | 'pagination'
    | 'reset'
    | 'setPagination'
    | 'sql'
    | 'totalRowCount'
  >;
  renderActions?: (sql: string) => ReactNode;
};

export function MosaicProfilerStatusBar({
  className,
  profiler,
  renderActions,
}: MosaicProfilerStatusBarProps) {
  const actions = renderActions?.(profiler.sql);
  const totalPages =
    profiler.filteredRowCount !== undefined
      ? Math.max(
          1,
          Math.ceil(profiler.filteredRowCount / profiler.pagination.pageSize),
        )
      : undefined;
  const canGoPrevious = profiler.pagination.pageIndex > 0;
  const canGoNext =
    totalPages !== undefined && profiler.pagination.pageIndex < totalPages - 1;
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
              profiler.setPagination((prev) => ({
                ...prev,
                pageIndex: Math.max(0, prev.pageIndex - 1),
              }));
            }}
          >
            <ChevronLeftIcon size={14} />
          </Button>
          {showPaginationLabel ? (
            <span className="text-muted-foreground min-w-14 text-center text-[11px]">
              {profiler.pagination.pageIndex + 1} / {totalPages}
            </span>
          ) : null}
          <Button
            variant="ghost"
            size="xs"
            className="h-6 w-6 p-0"
            aria-label="Next page"
            disabled={!canGoNext}
            onClick={() => {
              profiler.setPagination((prev) => ({
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
        <div className="flex items-center gap-2">
          <Button
            variant="link"
            size="sm"
            className="h-auto px-0"
            disabled={!profiler.hasFilters}
            onClick={profiler.reset}
          >
            Reset
          </Button>
          <span className="text-muted-foreground text-xs">
            {profiler.filteredRowCount?.toLocaleString() ?? '0'}
            {profiler.totalRowCount !== undefined
              ? ` of ${profiler.totalRowCount.toLocaleString()} rows`
              : ' rows'}
          </span>
        </div>
      </div>
      {actions ? <div>{actions}</div> : null}
    </div>
  );
}
