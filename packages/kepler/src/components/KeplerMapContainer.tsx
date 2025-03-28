import {FC} from 'react';
import {ThemeProvider} from 'styled-components';
import {useStoreWithKepler} from '../KeplerSlice';

import {
  appInjector,
  makeGetActionCreators,
  MapContainerFactory,
  mapFieldsSelector,
  provideRecipesToInjector,
} from '@kepler.gl/components';
import {theme} from '@kepler.gl/styles';

// Privde custom components for Dashboard and BI
const KeplerInjector = provideRecipesToInjector([], appInjector);
const MapContainer = KeplerInjector.get(MapContainerFactory);
const keplerActionSelector = makeGetActionCreators();

export const KeplerMapContainer: FC<{
  mapId: string;
}> = ({mapId}) => {
  const keplerMap = useStoreWithKepler((state) =>
    state.config.kepler.maps.find((map) => map.id === mapId),
  );

  const dispatchAction = useStoreWithKepler(
    (state) => state.kepler.dispatchAction,
  );
  const keplerState = useStoreWithKepler((state) => state.kepler.map);
  console.log({keplerState});
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
    <div className="h-full w-full">
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
    </div>
  );

  // return <pre>{JSON.stringify(keplerMap, null, 2)}</pre>;
};
