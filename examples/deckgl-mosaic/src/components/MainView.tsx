import {SpinnerPane} from '@sqlrooms/ui';
import {useRoomStore} from '../store';
import MapView from './map/MapView';
import FiltersPanel from './filters/FiltersPanel';

export const MainView = () => {
  const mosaicConn = useRoomStore((state) => state.mosaic.connection);
  const isTableReady = useRoomStore((state) =>
    state.db.tables.find(({table: {table}}) => table === 'earthquakes'),
  );

  if (mosaicConn.status === 'loading') {
    return <SpinnerPane className="h-full w-full" />;
  } else if (mosaicConn.status === 'error') {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-4 text-red-500">
        <h2 className="text-2xl font-bold">
          Error initializing Mosaic:{' '}
          {mosaicConn.error instanceof Error
            ? mosaicConn.error.message
            : 'Unknown error'}
        </h2>
      </div>
    );
  }
  if (!isTableReady) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-4">
        No data available
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-row">
      <MapView className="w-[70%] grow" />
      <FiltersPanel className="w-[30%] max-w-100" />
    </div>
  );
};
