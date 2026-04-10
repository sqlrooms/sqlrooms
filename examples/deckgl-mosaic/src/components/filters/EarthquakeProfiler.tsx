import {
  MosaicProfilerHeader,
  MosaicProfilerRows,
  MosaicProfilerStatusBar,
  useMosaicProfiler,
} from '@sqlrooms/mosaic';
import {Button, cn, Table} from '@sqlrooms/ui';
import {CopyIcon} from 'lucide-react';
import {useRoomStore} from '../../store';

export function EarthquakeProfiler({className}: {className?: string}) {
  const brush = useRoomStore((state) => state.mosaic.getSelection('brush'));
  const profiler = useMosaicProfiler({
    pageSize: 25,
    selection: brush,
    tableName: 'earthquakes',
  });

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
          <Table disableWrapper className="w-max min-w-full table-fixed">
            <MosaicProfilerHeader profiler={profiler} />
            <MosaicProfilerRows profiler={profiler} />
          </Table>
        </div>
      </div>

      <MosaicProfilerStatusBar
        profiler={profiler}
        renderActions={(sql) => (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => navigator.clipboard.writeText(sql)}
          >
            <CopyIcon className="h-3 w-3" />
            Copy SQL
          </Button>
        )}
      />
    </section>
  );
}
