import {
  MosaicProfilerHeader,
  MosaicProfilerRows,
  MosaicProfilerStatusBar,
  useMosaicProfiler,
} from '@sqlrooms/mosaic';
import {cn, Table} from '@sqlrooms/ui';
import {useRoomStore} from '../../store';

const ROW_NUMBER_COLUMN_WIDTH_PX = 40;
const DEFAULT_PROFILER_COLUMN_WIDTH_PX = 140;
const UNSUPPORTED_PROFILER_COLUMN_WIDTH_PX = 104;

export function EarthquakeProfiler({className}: {className?: string}) {
  const brush = useRoomStore((state) => state.mosaic.getSelection('brush'));
  const profiler = useMosaicProfiler({
    pageSize: 25,
    selection: brush,
    tableName: 'earthquakes',
  });
  const tableWidth =
    ROW_NUMBER_COLUMN_WIDTH_PX +
    profiler.columns.reduce(
      (total, column) =>
        total +
        (column.kind === 'unsupported'
          ? UNSUPPORTED_PROFILER_COLUMN_WIDTH_PX
          : DEFAULT_PROFILER_COLUMN_WIDTH_PX),
      0,
    );

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
