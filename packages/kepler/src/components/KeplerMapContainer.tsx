import {FC, useRef} from 'react';

import {
  MapContainerFactory,
  BottomWidgetFactory,
  mapFieldsSelector,
  bottomWidgetSelector,
  MapViewStateContextProvider,
  RootContext,
} from '@kepler.gl/components';
import {useTheme} from 'styled-components';

import {KeplerInjector} from './KeplerInjector';
import {KeplerProvider} from './KeplerProvider';
import {useKeplerStateActions} from '../hooks/useKeplerStateActions';
// import {theme} from '@kepler.gl/styles';

const MapContainer = KeplerInjector.get(MapContainerFactory);
const BottomWidget = KeplerInjector.get(BottomWidgetFactory);

const MAPBOX_TOKEN = process.env.MapboxAccessToken;

const KeplerGl: FC<{
  mapId: string;
}> = ({mapId}) => {
  const bottomWidgetRef = useRef(null);
  const theme = useTheme();
  const {keplerActions, keplerState} = useKeplerStateActions({mapId});
  const mapFields = keplerState
    ? mapFieldsSelector({
        id: mapId,
        mapboxApiAccessToken: '',
        ...keplerState,
        ...keplerActions,
      })
    : null;

  const bottomWidgetFields = keplerState
    ? bottomWidgetSelector(
        {
          sidePanelWidth: 300,
          ...keplerState,
          ...keplerActions,
        },
        theme,
      )
    : null;

  return (
    <>
      {mapFields?.mapState ? (
        <MapViewStateContextProvider mapState={mapFields.mapState}>
          <MapContainer
            primary={true}
            containerId={0}
            key={0}
            index={0}
            {...mapFields}
            mapboxApiAccessToken={MAPBOX_TOKEN}
          />
        </MapViewStateContextProvider>
      ) : null}
      <div className="absolute bottom-0 left-0 right-0">
        <BottomWidget
          rootRef={bottomWidgetRef}
          {...bottomWidgetFields}
          // containerW={dimensions.width}
          theme={theme}
        />
      </div>
    </>
  );
};
export const KeplerMapContainer: FC<{
  mapId: string;
}> = ({mapId}) => {
  const root = useRef(null);

  return (
    <RootContext.Provider value={root}>
      <KeplerProvider mapId={mapId}>
        <div className="relative h-full w-full">
          <div className="kepler-gl absolute h-full w-full" ref={root}>
            <KeplerGl mapId={mapId} />
            {/* <MapContainer
              primary={true}
              containerId={0}
              key={0}
              index={0}
              {...mapFields}
              mapboxApiAccessToken={MAPBOX_TOKEN}
            {/* {mapFields?.mapState ? (
              <MapViewStateContextProvider mapState={mapFields.mapState}>
                <MapContainer
                  primary={true}
                  containerId={0}
                  key={0}
                  index={0}
                  {...mapFields}
                  mapboxApiAccessToken={MAPBOX_TOKEN}
                />
              </MapViewStateContextProvider>
            ) : null}
            <div className="absolute bottom-0 left-0 right-0">
              <BottomWidget
                rootRef={bottomWidgetRef}
                {...bottomWidgetFields}
                // containerW={dimensions.width}
                theme={theme}
              />
            </div> */}
          </div>
        </div>
      </KeplerProvider>
    </RootContext.Provider>
  );
};
