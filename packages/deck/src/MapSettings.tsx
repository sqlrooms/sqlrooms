import {FC, useCallback, useState} from 'react';
import {
  Field,
  ColumnSelector,
  ColumnsProvider,
  useStoreWithMosaicDashboard,
  useDataTable,
} from '@sqlrooms/mosaic';
import type {MosaicDashboardPanelConfigType} from '@sqlrooms/mosaic';
import {
  binnedNumericSchemes,
  categoricalSchemes,
  continuousDivergingSchemes,
  continuousSequentialSchemes,
} from '@sqlrooms/color-scales';
import type {ColorScaleConfig, ColorScaleScheme} from '@sqlrooms/color-scales';
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@sqlrooms/ui';
import {XIcon} from 'lucide-react';
import {LatitudeSelector} from './LatitudeSelector';
import {LongitudeSelector} from './LongitudeSelector';
import type {DeckMapDashboardPanelConfig} from './dashboardConfig';
import {DEFAULT_DECK_MAP_MAX_DATA_POINTS} from './dashboardConfig';
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
  setDeckMapLayerType,
  type DeckMapLayerColorAccessor,
  usesGeometryColumnSetting,
} from './mapLayerConfigUtils';

interface MapSettingsPanelProps {
  dashboardId: string;
  panel: MosaicDashboardPanelConfigType;
  onClose?: () => void;
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
}) => {
  const [layerIndex, setLayerIndex] = useState(0);
  const [colorAccessor, setColorAccessor] =
    useState<DeckMapLayerColorAccessor>('getFillColor');

  const tableName = useStoreWithMosaicDashboard(
    (state) =>
      state.mosaicDashboard.config.dashboardsById[dashboardId]?.selectedTable,
  );

  const dataTable = useDataTable(tableName);

  const updatePanel = useStoreWithMosaicDashboard(
    (state) => state.mosaicDashboard.updatePanel,
  );

  const mapConfig = panel.config as DeckMapDashboardPanelConfig;
  const layers = getDeckMapLayerRecords(mapConfig);
  const activeLayerIndex = Math.min(layerIndex, Math.max(layers.length - 1, 0));
  const activeLayer = layers[activeLayerIndex];
  const activeLayerDatasetId = getDeckMapLayerDatasetId(activeLayer);
  const activeLayerDataset = activeLayerDatasetId
    ? mapConfig.datasets?.[activeLayerDatasetId]
    : undefined;
  const showGeometryColumnSetting = usesGeometryColumnSetting(
    activeLayer?.['@@type'],
  );
  const colorAccessorOptions = getDeckMapColorAccessorOptions(
    activeLayer?.['@@type'],
  );
  const effectiveColorAccessor =
    colorAccessorOptions.find((option) => option.value === colorAccessor)
      ?.value ?? colorAccessorOptions[0]?.value;
  const colorScale = effectiveColorAccessor
    ? getDeckMapLayerColorScale(activeLayer, effectiveColorAccessor)
    : undefined;
  const colorScaleType = colorScale?.type ?? 'sequential';
  const schemeOptions = getSchemeOptions(colorScaleType);
  const firstColumnName = dataTable?.columns[0]?.name;
  const maxRows =
    mapConfig.dataPolicy?.maxRows ?? DEFAULT_DECK_MAP_MAX_DATA_POINTS;

  const applyConfig = useCallback(
    (config: DeckMapDashboardPanelConfig) => {
      updatePanel(dashboardId, panel.id, {
        config: {...config, settingsOpen: mapConfig.settingsOpen} as any,
      });
    },
    [dashboardId, mapConfig.settingsOpen, panel.id, updatePanel],
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
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-3 py-1.5 text-xs font-medium">
        <div className="flex items-center">Map settings</div>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={onClose}
            aria-label="Close"
          >
            <XIcon className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-2">
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
                        <SelectItem key={option.value} value={option.value}>
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
                        {DECK_MAP_COLOR_SCALE_TYPE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Scheme">
                    <Select
                      value={colorScale.scheme}
                      onValueChange={(value) =>
                        updateColorScale({scheme: value as ColorScaleScheme})
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
          </div>
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

        {dataTable && !showGeometryColumnSetting && (
          <ColumnsProvider columns={dataTable.columns}>
            <Field label="Latitude column" required>
              <LatitudeSelector
                dashboardId={dashboardId}
                panel={panel}
                currentTable={dataTable}
              />
            </Field>
            <Field label="Longitude column" required>
              <LongitudeSelector
                dashboardId={dashboardId}
                panel={panel}
                currentTable={dataTable}
              />
            </Field>
          </ColumnsProvider>
        )}

        <Field label="Max rows">
          <Input
            type="number"
            min={1}
            value={maxRows}
            className="no-spinner"
            onChange={(event) => {
              const parsed = Number.parseInt(event.target.value, 10);
              if (!Number.isFinite(parsed) || parsed < 1) return;
              applyConfig({
                ...mapConfig,
                dataPolicy: {
                  ...mapConfig.dataPolicy,
                  maxRows: parsed,
                },
              });
            }}
            placeholder={String(DEFAULT_DECK_MAP_MAX_DATA_POINTS)}
          />
        </Field>
      </div>
    </div>
  );
};
