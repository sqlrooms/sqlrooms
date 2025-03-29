import {FC, useEffect} from 'react';
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
import {initApplicationConfig} from '@kepler.gl/utils';
import maplibre from 'maplibre-gl';
import {requestMapStyles} from '@kepler.gl/actions';

// Privde custom components for Dashboard and BI
const KeplerInjector = provideRecipesToInjector([], appInjector);
const MapContainer = KeplerInjector.get(MapContainerFactory);
const keplerActionSelector = makeGetActionCreators();

initApplicationConfig({
  plugins: [
    // keplerGlDuckdbPlugin
  ],
  getMapLib: () => ({...maplibre}),
  // table: KeplerGlDuckDbTable
});

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

  useEffect(() => {
    const style =
      keplerProps.mapStyle.mapStyles[keplerProps.mapStyle.styleType];
    console.log('setting style', style);
    if (style) {
      dispatch(requestMapStyles({[style.id]: style}));
    }
  }, []);

  const mapFields = mapFieldsSelector(keplerProps);
  console.log({
    mapFields,
    keplerProps,
  });
  return (
    <div className="relative h-full w-full">
      <div className="absolute h-full w-full">
        <ThemeProvider theme={theme}>
          {/* <div> */}
          <MapContainer
            primary={true}
            key={0}
            index={0}
            {...mapFields}
            containerId={0}
          />
          {/* </div> */}
        </ThemeProvider>
      </div>
    </div>
  );

  // return <pre>{JSON.stringify(keplerMap, null, 2)}</pre>;
};
