import {FC} from 'react';
import {useKeplerStore, useProjectStore} from '../store';
import {ThemeProvider} from 'styled-components';

import {
  provideRecipesToInjector,
  appInjector,
  mapFieldsSelector,
  makeGetActionCreators,
  MapContainerFactory,
} from '@kepler.gl/components';
import {theme} from '@kepler.gl/styles';
// Privde custom components for Dashboard and BI
const KeplerInjector = provideRecipesToInjector([], appInjector);
const MapContainer = KeplerInjector.get(MapContainerFactory);
const keplerActionSelector = makeGetActionCreators();

export const KeplerMapContainer: FC<{
  mapId: string;
}> = ({mapId}) => {
  // const keplerState = useKeplerStore();

  const dispatchAction = useProjectStore(
    (state) => state.kepler.dispatchAction,
  );
  const keplerState = useProjectStore((state) => state.kepler.map);

  const {
    visStateActions,
    mapStateActions,
    uiStateActions,
    mapStyleActions,
    providerActions,
    dispatch,
  } = keplerActionSelector(dispatchAction, {});
  const keplerProps = {
    id: mapId,
    mapboxApiAccessToken: '',
    ...keplerState,
    visStateActions,
    mapStateActions,
    uiStateActions,
    mapStyleActions,
    providerActions,
    dispatch,
  };

  const mepFields = mapFieldsSelector(keplerProps);
  console.log(mepFields);
  return (
    <ThemeProvider theme={theme}>
      {/* <div> */}
      <MapContainer
        primary={true}
        key={0}
        index={0}
        {...mepFields}
        containerId={0}
      />
      {/* </div> */}
    </ThemeProvider>
  );
};
