import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';

import {
  LayerManagerFactory,
  FilterManagerFactory,
  InteractionManagerFactory,
  MapManagerFactory,
  DndContextFactory,
} from '@kepler.gl/components';
import {
  SIDEBAR_PANELS,
  ADD_MAP_STYLE_ID,
  ADD_DATA_ID,
} from '@kepler.gl/constants';

import {
  KeplerActions,
  useKeplerStateActions,
} from '../hooks/useKeplerStateActions';
import {KeplerProvider} from './KeplerProvider';
import {KeplerInjector} from './KeplerInjector';
import {RGBColor} from '@kepler.gl/types';

const LayerManager = KeplerInjector.get(LayerManagerFactory);
const FilterManager = KeplerInjector.get(FilterManagerFactory);
const InteractionManager = KeplerInjector.get(InteractionManagerFactory);
const MapManager = KeplerInjector.get(MapManagerFactory);
const DndContext = KeplerInjector.get(DndContextFactory);

const layerPanelMetadata = SIDEBAR_PANELS.find((p) => p.id === 'layer');
const filterPanelMetadata = SIDEBAR_PANELS.find((p) => p.id === 'filter');
const interactionPanelMetadata = SIDEBAR_PANELS.find(
  (p) => p.id === 'interaction',
);
const mapPanelMetadata = SIDEBAR_PANELS.find((p) => p.id === 'map');

function useSidePanelActions(keplerActions: KeplerActions) {
  const {openDeleteModal, toggleModal} = keplerActions.uiStateActions;
  const {updateTableColor} = keplerActions.visStateActions;

  const onRemoveDataset = useCallback(
    (dataId: string) => openDeleteModal(dataId),
    [openDeleteModal],
  );
  const onShowAddDataModal = useCallback(
    () => toggleModal(ADD_DATA_ID),
    [toggleModal],
  );
  const onUpdateTableColor = useCallback(
    (dataId: string, newColor: RGBColor) => updateTableColor(dataId, newColor),
    [updateTableColor],
  );

  return {
    onRemoveDataset,
    onShowAddDataModal,
    onUpdateTableColor,
  };
}
const KeplerLayerManager: React.FC<{
  mapId: string;
  showDeleteDataset?: boolean;
}> = ({mapId, showDeleteDataset}) => {
  const {keplerActions, keplerState} = useKeplerStateActions({mapId});
  const intl = useIntl();

  const {onRemoveDataset, onShowAddDataModal, onUpdateTableColor} =
    useSidePanelActions(keplerActions);

  return (
    <>
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
        showAddDataModal={onShowAddDataModal}
        updateTableColor={onUpdateTableColor}
        removeDataset={onRemoveDataset}
        showDeleteDataset={showDeleteDataset ?? true}
        uiStateActions={keplerActions.uiStateActions}
        visStateActions={keplerActions.visStateActions}
        mapStateActions={keplerActions.mapStateActions}
      />
    </>
  );
};

const KeplerFilterManager: React.FC<{mapId: string}> = ({mapId}) => {
  const {keplerActions, keplerState} = useKeplerStateActions({mapId});
  const {onRemoveDataset, onShowAddDataModal, onUpdateTableColor} =
    useSidePanelActions(keplerActions);

  return (
    <FilterManager
      filters={keplerState?.visState.filters || []}
      datasets={keplerState?.visState.datasets || {}}
      layers={keplerState?.visState.layers || []}
      showAddDataModal={onShowAddDataModal}
      updateTableColor={onUpdateTableColor}
      //   showDatasetTable={showDatasetTable}
      removeDataset={onRemoveDataset}
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
  const {toggleModal} = keplerActions.uiStateActions;
  const onShowAddMapStyleModal = useCallback(
    () => toggleModal(ADD_MAP_STYLE_ID),
    [toggleModal],
  );

  return (
    <MapManager
      mapStyle={keplerState?.mapStyle}
      mapStyleActions={keplerActions.mapStyleActions}
      showAddMapStyleModal={onShowAddMapStyleModal}
      panelMetadata={mapPanelMetadata}
    />
  );
};

type KeplerSidePanelProps = {
  mapId: string;
  panelId: 'layer' | 'filter' | 'interaction' | 'map';
  showDeleteDataset?: boolean;
};
export const KeplerSidePanels: React.FC<KeplerSidePanelProps> = ({
  mapId,
  panelId,
  showDeleteDataset,
}) => {
  const {keplerState} = useKeplerStateActions({mapId});

  return (
    <KeplerProvider mapId={mapId}>
      <DndContext visState={keplerState?.visState}>
        <div>
          {panelId === 'layer' ? (
            <KeplerLayerManager
              mapId={mapId}
              showDeleteDataset={showDeleteDataset}
            />
          ) : null}
          {panelId === 'filter' ? <KeplerFilterManager mapId={mapId} /> : null}
          {panelId === 'interaction' ? (
            <KeplerInteractionManager mapId={mapId} />
          ) : null}
          {panelId === 'map' ? <KeplerBasemapManager mapId={mapId} /> : null}
        </div>
      </DndContext>
    </KeplerProvider>
  );
};
