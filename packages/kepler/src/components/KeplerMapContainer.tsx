import {FC, useRef} from 'react';

import {
  MapContainerFactory,
  mapFieldsSelector,
  MapViewStateContextProvider,
  RootContext
} from '@kepler.gl/components';
import {KeplerInjector} from './KeplerInjector';
import {KeplerProvider} from './KeplerProvider';
import {useKeplerStateActions} from '../hooks/useKeplerStateActions';

const MapContainer = KeplerInjector.get(MapContainerFactory);

// @ts-expect-error: injected with define
const MAPBOX_TOKEN = process.env.MapboxAccessToken;

export const KeplerMapContainer: FC<{
  mapId: string;
}> = ({mapId}) => {
  const root = useRef(null);
  const {keplerActions, keplerState} = useKeplerStateActions({mapId});

  const mapFields = keplerState
    ? mapFieldsSelector({
        id: mapId,
        mapboxApiAccessToken: '',
        ...keplerState,
        ...keplerActions,
      })
    : null;

  return (
    <RootContext.Provider value={root}>
      <KeplerProvider mapId={mapId}>
        <div className="relative h-full w-full">
          <div className="absolute h-full w-full kepler-gl" ref={root}>
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
          </div>
        </div>
      </KeplerProvider>
    </RootContext.Provider>
  );
};
