import type {ReactNode} from 'react';
import {Button, cn} from '@sqlrooms/ui';
import type {UseMosaicProfilerReturn} from './profiler/types';

export type MosaicProfilerStatusBarProps = {
  className?: string;
  profiler: Pick<
    UseMosaicProfilerReturn,
    'filteredRowCount' | 'reset' | 'sql' | 'totalRowCount'
  >;
  renderActions?: (sql: string) => ReactNode;
};

export function MosaicProfilerStatusBar({
  className,
  profiler,
  renderActions,
}: MosaicProfilerStatusBarProps) {
  const hasFilters =
    profiler.filteredRowCount !== undefined &&
    profiler.totalRowCount !== undefined &&
    profiler.filteredRowCount !== profiler.totalRowCount;

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 border-t px-3 py-2 text-sm',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <Button
          variant="link"
          size="sm"
          className="h-auto px-0"
          disabled={!hasFilters}
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
      <div>{renderActions?.(profiler.sql)}</div>
    </div>
  );
}
