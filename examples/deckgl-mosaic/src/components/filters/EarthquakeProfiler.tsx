import {MosaicProfiler} from '@sqlrooms/mosaic';
import {cn} from '@sqlrooms/ui';
import {useMemo} from 'react';
import {useRoomStore} from '../../store';

export function EarthquakeProfiler({className}: {className?: string}) {
  const mosaic = useRoomStore((state) => state.mosaic);
  const brush = useMemo(() => mosaic.getSelection('brush'), [mosaic]);

  return (
    <section
      className={cn('bg-background flex min-h-0 flex-col border-t', className)}
    >
      <MosaicProfiler pageSize={25} selection={brush} tableName="earthquakes">
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
            <MosaicProfiler.Table>
              <MosaicProfiler.Header />
              <MosaicProfiler.Rows />
            </MosaicProfiler.Table>
          </div>
        </div>

        <MosaicProfiler.StatusBar />
      </MosaicProfiler>
    </section>
  );
}
