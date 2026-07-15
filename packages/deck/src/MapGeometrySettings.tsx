import {FC, useCallback} from 'react';
import {getTableIdentity, TableColumn, type DataTable} from '@sqlrooms/duckdb';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sqlrooms/ui';
import type {DeckMapConfig, DeckMapDatasetConfig} from './mapConfig';
import {
  DeckMapColumnSelector as ColumnSelector,
  DeckMapColumnsProvider as ColumnsProvider,
  DeckMapSettingsField as Field,
} from './MapSettingsControls';
import {regenerateMapConfigForTable} from './mapConfigUtils';
import {setDeckMapLayerGeometryColumn} from './mapLayerConfigUtils';

type GeometryMode = 'latlong' | 'wkb';

export interface MapGeometrySettingsProps {
  mapConfig: DeckMapConfig;
  activeLayerIndex: number;
  activeLayerDatasetId?: string;
  activeLayerDataset?: DeckMapDatasetConfig;
  sourceDataTable: DataTable;
  sourceColumns: TableColumn[];
  outputColumns: TableColumn[];
  onConfigChange: (config: DeckMapConfig) => void;
  readOnly?: boolean;
}

export const MapGeometrySettings: FC<MapGeometrySettingsProps> = ({
  mapConfig,
  activeLayerIndex,
  activeLayerDatasetId,
  activeLayerDataset,
  sourceDataTable,
  sourceColumns,
  outputColumns,
  onConfigChange,
  readOnly,
}) => {
  const geometryMode: GeometryMode =
    mapConfig.fitToData?.latitudeColumn && mapConfig.fitToData?.longitudeColumn
      ? 'latlong'
      : activeLayerDataset?.geometryColumn &&
          activeLayerDataset?.geometryEncodingHint === 'wkb'
        ? 'wkb'
        : 'latlong';

  const handleGeometryModeChange = useCallback(
    (value: string) => {
      if (value === 'wkb') {
        // Switch to WKB mode - regenerate config with geometry column
        const geometryColumn = activeLayerDataset?.geometryColumn ?? 'geom';
        onConfigChange({
          ...mapConfig,
          datasets: {
            ...mapConfig.datasets,
            [activeLayerDatasetId ?? '']: {
              ...activeLayerDataset,
              geometryColumn,
              geometryEncodingHint: 'wkb',
              source: {
                tableName:
                  sourceDataTable.tableName ??
                  getTableIdentity(sourceDataTable.table),
              },
            },
          },
          fitToData: {
            dataset: activeLayerDatasetId ?? '',
            geometryColumn,
            ...(mapConfig.fitToData?.padding !== undefined && {
              padding: mapConfig.fitToData.padding,
            }),
            ...(mapConfig.fitToData?.maxZoom !== undefined && {
              maxZoom: mapConfig.fitToData.maxZoom,
            }),
          },
        });
      } else {
        // Switch to lat/long mode
        const latitudeColumn = mapConfig.fitToData?.latitudeColumn;
        const longitudeColumn = mapConfig.fitToData?.longitudeColumn;
        onConfigChange(
          regenerateMapConfigForTable(
            {config: mapConfig},
            sourceDataTable,
            longitudeColumn,
            latitudeColumn,
          ) as DeckMapConfig,
        );
      }
    },
    [
      mapConfig,
      activeLayerDatasetId,
      activeLayerDataset,
      sourceDataTable,
      onConfigChange,
    ],
  );

  const handleGeometryColumnChange = useCallback(
    (geometryColumn: string) => {
      onConfigChange(
        setDeckMapLayerGeometryColumn(
          mapConfig,
          activeLayerIndex,
          geometryColumn,
        ),
      );
    },
    [mapConfig, activeLayerIndex, onConfigChange],
  );

  const handleLatitudeColumnChange = useCallback(
    (latitudeColumn: string) => {
      const longitudeColumn = mapConfig.fitToData?.longitudeColumn;
      onConfigChange(
        regenerateMapConfigForTable(
          {config: mapConfig},
          sourceDataTable,
          longitudeColumn,
          latitudeColumn,
        ) as DeckMapConfig,
      );
    },
    [mapConfig, sourceDataTable, onConfigChange],
  );

  const handleLongitudeColumnChange = useCallback(
    (longitudeColumn: string) => {
      const latitudeColumn = mapConfig.fitToData?.latitudeColumn;
      onConfigChange(
        regenerateMapConfigForTable(
          {config: mapConfig},
          sourceDataTable,
          longitudeColumn,
          latitudeColumn,
        ) as DeckMapConfig,
      );
    },
    [mapConfig, sourceDataTable, onConfigChange],
  );

  return (
    <>
      <Field label="Geometry type">
        <Select
          value={geometryMode}
          onValueChange={handleGeometryModeChange}
          disabled={readOnly}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select geometry type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="latlong">Latitude / Longitude</SelectItem>
            <SelectItem value="wkb">Geometry Column (WKB)</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      {geometryMode === 'wkb' ? (
        <ColumnsProvider columns={outputColumns}>
          <Field label="Geometry column" required>
            <ColumnSelector.Geometry
              value={activeLayerDataset?.geometryColumn}
              onChange={handleGeometryColumnChange}
              placeholder="Select geometry column..."
              disabled={readOnly}
            />
          </Field>
        </ColumnsProvider>
      ) : (
        <ColumnsProvider columns={sourceColumns}>
          <Field label="Latitude column" required>
            <ColumnSelector.Numeric
              value={mapConfig.fitToData?.latitudeColumn}
              onChange={handleLatitudeColumnChange}
              disabled={readOnly}
            />
          </Field>
          <Field label="Longitude column" required>
            <ColumnSelector.Numeric
              value={mapConfig.fitToData?.longitudeColumn}
              onChange={handleLongitudeColumnChange}
              disabled={readOnly}
            />
          </Field>
        </ColumnsProvider>
      )}
    </>
  );
};
