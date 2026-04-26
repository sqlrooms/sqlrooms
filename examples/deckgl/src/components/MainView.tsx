import {SpinnerPane} from '@sqlrooms/ui';
import {useRoomStore} from '../store';
import {BUILDINGS_TABLE_NAME} from '../dataSources';
import {MapView} from './MapView';

export const MainView: React.FC = () => {
  const airportsTable = useRoomStore((s) => s.db.findTableByName('airports'));
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
