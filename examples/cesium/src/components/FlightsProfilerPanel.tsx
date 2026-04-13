import {MosaicProfiler} from '@sqlrooms/mosaic';
import {RoomPanel} from '@sqlrooms/room-shell';
import {cn, SpinnerPane} from '@sqlrooms/ui';
import {useMemo} from 'react';
import {
  FLIGHT_FILTER_SELECTION_NAME,
  OPENSKY_POINT_PROFILER_COLUMNS,
  useRoomStore,
} from '../store';

export function FlightsProfilerPanel({className}: {className?: string}) {
  const mosaic = useRoomStore((state) => state.mosaic);
  const mosaicConnection = useRoomStore((state) => state.mosaic.connection);
  const flightPointsTable = useRoomStore((state) =>
    state.db.findTableByName('opensky_nyc_flight_points'),
  );
  const selection = useMemo(
    () => mosaic.getSelection(FLIGHT_FILTER_SELECTION_NAME),
    [mosaic],
  );

  if (mosaicConnection.status === 'loading') {
    return <SpinnerPane className="h-full w-full" />;
  }

  if (!flightPointsTable || mosaicConnection.status !== 'ready') {
    return null;
  }

  return (
    <RoomPanel type="filters" showHeader={false} className={className}>
      <section className={cn('bg-background flex h-full min-h-0 flex-col')}>
        <MosaicProfiler
          pageSize={18}
          selection={selection}
          tableName="opensky_nyc_flight_points"
          columns={[...OPENSKY_POINT_PROFILER_COLUMNS]}
        >
          <div className="border-b px-3 py-3">
            <h2 className="text-sm font-semibold">NYC Flight Profiler</h2>
            <p className="text-muted-foreground mt-1 text-xs leading-5">
              Filter a smaller New York area flight dataset by altitude,
              heading, speed, time, and route fields. Matching points promote
              their
              <code className="bg-muted ml-1 rounded px-1 py-0.5 text-[11px]">
                flight_id
              </code>
              s, and the globe renders those flights as complete moving paths.
              Profiler timestamps are shown in New York local time.
            </p>
          </div>

          <div className="min-h-0 flex-1">
            <div className="h-full w-full overflow-auto">
              <MosaicProfiler.Table>
                <MosaicProfiler.Header />
                <MosaicProfiler.Rows />
              </MosaicProfiler.Table>
            </div>
          </div>

          <div className="border-t">
            <div className="text-muted-foreground px-3 py-2 text-[11px] leading-4">
              Globe rendering is capped to the top 2,500 matching flights, but
              the NYC subset is already much lighter than the world-scale demo.
            </div>
            <MosaicProfiler.StatusBar />
          </div>
        </MosaicProfiler>
      </section>
    </RoomPanel>
  );
}
