import {FC, useMemo} from 'react';
import {IntlProvider} from 'react-intl';
import {ThemeProvider} from 'styled-components';
import {
  KeplerAction,
  KeplerGlReduxState,
  useStoreWithKepler,
} from '../KeplerSlice';
import {messages} from '@kepler.gl/localization';
import {forwardTo} from '@kepler.gl/actions';

import {
  appInjector,
  makeGetActionCreators,
  MapContainerFactory,
  mapFieldsSelector,
  provideRecipesToInjector,
  KeplerGlContext,
} from '@kepler.gl/components';
import {theme} from '@kepler.gl/styles';
import {Provider} from 'react-redux';
// Privde custom components for Dashboard and BI
const KeplerInjector = provideRecipesToInjector([], appInjector);
const MapContainer = KeplerInjector.get(MapContainerFactory);
const keplerActionSelector = makeGetActionCreators();

// import {initApplicationConfig} from '@kepler.gl/utils';
// import maplibre from 'maplibre-gl';
// @ts-ignore
// initApplicationConfig({getMapLib: () => ({...maplibre})});

export const KeplerMapContainer: FC<{
  mapId: string;
}> = ({mapId}) => {
  const mapConfig = useStoreWithKepler((state) =>
    state.config.kepler.maps.find((map) => map.id === mapId),
  );

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

  const mapFields = keplerState
    ? mapFieldsSelector({
        id: mapId,
        mapboxApiAccessToken: '',
        ...keplerState,
        ...keplerActionSelector(forwardToDispatch, {}),
      })
    : null;

  // useEffect(() => {
  //   const data = arrow.tableFromJSON([
  //     {latitude: 51.5074, longitude: -0.1278},
  //     {latitude: 51.5173, longitude: -0.1369},
  //     {latitude: 51.4975, longitude: -0.1357},
  //     {latitude: 51.5194, longitude: -0.127},
  //     {latitude: 51.4993, longitude: -0.1248},
  //     {latitude: 51.5036, longitude: -0.1147},
  //     {latitude: 51.5142, longitude: -0.0494},
  //     {latitude: 51.4872, longitude: -0.188},
  //     {latitude: 51.5225, longitude: -0.1539},
  //     {latitude: 51.4991, longitude: -0.1335},
  //   ]);
  //   const payload = {
  //     datasets: [
  //       {
  //         data: {
  //           rows: [],
  //           cols: Array.from({length: data.numCols}, (_, i) =>
  //             data.getChildAt(i),
  //           ),
  //           fields: arrowSchemaToFields(data),
  //         },
  //         info: {
  //           format: 'arrow',
  //           id: createId(),
  //           label: 'Query result',
  //           color: [31, 186, 214],
  //         },
  //       },
  //     ],
  //     options: {
  //       centerMap: true,
  //       readOnly: false,
  //       autoCreateLayers: true,
  //     },
  //   } satisfies AddDataToMapPayload;

  //   window.setTimeout(() => {
  //     dispatchAction(addDataToMap(payload));
  //   }, 5000);
  // }, []);
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
                {mapFields ? (
                  <MapContainer
                    primary={true}
                    containerId={0}
                    key={0}
                    index={0}
                    {...mapFields}
                  />
                ) : null}
              </KeplerGlContext.Provider>
            </ThemeProvider>
          </Provider>
        </IntlProvider>
      </div>
    </div>
  );

  // return <pre>{JSON.stringify(keplerMap, null, 2)}</pre>;
};
