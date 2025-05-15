import {FC, useMemo, useRef} from 'react';

import {
  MapContainerFactory,
  BottomWidgetFactory,
  GeocoderPanelFactory,
  mapFieldsSelector,
  bottomWidgetSelector,
  geoCoderPanelSelector,
  modalContainerSelector,
  MapViewStateContextProvider,
  RootContext,
  ModalContainerFactory,
} from '@kepler.gl/components';
import {useDimensions} from '@kepler.gl/utils';
import styled, {useTheme} from 'styled-components';

import {KeplerInjector} from './KeplerInjector';
import {KeplerProvider} from './KeplerProvider';
import {useKeplerStateActions} from '../hooks/useKeplerStateActions';
import {useStoreWithKepler} from '../KeplerSlice';

const MapContainer = KeplerInjector.get(MapContainerFactory);
const BottomWidget = KeplerInjector.get(BottomWidgetFactory);
const GeoCoderPanel = KeplerInjector.get(GeocoderPanelFactory);
const ModalContainer = KeplerInjector.get(ModalContainerFactory);

const DEFAULT_DIMENSIONS = {
  width: 0,
  height: 0,
};
const KEPLER_PROPS = {
  mapboxApiUrl: 'https://api.mapbox.com',
  appName: 'kepler.gl',
  sidePanelWidth: 0,
};
// overide kepler default style
const CustomWidgetcontainer = styled.div`
  .bottom-widget--inner {
    margin-top: 0;
  }

  .map-popover {
    z-index: 50;
  }
`;

type KeplerGLProps = Parameters<typeof geoCoderPanelSelector>[0];

const KeplerGl: FC<{
  mapId: string;
}> = ({mapId}) => {
  const bottomWidgetRef = useRef(null);
  const [containerRef, size] = useDimensions<HTMLDivElement>();
  const theme = useTheme();
  const basicKeplerProps = useStoreWithKepler(
    (state) => state.kepler.basicKeplerProps,
  );

  const {keplerActions, keplerState} = useKeplerStateActions({mapId});
  const interactionConfig = keplerState?.visState?.interactionConfig;
  const mergedKeplerProps = useMemo(() => {
    return {
      ...KEPLER_PROPS,
      ...keplerState,
      ...keplerActions,
      id: mapId,
    } as KeplerGLProps;
  }, [keplerState, keplerActions, mapId]);
  const geoCoderPanelFields = keplerState?.visState
    ? geoCoderPanelSelector(
        mergedKeplerProps,
        // dont need height
        size || DEFAULT_DIMENSIONS,
      )
    : null;
  const mapFields = keplerState?.visState
    ? mapFieldsSelector(mergedKeplerProps)
    : null;

  const bottomWidgetFields = keplerState?.visState.filters?.length
    ? bottomWidgetSelector(mergedKeplerProps, theme)
    : null;

  const modalContainerFields = keplerState?.visState
    ? modalContainerSelector(mergedKeplerProps, containerRef.current)
    : null;
  return (
    <RootContext.Provider value={containerRef}>
      <CustomWidgetcontainer
        ref={containerRef}
        className="kepler-gl relative flex h-full w-full flex-col justify-between"
      >
        {mapFields?.mapState ? (
          <MapViewStateContextProvider mapState={mapFields.mapState}>
            <MapContainer
              primary={true}
              containerId={0}
              key={0}
              index={0}
              {...mapFields}
              mapboxApiAccessToken={
                mapFields?.mapStyle?.mapboxApiAccessToken ||
                basicKeplerProps?.mapboxApiAccessToken
              }
            />
          </MapViewStateContextProvider>
        ) : null}
        {interactionConfig?.geocoder?.enabled ? (
          <GeoCoderPanel
            {...geoCoderPanelFields}
            index={0}
            unsyncedViewports={false}
          />
        ) : null}
        {bottomWidgetFields ? (
          <BottomWidget
            rootRef={bottomWidgetRef}
            {...bottomWidgetFields}
            theme={theme}
            containerW={size?.width}
          />
        ) : null}
        {modalContainerFields ? (
          <ModalContainer
            {...modalContainerFields}
            containerW={size?.width}
            containerH={size?.height}
          />
        ) : null}
      </CustomWidgetcontainer>
    </RootContext.Provider>
  );
};

export const KeplerMapContainer: FC<{
  mapId: string;
}> = ({mapId}) => {
  return (
    <KeplerProvider mapId={mapId}>
      <KeplerGl mapId={mapId} />
    </KeplerProvider>
  );
};
