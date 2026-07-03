import {FC, useCallback, useMemo, useState} from 'react';
import {
  CodeViewToggleButton,
  Field,
  ColumnSelector,
  ColumnsProvider,
  MosaicCodeViewerPanel,
  useStoreWithMosaicDashboard,
  DataTableSelector,
  useTablesWithColumns,
} from '@sqlrooms/mosaic';
import {getTableIdentity, useDataTable, type DataTable} from '@sqlrooms/duckdb';
import type {MosaicDashboardPanelConfigType} from '@sqlrooms/mosaic';
import {
  binnedNumericSchemes,
  categoricalSchemes,
  continuousDivergingSchemes,
  continuousSequentialSchemes,
  continuousSequentialInterpolators,
  parseColorString,
} from '@sqlrooms/color-scales';
import type {ColorScaleConfig, ColorScaleScheme} from '@sqlrooms/color-scales';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Slider,
  ScrollArea,
  SettingsPanelHeader,
  Switch,
} from '@sqlrooms/ui';
import {LatitudeSelector} from './LatitudeSelector';
import {LongitudeSelector} from './LongitudeSelector';
import {
  isDeckMapDashboardSqlDatasetSource,
  isDeckMapDashboardTableDatasetSource,
  type DeckMapDashboardPanelConfig,
} from './dashboardConfig';
import {
  clearDeckMapLayerColorScale,
  createDeckMapLayerColorScale,
  DECK_MAP_COLOR_SCALE_TYPE_OPTIONS,
  DECK_MAP_LAYER_TYPE_OPTIONS,
  getDeckMapColorAccessorOptions,
  getDeckMapLayerDatasetId,
  getDeckMapLayerColorScale,
  getDeckMapLayerRecords,
  setDeckMapLayerColorScale,
  setDeckMapLayerGeometryColumn,
  setDeckMapLayerHexagonColumn,
  setDeckMapLayerArcColumns,
  setDeckMapLayerType,
  updateDeckMapLayer,
  type DeckMapLayerColorAccessor,
  type DeckMapLayerRecord,
  usesGeometryColumnSetting,
  usesH3ColumnSetting,
  usesArcColumnSetting,
  usesRadiusSetting,
  usesColumnRadiusSetting,
  usesTripsSettings,
  usesExtrusionSettings,
} from './mapLayerConfigUtils';

/**
 * Extracts the primary table name from a simple SQL query.
 * Handles patterns like: `SELECT ... FROM tableName ...`
 * and `SELECT ... FROM "tableName" ...`
 */
function extractTableFromSqlQuery(
  sqlQuery: string | undefined,
): string | undefined {
  if (!sqlQuery) return undefined;
  const match = sqlQuery.match(/\bFROM\s+(?:"([^"]+)"|(\w[\w.]*))/i);
  return match?.[1] ?? match?.[2];
}

const HEATMAP_COLOR_STEPS = 6;

function schemeToColorRange(
  scheme: string,
): Array<[number, number, number, number]> {
  const interpolator =
    continuousSequentialInterpolators[
      scheme as keyof typeof continuousSequentialInterpolators
    ];
  if (!interpolator) {
    return continuousSequentialInterpolators.Viridis
      ? Array.from({length: HEATMAP_COLOR_STEPS}, (_, i) =>
          parseColorString(
            continuousSequentialInterpolators.Viridis(
              i / (HEATMAP_COLOR_STEPS - 1),
            ),
          ),
        )
      : [];
  }
  return Array.from({length: HEATMAP_COLOR_STEPS}, (_, i) =>
    parseColorString(interpolator(i / (HEATMAP_COLOR_STEPS - 1))),
  );
}

function detectHeatmapScheme(colorRange: unknown): string {
  if (!Array.isArray(colorRange) || colorRange.length === 0) return 'Viridis';
  for (const scheme of continuousSequentialSchemes) {
    const sampled = schemeToColorRange(scheme);
    if (sampled.length === colorRange.length) {
      const matches = sampled.every((color, idx) => {
        const actual = colorRange[idx];
        if (!Array.isArray(actual)) return false;
        return (
          Math.abs(color[0] - actual[0]) < 2 &&
          Math.abs(color[1] - actual[1]) < 2 &&
          Math.abs(color[2] - actual[2]) < 2
        );
      });
      if (matches) return scheme;
    }
  }
  return 'Viridis';
}

interface MapSettingsPanelProps {
  dashboardId: string;
  panel: MosaicDashboardPanelConfigType;
  onClose?: () => void;
  onTableChange?: (table: DataTable) => void;
  onTitleChange?: (title: string) => void;
  readOnly?: boolean;
}

function getSchemeOptions(type: ColorScaleConfig['type']) {
  if (type === 'categorical') {
    return categoricalSchemes;
  }
  if (type === 'diverging') {
    return continuousDivergingSchemes;
  }
  if (type === 'sequential') {
    return continuousSequentialSchemes;
  }
  return binnedNumericSchemes;
}

export const MapSettingsPanel: FC<MapSettingsPanelProps> = ({
  dashboardId,
  panel,
  onClose,
  onTableChange,
  onTitleChange,
  readOnly,
}) => {
  const [layerIndex, setLayerIndex] = useState(0);
  const [colorAccessor, setColorAccessor] =
    useState<DeckMapLayerColorAccessor>('getFillColor');
  const [viewMode, setViewMode] = useState<'settings' | 'code'>('settings');

  const dashboardSelectedTable = useStoreWithMosaicDashboard(
    (state) =>
      state.mosaicDashboard.config.dashboardsById[dashboardId]?.selectedTable,
  );

  const updatePanel = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.updatePanel,
  );

  const setSelectedTable = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.setSelectedTable,
  );

  const tables = useTablesWithColumns();
  const selectedDataTable = useDataTable(dashboardSelectedTable);

  const handleTableChange = useCallback(
    (table: DataTable) => {
      if (readOnly) return;
      if (onTableChange) {
        onTableChange(table);
      } else {
        setSelectedTable(dashboardId, getTableIdentity(table.table));
      }
    },
    [dashboardId, onTableChange, readOnly, setSelectedTable],
  );

  const mapConfig = panel.config as DeckMapDashboardPanelConfig;
  const serializedMapConfig = useMemo(
    () => JSON.stringify(panel.config, null, 2),
    [panel.config],
  );
  const showCode = viewMode === 'code';
  const layers = getDeckMapLayerRecords(mapConfig);
  const activeLayerIndex = Math.min(layerIndex, Math.max(layers.length - 1, 0));
  const activeLayer = layers[activeLayerIndex];
  const activeLayerDatasetId = getDeckMapLayerDatasetId(activeLayer);
  const activeLayerDataset = activeLayerDatasetId
    ? mapConfig.datasets?.[activeLayerDatasetId]
    : undefined;

  // Resolve the table for column listing: prefer the dashboard's selected
  // table (which represents the user's active choice), falling back to the
  // dataset's explicit source table when no dashboard table is selected.
  const activeLayerDatasetSource = activeLayerDataset?.source;
  const fallbackTableName = isDeckMapDashboardTableDatasetSource(
    activeLayerDatasetSource,
  )
    ? activeLayerDatasetSource.tableName
    : isDeckMapDashboardSqlDatasetSource(activeLayerDatasetSource)
      ? extractTableFromSqlQuery(activeLayerDatasetSource.sqlQuery)
      : undefined;
  const fallbackTable = useDataTable(fallbackTableName);
  const dataTable = selectedDataTable ?? fallbackTable;

  const showGeometryColumnSetting = usesGeometryColumnSetting(
    activeLayer?.['@@type'],
  );
  const showH3ColumnSetting = usesH3ColumnSetting(activeLayer?.['@@type']);
  const showArcColumnSetting = usesArcColumnSetting(activeLayer?.['@@type']);
  const showRadiusSetting = usesRadiusSetting(activeLayer?.['@@type']);
  const showColumnRadiusSetting = usesColumnRadiusSetting(
    activeLayer?.['@@type'],
  );
  const showTripsSettings = usesTripsSettings(activeLayer?.['@@type']);
  const showExtrusionSettings = usesExtrusionSettings(activeLayer?.['@@type']);
  const colorAccessorOptions = getDeckMapColorAccessorOptions(
    activeLayer?.['@@type'],
  );
  const effectiveColorAccessor =
    colorAccessorOptions.find((option) => option.value === colorAccessor)
      ?.value ?? colorAccessorOptions[0]?.value;
  const pointRadiusPixels =
    activeLayer?.radiusUnits === 'pixels' &&
    typeof activeLayer?.getRadius === 'number'
      ? activeLayer.getRadius
      : ((activeLayer?.radiusMinPixels as number | undefined) ?? 2);
  const colorScale = effectiveColorAccessor
    ? getDeckMapLayerColorScale(activeLayer, effectiveColorAccessor)
    : undefined;
  const colorScaleType = colorScale?.type ?? 'sequential';
  const schemeOptions = getSchemeOptions(colorScaleType);
  const isHeatmapLayer = activeLayer?.['@@type'] === 'GeoArrowHeatmapLayer';
  const firstColumnName = dataTable?.columns[0]?.name;

  const applyConfig = useCallback(
    (config: DeckMapDashboardPanelConfig) => {
      if (readOnly) return;
      updatePanel(dashboardId, panel.id, {
        config: {...config, settingsOpen: mapConfig.settingsOpen} as any,
      });
    },
    [dashboardId, mapConfig.settingsOpen, panel.id, readOnly, updatePanel],
  );

  const updateColorScale = (patch: {
    field?: string;
    type?: ColorScaleConfig['type'];
    scheme?: ColorScaleScheme;
  }) => {
    const field = patch.field ?? colorScale?.field ?? firstColumnName;
    if (!field || !effectiveColorAccessor) return;

    const type = patch.type ?? colorScale?.type ?? 'sequential';
    const scheme =
      patch.scheme ??
      (patch.type && patch.type !== colorScale?.type
        ? undefined
        : colorScale?.scheme);

    applyConfig(
      setDeckMapLayerColorScale(
        mapConfig,
        activeLayerIndex,
        effectiveColorAccessor,
        createDeckMapLayerColorScale({
          field,
          type,
          scheme,
          title: field,
        }),
      ),
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SettingsPanelHeader
        className="shrink-0 p-2"
        actions={
          <CodeViewToggleButton
            label={showCode ? 'Show settings' : 'View code'}
            selected={showCode}
            onClick={() =>
              setViewMode((currentViewMode) =>
                currentViewMode === 'code' ? 'settings' : 'code',
              )
            }
          />
        }
        onClose={onClose}
        closeLabel="Close map settings"
      />

      {showCode ? (
        <MosaicCodeViewerPanel
          value={serializedMapConfig}
          copyTooltipLabel="Copy map config"
        />
      ) : (
        <ScrollArea className="min-h-0 flex-1 [&_[data-radix-scroll-area-viewport]>div]:!block">
          <div className="flex flex-col gap-2 p-2 pt-0">
            <Field label="Title">
              <input
                value={panel.title}
                onChange={(e) => onTitleChange?.(e.target.value)}
                placeholder="Map title"
                disabled={readOnly}
                className="border-input placeholder:text-muted-foreground focus-visible:ring-ring h-8 w-full rounded-md border bg-transparent px-3 py-2 text-xs font-medium shadow-sm outline-hidden transition-colors focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </Field>

            <Field label="Dataset" required>
              <DataTableSelector
                onChange={handleTableChange}
                tables={tables}
                value={selectedDataTable}
                className="w-full"
                disabled={readOnly}
              />
            </Field>

            {layers.length > 0 && (
              <div className="flex flex-col gap-3">
                {layers.length > 1 && (
                  <Field label="Layer">
                    <Select
                      value={String(activeLayerIndex)}
                      onValueChange={(value) => setLayerIndex(Number(value))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {layers.map((layer, index) => (
                          <SelectItem key={index} value={String(index)}>
                            {String(layer.id ?? `Layer ${index + 1}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Visible</span>
                  <Switch
                    checked={activeLayer?.visible !== false}
                    onCheckedChange={(checked) =>
                      applyConfig(
                        updateDeckMapLayer(
                          mapConfig,
                          activeLayerIndex,
                          (layer) => ({
                            ...layer,
                            visible: checked,
                          }),
                        ),
                      )
                    }
                  />
                </div>

                <Field label="Layer type">
                  <Select
                    value={
                      typeof activeLayer?.['@@type'] === 'string'
                        ? activeLayer['@@type']
                        : undefined
                    }
                    onValueChange={(value) =>
                      applyConfig(
                        setDeckMapLayerType(mapConfig, activeLayerIndex, value),
                      )
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select layer type" />
                    </SelectTrigger>
                    <SelectContent>
                      {DECK_MAP_LAYER_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                {showTripsSettings && (
                  <>
                    <Field
                      label={`Line width: ${(activeLayer?.widthMinPixels as number | undefined) ?? 3}px`}
                    >
                      <Slider
                        min={1}
                        max={20}
                        step={1}
                        value={[
                          (activeLayer?.widthMinPixels as number | undefined) ??
                            3,
                        ]}
                        onValueChange={(values) => {
                          const value = values[0] ?? 3;
                          applyConfig(
                            updateDeckMapLayer(
                              mapConfig,
                              activeLayerIndex,
                              (layer) => ({
                                ...layer,
                                widthMinPixels: value,
                              }),
                            ),
                          );
                        }}
                      />
                    </Field>
                    <Field
                      label={`Trail length: ${Math.round(((activeLayer?._trailLengthFactor as number | undefined) ?? 0.4) * 100)}%`}
                    >
                      <Slider
                        min={5}
                        max={100}
                        step={5}
                        value={[
                          Math.round(
                            ((activeLayer?._trailLengthFactor as
                              | number
                              | undefined) ?? 0.4) * 100,
                          ),
                        ]}
                        onValueChange={(values) => {
                          const value = (values[0] ?? 40) / 100;
                          applyConfig(
                            updateDeckMapLayer(
                              mapConfig,
                              activeLayerIndex,
                              (layer) => ({
                                ...layer,
                                _trailLengthFactor: value,
                              }),
                            ),
                          );
                        }}
                      />
                    </Field>
                  </>
                )}

                {isHeatmapLayer ? (
                  <div className="flex flex-col gap-2 rounded-md border p-2">
                    <span className="text-xs font-medium">
                      Color scheme (density)
                    </span>
                    <Field label="Scheme">
                      <Select
                        value={detectHeatmapScheme(activeLayer?.colorRange)}
                        onValueChange={(value) =>
                          applyConfig(
                            updateDeckMapLayer(
                              mapConfig,
                              activeLayerIndex,
                              (layer) => ({
                                ...layer,
                                colorRange: schemeToColorRange(value),
                              }),
                            ),
                          )
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {continuousSequentialSchemes.map((scheme) => (
                            <SelectItem key={scheme} value={scheme}>
                              {scheme}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 rounded-md border p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium">Color scale</span>
                      <Switch
                        checked={Boolean(colorScale)}
                        onCheckedChange={(checked) => {
                          if (!effectiveColorAccessor) return;
                          if (checked) {
                            updateColorScale({});
                            return;
                          }
                          applyConfig(
                            clearDeckMapLayerColorScale(
                              mapConfig,
                              activeLayerIndex,
                              effectiveColorAccessor,
                            ),
                          );
                        }}
                        disabled={!firstColumnName || !effectiveColorAccessor}
                      />
                    </div>

                    {effectiveColorAccessor && (
                      <Field label="Color property">
                        <Select
                          value={effectiveColorAccessor}
                          onValueChange={(value) =>
                            setColorAccessor(value as DeckMapLayerColorAccessor)
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {colorAccessorOptions.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    )}

                    {colorScale && dataTable && (
                      <ColumnsProvider columns={dataTable.columns}>
                        <Field label="Color field" required>
                          {colorScaleType === 'categorical' ? (
                            <ColumnSelector.Categorical
                              value={colorScale.field}
                              onChange={(field) => updateColorScale({field})}
                            />
                          ) : (
                            <ColumnSelector.Quantitative
                              value={colorScale.field}
                              onChange={(field) => updateColorScale({field})}
                            />
                          )}
                        </Field>
                      </ColumnsProvider>
                    )}

                    {colorScale && (
                      <>
                        <Field label="Scale type">
                          <Select
                            value={colorScaleType}
                            onValueChange={(value) =>
                              updateColorScale({
                                type: value as ColorScaleConfig['type'],
                              })
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DECK_MAP_COLOR_SCALE_TYPE_OPTIONS.map(
                                (option) => (
                                  <SelectItem
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label}
                                  </SelectItem>
                                ),
                              )}
                            </SelectContent>
                          </Select>
                        </Field>

                        <Field label="Scheme">
                          <Select
                            value={colorScale.scheme}
                            onValueChange={(value) =>
                              updateColorScale({
                                scheme: value as ColorScaleScheme,
                              })
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {schemeOptions.map((scheme) => (
                                <SelectItem key={scheme} value={scheme}>
                                  {scheme}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {isHeatmapLayer && (
              <Field
                label={`Radius: ${(activeLayer?.radiusPixels as number | undefined) ?? 30}px`}
              >
                <div className="pt-0.5">
                  <Slider
                    min={1}
                    max={100}
                    step={1}
                    value={[
                      (activeLayer?.radiusPixels as number | undefined) ?? 30,
                    ]}
                    onValueChange={(values) => {
                      const value = values[0] ?? 30;
                      applyConfig(
                        updateDeckMapLayer(
                          mapConfig,
                          activeLayerIndex,
                          (layer) => ({
                            ...layer,
                            radiusPixels: value,
                          }),
                        ),
                      );
                    }}
                  />
                </div>
              </Field>
            )}

            {showRadiusSetting && (
              <Field label={`Point radius: ${pointRadiusPixels}px`}>
                <div className="pt-0.5">
                  <Slider
                    min={1}
                    max={50}
                    step={1}
                    value={[pointRadiusPixels]}
                    onValueChange={(values) => {
                      const value = values[0] ?? 2;
                      applyConfig(
                        updateDeckMapLayer(
                          mapConfig,
                          activeLayerIndex,
                          (layer) => {
                            const nextLayer: DeckMapLayerRecord = {
                              ...layer,
                              radiusMinPixels: value,
                              radiusMaxPixels: Math.max(
                                value,
                                (layer.radiusMaxPixels as number | undefined) ??
                                  value,
                              ),
                            };

                            if (
                              layer.radiusUnits === 'pixels' &&
                              typeof layer.getRadius !== 'string'
                            ) {
                              nextLayer.getRadius = value;
                            }

                            return nextLayer;
                          },
                        ),
                      );
                    }}
                  />
                </div>
              </Field>
            )}

            {showColumnRadiusSetting && (
              <Field
                label={`Column radius: ${(activeLayer?.radius as number | undefined) ?? 50}m`}
              >
                <div className="pt-0.5">
                  <Slider
                    min={1}
                    max={10000}
                    step={1}
                    value={[(activeLayer?.radius as number | undefined) ?? 50]}
                    onValueChange={(values) => {
                      const value = values[0] ?? 50;
                      applyConfig(
                        updateDeckMapLayer(
                          mapConfig,
                          activeLayerIndex,
                          (layer) => ({
                            ...layer,
                            radius: value,
                          }),
                        ),
                      );
                    }}
                  />
                </div>
              </Field>
            )}

            {dataTable && showGeometryColumnSetting && (
              <ColumnsProvider columns={dataTable.columns}>
                <Field label="Geometry column" required>
                  <ColumnSelector
                    value={activeLayerDataset?.geometryColumn}
                    onChange={(geometryColumn) =>
                      applyConfig(
                        setDeckMapLayerGeometryColumn(
                          mapConfig,
                          activeLayerIndex,
                          geometryColumn,
                        ),
                      )
                    }
                    placeholder="Select geometry column..."
                  />
                </Field>
              </ColumnsProvider>
            )}

            {dataTable && showH3ColumnSetting && (
              <ColumnsProvider columns={dataTable.columns}>
                <Field label="H3 column" required>
                  <ColumnSelector
                    value={
                      (activeLayer?._sqlroomsBinding as Record<string, unknown>)
                        ?.hexagonColumn as string | undefined
                    }
                    onChange={(hexagonColumn) =>
                      applyConfig(
                        setDeckMapLayerHexagonColumn(
                          mapConfig,
                          activeLayerIndex,
                          hexagonColumn,
                        ),
                      )
                    }
                    placeholder="Select H3 index column..."
                  />
                </Field>
              </ColumnsProvider>
            )}

            {dataTable && showArcColumnSetting && (
              <ColumnsProvider columns={dataTable.columns}>
                <Field label="Source latitude" required>
                  <ColumnSelector
                    value={
                      (activeLayer?._sqlroomsBinding as Record<string, unknown>)
                        ?.sourceLatitudeColumn as string | undefined
                    }
                    onChange={(sourceLatitudeColumn) =>
                      applyConfig(
                        setDeckMapLayerArcColumns(mapConfig, activeLayerIndex, {
                          sourceLatitudeColumn,
                        }),
                      )
                    }
                    placeholder="Select source latitude..."
                  />
                </Field>
                <Field label="Source longitude" required>
                  <ColumnSelector
                    value={
                      (activeLayer?._sqlroomsBinding as Record<string, unknown>)
                        ?.sourceLongitudeColumn as string | undefined
                    }
                    onChange={(sourceLongitudeColumn) =>
                      applyConfig(
                        setDeckMapLayerArcColumns(mapConfig, activeLayerIndex, {
                          sourceLongitudeColumn,
                        }),
                      )
                    }
                    placeholder="Select source longitude..."
                  />
                </Field>
                <Field label="Target latitude" required>
                  <ColumnSelector
                    value={
                      (activeLayer?._sqlroomsBinding as Record<string, unknown>)
                        ?.targetLatitudeColumn as string | undefined
                    }
                    onChange={(targetLatitudeColumn) =>
                      applyConfig(
                        setDeckMapLayerArcColumns(mapConfig, activeLayerIndex, {
                          targetLatitudeColumn,
                        }),
                      )
                    }
                    placeholder="Select target latitude..."
                  />
                </Field>
                <Field label="Target longitude" required>
                  <ColumnSelector
                    value={
                      (activeLayer?._sqlroomsBinding as Record<string, unknown>)
                        ?.targetLongitudeColumn as string | undefined
                    }
                    onChange={(targetLongitudeColumn) =>
                      applyConfig(
                        setDeckMapLayerArcColumns(mapConfig, activeLayerIndex, {
                          targetLongitudeColumn,
                        }),
                      )
                    }
                    placeholder="Select target longitude..."
                  />
                </Field>
              </ColumnsProvider>
            )}

            {showArcColumnSetting && (
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">Flat lines</span>
                <Switch
                  checked={activeLayer?.getHeight === 0}
                  onCheckedChange={(checked) =>
                    applyConfig(
                      updateDeckMapLayer(
                        mapConfig,
                        activeLayerIndex,
                        (layer) => ({
                          ...layer,
                          getHeight: checked ? 0 : undefined,
                        }),
                      ),
                    )
                  }
                />
              </div>
            )}

            {showArcColumnSetting && (
              <Field
                label={`Line width: ${(activeLayer?.widthMinPixels as number | undefined) ?? 1}px`}
              >
                <Slider
                  min={1}
                  max={20}
                  step={1}
                  value={[
                    (activeLayer?.widthMinPixels as number | undefined) ?? 1,
                  ]}
                  onValueChange={(values) => {
                    const value = values[0] ?? 1;
                    applyConfig(
                      updateDeckMapLayer(
                        mapConfig,
                        activeLayerIndex,
                        (layer) => ({
                          ...layer,
                          widthMinPixels: value,
                        }),
                      ),
                    );
                  }}
                />
              </Field>
            )}

            {showExtrusionSettings && (
              <div className="flex flex-col gap-2 rounded-md border p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium">Extrusion</span>
                  <Switch
                    checked={Boolean(activeLayer?.extruded)}
                    onCheckedChange={(checked) =>
                      applyConfig(
                        updateDeckMapLayer(
                          mapConfig,
                          activeLayerIndex,
                          (layer) => ({
                            ...layer,
                            extruded: checked,
                            getElevation: checked
                              ? (layer.getElevation ?? 1)
                              : layer.getElevation,
                          }),
                        ),
                      )
                    }
                  />
                </div>

                {Boolean(activeLayer?.extruded) && dataTable && (
                  <ColumnsProvider columns={dataTable.columns}>
                    <Field label="Elevation column">
                      <ColumnSelector.Numeric
                        value={(() => {
                          const elev = activeLayer?.getElevation;
                          if (
                            elev &&
                            typeof elev === 'object' &&
                            '@@function' in (elev as object)
                          ) {
                            return (elev as Record<string, unknown>).field as
                              | string
                              | undefined;
                          }
                          if (
                            typeof elev === 'string' &&
                            elev.startsWith('@@=')
                          ) {
                            return elev.slice(3);
                          }
                          return undefined;
                        })()}
                        onChange={(elevationColumn) =>
                          applyConfig(
                            updateDeckMapLayer(
                              mapConfig,
                              activeLayerIndex,
                              (layer) => ({
                                ...layer,
                                getElevation: elevationColumn
                                  ? {
                                      '@@function': 'scale',
                                      field: elevationColumn,
                                      type: 'linear',
                                      domain: 'auto',
                                      range: [0, 200],
                                    }
                                  : undefined,
                                elevationScale: layer.elevationScale ?? 1,
                              }),
                            ),
                          )
                        }
                        placeholder="Select elevation column..."
                        disabled={readOnly}
                      />
                    </Field>
                  </ColumnsProvider>
                )}

                {Boolean(activeLayer?.extruded) && (
                  <Field
                    label={`Elevation scale: ${(activeLayer?.elevationScale as number | undefined) ?? 1}x`}
                  >
                    <div className="pt-1.5">
                      <Slider
                        min={0.01}
                        max={100}
                        step={0.01}
                        value={[
                          (activeLayer?.elevationScale as number | undefined) ??
                            1,
                        ]}
                        onValueChange={(values) => {
                          const value = values[0] ?? 1;
                          applyConfig(
                            updateDeckMapLayer(
                              mapConfig,
                              activeLayerIndex,
                              (layer) => ({
                                ...layer,
                                elevationScale: value,
                              }),
                            ),
                          );
                        }}
                      />
                    </div>
                  </Field>
                )}
              </div>
            )}

            {dataTable &&
              !showGeometryColumnSetting &&
              !showH3ColumnSetting &&
              !showArcColumnSetting && (
                <ColumnsProvider columns={dataTable.columns}>
                  <Field label="Latitude column" required>
                    <LatitudeSelector
                      dashboardId={dashboardId}
                      panel={panel}
                      currentTable={dataTable}
                      readOnly={readOnly}
                    />
                  </Field>
                  <Field label="Longitude column" required>
                    <LongitudeSelector
                      dashboardId={dashboardId}
                      panel={panel}
                      currentTable={dataTable}
                      readOnly={readOnly}
                    />
                  </Field>
                </ColumnsProvider>
              )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};
