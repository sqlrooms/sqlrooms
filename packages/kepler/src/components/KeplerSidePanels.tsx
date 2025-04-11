import React from 'react';
import {useIntl} from 'react-intl';

import {
  LayerManagerFactory,
  FilterManagerFactory,
  InteractionManagerFactory,
  MapManagerFactory,
} from '@kepler.gl/components';
import {SIDEBAR_PANELS} from '@kepler.gl/constants';

import {useKeplerStateActions} from '../hooks/useKeplerStateActions';
import {KeplerProvider} from './KeplerProvider';
import {KeplerInjector} from './KeplerInjector';

const LayerManager = KeplerInjector.get(LayerManagerFactory);
const FilterManager = KeplerInjector.get(FilterManagerFactory);
const InteractionManager = KeplerInjector.get(InteractionManagerFactory);
const MapManager = KeplerInjector.get(MapManagerFactory);

const layerPanelMetadata = SIDEBAR_PANELS.find((p) => p.id === 'layer');
const filterPanelMetadata = SIDEBAR_PANELS.find((p) => p.id === 'filter');
const interactionPanelMetadata = SIDEBAR_PANELS.find(
  (p) => p.id === 'interaction',
);
const mapPanelMetadata = SIDEBAR_PANELS.find((p) => p.id === 'map');

const KeplerLayerManager: React.FC<{mapId: string}> = ({mapId}) => {
  const {keplerActions, keplerState} = useKeplerStateActions({mapId});
  const intl = useIntl();

  return (
    <LayerManager
      layers={keplerState?.visState.layers || []}
      datasets={keplerState?.visState.datasets || {}}
      intl={intl}
      layerOrder={keplerState?.visState.layerOrder || {}}
      panelListView={keplerState?.uiState.layerPanelListView}
      panelMetadata={layerPanelMetadata}
      layerClasses={keplerState?.visState.layerClasses || {}}
      layerBlending={keplerState?.visState.layerBlending}
      overlayBlending={keplerState?.visState.overlayBlending}
      //   showAddDataModal={showAddDataModal}
      //   updateTableColor={updateTableColor}
      //   showDatasetTable={showDatasetTable}
      //   removeDataset={removeDataset}
      uiStateActions={keplerActions.uiStateActions}
      visStateActions={keplerActions.visStateActions}
      mapStateActions={keplerActions.mapStateActions}
    />
  );
};

const KeplerFilterManager: React.FC<{mapId: string}> = ({mapId}) => {
  const {keplerActions, keplerState} = useKeplerStateActions({mapId});

  return (
    <FilterManager
      filters={keplerState?.visState.filters || []}
      datasets={keplerState?.visState.datasets || {}}
      layers={keplerState?.visState.layers || []}
      //   showAddDataModal={showAddDataModal}
      //   updateTableColor={updateTableColor}
      //   showDatasetTable={showDatasetTable}
      //   removeDataset={removeDataset}
      panelMetadata={filterPanelMetadata}
      panelListView={keplerState?.uiState.filterPanelListView}
      uiStateActions={keplerActions.uiStateActions}
      visStateActions={keplerActions.visStateActions}
    />
  );
};

const KeplerInteractionManager: React.FC<{mapId: string}> = ({mapId}) => {
  const {keplerActions, keplerState} = useKeplerStateActions({mapId});

  return (
    <InteractionManager
      interactionConfig={keplerState?.visState.interactionConfig || {}}
      datasets={keplerState?.visState.datasets || {}}
      visStateActions={keplerActions.visStateActions}
      panelMetadata={interactionPanelMetadata}
    />
  );
};

const KeplerBasemapManager: React.FC<{mapId: string}> = ({mapId}) => {
  const {keplerActions, keplerState} = useKeplerStateActions({mapId});

  return (
    <MapManager
      mapStyle={keplerState?.mapStyle}
      mapStyleActions={keplerActions.mapStyleActions}
      // showAddMapStyleModal,
      panelMetadata={mapPanelMetadata}
    />
  );
};

type KeplerSidePanelProps = {
  mapId: string;
  panelId: 'layer' | 'filter' | 'interaction' | 'map';
};
export const KeplerSidePanels: React.FC<KeplerSidePanelProps> = ({
  mapId,
  panelId,
}) => {
  return (
    <KeplerProvider mapId={mapId}>
      {panelId === 'layer' ? <KeplerLayerManager mapId={mapId} /> : null}
      {panelId === 'filter' ? <KeplerFilterManager mapId={mapId} /> : null}
      {panelId === 'interaction' ? (
        <KeplerInteractionManager mapId={mapId} />
      ) : null}
      {panelId === 'map' ? <KeplerBasemapManager mapId={mapId} /> : null}
    </KeplerProvider>
  );
};
