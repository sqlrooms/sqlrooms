import {FC, useMemo} from 'react';

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
};

export const KeplerPlotContainer: FC<{mapId: string}> = ({mapId}) => {
  const {keplerState, keplerActions} = useKeplerStateActions({mapId});

  // Debug keplerActions changes

  const isExportingImage = keplerState?.uiState?.exportImage?.exporting;
  const mergedKeplerProps = useMemo(() => {
    return {
      ...KEPLER_PROPS,
      ...keplerState,
      ...keplerActions,
      id: mapId,
    };
  }, [keplerState, keplerActions, mapId]);

  const plotContainerFields = useMemo(
    () => plotContainerSelector(mergedKeplerProps),
    [mergedKeplerProps],
  );

  return isExportingImage ? (
    <KeplerProvider mapId={mapId}>
      <PlotContainer {...plotContainerFields} />
    </KeplerProvider>
  ) : null;
};
