import {SpinnerPane} from '@sqlrooms/ui';
import {useRoomStore} from '../store';
import {MapView} from './MapView';

export const MainView: React.FC = () => {
  const table = useRoomStore((s) => s.db.findTableByName('airports'));

  if (!table) {
    return <SpinnerPane className="h-full w-full" />;
  }

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <MapView />
    </div>
  );
};
