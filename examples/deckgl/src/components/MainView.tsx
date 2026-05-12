import {SpinnerPane} from '@sqlrooms/ui';
import {useRoomStore} from '../store';
import {AIRPORTS_TABLE_NAME, BUILDINGS_TABLE_NAME} from '../dataSources';
import {MapView} from './MapView';

export const MainView: React.FC = () => {
  const airportsTable = useRoomStore((s) =>
    s.db.findTableByName(AIRPORTS_TABLE_NAME),
  );
  const buildingsTable = useRoomStore((s) =>
    s.db.findTableByName(BUILDINGS_TABLE_NAME),
  );

  if (!airportsTable || !buildingsTable) {
    return <SpinnerPane className="h-full w-full" />;
  }

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <MapView />
    </div>
  );
};
