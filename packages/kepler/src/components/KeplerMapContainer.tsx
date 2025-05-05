import {FC, useRef} from 'react';

import {
  MapContainerFactory,
  BottomWidgetFactory,
  mapFieldsSelector,
  bottomWidgetSelector,
  MapViewStateContextProvider,
  RootContext,
} from '@kepler.gl/components';
import styled, {useTheme} from 'styled-components';

import {KeplerInjector} from './KeplerInjector';
import {KeplerProvider} from './KeplerProvider';
import {useKeplerStateActions} from '../hooks/useKeplerStateActions';

const MapContainer = KeplerInjector.get(MapContainerFactory);
const BottomWidget = KeplerInjector.get(BottomWidgetFactory);

const MAPBOX_TOKEN = process.env.MapboxAccessToken;

// HACK! should fix it in kepler.gl
const CustomWidgetcontainer = styled.div`
  .bottom-widget--inner {
    margin-top: 0;
  }
`;
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
          sidePanelWidth: 0,
          ...keplerState,
          ...keplerActions,
        },
        theme,
      )
    : null;

  return (
    <CustomWidgetcontainer className="kepler-gl flex h-full w-full flex-col justify-between">
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
      <BottomWidget
        rootRef={bottomWidgetRef}
        {...bottomWidgetFields}
        theme={theme}
      />
    </CustomWidgetcontainer>
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
          <KeplerGl mapId={mapId} />
        </div>
      </KeplerProvider>
    </RootContext.Provider>
  );
};
