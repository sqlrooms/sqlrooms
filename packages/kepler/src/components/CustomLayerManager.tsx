import React, {useCallback, useMemo} from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import {
  LayerListFactory,
  DatasetLayerGroupFactory,
  PanelTitleFactory,
  AddLayerButtonFactory,
  SidePanelSection,
} from '@kepler.gl/components';
import {PANEL_VIEW_TOGGLES, SIDEBAR_PANELS} from '@kepler.gl/constants';
import {LayerClassesType} from '@kepler.gl/layers';
import {getApplicationConfig} from '@kepler.gl/utils';

import {getKeplerFactory} from './KeplerInjector';
import {
  KeplerActions,
  useKeplerStateActions,
} from '../hooks/useKeplerStateActions';
import {RGBColor} from '@kepler.gl/types';

// Get the kepler.gl components through the injector
const LayerList = getKeplerFactory(LayerListFactory);
const DatasetLayerGroup = getKeplerFactory(DatasetLayerGroupFactory);
const PanelTitle = getKeplerFactory(PanelTitleFactory);
const AddLayerButton = getKeplerFactory(AddLayerButtonFactory);

const layerPanelMetadata = SIDEBAR_PANELS.find((p) => p.id === 'layer');

// Custom styled components for your layer manager
const CustomLayerManagerContainer = styled.div`
  .layer-manager {
    /* Add your custom styles here */
  }
  
  .layer-manager-title {
    /* Custom title styling */
  }

  .add-layer-button {
    background-color: ${(props) => props.theme.sidePanelBg || props.theme.panelBackground};
    color: #2563EB; 
    border: 0px;
    height: 28px;
    font-weight: 500;
    font-size: 14px;
  }

  .layer__title__type {
    display: none !important;
  }

  .layer-panel__header {
    height: 36px;
  }

  .layer__title {
    min-width: 0;
  }

  .layer__title > div {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .layer__title__editor {
    width: 100%;
    min-width: 0;
    flex: 1;
  }
}
`;

type CustomLayerManagerProps = {
  mapId: string;
  showDeleteDataset?: boolean;
};

// Custom hook for side panel actions
function useCustomSidePanelActions(keplerActions: KeplerActions) {
  const {openDeleteModal, toggleModal} = keplerActions.uiStateActions;
  const {updateTableColor} = keplerActions.visStateActions;

  const onRemoveDataset = useCallback(
    (dataId: string) => openDeleteModal(dataId),
    [openDeleteModal],
  );

  const onShowAddDataModal = useCallback(
    () => toggleModal('addData'),
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

// Main Custom Layer Manager Component
export const CustomLayerManager: React.FC<CustomLayerManagerProps> = ({
  mapId,
  showDeleteDataset = true,
}) => {
  const {keplerActions, keplerState} = useKeplerStateActions({mapId});
  const intl = useIntl();

  const {onRemoveDataset, onUpdateTableColor} =
    useCustomSidePanelActions(keplerActions);

  const {addLayer} = keplerActions.visStateActions;

  const onAddLayer = useCallback(
    (dataset: string) => {
      addLayer(undefined, dataset);
    },
    [addLayer],
  );

  const isSortByDatasetMode =
    keplerState?.uiState.layerPanelListView === PANEL_VIEW_TOGGLES.byDataset;

  // Filter layer classes based on application config
  const enableRasterTileLayer = getApplicationConfig().enableRasterTileLayer;
  const enableWMSLayer = getApplicationConfig().enableWMSLayer;

  const filteredLayerClasses = useMemo(() => {
    let filteredClasses = keplerState?.visState.layerClasses || {};
    if (!enableRasterTileLayer && 'rasterTile' in filteredClasses) {
      const {rasterTile: _rasterTile, ...rest} = filteredClasses;
      filteredClasses = rest as LayerClassesType;
    }
    if (!enableWMSLayer && 'wms' in filteredClasses) {
      const {wms: _wms, ...rest} = filteredClasses;
      filteredClasses = rest as LayerClassesType;
    }
    return filteredClasses as LayerClassesType;
  }, [
    enableRasterTileLayer,
    enableWMSLayer,
    keplerState?.visState.layerClasses,
  ]);

  if (!keplerState || !keplerActions) {
    return null;
  }

  return (
    <CustomLayerManagerContainer>
      <div className="layer-manager">
        <SidePanelSection>
          <PanelTitle
            className="layer-manager-title"
            title={intl.formatMessage({
              id: layerPanelMetadata?.label || 'Layers',
            })}
          >
            <AddLayerButton
              datasets={keplerState.visState.datasets}
              onAdd={onAddLayer}
            />
          </PanelTitle>
        </SidePanelSection>

        <SidePanelSection>
          {isSortByDatasetMode ? (
            <DatasetLayerGroup
              datasets={keplerState.visState.datasets}
              showDatasetTable={keplerActions.visStateActions.showDatasetTable}
              layers={keplerState.visState.layers}
              updateTableColor={onUpdateTableColor}
              removeDataset={onRemoveDataset}
              layerOrder={keplerState.visState.layerOrder}
              layerClasses={filteredLayerClasses}
              uiStateActions={keplerActions.uiStateActions}
              visStateActions={keplerActions.visStateActions}
              mapStateActions={keplerActions.mapStateActions}
              showDeleteDataset={showDeleteDataset}
            />
          ) : (
            <LayerList
              layers={keplerState.visState.layers}
              datasets={keplerState.visState.datasets}
              layerOrder={keplerState.visState.layerOrder}
              uiStateActions={keplerActions.uiStateActions}
              visStateActions={keplerActions.visStateActions}
              mapStateActions={keplerActions.mapStateActions}
              layerClasses={filteredLayerClasses}
            />
          )}
        </SidePanelSection>
      </div>
    </CustomLayerManagerContainer>
  );
};
