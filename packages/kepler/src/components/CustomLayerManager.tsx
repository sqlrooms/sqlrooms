import React, {useCallback, useMemo, useRef, useState} from 'react';
import {useIntl} from 'react-intl';
import styled from 'styled-components';

import {
  Accessor,
  Button,
  Icons,
  LayerListFactory,
  DatasetLayerGroupFactory,
  PanelTitleFactory,
  SidePanelSection,
  Typeahead,
} from '@kepler.gl/components';
import {PANEL_VIEW_TOGGLES, SIDEBAR_PANELS} from '@kepler.gl/constants';
import {LayerClassesType} from '@kepler.gl/layers';
import {getApplicationConfig} from '@kepler.gl/utils';

import {getKeplerFactory} from './KeplerInjector';
import {
  KeplerActions,
  useKeplerStateActions,
} from '../hooks/useKeplerStateActions';
import {useStoreWithKepler} from '../KeplerSlice';
import {RGBColor} from '@kepler.gl/types';

const LayerList = getKeplerFactory(LayerListFactory);
const DatasetLayerGroup = getKeplerFactory(DatasetLayerGroupFactory);
const PanelTitle = getKeplerFactory(PanelTitleFactory);

const layerPanelMetadata = SIDEBAR_PANELS.find((p) => p.id === 'layer');

const CustomLayerManagerContainer = styled.div`
  .layer-manager-title {
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

const DropdownWrapper = styled.div`
  position: relative;
  display: inline-block;
  overflow: visible;
`;

const DropdownMenu = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 240px;
  max-width: 240px;
  position: fixed;
  z-index: 100;

  .list-selector {
    border-top: 1px solid ${(props) => props.theme.secondaryInputBorderColor};
    width: 100%;
    max-height: unset;
  }
  .list__item > div {
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
    line-height: 18px;
    padding: 0;
  }
`;

const ListItemWrapper = styled.div`
  display: flex;
  color: ${(props) => props.theme.textColor};
  font-size: 11px;
  letter-spacing: 0.2px;
  overflow: auto;
  .table-name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

const TYPEAHEAD_CLASS = 'typeahead';
const TYPEAHEAD_INPUT_CLASS = 'typeahead__input';

type TableOption = {label: string; value: string};

const TableListItem: React.FC<{value: TableOption}> = ({value}) => (
  <ListItemWrapper>
    <div className="table-name" title={value.label}>
      {value.label}
    </div>
  </ListItemWrapper>
);

/**
 * Dropdown button that lists available datasets and DuckDB tables.
 * When a table is selected, it is synced to Kepler on demand and a new
 * layer is created for it.
 */
const AddTableLayerButton: React.FC<{
  onAdd: (tableName: string) => Promise<void>;
  keplerDatasetIds: string[];
  disabled?: boolean;
}> = ({onAdd, keplerDatasetIds, disabled}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{top: number; right: number}>({
    top: 0,
    right: 0,
  });
  const intl = useIntl();

  const dbTables = useStoreWithKepler((state) => state.db.tables);

  const options: TableOption[] = useMemo(() => {
    const tableNames = new Set(
      dbTables
        .filter((t) => t.table.schema === 'main')
        .map((t) => t.table.table),
    );
    for (const id of keplerDatasetIds) {
      tableNames.add(id);
    }
    return Array.from(tableNames)
      .sort()
      .map((name) => ({label: name, value: name}));
  }, [dbTables, keplerDatasetIds]);

  const handleClick = useCallback(async () => {
    if (options.length === 1 && options[0]) {
      setIsAdding(true);
      try {
        await onAdd(options[0].value);
      } catch (e) {
        console.error('Failed to add layer:', e);
      } finally {
        setIsAdding(false);
      }
      return;
    }
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom,
        right: window.innerWidth - rect.right,
      });
    }
    setIsOpen((prev) => !prev);
  }, [options, onAdd]);

  const handleSelect = useCallback(
    (option: TableOption | null) => {
      if (!option) return;
      setIsAdding(true);
      onAdd(option.value)
        .then(() => setIsOpen(false))
        .catch((e) => console.error('Failed to add layer:', e))
        .finally(() => setIsAdding(false));
    },
    [onAdd],
  );

  // Close dropdown on outside click
  React.useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <DropdownWrapper ref={dropdownRef}>
      <Button
        ref={buttonRef}
        className="add-layer-button"
        onClick={handleClick}
        disabled={!options.length || disabled || isAdding}
      >
        <Icons.Add height="12px" />
        {intl.formatMessage({id: 'layerManager.addLayer'})}
      </Button>
      {isOpen && options.length > 1 && (
        <DropdownMenu style={{top: menuPos.top, right: menuPos.right}}>
          <Typeahead
            className={TYPEAHEAD_CLASS}
            customClasses={{
              results: 'list-selector',
              input: TYPEAHEAD_INPUT_CLASS,
              listItem: 'list__item',
            }}
            placeholder={
              intl ? intl.formatMessage({id: 'placeholder.search'}) : 'Search'
            }
            selectedItems={null}
            options={options}
            displayOption={Accessor.generateOptionToStringFor('label')}
            filterOption={'label'}
            searchable
            onOptionSelected={handleSelect}
            customListItemComponent={TableListItem}
          />
        </DropdownMenu>
      )}
    </DropdownWrapper>
  );
};

type CustomLayerManagerProps = {
  mapId: string;
  showDeleteDataset?: boolean;
};

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
  const addTableToMap = useStoreWithKepler(
    (state) => state.kepler.addTableToMap,
  );

  const {onRemoveDataset, onUpdateTableColor} =
    useCustomSidePanelActions(keplerActions);

  const {addLayer} = keplerActions.visStateActions;

  const keplerDatasetIds = useMemo(
    () => Object.keys(keplerState?.visState.datasets ?? {}),
    [keplerState?.visState.datasets],
  );

  const onAddTableLayer = useCallback(
    async (tableName: string) => {
      const keplerDatasets = keplerState?.visState.datasets;
      if (!keplerDatasets?.[tableName]) {
        await addTableToMap(mapId, tableName, {
          autoCreateLayers: true,
          centerMap: true,
        });
      } else {
        addLayer(undefined, tableName);
      }
    },
    [addLayer, addTableToMap, keplerState?.visState.datasets, mapId],
  );

  const isSortByDatasetMode =
    keplerState?.uiState.layerPanelListView === PANEL_VIEW_TOGGLES.byDataset;

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
            <AddTableLayerButton
              onAdd={onAddTableLayer}
              keplerDatasetIds={keplerDatasetIds}
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
