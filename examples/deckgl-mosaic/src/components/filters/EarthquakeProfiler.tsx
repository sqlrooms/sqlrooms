import {DataTableExplorer, useDataTable} from '@sqlrooms/mosaic';
import {cn} from '@sqlrooms/ui';
import {FC, useMemo} from 'react';
import {useRoomStore} from '../../store';

type EarthquakeProfilerProps = {className?: string};

export const EarthquakeProfiler: FC<EarthquakeProfilerProps> = ({
  className,
}) => {
  const mosaic = useRoomStore((state) => state.mosaic);
  const brush = useMemo(() => mosaic.getSelection('brush'), [mosaic]);

  const dataTable = useDataTable('earthquakes');

  if (!dataTable) {
    return (
      <div
        className={cn(
          'bg-background flex h-full w-full items-center justify-center',
          className,
        )}
      >
        No data table found.
      </div>
    );
  }

  return (
    <section
      className={cn('bg-background flex min-h-0 flex-col border-t', className)}
    >
      <DataTableExplorer pageSize={25} selection={brush} tableName={dataTable}>
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
            <DataTableExplorer.Table>
              <DataTableExplorer.Header />
              <DataTableExplorer.Rows />
            </DataTableExplorer.Table>
          </div>
        </div>

        <DataTableExplorer.StatusBar />
      </DataTableExplorer>
    </section>
  );
};
