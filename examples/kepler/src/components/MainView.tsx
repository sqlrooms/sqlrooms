import {KeplerMapsContainer} from './KeplerMapsContainer';
import {SkeletonPane} from '@sqlrooms/ui';
import {useProjectStore} from '../store';

export const MainView: React.FC = () => {
  // Check if data is available
  const isDataAvailable = useProjectStore(
    (state) => state.project.isDataAvailable,
  );

  if (!isDataAvailable) {
    return <SkeletonPane />;
  }

  return (
    <div className="flex h-full w-full flex-col">
      <KeplerMapsContainer />
    </div>
  );
};
