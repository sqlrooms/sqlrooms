import {FC} from 'react';
import {MammalsGraph} from './mammals-graph/MammalsGraph';

export const MainView: FC = () => {
  return (
    <div className="h-full w-full p-4">
      <MammalsGraph />
    </div>
  );
};
