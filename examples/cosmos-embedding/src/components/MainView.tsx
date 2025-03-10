import {FC} from 'react';
import {PublicationsMap} from './publications-map/PublicationsMap';

export const MainView: FC = () => {
  return (
    <div className="h-full w-full p-4">
      <PublicationsMap />
    </div>
  );
};
