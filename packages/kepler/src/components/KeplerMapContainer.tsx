import {FC} from 'react';
import {useStoreWithKepler} from '../KeplerSlice';

export const KeplerMapContainer: FC<{
  mapId: string;
}> = ({mapId}) => {
  const keplerMap = useStoreWithKepler((state) =>
    state.config.kepler.maps.find((map) => map.id === mapId),
  );

  return <pre>{JSON.stringify(keplerMap, null, 2)}</pre>;
};
