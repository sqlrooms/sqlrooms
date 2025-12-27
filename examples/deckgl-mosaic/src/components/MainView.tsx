import {useMosaic} from '@sqlrooms/mosaic';
import {SpinnerPane} from '@sqlrooms/ui';
import {useRoomStore} from '../store';
import MapView from './map/MapView';
export const MainView = () => {
  const {isMosaicLoading} = useMosaic();

  const isTableReady = useRoomStore((state) =>
    state.db.tables.find((t) => t.tableName === 'earthquakes'),
  );

  if (isMosaicLoading) {
    return <SpinnerPane className="h-full w-full" />;
  }
  if (!isTableReady) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-4">
        No data available
      </div>
    );
  }

  return <MapView />;
};
