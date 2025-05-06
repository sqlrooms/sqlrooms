import {useMemo} from 'react';
import {KeplerAction, useStoreWithKepler} from '../KeplerSlice';
import {makeGetActionCreators} from '@kepler.gl/components';
import {KeplerGlState} from '@kepler.gl/reducers';

const keplerActionSelector = makeGetActionCreators();
export type KeplerActions = {
  visStateActions: any;
  mapStateActions: any;
  mapStyleActions: any;
  uiStateActions: any;
  providerActions: any;
  dispatch: (action: KeplerAction) => void;
};
export function useKeplerStateActions({mapId}: {mapId: string}): {
  keplerActions: KeplerActions;
  keplerState: KeplerGlState | undefined;
} {
  const dispatchAction = useStoreWithKepler(
    (state) => state.kepler.dispatchAction,
  );
  const forwardToDispatch = useMemo(
    () => (action: KeplerAction) => dispatchAction(mapId, action),
    [mapId, dispatchAction],
  );
  const keplerState = useStoreWithKepler((state) => {
    return state.kepler.map[mapId];
  });

  const keplerActions = useMemo(
    () => keplerActionSelector(forwardToDispatch, {}),
    [forwardToDispatch],
  );

  return {keplerActions, keplerState};
}
