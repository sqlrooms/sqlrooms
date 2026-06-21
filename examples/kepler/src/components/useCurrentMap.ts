import {KeplerMapSchema} from '@sqlrooms/kepler';
import {getCurrentKeplerMapArtifactId, useRoomStore} from '../store';

export function useCurrentMap(): KeplerMapSchema | undefined {
  return useRoomStore((state) => {
    const mapId = getCurrentKeplerMapArtifactId(state);
    return mapId
      ? state.kepler.config.maps.find((map) => map.id === mapId)
      : undefined;
  });
}
