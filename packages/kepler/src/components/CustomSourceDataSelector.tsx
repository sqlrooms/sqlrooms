import {FormattedMessage} from '@kepler.gl/localization';
import {
  PanelLabel,
  SidePanelSection,
  SourceDataSelectorFactory,
  SourceDataSelectorProps,
} from '@kepler.gl/components';
import React, {useCallback, useMemo, useState} from 'react';
import {
  buildKeplerTableLayerOptions,
  findKeplerTableForDatasetId,
  getKeplerTableLabel,
} from '../keplerTableSelection';
import {useStoreWithKepler} from '../KeplerSlice';

const UNLOADED_TABLE_COLOR: [number, number, number] = [143, 149, 161];

type SourceDataSelectorValue = Parameters<
  SourceDataSelectorProps['onSelect']
>[0];
type SelectableDataset = SourceDataSelectorProps['datasets'][string];
type SourceDataSelectorContent = React.ComponentType<SourceDataSelectorProps>;
type CustomSourceDataSelectorProps = SourceDataSelectorProps & {
  id?: string;
};

function getTableKey(
  table: ReturnType<typeof findKeplerTableForDatasetId>,
): string | undefined {
  if (!table) {
    return undefined;
  }

  return [
    table.table.database ?? '',
    table.table.schema ?? '',
    table.table.table,
  ].join('.');
}

function getSelectedDatasetId(
  value: SourceDataSelectorValue,
): string | undefined {
  if (value === null) {
    return undefined;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return undefined;
    }
    return getSelectedDatasetId(value[0] as SourceDataSelectorValue);
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (typeof value === 'boolean') {
    return String(value);
  }

  if (typeof value === 'object') {
    const option = value as {id?: unknown; value?: unknown};
    if (typeof option.value === 'string') {
      return option.value;
    }
    if (typeof option.id === 'string') {
      return option.id;
    }
  }

  return undefined;
}

/**
 * Kepler uses the same SourceDataSelector in layer config and filter config.
 * Layer config passes a layer id, so only that version is augmented with
 * SQLRooms table options. Filter selectors keep Kepler's native dataset-only
 * behavior because a filter needs a loaded dataset to expose fields.
 */
export function CustomSourceDataSelectorFactory(
  DataSourceSelectorContent: SourceDataSelectorContent,
): React.FC<CustomSourceDataSelectorProps> {
  const SourceDataSelector: React.FC<CustomSourceDataSelectorProps> = ({
    dataId,
    datasets,
    disabled,
    onSelect,
    defaultValue = 'Select A Dataset',
    inputTheme,
    className,
    id: layerId,
  }) => {
    const [isLoadingTable, setIsLoadingTable] = useState(false);
    const dbTables = useStoreWithKepler((state) => state.db.tables);
    const tableSelection = useStoreWithKepler(
      (state) => state.kepler.tableSelection,
    );
    const addTableToMap = useStoreWithKepler(
      (state) => state.kepler.addTableToMap,
    );
    const mapId = useStoreWithKepler((state) => {
      if (!layerId) {
        return undefined;
      }

      for (const [candidateMapId, mapState] of Object.entries(
        state.kepler.map,
      )) {
        const hasLayer = mapState?.visState?.layers?.some(
          (layer: {id?: string}) => layer.id === layerId,
        );
        if (hasLayer) {
          return candidateMapId;
        }
      }

      return undefined;
    });
    const mapDatasets = useStoreWithKepler((state) => {
      if (!mapId) {
        return undefined;
      }

      return state.kepler.map[mapId]?.visState.datasets;
    });
    const loadedDatasetIds = useMemo(
      () => Object.keys(mapDatasets ?? datasets),
      [datasets, mapDatasets],
    );

    const selectorDatasets = useMemo(() => {
      if (!layerId || !mapId) {
        return datasets;
      }

      const tableOptions = buildKeplerTableLayerOptions(
        dbTables,
        loadedDatasetIds,
        tableSelection,
      );
      const nextDatasets: Record<string, SelectableDataset> = {};
      const loadedTableKeys = new Set<string>();

      for (const [datasetId, dataset] of Object.entries(datasets)) {
        const table = findKeplerTableForDatasetId(
          dbTables,
          datasetId,
          tableSelection,
        );
        const tableKey = getTableKey(table);
        if (table && tableKey) {
          loadedTableKeys.add(tableKey);
          nextDatasets[datasetId] = {
            ...dataset,
            label: getKeplerTableLabel(table, tableSelection),
          };
        } else {
          nextDatasets[datasetId] = dataset;
        }
      }

      for (const option of tableOptions) {
        const table = findKeplerTableForDatasetId(
          dbTables,
          option.value,
          tableSelection,
        );
        if (!table) {
          continue;
        }

        const tableKey = getTableKey(table);
        if (tableKey && loadedTableKeys.has(tableKey)) {
          continue;
        }

        if (nextDatasets[option.value]) {
          continue;
        }

        nextDatasets[option.value] = {
          id: option.value,
          label: option.label,
          color: UNLOADED_TABLE_COLOR,
        };
      }

      return nextDatasets;
    }, [datasets, dbTables, layerId, loadedDatasetIds, mapId, tableSelection]);

    const handleSelect = useCallback(
      (value: SourceDataSelectorValue) => {
        const selectedDatasetId = getSelectedDatasetId(value);
        if (!selectedDatasetId || !layerId || !mapId) {
          onSelect(value);
          return;
        }

        if (loadedDatasetIds.includes(selectedDatasetId)) {
          onSelect(selectedDatasetId);
          return;
        }

        setIsLoadingTable(true);
        void addTableToMap(mapId, selectedDatasetId, {
          autoCreateLayers: false,
          centerMap: false,
        })
          .then(() => {
            onSelect(selectedDatasetId);
          })
          .catch((e) => {
            console.error('Failed to load layer data source:', e);
          })
          .finally(() => {
            setIsLoadingTable(false);
          });
      },
      [addTableToMap, layerId, loadedDatasetIds, mapId, onSelect],
    );

    const isDisabled = Boolean(disabled || isLoadingTable);

    return (
      <SidePanelSection className="data-source-selector">
        <PanelLabel>
          <FormattedMessage id="misc.dataSource" />
        </PanelLabel>
        <DataSourceSelectorContent
          className={className}
          inputTheme={inputTheme}
          datasets={selectorDatasets}
          dataId={dataId}
          onSelect={handleSelect}
          defaultValue={defaultValue}
          disabled={isDisabled}
        />
      </SidePanelSection>
    );
  };

  SourceDataSelector.displayName = 'CustomSourceDataSelector';
  return SourceDataSelector;
}

CustomSourceDataSelectorFactory.deps = SourceDataSelectorFactory.deps;
