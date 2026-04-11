import {
  getProfilerTableWidth,
  MosaicProfilerHeader,
  MosaicProfilerRows,
  MosaicProfilerStatusBar,
  useMosaicProfiler,
} from '@sqlrooms/mosaic';
import {cn, Table} from '@sqlrooms/ui';
import {useMemo} from 'react';
import {useRoomStore} from '../../store';

export function EarthquakeProfiler({className}: {className?: string}) {
  const mosaic = useRoomStore((state) => state.mosaic);
  const brush = useMemo(() => mosaic.getSelection('brush'), [mosaic]);
  const profiler = useMosaicProfiler({
    pageSize: 25,
    selection: brush,
    tableName: 'earthquakes',
  });
  const tableWidth = getProfilerTableWidth(profiler.columns);

  return (
    <section
      className={cn('bg-background flex min-h-0 flex-col border-t', className)}
    >
      <div className="flex items-center justify-between gap-4 px-3 py-2">
        <div>
          <h2 className="text-sm font-semibold">Earthquake Profiler</h2>
          <p className="text-muted-foreground text-xs">
            Cross-filtered rows and per-column summaries powered by Mosaic.
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="h-full w-full overflow-auto">
          <Table
            disableWrapper
            className="min-w-full table-fixed"
            style={{width: `${tableWidth}px`}}
          >
            <MosaicProfilerHeader profiler={profiler} />
            <MosaicProfilerRows profiler={profiler} />
          </Table>
        </div>
      </div>

      <MosaicProfilerStatusBar profiler={profiler} />
    </section>
  );
}
