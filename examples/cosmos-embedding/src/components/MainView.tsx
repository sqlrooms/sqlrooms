import {FC} from 'react';
import {PublicationsMap} from './publications-map/PublicationsMap';

export const MainView: FC = () => {
  return (
    <div className="w-full h-full p-4">
      <PublicationsMap />
    </div>
  );
};
