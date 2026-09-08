import {
  FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from 'react';
import {
  getTableIdentity,
  resolveTableReference,
  type DataTable,
} from '@sqlrooms/duckdb';
import {
  binnedNumericSchemes,
  categoricalSchemeColors,
  categoricalSchemes,
  continuousDivergingInterpolators,
  continuousDivergingSchemes,
  continuousSequentialSchemes,
  continuousSequentialInterpolators,
  parseColorString,
} from '@sqlrooms/color-scales';
import type {ColorScaleConfig, ColorScaleScheme} from '@sqlrooms/color-scales';
import {
  cn,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Slider,
  ScrollArea,
  SettingsPanelHeader,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@sqlrooms/ui';
import {AlertTriangleIcon} from 'lucide-react';
import {DeckMapBasemapSelect} from './DeckMapBasemapSelect';
import {
  isDeckMapSqlDatasetSource,
  isDeckMapTableDatasetSource,
  type DeckMapConfig,
} from './mapConfig';
import {parseDeckMapPointTransformSql} from './mapConfigUtils';
import {
  clearDeckMapLayerColorScale,
  createDeckMapLayerColorScale,
  DECK_MAP_COLOR_SCALE_TYPE_OPTIONS,
  DECK_MAP_DEFAULT_LAYER_COLOR,
  DECK_MAP_DEFAULT_STROKE_COLOR,
  DECK_MAP_LAYER_TYPE_OPTIONS,
  deckMapRgbaToHex,
  getDeckMapColorAccessorOptions,
  getDeckMapLayerDatasetId,
  getDeckMapLayerColorScale,
  getDeckMapLayerExtruded,
  getDeckMapLayerFlatColor,
  getDeckMapLayerRecords,
  setDeckMapLayerFlatColor,
  setDeckMapLayerGeometryColumn,
  setDeckMapLayerCoordinateColumns,
  setDeckMapLayerHexagonColumn,
  setDeckMapLayerArcGeometryColumns,
  setDeckMapLayerArcCoordinateColumns,
  setDeckMapLayerTimestampColumn,
  setDeckMapLayerType,
  setDeckMapLayerColumnRadius,
  updateDeckMapLayer,
  type DeckMapLayerColorAccessor,
  type DeckMapLayerRecord,
  usesGeometryColumnSetting,
  usesPointCoordinateSetting,
  usesH3ColumnSetting,
  usesArcColumnSetting,
  usesRadiusSetting,
  usesColumnRadiusSetting,
  usesTripsSettings,
  usesExtrusionSettings,
  usesStrokeSetting,
  usesStrokeExtrusionWarning,
  getDeckMapLayerStrokeDefault,
  getDeckMapColorScaleOpacity,
  getDeckMapLayerChannelOpacityPercent,
  detachDeckMapLayerOpacity,
  replaceDeckMapLayerColorScalesWithFlat,
  replaceDeckMapLayerColorScaleWithFlat,
} from './mapLayerConfigUtils';
import {
  DeckMapCodeViewerPanel,
  DeckMapCodeViewToggleButton,
  DeckMapColumnSelector as ColumnSelector,
  DeckMapColumnsProvider as ColumnsProvider,
  DeckMapSettingsField as Field,
  DeckMapTableSelector as DataTableSelector,
  filterDeckMapColumns,
  isDeckMapCategoricalColorColumn,
  pickDeckMapArcGeometryColumns,
  pickDeckMapSourceGeometryColumn,
} from './MapSettingsControls';
import {
  isDeckMapGeneratedTransformColumn,
  useDeckMapDatasetSchema,
} from './useDeckMapDatasetSchema';
import {
  detectHeatmapScheme,
  heatmapSchemeToColorRange,
} from './json/heatmapDefaults';

const EMPTY_COLUMNS: DataTable['columns'] = [];

function mergeDeckMapColumns(
  ...columnSets: Array<DataTable['columns'] | undefined>
): DataTable['columns'] {
  const columnsByName = new Map<string, DataTable['columns'][number]>();
  for (const columns of columnSets) {
    for (const column of columns ?? []) {
      columnsByName.set(column.name, column);
    }
  }
  return [...columnsByName.values()];
}

function getBoundGeometryColumnNames(
  datasetGeometryColumn: string | undefined,
  layer: DeckMapLayerRecord | undefined,
): Set<string> {
  const binding = layer?._sqlroomsBinding;
  const names = [
    datasetGeometryColumn,
    isRecord(binding) ? binding.geometryColumn : undefined,
    isRecord(binding) ? binding.sourceGeometryColumn : undefined,
    isRecord(binding) ? binding.targetGeometryColumn : undefined,
  ];
  return new Set(
    names.filter(
      (name): name is string => typeof name === 'string' && name.length > 0,
    ),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function getColorScaleColumnKind(
  type: ColorScaleConfig['type'],
): 'quantitative' | 'categorical' {
  return type === 'categorical' ? 'categorical' : 'quantitative';
}

/** Color-scale type matching the field's column kind. */
function resolveColorScaleTypeForField(
  columns: DataTable['columns'],
  field: string | undefined,
  preferredType: ColorScaleConfig['type'],
): ColorScaleConfig['type'] {
  if (!field) return preferredType;
  const column = columns.find((candidate) => candidate.name === field);
  if (!column?.type) return preferredType;
  // String/boolean/binary fields only work with categorical scales.
  if (isDeckMapCategoricalColorColumn(column)) {
    return 'categorical';
  }
  return preferredType;
}

/** First selectable color-scale field for this type. */
function getDefaultColorScaleField(
  columns: DataTable['columns'],
  type: ColorScaleConfig['type'],
  preferred?: string,
): string | undefined {
  const colorable = filterDeckMapColumns(columns, 'colorable');
  if (preferred && colorable.some((column) => column.name === preferred)) {
    return preferred;
  }
  const matchingKind = filterDeckMapColumns(
    colorable,
    getColorScaleColumnKind(type),
  );
  return matchingKind[0]?.name ?? colorable[0]?.name;
}

/** Pick field first, then coerce scale type to match that field. */
export function resolveColorScaleFieldAndType(
  columns: DataTable['columns'],
  preferredType: ColorScaleConfig['type'],
  preferredField?: string,
): {field: string; type: ColorScaleConfig['type']} | undefined {
  const field = getDefaultColorScaleField(
    columns,
    preferredType,
    preferredField,
  );
  if (!field) return undefined;
  return {
    field,
    type: resolveColorScaleTypeForField(columns, field, preferredType),
  };
}

export interface DeckMapSettingsPanelProps {
  title: string;
  selectedTable?: string;
  config: DeckMapConfig;
  tables: DataTable[];
  onClose?: () => void;
  onTableChange: (table: DataTable) => void;
  onTitleChange: (title: string) => void;
  onConfigChange: (config: DeckMapConfig) => void;
  readOnly?: boolean;
  /** Custom maps stay on the JSON editor so basic controls cannot clobber them. */
  customConfig?: boolean;
  /**
   * Document maps own their dataset in `config.datasets`. Prefer that table
   * over `selectedTable`, which is only a sidecar. Dashboards leave this false
   * so the shared dashboard selected table is shown.
   */
  preferDatasetSource?: boolean;
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
  // Quantile/quantize/threshold: ColorBrewer only (Viridis → sequential).
  return binnedNumericSchemes;
}

const SCHEME_PREVIEW_STEPS = 24;

/** Sample CSS colors for scheme dropdown previews. */
function getSchemePreviewColors(
  scheme: string,
  type: ColorScaleConfig['type'],
): string[] {
  if (type === 'categorical') {
    const colors =
      categoricalSchemeColors[scheme as keyof typeof categoricalSchemeColors];
    return colors ? [...colors] : [];
  }

  const interpolator =
    type === 'diverging'
      ? continuousDivergingInterpolators[
          scheme as keyof typeof continuousDivergingInterpolators
        ]
      : (continuousSequentialInterpolators[
          scheme as keyof typeof continuousSequentialInterpolators
        ] ??
        continuousDivergingInterpolators[
          scheme as keyof typeof continuousDivergingInterpolators
        ]);

  if (!interpolator) return [];
  return Array.from({length: SCHEME_PREVIEW_STEPS}, (_, i) =>
    interpolator(i / (SCHEME_PREVIEW_STEPS - 1)),
  );
}

/** Edge-to-edge CSS gradient for a scheme (no fringe gaps). */
function getSchemePreviewGradient(
  colors: string[],
  type: ColorScaleConfig['type'],
): string | undefined {
  if (colors.length === 0) return undefined;
  if (type === 'categorical') {
    const stops = colors.flatMap((color, index) => {
      const start = (index / colors.length) * 100;
      const end = ((index + 1) / colors.length) * 100;
      return [`${color} ${start}%`, `${color} ${end}%`];
    });
    return `linear-gradient(to right, ${stops.join(', ')})`;
  }
  return `linear-gradient(to right, ${colors.join(', ')})`;
}

const ColorSchemeOptionLabel: FC<{
  scheme: string;
  type: ColorScaleConfig['type'];
}> = ({scheme, type}) => {
  const colors = getSchemePreviewColors(scheme, type);
  const gradient = getSchemePreviewGradient(colors, type);
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      {gradient ? (
        <span
          aria-hidden
          className="h-3 w-20 shrink-0 overflow-hidden rounded-sm"
          style={{backgroundImage: gradient}}
        />
      ) : null}
      <span className="truncate">{scheme}</span>
    </span>
  );
};

/** Compact color swatch; native picker is visually hidden. */
const ColorSwatchInput: FC<{
  value: string;
  onChange: (hex: string) => void;
  disabled?: boolean;
  'aria-label': string;
}> = ({value, onChange, disabled, 'aria-label': ariaLabel}) => (
  <label
    className={cn(
      'border-input relative h-5 w-9 shrink-0 overflow-hidden rounded-[3px] border',
      'ring-offset-background focus-within:ring-ring focus-within:ring-1 focus-within:ring-offset-1',
      disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
    )}
    style={{backgroundColor: value}}
  >
    <input
      type="color"
      aria-label={ariaLabel}
      value={value}
      disabled={disabled}
      className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
      onChange={(event) => onChange(event.target.value)}
    />
  </label>
);

function opacityPercentToAlpha(percent: number): number {
  return Math.round((Math.max(0, Math.min(100, percent)) / 100) * 255);
}

function getLayerOpacityPercent(layer: DeckMapLayerRecord | undefined): number {
  const opacity = layer?.opacity;
  if (typeof opacity === 'number' && Number.isFinite(opacity)) {
    return Math.round(Math.max(0, Math.min(1, opacity)) * 100);
  }
  return 100;
}

const SettingsSliderField: FC<{
  label: string;
  children: ReactNode;
}> = ({label, children}) => (
  <Field label={label}>
    <div className="pt-0.5">{children}</div>
  </Field>
);

const AppearanceOpacitySlider: FC<{
  valuePercent: number;
  onChange: (percent: number) => void;
  disabled?: boolean;
}> = ({valuePercent, onChange, disabled}) => (
  <SettingsSliderField label={`Opacity: ${valuePercent}%`}>
    <Slider
      min={0}
      max={100}
      step={1}
      value={[valuePercent]}
      disabled={disabled}
      onValueChange={(values) => onChange(values[0] ?? valuePercent)}
    />
  </SettingsSliderField>
);

type AppearanceColorChannelProps = {
  accessor: DeckMapLayerColorAccessor;
  layer: DeckMapLayerRecord | undefined;
  columns: DataTable['columns'];
  mapConfig: DeckMapConfig;
  layerIndex: number;
  applyConfig: (config: DeckMapConfig) => void;
  lastColorScaleFieldsRef: MutableRefObject<
    Partial<Record<DeckMapLayerColorAccessor, string>>
  >;
  readOnly?: boolean;
  /** Stroke enable switch. */
  enabled?: boolean;
  onEnabledChange?: (enabled: boolean) => void;
  enableLabel?: string;
  defaultFlatColor?: readonly [number, number, number, number];
  widthPixels?: number;
  onWidthChange?: (width: number) => void;
  widthLabel?: string;
  radiusValue?: number;
  onRadiusChange?: (radius: number) => void;
  radiusLabel?: string;
  radiusUnit?: string;
  radiusMin?: number;
  radiusMax?: number;
  radiusStep?: number;
  /** Warning that strokes are ignored while the layer is extruded. */
  extrusionDisablesStroke?: boolean;
};

const AppearanceColorChannel: FC<AppearanceColorChannelProps> = ({
  accessor,
  layer,
  columns,
  mapConfig,
  layerIndex,
  applyConfig,
  lastColorScaleFieldsRef,
  readOnly,
  enabled,
  onEnabledChange,
  enableLabel = 'Enabled',
  defaultFlatColor = DECK_MAP_DEFAULT_LAYER_COLOR,
  widthPixels,
  onWidthChange,
  widthLabel = 'Width',
  radiusValue,
  onRadiusChange,
  radiusLabel = 'Radius',
  radiusUnit = '',
  radiusMin = 0.1,
  radiusMax = 50,
  radiusStep = 0.1,
  extrusionDisablesStroke = false,
}) => {
  const colorScale = getDeckMapLayerColorScale(layer, accessor);
  const flatColor = getDeckMapLayerFlatColor(layer, accessor) ?? [
    ...defaultFlatColor,
  ];
  const colorScaleType = colorScale?.type ?? 'sequential';
  const schemeOptions = getSchemeOptions(colorScaleType);
  // Don't read lastColorScaleFieldsRef during render (react-hooks/refs).
  const defaultField = getDefaultColorScaleField(columns, colorScaleType);
  const showControls = enabled !== false;
  const opacityPercent = getDeckMapLayerChannelOpacityPercent(
    layer,
    accessor,
    flatColor[3] ?? 255,
  );

  const updateColorScale = (patch: {
    field?: string;
    type?: ColorScaleConfig['type'];
    scheme?: ColorScaleScheme;
  }) => {
    const preferredField =
      patch.field ??
      colorScale?.field ??
      lastColorScaleFieldsRef.current[accessor];
    const resolved = resolveColorScaleFieldAndType(
      columns,
      patch.type ?? colorScale?.type ?? 'sequential',
      preferredField,
    );
    if (!resolved) return;
    const {field, type} = resolved;

    lastColorScaleFieldsRef.current[accessor] = field;
    const scheme =
      patch.scheme ??
      (patch.type && patch.type !== colorScale?.type
        ? undefined
        : type !== colorScale?.type
          ? undefined
          : colorScale?.scheme);

    applyConfig(
      updateDeckMapLayer(mapConfig, layerIndex, (nextLayer) => {
        const detached = detachDeckMapLayerOpacity(nextLayer);
        const existingScale = getDeckMapLayerColorScale(detached, accessor);
        const currentFlat =
          getDeckMapLayerFlatColor(detached, accessor) ?? flatColor;
        return {
          ...detached,
          [accessor]: createDeckMapLayerColorScale({
            field,
            type,
            scheme,
            title: field,
            opacity: existingScale
              ? getDeckMapColorScaleOpacity(existingScale)
              : (currentFlat[3] ?? 255) / 255,
          }),
        };
      }),
    );
  };

  return (
    <div className="flex flex-col gap-2">
      {onEnabledChange ? (
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1 text-xs font-medium">
            {enableLabel}
            {extrusionDisablesStroke ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex"
                    aria-label="no strokes with extrusion enabled"
                  >
                    <AlertTriangleIcon className="h-3.5 w-3.5 text-amber-500" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  no strokes with extrusion enabled
                </TooltipContent>
              </Tooltip>
            ) : null}
          </span>
          <Switch
            checked={enabled !== false}
            onCheckedChange={onEnabledChange}
            aria-label={enableLabel}
          />
        </div>
      ) : null}

      {showControls && onWidthChange && widthPixels !== undefined ? (
        <SettingsSliderField
          label={`${widthLabel}: ${Number(widthPixels.toFixed(1))}px`}
        >
          <Slider
            min={0.1}
            max={20}
            step={0.1}
            value={[widthPixels]}
            onValueChange={(values) => onWidthChange(values[0] ?? 1)}
          />
        </SettingsSliderField>
      ) : null}

      {showControls && onRadiusChange && radiusValue !== undefined ? (
        <SettingsSliderField
          label={`${radiusLabel}: ${
            radiusStep < 1 ? Number(radiusValue.toFixed(1)) : radiusValue
          }${radiusUnit}`}
        >
          <Slider
            min={radiusMin}
            max={radiusMax}
            step={radiusStep}
            value={[radiusValue]}
            onValueChange={(values) => onRadiusChange(values[0] ?? radiusValue)}
          />
        </SettingsSliderField>
      ) : null}

      {showControls ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium">Color scale</span>
            <Switch
              checked={Boolean(colorScale)}
              disabled={readOnly || (!colorScale && !defaultField)}
              aria-label="Color scale"
              onCheckedChange={(checked) => {
                if (checked) {
                  updateColorScale({});
                  return;
                }
                if (colorScale?.field) {
                  lastColorScaleFieldsRef.current[accessor] = colorScale.field;
                }
                applyConfig(
                  clearDeckMapLayerColorScale(mapConfig, layerIndex, accessor),
                );
              }}
            />
          </div>

          {!colorScale ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium">Color</span>
              <ColorSwatchInput
                aria-label="Color"
                value={deckMapRgbaToHex(flatColor)}
                disabled={readOnly}
                onChange={(hex) => {
                  const next = parseColorString(hex, flatColor[3] ?? 255);
                  applyConfig(
                    setDeckMapLayerFlatColor(
                      mapConfig,
                      layerIndex,
                      accessor,
                      next,
                    ),
                  );
                }}
              />
            </div>
          ) : null}

          {colorScale ? (
            <div className="flex flex-col gap-2">
              {columns.length > 0 ? (
                <ColumnsProvider columns={columns}>
                  <Field label="Field" required>
                    <ColumnSelector.Colorable
                      value={colorScale.field}
                      onChange={(field) => updateColorScale({field})}
                      disabled={readOnly}
                    />
                  </Field>
                </ColumnsProvider>
              ) : null}
              <Field label="Type">
                <Select
                  value={colorScaleType}
                  onValueChange={(value) =>
                    updateColorScale({type: value as ColorScaleConfig['type']})
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
                  <SelectTrigger className="w-full [&>span]:line-clamp-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {schemeOptions.map((scheme) => (
                      <SelectItem key={scheme} value={scheme}>
                        <ColorSchemeOptionLabel
                          scheme={scheme}
                          type={colorScaleType}
                        />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          ) : null}

          <AppearanceOpacitySlider
            valuePercent={opacityPercent}
            disabled={readOnly}
            onChange={(percent) => {
              applyConfig(
                updateDeckMapLayer(mapConfig, layerIndex, (nextLayer) => {
                  const detached = detachDeckMapLayerOpacity(nextLayer);
                  if (colorScale) {
                    const scale =
                      getDeckMapLayerColorScale(detached, accessor) ??
                      colorScale;
                    return {
                      ...detached,
                      [accessor]: {
                        ...scale,
                        opacity: percent / 100,
                      },
                    };
                  }
                  const current =
                    getDeckMapLayerFlatColor(detached, accessor) ?? flatColor;
                  return {
                    ...detached,
                    [accessor]: [
                      current[0],
                      current[1],
                      current[2],
                      opacityPercentToAlpha(percent),
                    ],
                  };
                }),
              );
            }}
          />
        </>
      ) : null}
    </div>
  );
};

/** Arc source/target colors; optional shared color scale. */
const AppearanceArcColorPanel: FC<{
  layer: DeckMapLayerRecord | undefined;
  columns: DataTable['columns'];
  mapConfig: DeckMapConfig;
  layerIndex: number;
  applyConfig: (config: DeckMapConfig) => void;
  lastColorScaleFieldsRef: MutableRefObject<
    Partial<Record<DeckMapLayerColorAccessor, string>>
  >;
  readOnly?: boolean;
}> = ({
  layer,
  columns,
  mapConfig,
  layerIndex,
  applyConfig,
  lastColorScaleFieldsRef,
  readOnly,
}) => {
  const sourceScale = getDeckMapLayerColorScale(layer, 'getSourceColor');
  const targetScale = getDeckMapLayerColorScale(layer, 'getTargetColor');
  const colorScale = sourceScale ?? targetScale;
  const colorScaleType = colorScale?.type ?? 'sequential';
  const schemeOptions = getSchemeOptions(colorScaleType);
  // Don't read lastColorScaleFieldsRef during render (react-hooks/refs).
  const defaultField = getDefaultColorScaleField(columns, colorScaleType);
  const sourceFlat = getDeckMapLayerFlatColor(layer, 'getSourceColor') ?? [
    ...DECK_MAP_DEFAULT_LAYER_COLOR,
  ];
  const targetFlat = getDeckMapLayerFlatColor(layer, 'getTargetColor') ?? [
    ...DECK_MAP_DEFAULT_LAYER_COLOR,
  ];
  const opacityPercent = Math.round(
    (getDeckMapLayerChannelOpacityPercent(
      layer,
      'getSourceColor',
      sourceFlat[3] ?? 255,
    ) +
      getDeckMapLayerChannelOpacityPercent(
        layer,
        'getTargetColor',
        targetFlat[3] ?? 255,
      )) /
      2,
  );

  const applySharedColorScale = (patch: {
    field?: string;
    type?: ColorScaleConfig['type'];
    scheme?: ColorScaleScheme;
  }) => {
    const preferredField =
      patch.field ??
      colorScale?.field ??
      lastColorScaleFieldsRef.current.getSourceColor ??
      lastColorScaleFieldsRef.current.getTargetColor;
    const resolved = resolveColorScaleFieldAndType(
      columns,
      patch.type ?? colorScale?.type ?? 'sequential',
      preferredField,
    );
    if (!resolved) return;
    const {field, type} = resolved;

    lastColorScaleFieldsRef.current.getSourceColor = field;
    lastColorScaleFieldsRef.current.getTargetColor = field;
    const scheme =
      patch.scheme ??
      (patch.type && patch.type !== colorScale?.type
        ? undefined
        : type !== colorScale?.type
          ? undefined
          : colorScale?.scheme);

    applyConfig(
      updateDeckMapLayer(mapConfig, layerIndex, (nextLayer) => {
        const detached = detachDeckMapLayerOpacity(nextLayer);
        const existing =
          getDeckMapLayerColorScale(detached, 'getSourceColor') ??
          getDeckMapLayerColorScale(detached, 'getTargetColor');
        const source =
          getDeckMapLayerFlatColor(detached, 'getSourceColor') ?? sourceFlat;
        const target =
          getDeckMapLayerFlatColor(detached, 'getTargetColor') ?? targetFlat;
        const opacity = existing
          ? getDeckMapColorScaleOpacity(existing)
          : Math.round(((source[3] ?? 255) + (target[3] ?? 255)) / 2) / 255;
        const scale = createDeckMapLayerColorScale({
          field,
          type,
          scheme,
          title: field,
          opacity,
        });
        return {
          ...detached,
          getSourceColor: scale,
          getTargetColor: scale,
        };
      }),
    );
  };

  const setFlatColor = (
    accessor: 'getSourceColor' | 'getTargetColor',
    color: readonly [number, number, number, number],
  ) => {
    applyConfig(
      setDeckMapLayerFlatColor(mapConfig, layerIndex, accessor, color),
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium">Color scale</span>
        <Switch
          checked={Boolean(colorScale)}
          disabled={readOnly || (!colorScale && !defaultField)}
          aria-label="Color scale"
          onCheckedChange={(checked) => {
            if (checked) {
              applySharedColorScale({});
              return;
            }
            if (colorScale?.field) {
              lastColorScaleFieldsRef.current.getSourceColor = colorScale.field;
              lastColorScaleFieldsRef.current.getTargetColor = colorScale.field;
            }
            applyConfig(
              updateDeckMapLayer(mapConfig, layerIndex, (nextLayer) => {
                const replacements: Partial<
                  Record<
                    DeckMapLayerColorAccessor,
                    readonly [number, number, number, number]
                  >
                > = {};
                if (getDeckMapLayerColorScale(nextLayer, 'getSourceColor')) {
                  replacements.getSourceColor = DECK_MAP_DEFAULT_LAYER_COLOR;
                }
                if (getDeckMapLayerColorScale(nextLayer, 'getTargetColor')) {
                  replacements.getTargetColor = DECK_MAP_DEFAULT_LAYER_COLOR;
                }
                return replaceDeckMapLayerColorScalesWithFlat(
                  nextLayer,
                  replacements,
                );
              }),
            );
          }}
        />
      </div>

      {!colorScale ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium">Source color</span>
            <ColorSwatchInput
              aria-label="Source color"
              value={deckMapRgbaToHex(sourceFlat)}
              disabled={readOnly}
              onChange={(hex) => {
                const next = parseColorString(hex, sourceFlat[3] ?? 255);
                setFlatColor('getSourceColor', next);
              }}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium">Target color</span>
            <ColorSwatchInput
              aria-label="Target color"
              value={deckMapRgbaToHex(targetFlat)}
              disabled={readOnly}
              onChange={(hex) => {
                const next = parseColorString(hex, targetFlat[3] ?? 255);
                setFlatColor('getTargetColor', next);
              }}
            />
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          {columns.length > 0 ? (
            <ColumnsProvider columns={columns}>
              <Field label="Field" required>
                <ColumnSelector.Colorable
                  value={colorScale.field}
                  onChange={(field) => applySharedColorScale({field})}
                  disabled={readOnly}
                />
              </Field>
            </ColumnsProvider>
          ) : null}
          <Field label="Type">
            <Select
              value={colorScaleType}
              onValueChange={(value) =>
                applySharedColorScale({
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
                applySharedColorScale({scheme: value as ColorScaleScheme})
              }
            >
              <SelectTrigger className="w-full [&>span]:line-clamp-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {schemeOptions.map((scheme) => (
                  <SelectItem key={scheme} value={scheme}>
                    <ColorSchemeOptionLabel
                      scheme={scheme}
                      type={colorScaleType}
                    />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      )}

      <AppearanceOpacitySlider
        valuePercent={opacityPercent}
        disabled={readOnly}
        onChange={(percent) => {
          applyConfig(
            updateDeckMapLayer(mapConfig, layerIndex, (nextLayer) => {
              const detached = detachDeckMapLayerOpacity(nextLayer);
              if (colorScale) {
                const scale =
                  getDeckMapLayerColorScale(detached, 'getSourceColor') ??
                  getDeckMapLayerColorScale(detached, 'getTargetColor') ??
                  colorScale;
                const nextScale = {...scale, opacity: percent / 100};
                return {
                  ...detached,
                  getSourceColor: nextScale,
                  getTargetColor: nextScale,
                };
              }
              const alpha = opacityPercentToAlpha(percent);
              const source =
                getDeckMapLayerFlatColor(detached, 'getSourceColor') ??
                sourceFlat;
              const target =
                getDeckMapLayerFlatColor(detached, 'getTargetColor') ??
                targetFlat;
              return {
                ...detached,
                getSourceColor: [source[0], source[1], source[2], alpha],
                getTargetColor: [target[0], target[1], target[2], alpha],
              };
            }),
          );
        }}
      />
    </div>
  );
};

const AppearanceExtrusionPanel: FC<{
  layer: DeckMapLayerRecord | undefined;
  columns: DataTable['columns'];
  mapConfig: DeckMapConfig;
  layerIndex: number;
  applyConfig: (config: DeckMapConfig) => void;
  readOnly?: boolean;
}> = ({layer, columns, mapConfig, layerIndex, applyConfig, readOnly}) => {
  const extruded = getDeckMapLayerExtruded(layer);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium">Extruded</span>
        <Switch
          checked={extruded}
          onCheckedChange={(checked) =>
            applyConfig(
              updateDeckMapLayer(mapConfig, layerIndex, (nextLayer) => ({
                ...nextLayer,
                extruded: checked,
                getElevation: checked
                  ? (nextLayer.getElevation ?? 1)
                  : nextLayer.getElevation,
              })),
            )
          }
        />
      </div>

      {extruded && columns.length > 0 ? (
        <ColumnsProvider columns={columns}>
          <Field label="Elevation column">
            <ColumnSelector.Numeric
              value={(() => {
                const elev = layer?.getElevation;
                if (
                  elev &&
                  typeof elev === 'object' &&
                  '@@function' in (elev as object)
                ) {
                  return (elev as Record<string, unknown>).field as
                    | string
                    | undefined;
                }
                if (typeof elev === 'string' && elev.startsWith('@@=')) {
                  return elev.slice(3);
                }
                return undefined;
              })()}
              onChange={(elevationColumn) =>
                applyConfig(
                  updateDeckMapLayer(mapConfig, layerIndex, (nextLayer) => ({
                    ...nextLayer,
                    getElevation: elevationColumn
                      ? {
                          '@@function': 'scale',
                          field: elevationColumn,
                          type: 'linear',
                          domain: 'auto',
                          range: [0, 200],
                        }
                      : undefined,
                    elevationScale: nextLayer.elevationScale ?? 1,
                  })),
                )
              }
              placeholder="Select elevation column..."
              disabled={readOnly}
            />
          </Field>
        </ColumnsProvider>
      ) : null}

      {extruded ? (
        <SettingsSliderField
          label={`Elevation scale: ${(layer?.elevationScale as number | undefined) ?? 1}x`}
        >
          <Slider
            min={0.01}
            max={1000}
            step={0.01}
            value={[(layer?.elevationScale as number | undefined) ?? 1]}
            onValueChange={(values) => {
              const value = values[0] ?? 1;
              applyConfig(
                updateDeckMapLayer(mapConfig, layerIndex, (nextLayer) => ({
                  ...nextLayer,
                  elevationScale: value,
                })),
              );
            }}
          />
        </SettingsSliderField>
      ) : null}
    </div>
  );
};

const PointLonLatFields: FC<{
  latitudeColumn?: string;
  longitudeColumn?: string;
  sourceColumns: DataTable['columns'];
  mapConfig: DeckMapConfig;
  layerIndex: number;
  applyConfig: (nextConfig: DeckMapConfig) => void;
  onSelectLonLat?: () => void;
  readOnly?: boolean;
}> = ({
  latitudeColumn,
  longitudeColumn,
  sourceColumns,
  mapConfig,
  layerIndex,
  applyConfig,
  onSelectLonLat,
  readOnly,
}) => (
  <ColumnsProvider columns={sourceColumns}>
    <div className="flex flex-col gap-2">
      <Field label="Latitude" required>
        <ColumnSelector
          value={latitudeColumn}
          onChange={(nextLatitudeColumn) => {
            onSelectLonLat?.();
            applyConfig(
              setDeckMapLayerCoordinateColumns(
                mapConfig,
                layerIndex,
                {latitudeColumn: nextLatitudeColumn},
                sourceColumns,
              ),
            );
          }}
          placeholder="Select latitude..."
          disabled={readOnly}
        />
      </Field>
      <Field label="Longitude" required>
        <ColumnSelector
          value={longitudeColumn}
          onChange={(nextLongitudeColumn) => {
            onSelectLonLat?.();
            applyConfig(
              setDeckMapLayerCoordinateColumns(
                mapConfig,
                layerIndex,
                {longitudeColumn: nextLongitudeColumn},
                sourceColumns,
              ),
            );
          }}
          placeholder="Select longitude..."
          disabled={readOnly}
        />
      </Field>
    </div>
  </ColumnsProvider>
);

const ArcLonLatFields: FC<{
  sourceLatitudeColumn?: string;
  sourceLongitudeColumn?: string;
  targetLatitudeColumn?: string;
  targetLongitudeColumn?: string;
  sourceColumns: DataTable['columns'];
  mapConfig: DeckMapConfig;
  layerIndex: number;
  applyConfig: (nextConfig: DeckMapConfig) => void;
  onSelectLonLat?: () => void;
  readOnly?: boolean;
}> = ({
  sourceLatitudeColumn,
  sourceLongitudeColumn,
  targetLatitudeColumn,
  targetLongitudeColumn,
  sourceColumns,
  mapConfig,
  layerIndex,
  applyConfig,
  onSelectLonLat,
  readOnly,
}) => {
  const setCoordinate = (
    columns: Parameters<typeof setDeckMapLayerArcCoordinateColumns>[2],
  ) => {
    onSelectLonLat?.();
    applyConfig(
      setDeckMapLayerArcCoordinateColumns(
        mapConfig,
        layerIndex,
        columns,
        sourceColumns,
      ),
    );
  };

  return (
    <ColumnsProvider columns={sourceColumns}>
      <div className="flex flex-col gap-2">
        <Field label="Source latitude" required>
          <ColumnSelector
            value={sourceLatitudeColumn}
            onChange={(column) => setCoordinate({sourceLatitudeColumn: column})}
            placeholder="Select source latitude..."
            disabled={readOnly}
          />
        </Field>
        <Field label="Source longitude" required>
          <ColumnSelector
            value={sourceLongitudeColumn}
            onChange={(column) =>
              setCoordinate({sourceLongitudeColumn: column})
            }
            placeholder="Select source longitude..."
            disabled={readOnly}
          />
        </Field>
        <Field label="Target latitude" required>
          <ColumnSelector
            value={targetLatitudeColumn}
            onChange={(column) => setCoordinate({targetLatitudeColumn: column})}
            placeholder="Select target latitude..."
            disabled={readOnly}
          />
        </Field>
        <Field label="Target longitude" required>
          <ColumnSelector
            value={targetLongitudeColumn}
            onChange={(column) =>
              setCoordinate({targetLongitudeColumn: column})
            }
            placeholder="Select target longitude..."
            disabled={readOnly}
          />
        </Field>
      </div>
    </ColumnsProvider>
  );
};

export const DeckMapSettingsPanel: FC<DeckMapSettingsPanelProps> = ({
  title,
  selectedTable,
  config,
  tables,
  onClose,
  onTableChange,
  onTitleChange,
  onConfigChange,
  readOnly,
  customConfig = false,
  preferDatasetSource = false,
}) => {
  const [layerIndex, setLayerIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'settings' | 'code'>(
    customConfig ? 'code' : 'settings',
  );
  // Last color-scale field per accessor (restored when re-enabling a scale).
  const lastColorScaleFieldsRef = useRef<
    Partial<Record<DeckMapLayerColorAccessor, string>>
  >({});
  const [positionTabOverride, setPositionTabOverride] = useState<{
    key: string;
    tab: 'geom' | 'lonlat';
  } | null>(null);
  const lastSourceGeometryColumnRef = useRef<string | undefined>(undefined);
  const lastArcSourceGeometryColumnRef = useRef<string | undefined>(undefined);
  const lastArcTargetGeometryColumnRef = useRef<string | undefined>(undefined);

  const selectedDataTable = useMemo(
    () =>
      selectedTable
        ? resolveTableReference(tables, selectedTable).table
        : undefined,
    [selectedTable, tables],
  );

  const handleTableChange = useCallback(
    (table: DataTable) => {
      if (readOnly) return;
      onTableChange(table);
    },
    [onTableChange, readOnly],
  );

  const mapConfig = config;
  const serializedMapConfig = useMemo(
    () => JSON.stringify(config, null, 2),
    [config],
  );
  const showCode = customConfig || viewMode === 'code';
  const layers = getDeckMapLayerRecords(mapConfig);
  const activeLayerIndex = Math.min(layerIndex, Math.max(layers.length - 1, 0));
  const activeLayer = layers[activeLayerIndex];
  const activeLayerDatasetId = getDeckMapLayerDatasetId(activeLayer);
  const activeLayerDataset = activeLayerDatasetId
    ? mapConfig.datasets?.[activeLayerDatasetId]
    : undefined;
  const geometrySessionKey = `${activeLayerIndex}:${activeLayerDatasetId ?? ''}:${typeof activeLayer?.['@@type'] === 'string' ? activeLayer['@@type'] : ''}`;
  const scopedPositionTabOverride =
    positionTabOverride?.key === geometrySessionKey
      ? positionTabOverride.tab
      : null;

  // Source table (coords/transform) vs compiled output columns (bindings).
  const activeLayerDatasetSource = activeLayerDataset?.source;
  const fallbackTableName = isDeckMapTableDatasetSource(
    activeLayerDatasetSource,
  )
    ? activeLayerDatasetSource.tableName
    : undefined;
  const fallbackTable = useMemo(
    () =>
      fallbackTableName
        ? resolveTableReference(tables, fallbackTableName).table
        : undefined,
    [fallbackTableName, tables],
  );
  const sourceDataTable = preferDatasetSource
    ? (fallbackTable ?? selectedDataTable)
    : (selectedDataTable ?? fallbackTable);
  const sourceColumns = sourceDataTable?.columns ?? EMPTY_COLUMNS;
  const resolvedActiveLayerDatasetSource = useMemo(() => {
    if (!activeLayerDatasetSource) {
      return selectedDataTable
        ? {tableName: getTableIdentity(selectedDataTable.table)}
        : undefined;
    }
    if (!isDeckMapTableDatasetSource(activeLayerDatasetSource)) {
      return activeLayerDatasetSource;
    }

    return {
      tableName:
        !preferDatasetSource && selectedDataTable
          ? getTableIdentity(selectedDataTable.table)
          : activeLayerDatasetSource.tableName,
      ...(activeLayerDatasetSource.transformSql
        ? {transformSql: activeLayerDatasetSource.transformSql}
        : {}),
    };
  }, [activeLayerDatasetSource, preferDatasetSource, selectedDataTable]);
  const datasetSchema = useDeckMapDatasetSchema({
    source: resolvedActiveLayerDatasetSource,
    sourceColumns,
  });
  const outputColumns = datasetSchema.outputColumns;
  const boundGeometryColumnNames = getBoundGeometryColumnNames(
    activeLayerDataset?.geometryColumn,
    activeLayer,
  );
  const dataOutputColumns = datasetSchema.dataOutputColumns.filter(
    (column) => !boundGeometryColumnNames.has(column.name),
  );
  const positionColumns = mergeDeckMapColumns(sourceColumns, outputColumns);
  const datasetSchemaErrorMessage = datasetSchema.error?.message;

  const showGeometryColumnSetting =
    usesGeometryColumnSetting(activeLayer?.['@@type']) ||
    usesPointCoordinateSetting(activeLayer?.['@@type']);
  const showPointCoordinateSetting = usesPointCoordinateSetting(
    activeLayer?.['@@type'],
  );
  const activeLayerBinding = isRecord(activeLayer?._sqlroomsBinding)
    ? activeLayer._sqlroomsBinding
    : undefined;
  const parsedPointTransform = isDeckMapTableDatasetSource(
    activeLayerDatasetSource,
  )
    ? activeLayerDatasetSource.transformSql
      ? parseDeckMapPointTransformSql(activeLayerDatasetSource.transformSql)
      : undefined
    : isDeckMapSqlDatasetSource(activeLayerDatasetSource)
      ? parseDeckMapPointTransformSql(activeLayerDatasetSource.sqlQuery)
      : undefined;
  const fitToData =
    mapConfig.fitToData?.dataset === activeLayerDatasetId
      ? mapConfig.fitToData
      : undefined;
  const interactionCoordinates =
    mapConfig.interaction?.type === 'point-radius-brush' &&
    mapConfig.interaction.dataset === activeLayerDatasetId
      ? mapConfig.interaction
      : undefined;
  const boundPointGeometryColumn =
    typeof activeLayerBinding?.geometryColumn === 'string'
      ? activeLayerBinding.geometryColumn
      : activeLayerDataset?.geometryColumn;
  const isGeneratedPointGeometryColumn = (columnName: string) =>
    isDeckMapGeneratedTransformColumn(columnName, sourceColumns);
  const usingGeneratedPointGeometry = Boolean(
    boundPointGeometryColumn &&
    isGeneratedPointGeometryColumn(boundPointGeometryColumn),
  );
  const latitudeColumn =
    fitToData?.latitudeColumn ||
    parsedPointTransform?.latitudeColumn ||
    (usingGeneratedPointGeometry
      ? interactionCoordinates?.latitudeColumn
      : undefined);
  const longitudeColumn =
    fitToData?.longitudeColumn ||
    parsedPointTransform?.longitudeColumn ||
    (usingGeneratedPointGeometry
      ? interactionCoordinates?.longitudeColumn
      : undefined);
  const usingCoordinateColumns = Boolean(latitudeColumn || longitudeColumn);
  const pointGeometryColumns = mergeDeckMapColumns(
    boundPointGeometryColumn &&
      !isGeneratedPointGeometryColumn(boundPointGeometryColumn)
      ? [{name: boundPointGeometryColumn, type: 'GEOMETRY'}]
      : [],
    filterDeckMapColumns(
      mergeDeckMapColumns(sourceColumns, outputColumns),
      'geometry',
    ).filter((column) => !isGeneratedPointGeometryColumn(column.name)),
  );
  const hasPointGeometryColumns = pointGeometryColumns.length > 0;
  const pointGeometryColumn = pointGeometryColumns.some(
    (column) => column.name === boundPointGeometryColumn,
  )
    ? boundPointGeometryColumn
    : undefined;
  const positionTabFromConfig =
    usingCoordinateColumns || !hasPointGeometryColumns ? 'lonlat' : 'geom';
  const positionTab = hasPointGeometryColumns
    ? (scopedPositionTabOverride ?? positionTabFromConfig)
    : 'lonlat';
  const showH3ColumnSetting = usesH3ColumnSetting(activeLayer?.['@@type']);
  const showArcColumnSetting = usesArcColumnSetting(activeLayer?.['@@type']);
  const arcSourceGeometryColumn =
    typeof activeLayerBinding?.sourceGeometryColumn === 'string'
      ? activeLayerBinding.sourceGeometryColumn
      : undefined;
  const arcTargetGeometryColumn =
    typeof activeLayerBinding?.targetGeometryColumn === 'string'
      ? activeLayerBinding.targetGeometryColumn
      : undefined;
  const nativeArcSourceGeometryColumn =
    arcSourceGeometryColumn &&
    !isDeckMapGeneratedTransformColumn(arcSourceGeometryColumn, sourceColumns)
      ? arcSourceGeometryColumn
      : undefined;
  const nativeArcTargetGeometryColumn =
    arcTargetGeometryColumn &&
    !isDeckMapGeneratedTransformColumn(arcTargetGeometryColumn, sourceColumns)
      ? arcTargetGeometryColumn
      : undefined;
  const arcGeometryColumns = mergeDeckMapColumns(
    [
      ...(nativeArcSourceGeometryColumn
        ? [{name: nativeArcSourceGeometryColumn, type: 'GEOMETRY'}]
        : []),
      ...(nativeArcTargetGeometryColumn
        ? [{name: nativeArcTargetGeometryColumn, type: 'GEOMETRY'}]
        : []),
    ],
    filterDeckMapColumns(
      mergeDeckMapColumns(sourceColumns, outputColumns),
      'geometry',
    ).filter(
      (column) =>
        !isDeckMapGeneratedTransformColumn(column.name, sourceColumns),
    ),
  );
  const hasArcGeometryColumns = arcGeometryColumns.length > 0;
  const usingArcCoordinateColumns = Boolean(
    activeLayerBinding?.sourceLatitudeColumn ||
    activeLayerBinding?.sourceLongitudeColumn ||
    activeLayerBinding?.targetLatitudeColumn ||
    activeLayerBinding?.targetLongitudeColumn,
  );
  const arcTabFromConfig =
    usingArcCoordinateColumns || !hasArcGeometryColumns ? 'lonlat' : 'geom';
  const arcTab = hasArcGeometryColumns
    ? (scopedPositionTabOverride ?? arcTabFromConfig)
    : 'lonlat';
  const showRadiusSetting = usesRadiusSetting(activeLayer?.['@@type']);
  const showColumnRadiusSetting = usesColumnRadiusSetting(
    activeLayer?.['@@type'],
  );
  const showTripsSettings = usesTripsSettings(activeLayer?.['@@type']);
  const showPointGeometryGroup =
    showPointCoordinateSetting &&
    (hasPointGeometryColumns ||
      usingCoordinateColumns ||
      sourceColumns.length > 0);
  const showArcGeometryGroup =
    showArcColumnSetting &&
    (hasArcGeometryColumns ||
      usingArcCoordinateColumns ||
      sourceColumns.length > 0);
  const pathPolygonGeometryColumns =
    pointGeometryColumns.length > 0 ? pointGeometryColumns : positionColumns;
  const showPathPolygonGeometryGroup = Boolean(
    showGeometryColumnSetting &&
    !showPointCoordinateSetting &&
    !showArcColumnSetting &&
    (pathPolygonGeometryColumns.length > 0 ||
      Boolean(boundPointGeometryColumn)),
  );
  const showTripsTimestampGroup = showTripsSettings && outputColumns.length > 0;
  const showH3GeometryGroup = showH3ColumnSetting && outputColumns.length > 0;
  const showGeometryGroup =
    showPointGeometryGroup ||
    showArcGeometryGroup ||
    showPathPolygonGeometryGroup ||
    showTripsTimestampGroup ||
    showH3GeometryGroup;
  const showExtrusionSettings = usesExtrusionSettings(activeLayer?.['@@type']);
  const showStrokeSetting = usesStrokeSetting(activeLayer?.['@@type']);
  const strokeEnabled =
    typeof activeLayer?.stroked === 'boolean'
      ? activeLayer.stroked
      : getDeckMapLayerStrokeDefault(activeLayer?.['@@type'], {
          extruded: getDeckMapLayerExtruded(activeLayer),
        });
  const strokeWidthPixels =
    activeLayer?.lineWidthUnits === 'pixels' &&
    typeof activeLayer?.getLineWidth === 'number'
      ? activeLayer.getLineWidth
      : ((activeLayer?.lineWidthMinPixels as number | undefined) ?? 1);
  const colorAccessorOptions = getDeckMapColorAccessorOptions(
    activeLayer?.['@@type'],
  );
  const hasFillColor = colorAccessorOptions.some(
    (option) => option.value === 'getFillColor',
  );
  const hasLineColor = colorAccessorOptions.some(
    (option) => option.value === 'getLineColor',
  );
  const hasPathColor = colorAccessorOptions.some(
    (option) => option.value === 'getColor',
  );
  const hasSourceColor = colorAccessorOptions.some(
    (option) => option.value === 'getSourceColor',
  );
  const hasTargetColor = colorAccessorOptions.some(
    (option) => option.value === 'getTargetColor',
  );
  const isPathLayer = activeLayer?.['@@type'] === 'GeoArrowPathLayer';
  const isGeoJsonLayer = activeLayer?.['@@type'] === 'GeoJsonLayer';
  // Keep unknown types visible if the layer already uses them.
  const activeLayerType =
    typeof activeLayer?.['@@type'] === 'string'
      ? activeLayer['@@type']
      : undefined;
  const layerTypeOptions: ReadonlyArray<{value: string; label: string}> =
    activeLayerType &&
    !DECK_MAP_LAYER_TYPE_OPTIONS.some(
      (option) => option.value === activeLayerType,
    )
      ? [
          ...DECK_MAP_LAYER_TYPE_OPTIONS,
          {value: activeLayerType, label: activeLayerType},
        ]
      : DECK_MAP_LAYER_TYPE_OPTIONS;
  // GeoJsonLayer uses pointRadius* / getPointRadius; scatterplot uses radius* / getRadius.
  const pointRadiusPixels = isGeoJsonLayer
    ? activeLayer?.pointRadiusUnits === 'pixels' &&
      typeof activeLayer?.getPointRadius === 'number'
      ? activeLayer.getPointRadius
      : ((activeLayer?.pointRadiusMinPixels as number | undefined) ?? 2)
    : activeLayer?.radiusUnits === 'pixels' &&
        typeof activeLayer?.getRadius === 'number'
      ? activeLayer.getRadius
      : ((activeLayer?.radiusMinPixels as number | undefined) ?? 2);
  const isHeatmapLayer = activeLayer?.['@@type'] === 'GeoArrowHeatmapLayer';
  const showAppearanceCard = isHeatmapLayer || colorAccessorOptions.length > 0;
  const lineWidthPixels =
    activeLayer?.widthUnits === 'pixels' &&
    typeof activeLayer?.getWidth === 'number'
      ? activeLayer.getWidth
      : ((activeLayer?.widthMinPixels as number | undefined) ??
        (showTripsSettings ? 3 : 1));

  const applyConfig = useCallback(
    (nextConfig: DeckMapConfig) => {
      if (readOnly) return;
      onConfigChange(nextConfig);
    },
    [onConfigChange, readOnly],
  );

  const setGeometryTabOverride = (tab: 'geom' | 'lonlat') => {
    setPositionTabOverride({key: geometrySessionKey, tab});
  };

  useEffect(() => {
    lastSourceGeometryColumnRef.current = undefined;
    lastArcSourceGeometryColumnRef.current = undefined;
    lastArcTargetGeometryColumnRef.current = undefined;
  }, [geometrySessionKey]);

  useEffect(() => {
    if (pointGeometryColumn) {
      lastSourceGeometryColumnRef.current = pointGeometryColumn;
    }
  }, [pointGeometryColumn]);

  useEffect(() => {
    if (nativeArcSourceGeometryColumn) {
      lastArcSourceGeometryColumnRef.current = nativeArcSourceGeometryColumn;
    }
  }, [nativeArcSourceGeometryColumn]);

  useEffect(() => {
    if (nativeArcTargetGeometryColumn) {
      lastArcTargetGeometryColumnRef.current = nativeArcTargetGeometryColumn;
    }
  }, [nativeArcTargetGeometryColumn]);

  // Drop point/heatmap radius leftovers on Column layers (pixels vs meters).
  useEffect(() => {
    if (!showColumnRadiusSetting || !activeLayer || readOnly) return;
    const needsHeal =
      activeLayer.radiusUnits === 'pixels' ||
      activeLayer.getRadius !== undefined ||
      activeLayer.radiusMinPixels !== undefined ||
      activeLayer.radiusMaxPixels !== undefined ||
      activeLayer.radiusPixels !== undefined;
    if (!needsHeal) return;
    const radius =
      typeof activeLayer.radius === 'number' &&
      Number.isFinite(activeLayer.radius) &&
      activeLayer.radius > 0
        ? activeLayer.radius
        : 50;
    applyConfig(
      setDeckMapLayerColumnRadius(mapConfig, activeLayerIndex, radius),
    );
  }, [
    activeLayer,
    activeLayerIndex,
    applyConfig,
    mapConfig,
    readOnly,
    showColumnRadiusSetting,
  ]);

  // Fix path/arc/trips where widthMaxPixels < widthMinPixels (clamps the slider).
  useEffect(() => {
    const isLineWidthLayer =
      showTripsSettings ||
      activeLayer?.['@@type'] === 'GeoArrowPathLayer' ||
      showArcColumnSetting;
    if (!isLineWidthLayer || !activeLayer || readOnly) return;

    const min =
      typeof activeLayer.widthMinPixels === 'number'
        ? activeLayer.widthMinPixels
        : undefined;
    const max =
      typeof activeLayer.widthMaxPixels === 'number'
        ? activeLayer.widthMaxPixels
        : undefined;
    if (min === undefined || max === undefined || max >= min) return;

    applyConfig(
      updateDeckMapLayer(mapConfig, activeLayerIndex, (layer) => ({
        ...layer,
        widthMinPixels: Math.min(min, max),
        widthMaxPixels: Math.max(min, max),
      })),
    );
  }, [
    activeLayer,
    activeLayerIndex,
    applyConfig,
    mapConfig,
    readOnly,
    showArcColumnSetting,
    showTripsSettings,
  ]);

  const setStrokeWidth = (value: number) => {
    applyConfig(
      updateDeckMapLayer(mapConfig, activeLayerIndex, (layer) => {
        const nextLayer: DeckMapLayerRecord = {
          ...layer,
          lineWidthUnits: 'pixels',
          lineWidthMinPixels: value,
          lineWidthMaxPixels: value,
        };
        if (typeof layer.getLineWidth !== 'string') {
          nextLayer.getLineWidth = value;
        }
        return nextLayer;
      }),
    );
  };

  const setLineWidth = (value: number) => {
    applyConfig(
      updateDeckMapLayer(mapConfig, activeLayerIndex, (layer) => {
        const nextLayer: DeckMapLayerRecord = {
          ...layer,
          widthUnits: 'pixels',
          widthMinPixels: value,
          widthMaxPixels: value,
        };
        if (typeof layer.getWidth !== 'string') {
          nextLayer.getWidth = value;
        }
        return nextLayer;
      }),
    );
  };

  const setPointRadius = (value: number) => {
    applyConfig(
      updateDeckMapLayer(mapConfig, activeLayerIndex, (layer) => {
        if (layer['@@type'] === 'GeoJsonLayer') {
          const nextLayer: DeckMapLayerRecord = {
            ...layer,
            pointRadiusUnits: 'pixels',
            pointRadiusMinPixels: value,
            pointRadiusMaxPixels: value,
          };
          if (typeof layer.getPointRadius !== 'string') {
            nextLayer.getPointRadius = value;
          }
          return nextLayer;
        }

        const nextLayer: DeckMapLayerRecord = {
          ...layer,
          radiusUnits: 'pixels',
          radiusMinPixels: value,
          radiusMaxPixels: value,
        };
        if (typeof layer.getRadius !== 'string') {
          nextLayer.getRadius = value;
        }
        return nextLayer;
      }),
    );
  };

  const setColumnRadius = (value: number) => {
    applyConfig(
      setDeckMapLayerColumnRadius(mapConfig, activeLayerIndex, value),
    );
  };

  const fillRadiusProps = showRadiusSetting
    ? {
        radiusValue: pointRadiusPixels,
        onRadiusChange: setPointRadius,
        radiusLabel: 'Point radius',
        radiusUnit: 'px',
        radiusMin: 0.1,
        radiusMax: 50,
        radiusStep: 0.1,
      }
    : showColumnRadiusSetting
      ? {
          radiusValue: (activeLayer?.radius as number | undefined) ?? 50,
          onRadiusChange: setColumnRadius,
          radiusLabel: 'Column radius',
          radiusUnit: 'm',
          radiusMin: 1,
          radiusMax: 10000,
          radiusStep: 1,
        }
      : {};

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SettingsPanelHeader
        title="Map settings"
        className="shrink-0 p-2"
        actions={
          customConfig ? undefined : (
            <DeckMapCodeViewToggleButton
              label={showCode ? 'Show settings' : 'View code'}
              selected={showCode}
              onClick={() =>
                setViewMode((currentViewMode) =>
                  currentViewMode === 'code' ? 'settings' : 'code',
                )
              }
            />
          )
        }
        onClose={onClose}
        closeLabel="Close map settings"
      />

      <div className="flex shrink-0 flex-col gap-2 px-2 pb-2">
        <Field label="Title">
          <input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Map title"
            disabled={readOnly}
            className="border-input placeholder:text-muted-foreground focus-visible:ring-ring h-8 w-full rounded-md border bg-transparent px-3 py-2 text-xs font-medium shadow-sm outline-hidden transition-colors focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </Field>
        <DeckMapBasemapSelect
          config={config}
          onConfigChange={onConfigChange}
          readOnly={readOnly}
        />
      </div>
      {showCode ? (
        <DeckMapCodeViewerPanel
          value={serializedMapConfig}
          copyTooltipLabel="Copy map config"
        />
      ) : (
        <ScrollArea className="min-h-0 flex-1 [&_[data-radix-scroll-area-viewport]>div]:!block">
          <div className="flex flex-col gap-2 p-2 pt-0">
            <Field label="Dataset" required>
              <DataTableSelector
                onChange={handleTableChange}
                tables={tables}
                value={sourceDataTable}
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
                    <SelectTrigger className="w-full text-xs">
                      <SelectValue placeholder="Select layer type" />
                    </SelectTrigger>
                    <SelectContent>
                      {layerTypeOptions.map((option) => (
                        <SelectItem
                          key={option.value}
                          value={option.value}
                          className="text-xs"
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                {(datasetSchema.isLoading || datasetSchemaErrorMessage) && (
                  <div className="text-muted-foreground rounded-md border px-2 py-1.5 text-xs">
                    {datasetSchema.isLoading
                      ? 'Inspecting dataset schema...'
                      : `Dataset schema unavailable: ${datasetSchemaErrorMessage}`}
                  </div>
                )}

                {showAppearanceCard && (
                  <Field label="Appearance">
                    <div className="flex flex-col gap-2 rounded-md border p-2">
                      {isHeatmapLayer ? (
                        <>
                          <SettingsSliderField
                            label={`Radius: ${(activeLayer?.radiusPixels as number | undefined) ?? 30}px`}
                          >
                            <Slider
                              min={1}
                              max={100}
                              step={1}
                              value={[
                                (activeLayer?.radiusPixels as
                                  | number
                                  | undefined) ?? 30,
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
                          </SettingsSliderField>
                          <Select
                            value={detectHeatmapScheme(activeLayer?.colorRange)}
                            onValueChange={(value) =>
                              applyConfig(
                                updateDeckMapLayer(
                                  mapConfig,
                                  activeLayerIndex,
                                  (layer) => ({
                                    ...layer,
                                    colorRange:
                                      heatmapSchemeToColorRange(value),
                                  }),
                                ),
                              )
                            }
                          >
                            <SelectTrigger className="w-full [&>span]:line-clamp-none">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {continuousSequentialSchemes.map((scheme) => (
                                <SelectItem key={scheme} value={scheme}>
                                  <ColorSchemeOptionLabel
                                    scheme={scheme}
                                    type="sequential"
                                  />
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <AppearanceOpacitySlider
                            valuePercent={getLayerOpacityPercent(activeLayer)}
                            disabled={readOnly}
                            onChange={(percent) => {
                              applyConfig(
                                updateDeckMapLayer(
                                  mapConfig,
                                  activeLayerIndex,
                                  (layer) => ({
                                    ...layer,
                                    opacity: percent / 100,
                                  }),
                                ),
                              );
                            }}
                          />
                        </>
                      ) : (
                        <>
                          {(showTripsSettings ||
                            isPathLayer ||
                            showArcColumnSetting) && (
                            <SettingsSliderField
                              label={`${
                                showTripsSettings ? 'Trip width' : 'Line width'
                              }: ${lineWidthPixels}px`}
                            >
                              <Slider
                                min={1}
                                max={20}
                                step={1}
                                value={[lineWidthPixels]}
                                onValueChange={(values) =>
                                  setLineWidth(values[0] ?? lineWidthPixels)
                                }
                              />
                            </SettingsSliderField>
                          )}

                          {showArcColumnSetting ? (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-medium">
                                Flat lines
                              </span>
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
                          ) : null}

                          {showTripsSettings ? (
                            <SettingsSliderField
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
                            </SettingsSliderField>
                          ) : null}

                          {hasFillColor && hasLineColor && showStrokeSetting ? (
                            <Tabs
                              key={`appearance-fill-stroke${showExtrusionSettings ? '-extrusion' : ''}`}
                              defaultValue="fill"
                              className="w-full"
                            >
                              <TabsList
                                className={`grid h-8 w-full ${showExtrusionSettings ? 'grid-cols-3' : 'grid-cols-2'}`}
                              >
                                <TabsTrigger value="fill" className="text-xs">
                                  Fill
                                </TabsTrigger>
                                <TabsTrigger value="stroke" className="text-xs">
                                  Stroke
                                </TabsTrigger>
                                {showExtrusionSettings ? (
                                  <TabsTrigger
                                    value="extrusion"
                                    className="text-xs"
                                  >
                                    Extrusion
                                  </TabsTrigger>
                                ) : null}
                              </TabsList>
                              <TabsContent value="fill" className="mt-2">
                                <AppearanceColorChannel
                                  accessor="getFillColor"
                                  layer={activeLayer}
                                  columns={dataOutputColumns}
                                  mapConfig={mapConfig}
                                  layerIndex={activeLayerIndex}
                                  applyConfig={applyConfig}
                                  lastColorScaleFieldsRef={
                                    lastColorScaleFieldsRef
                                  }
                                  readOnly={readOnly}
                                  {...fillRadiusProps}
                                />
                              </TabsContent>
                              <TabsContent value="stroke" className="mt-2">
                                <AppearanceColorChannel
                                  accessor="getLineColor"
                                  layer={activeLayer}
                                  columns={dataOutputColumns}
                                  mapConfig={mapConfig}
                                  layerIndex={activeLayerIndex}
                                  applyConfig={applyConfig}
                                  lastColorScaleFieldsRef={
                                    lastColorScaleFieldsRef
                                  }
                                  readOnly={readOnly}
                                  enabled={strokeEnabled}
                                  onEnabledChange={(checked) =>
                                    applyConfig(
                                      updateDeckMapLayer(
                                        mapConfig,
                                        activeLayerIndex,
                                        (layer) => {
                                          if (checked) {
                                            return {...layer, stroked: true};
                                          }
                                          // Clear stroke color scale when stroke is off.
                                          const next: DeckMapLayerRecord = {
                                            ...layer,
                                            stroked: false,
                                          };
                                          if (
                                            getDeckMapLayerColorScale(
                                              next,
                                              'getLineColor',
                                            )
                                          ) {
                                            return replaceDeckMapLayerColorScaleWithFlat(
                                              next,
                                              'getLineColor',
                                              DECK_MAP_DEFAULT_STROKE_COLOR,
                                            );
                                          }
                                          return next;
                                        },
                                      ),
                                    )
                                  }
                                  enableLabel="Stroke"
                                  defaultFlatColor={
                                    DECK_MAP_DEFAULT_STROKE_COLOR
                                  }
                                  widthPixels={strokeWidthPixels}
                                  onWidthChange={setStrokeWidth}
                                  widthLabel="Stroke width"
                                  extrusionDisablesStroke={
                                    usesStrokeExtrusionWarning(
                                      activeLayer?.['@@type'],
                                    ) && getDeckMapLayerExtruded(activeLayer)
                                  }
                                />
                              </TabsContent>
                              {showExtrusionSettings ? (
                                <TabsContent value="extrusion" className="mt-2">
                                  <AppearanceExtrusionPanel
                                    layer={activeLayer}
                                    columns={dataOutputColumns}
                                    mapConfig={mapConfig}
                                    layerIndex={activeLayerIndex}
                                    applyConfig={applyConfig}
                                    readOnly={readOnly}
                                  />
                                </TabsContent>
                              ) : null}
                            </Tabs>
                          ) : hasFillColor && showExtrusionSettings ? (
                            <Tabs
                              key="appearance-fill-extrusion"
                              defaultValue="fill"
                              className="w-full"
                            >
                              <TabsList className="grid h-8 w-full grid-cols-2">
                                <TabsTrigger value="fill" className="text-xs">
                                  Fill
                                </TabsTrigger>
                                <TabsTrigger
                                  value="extrusion"
                                  className="text-xs"
                                >
                                  Extrusion
                                </TabsTrigger>
                              </TabsList>
                              <TabsContent value="fill" className="mt-2">
                                <AppearanceColorChannel
                                  accessor="getFillColor"
                                  layer={activeLayer}
                                  columns={dataOutputColumns}
                                  mapConfig={mapConfig}
                                  layerIndex={activeLayerIndex}
                                  applyConfig={applyConfig}
                                  lastColorScaleFieldsRef={
                                    lastColorScaleFieldsRef
                                  }
                                  readOnly={readOnly}
                                  {...fillRadiusProps}
                                />
                              </TabsContent>
                              <TabsContent value="extrusion" className="mt-2">
                                <AppearanceExtrusionPanel
                                  layer={activeLayer}
                                  columns={dataOutputColumns}
                                  mapConfig={mapConfig}
                                  layerIndex={activeLayerIndex}
                                  applyConfig={applyConfig}
                                  readOnly={readOnly}
                                />
                              </TabsContent>
                            </Tabs>
                          ) : hasFillColor ? (
                            <AppearanceColorChannel
                              accessor="getFillColor"
                              layer={activeLayer}
                              columns={dataOutputColumns}
                              mapConfig={mapConfig}
                              layerIndex={activeLayerIndex}
                              applyConfig={applyConfig}
                              lastColorScaleFieldsRef={lastColorScaleFieldsRef}
                              readOnly={readOnly}
                              {...fillRadiusProps}
                            />
                          ) : null}

                          {hasSourceColor && hasTargetColor ? (
                            <AppearanceArcColorPanel
                              layer={activeLayer}
                              columns={dataOutputColumns}
                              mapConfig={mapConfig}
                              layerIndex={activeLayerIndex}
                              applyConfig={applyConfig}
                              lastColorScaleFieldsRef={lastColorScaleFieldsRef}
                              readOnly={readOnly}
                            />
                          ) : null}

                          {hasPathColor ? (
                            <AppearanceColorChannel
                              accessor="getColor"
                              layer={activeLayer}
                              columns={dataOutputColumns}
                              mapConfig={mapConfig}
                              layerIndex={activeLayerIndex}
                              applyConfig={applyConfig}
                              lastColorScaleFieldsRef={lastColorScaleFieldsRef}
                              readOnly={readOnly}
                            />
                          ) : null}
                        </>
                      )}
                    </div>
                  </Field>
                )}

                {showGeometryGroup ? (
                  <Field label="Geometry">
                    <div className="flex flex-col gap-2 rounded-md border p-2">
                      {showPointGeometryGroup && hasPointGeometryColumns ? (
                        <Tabs
                          value={positionTab}
                          onValueChange={(value) => {
                            if (value === 'lonlat') {
                              setGeometryTabOverride('lonlat');
                              return;
                            }
                            if (value !== 'geom') return;
                            setGeometryTabOverride('geom');
                            const geometryColumn =
                              pickDeckMapSourceGeometryColumn(
                                pointGeometryColumns,
                                lastSourceGeometryColumnRef.current,
                              );
                            if (!geometryColumn) return;
                            applyConfig(
                              setDeckMapLayerGeometryColumn(
                                mapConfig,
                                activeLayerIndex,
                                geometryColumn,
                              ),
                            );
                          }}
                          className="w-full"
                        >
                          <TabsList className="grid h-8 w-full grid-cols-2">
                            <TabsTrigger value="geom" className="text-xs">
                              Geom
                            </TabsTrigger>
                            <TabsTrigger value="lonlat" className="text-xs">
                              Lon/Lat
                            </TabsTrigger>
                          </TabsList>
                          <TabsContent value="geom" className="mt-2">
                            <ColumnsProvider columns={pointGeometryColumns}>
                              <ColumnSelector
                                kind="geometry"
                                value={pointGeometryColumn}
                                onChange={(geometryColumn) => {
                                  setGeometryTabOverride('geom');
                                  applyConfig(
                                    setDeckMapLayerGeometryColumn(
                                      mapConfig,
                                      activeLayerIndex,
                                      geometryColumn,
                                    ),
                                  );
                                }}
                                placeholder="Select geometry column..."
                                disabled={readOnly}
                              />
                            </ColumnsProvider>
                          </TabsContent>
                          <TabsContent value="lonlat" className="mt-2">
                            <PointLonLatFields
                              latitudeColumn={latitudeColumn}
                              longitudeColumn={longitudeColumn}
                              sourceColumns={sourceColumns}
                              mapConfig={mapConfig}
                              layerIndex={activeLayerIndex}
                              applyConfig={applyConfig}
                              onSelectLonLat={() =>
                                setGeometryTabOverride('lonlat')
                              }
                              readOnly={readOnly}
                            />
                          </TabsContent>
                        </Tabs>
                      ) : showPointGeometryGroup ? (
                        <PointLonLatFields
                          latitudeColumn={latitudeColumn}
                          longitudeColumn={longitudeColumn}
                          sourceColumns={sourceColumns}
                          mapConfig={mapConfig}
                          layerIndex={activeLayerIndex}
                          applyConfig={applyConfig}
                          readOnly={readOnly}
                        />
                      ) : null}

                      {showPathPolygonGeometryGroup ? (
                        <ColumnsProvider columns={pathPolygonGeometryColumns}>
                          <ColumnSelector
                            kind={
                              pointGeometryColumns.length > 0
                                ? 'geometry'
                                : 'all'
                            }
                            value={boundPointGeometryColumn}
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
                            disabled={readOnly}
                          />
                        </ColumnsProvider>
                      ) : null}

                      {showTripsTimestampGroup ? (
                        <ColumnsProvider columns={outputColumns}>
                          <Field label="Timestamp">
                            <ColumnSelector
                              value={
                                activeLayerBinding?.timestampColumn as
                                  | string
                                  | undefined
                              }
                              onChange={(timestampColumn) =>
                                applyConfig(
                                  setDeckMapLayerTimestampColumn(
                                    mapConfig,
                                    activeLayerIndex,
                                    timestampColumn,
                                  ),
                                )
                              }
                              placeholder="Select timestamp column..."
                              disabled={readOnly}
                            />
                          </Field>
                        </ColumnsProvider>
                      ) : null}

                      {showH3GeometryGroup ? (
                        <ColumnsProvider columns={outputColumns}>
                          <Field label="H3 index">
                            <ColumnSelector
                              value={
                                activeLayerBinding?.hexagonColumn as
                                  | string
                                  | undefined
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
                              disabled={readOnly}
                            />
                          </Field>
                        </ColumnsProvider>
                      ) : null}

                      {showArcGeometryGroup && hasArcGeometryColumns ? (
                        <Tabs
                          value={arcTab}
                          onValueChange={(value) => {
                            if (value === 'lonlat') {
                              setGeometryTabOverride('lonlat');
                              return;
                            }
                            if (value !== 'geom') return;
                            setGeometryTabOverride('geom');
                            const restored = pickDeckMapArcGeometryColumns(
                              arcGeometryColumns,
                              {
                                sourceGeometryColumn:
                                  lastArcSourceGeometryColumnRef.current,
                                targetGeometryColumn:
                                  lastArcTargetGeometryColumnRef.current,
                              },
                            );
                            if (
                              !restored.sourceGeometryColumn &&
                              !restored.targetGeometryColumn
                            ) {
                              return;
                            }
                            applyConfig(
                              setDeckMapLayerArcGeometryColumns(
                                mapConfig,
                                activeLayerIndex,
                                {
                                  sourceGeometryColumn:
                                    restored.sourceGeometryColumn ?? null,
                                  targetGeometryColumn:
                                    restored.targetGeometryColumn ?? null,
                                },
                              ),
                            );
                          }}
                          className="w-full"
                        >
                          <TabsList className="grid h-8 w-full grid-cols-2">
                            <TabsTrigger value="geom" className="text-xs">
                              Geom
                            </TabsTrigger>
                            <TabsTrigger value="lonlat" className="text-xs">
                              Lon/Lat
                            </TabsTrigger>
                          </TabsList>
                          <TabsContent value="geom" className="mt-2">
                            <ColumnsProvider columns={arcGeometryColumns}>
                              <div className="flex flex-col gap-2">
                                <Field label="Source geometry">
                                  <ColumnSelector
                                    kind="geometry"
                                    value={nativeArcSourceGeometryColumn}
                                    onChange={(sourceGeometryColumn) => {
                                      setGeometryTabOverride('geom');
                                      applyConfig(
                                        setDeckMapLayerArcGeometryColumns(
                                          mapConfig,
                                          activeLayerIndex,
                                          {sourceGeometryColumn},
                                        ),
                                      );
                                    }}
                                    placeholder="Select source geometry..."
                                    disabled={readOnly}
                                  />
                                </Field>
                                <Field label="Target geometry">
                                  <ColumnSelector
                                    kind="geometry"
                                    value={nativeArcTargetGeometryColumn}
                                    onChange={(targetGeometryColumn) => {
                                      setGeometryTabOverride('geom');
                                      applyConfig(
                                        setDeckMapLayerArcGeometryColumns(
                                          mapConfig,
                                          activeLayerIndex,
                                          {targetGeometryColumn},
                                        ),
                                      );
                                    }}
                                    placeholder="Select target geometry..."
                                    disabled={readOnly}
                                  />
                                </Field>
                              </div>
                            </ColumnsProvider>
                          </TabsContent>
                          <TabsContent value="lonlat" className="mt-2">
                            <ArcLonLatFields
                              sourceLatitudeColumn={
                                activeLayerBinding?.sourceLatitudeColumn as
                                  | string
                                  | undefined
                              }
                              sourceLongitudeColumn={
                                activeLayerBinding?.sourceLongitudeColumn as
                                  | string
                                  | undefined
                              }
                              targetLatitudeColumn={
                                activeLayerBinding?.targetLatitudeColumn as
                                  | string
                                  | undefined
                              }
                              targetLongitudeColumn={
                                activeLayerBinding?.targetLongitudeColumn as
                                  | string
                                  | undefined
                              }
                              sourceColumns={sourceColumns}
                              mapConfig={mapConfig}
                              layerIndex={activeLayerIndex}
                              applyConfig={applyConfig}
                              onSelectLonLat={() =>
                                setGeometryTabOverride('lonlat')
                              }
                              readOnly={readOnly}
                            />
                          </TabsContent>
                        </Tabs>
                      ) : showArcGeometryGroup ? (
                        <ArcLonLatFields
                          sourceLatitudeColumn={
                            activeLayerBinding?.sourceLatitudeColumn as
                              | string
                              | undefined
                          }
                          sourceLongitudeColumn={
                            activeLayerBinding?.sourceLongitudeColumn as
                              | string
                              | undefined
                          }
                          targetLatitudeColumn={
                            activeLayerBinding?.targetLatitudeColumn as
                              | string
                              | undefined
                          }
                          targetLongitudeColumn={
                            activeLayerBinding?.targetLongitudeColumn as
                              | string
                              | undefined
                          }
                          sourceColumns={sourceColumns}
                          mapConfig={mapConfig}
                          layerIndex={activeLayerIndex}
                          applyConfig={applyConfig}
                          readOnly={readOnly}
                        />
                      ) : null}
                    </div>
                  </Field>
                ) : null}
              </div>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};
