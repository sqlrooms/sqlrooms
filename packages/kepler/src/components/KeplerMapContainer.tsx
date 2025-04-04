import {messages} from '@kepler.gl/localization';
import {FC, useMemo} from 'react';
import {IntlProvider} from 'react-intl';
import {ThemeProvider} from 'styled-components';
import {
  KeplerAction,
  KeplerGlReduxState,
  useStoreWithKepler,
} from '../KeplerSlice';

import {
  appInjector,
  KeplerGlContext,
  makeGetActionCreators,
  MapContainerFactory,
  mapFieldsSelector,
  MapViewStateContextProvider,
  provideRecipesToInjector,
} from '@kepler.gl/components';
import {theme} from '@kepler.gl/styles';
import {Provider} from 'react-redux';
const KeplerInjector = provideRecipesToInjector([], appInjector);
const MapContainer = KeplerInjector.get(MapContainerFactory);
const keplerActionSelector = makeGetActionCreators();

export const KeplerMapContainer: FC<{
  mapId: string;
}> = ({mapId}) => {
  const reduxProviderStore = useStoreWithKepler(
    (state) => state.kepler.__reduxProviderStore,
  );

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
  console.log('keplerState', keplerState?.mapState);

  const mapFields = keplerState
    ? mapFieldsSelector({
        id: mapId,
        mapboxApiAccessToken: '',
        ...keplerState,
        ...keplerActionSelector(forwardToDispatch, {}),
      })
    : null;

  const keplerContext = useMemo(
    () => ({
      selector: (state: KeplerGlReduxState) => state[mapId],
      id: mapId,
    }),
    [mapId],
  );
  return (
    <div className="relative h-full w-full">
      <div className="absolute h-full w-full">
        <IntlProvider locale="en" messages={messages['en']}>
          <Provider store={reduxProviderStore}>
            <ThemeProvider theme={theme}>
              <KeplerGlContext.Provider value={keplerContext}>
                {mapFields?.mapState ? (
                  <MapViewStateContextProvider mapState={mapFields.mapState}>
                    <MapContainer
                      primary={true}
                      containerId={0}
                      key={0}
                      index={0}
                      {...mapFields}
                    />
                  </MapViewStateContextProvider>
                ) : null}
              </KeplerGlContext.Provider>
            </ThemeProvider>
          </Provider>
        </IntlProvider>
      </div>
    </div>
  );
};
