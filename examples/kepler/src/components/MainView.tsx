import {KeplerMapsContainer} from './KeplerMapsContainer';
import {SkeletonPane} from '@sqlrooms/ui';
import {useRoomStore} from '../store';

export const MainView: React.FC = () => {
  // Check if data is available
  const isDataAvailable = useRoomStore((state) => state.room.isDataAvailable);

  if (!isDataAvailable) {
    return <SkeletonPane />;
  }

  return (
    <div className="flex h-full w-full flex-col">
      <KeplerMapsContainer />
    </div>
  );
};
