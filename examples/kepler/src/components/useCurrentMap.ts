import {KeplerMapSchema} from '@sqlrooms/kepler';
import {useRoomStore} from '../store';

export function useCurrentMap(): KeplerMapSchema | undefined {
  return useRoomStore((state) => {
    return state.kepler.getCurrentMap();
  });
}
