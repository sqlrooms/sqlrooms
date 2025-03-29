import {FC, useEffect, useMemo} from 'react';
import {ThemeProvider} from 'styled-components';
import {useStoreWithKepler} from '../KeplerSlice';
import {arrowSchemaToFields} from '@kepler.gl/processors';
import {AddDataToMapPayload} from '@kepler.gl/types';
import * as arrow from 'apache-arrow';

import {
  appInjector,
  makeGetActionCreators,
  MapContainerFactory,
  mapFieldsSelector,
  provideRecipesToInjector,
} from '@kepler.gl/components';
import {theme} from '@kepler.gl/styles';
import {addDataToMap, requestMapStyles} from '@kepler.gl/actions';
import {createId} from '@paralleldrive/cuid2';
import {Table} from 'apache-arrow';

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

  const dispatchAction = useStoreWithKepler(
    (state) => state.kepler.dispatchAction,
  );
  const keplerState = useStoreWithKepler((state) => state.kepler.map);
  const mapFields = mapFieldsSelector({
    id: mapId,
    mapboxApiAccessToken: '',
    ...keplerState,
    ...keplerActionSelector(dispatchAction, {}),
  });
  // console.log('mapFields', mapFields);

  useEffect(() => {
    const {mapStyle} = keplerState;
    const style = mapStyle.mapStyles[mapStyle.styleType];
    if (style) {
      dispatchAction(requestMapStyles({[style.id]: style}));
    }
  }, []);

  useEffect(() => {
    const data = arrow.tableFromJSON([
      {latitude: 51.5074, longitude: -0.1278},
      {latitude: 51.5173, longitude: -0.1369},
      {latitude: 51.4975, longitude: -0.1357},
      {latitude: 51.5194, longitude: -0.127},
      {latitude: 51.4993, longitude: -0.1248},
      {latitude: 51.5036, longitude: -0.1147},
      {latitude: 51.5142, longitude: -0.0494},
      {latitude: 51.4872, longitude: -0.188},
      {latitude: 51.5225, longitude: -0.1539},
      {latitude: 51.4991, longitude: -0.1335},
    ]);
    const payload = {
      datasets: [
        {
          data: {
            rows: [],
            cols: Array.from({length: data.numCols}, (_, i) =>
              data.getChildAt(i),
            ),
            fields: arrowSchemaToFields(data),
          },
          info: {
            format: 'arrow',
            id: createId(),
            label: 'Query result',
            color: [31, 186, 214],
          },
        },
      ],
      options: {
        centerMap: true,
        readOnly: false,
        autoCreateLayers: true,
      },
    } satisfies AddDataToMapPayload;

    window.setTimeout(() => {
      dispatchAction(addDataToMap(payload));
    }, 5000);
  }, []);

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
