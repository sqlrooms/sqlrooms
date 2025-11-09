import {FC, ReactNode, useMemo} from 'react';

import {
  PlotContainerFactory,
  plotContainerSelector,
} from '@kepler.gl/components';
import {useKeplerStateActions} from '../hooks/useKeplerStateActions';
import {KeplerInjector} from './KeplerInjector';
import {KeplerProvider} from './KeplerProvider';

const PlotContainer = KeplerInjector.get(PlotContainerFactory);
const KEPLER_PROPS = {
  mapboxApiUrl: 'https://api.mapbox.com',
  appName: 'kepler.gl',
  sidePanelWidth: 0,
  mapboxApiAccessToken: '',
};

export const KeplerPlotContainer: FC<{
  mapId: string;
  logoComponent?: ReactNode;
}> = ({mapId, logoComponent}) => {
  const {keplerState, keplerActions} = useKeplerStateActions({mapId});

  const isExportingImage = keplerState?.uiState?.exportImage?.exporting;
  const mergedKeplerProps = useMemo(
    () =>
      keplerState !== undefined
        ? {
            ...KEPLER_PROPS,
            mapboxApiAccessToken:
              KEPLER_PROPS.mapboxApiAccessToken ||
              keplerState?.mapStyle?.mapboxApiAccessToken ||
              '',
            ...keplerState,
            ...keplerActions,
            id: mapId,
          }
        : null,
    [keplerState, keplerActions, mapId],
  );

  const plotContainerFields = useMemo(
    () => (mergedKeplerProps ? plotContainerSelector(mergedKeplerProps) : null),
    // include filters in deps to trigger refresh when filters change from bottom time widget
    [mergedKeplerProps, keplerState?.visState?.filters],
  );

  return isExportingImage && plotContainerFields ? (
    <KeplerProvider mapId={mapId}>
      <PlotContainer
        {...plotContainerFields}
        logoComponent={logoComponent ?? null}
      />
    </KeplerProvider>
  ) : null;
};
