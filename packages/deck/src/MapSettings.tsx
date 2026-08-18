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
} from '@sqlrooms/ui';
import {isDeckMapTableDatasetSource, type DeckMapConfig} from './mapConfig';
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
  setDeckMapLayerHexagonColumn,
  setDeckMapLayerArcColumns,
  setDeckMapLayerTimestampColumn,
  setDeckMapLayerType,
  setDeckMapLayerColumnRadius,
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
  usesStrokeSetting,
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
} from './MapSettingsControls';
import {regenerateMapConfigForTable} from './mapConfigUtils';
import {useDeckMapDatasetSchema} from './useDeckMapDatasetSchema';

const HEATMAP_COLOR_STEPS = 6;
const EMPTY_COLUMNS: DataTable['columns'] = [];

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
          <span className="text-xs font-medium">{enableLabel}</span>
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
}) => {
  const [layerIndex, setLayerIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'settings' | 'code'>(
    customConfig ? 'code' : 'settings',
  );
  // Last color-scale field per accessor (restored when re-enabling a scale).
  const lastColorScaleFieldsRef = useRef<
    Partial<Record<DeckMapLayerColorAccessor, string>>
  >({});

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
  const sourceDataTable = selectedDataTable ?? fallbackTable;
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
      tableName: selectedDataTable
        ? getTableIdentity(selectedDataTable.table)
        : activeLayerDatasetSource.tableName,
      ...(activeLayerDatasetSource.transformSql
        ? {transformSql: activeLayerDatasetSource.transformSql}
        : {}),
    };
  }, [activeLayerDatasetSource, selectedDataTable]);
  const datasetSchema = useDeckMapDatasetSchema({
    source: resolvedActiveLayerDatasetSource,
    sourceColumns,
  });
  const outputColumns = datasetSchema.outputColumns;
  const dataOutputColumns = datasetSchema.dataOutputColumns;
  const datasetSchemaErrorMessage = datasetSchema.error?.message;

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

      {showCode ? (
        <DeckMapCodeViewerPanel
          value={serializedMapConfig}
          copyTooltipLabel="Copy map config"
        />
      ) : (
        <ScrollArea className="min-h-0 flex-1 [&_[data-radix-scroll-area-viewport]>div]:!block">
          <div className="flex flex-col gap-2 p-2 pt-0">
            <Field label="Title">
              <input
                value={title}
                onChange={(e) => onTitleChange(e.target.value)}
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
                      {layerTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
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
                                    colorRange: schemeToColorRange(value),
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

                {outputColumns.length > 0 && showGeometryColumnSetting && (
                  <ColumnsProvider columns={outputColumns}>
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
                        disabled={readOnly}
                      />
                    </Field>
                  </ColumnsProvider>
                )}

                {outputColumns.length > 0 && showTripsSettings && (
                  <ColumnsProvider columns={outputColumns}>
                    <Field label="Timestamp column" required>
                      <ColumnSelector
                        value={
                          (
                            activeLayer?._sqlroomsBinding as Record<
                              string,
                              unknown
                            >
                          )?.timestampColumn as string | undefined
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
                )}

                {outputColumns.length > 0 && showH3ColumnSetting && (
                  <ColumnsProvider columns={outputColumns}>
                    <Field label="H3 column" required>
                      <ColumnSelector
                        value={
                          (
                            activeLayer?._sqlroomsBinding as Record<
                              string,
                              unknown
                            >
                          )?.hexagonColumn as string | undefined
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
                )}

                {outputColumns.length > 0 && showArcColumnSetting && (
                  <ColumnsProvider columns={outputColumns}>
                    <Field label="Source geometry" required>
                      <ColumnSelector
                        value={
                          (
                            activeLayer?._sqlroomsBinding as Record<
                              string,
                              unknown
                            >
                          )?.sourceGeometryColumn as string | undefined
                        }
                        onChange={(sourceGeometryColumn) =>
                          applyConfig(
                            setDeckMapLayerArcColumns(
                              mapConfig,
                              activeLayerIndex,
                              {
                                sourceGeometryColumn,
                              },
                            ),
                          )
                        }
                        placeholder="Select source geometry..."
                        disabled={readOnly}
                      />
                    </Field>
                    <Field label="Target geometry" required>
                      <ColumnSelector
                        value={
                          (
                            activeLayer?._sqlroomsBinding as Record<
                              string,
                              unknown
                            >
                          )?.targetGeometryColumn as string | undefined
                        }
                        onChange={(targetGeometryColumn) =>
                          applyConfig(
                            setDeckMapLayerArcColumns(
                              mapConfig,
                              activeLayerIndex,
                              {
                                targetGeometryColumn,
                              },
                            ),
                          )
                        }
                        placeholder="Select target geometry..."
                        disabled={readOnly}
                      />
                    </Field>
                  </ColumnsProvider>
                )}
              </div>
            )}

            {sourceDataTable &&
              !showGeometryColumnSetting &&
              !showH3ColumnSetting &&
              !showArcColumnSetting && (
                <ColumnsProvider columns={sourceColumns}>
                  <Field label="Latitude column" required>
                    <ColumnSelector.Numeric
                      value={mapConfig.fitToData?.latitudeColumn}
                      onChange={(latitudeColumn) => {
                        const longitudeColumn =
                          mapConfig.fitToData?.longitudeColumn;
                        applyConfig(
                          regenerateMapConfigForTable(
                            {config: mapConfig},
                            sourceDataTable,
                            longitudeColumn,
                            latitudeColumn,
                          ) as DeckMapConfig,
                        );
                      }}
                      disabled={readOnly}
                    />
                  </Field>
                  <Field label="Longitude column" required>
                    <ColumnSelector.Numeric
                      value={mapConfig.fitToData?.longitudeColumn}
                      onChange={(longitudeColumn) => {
                        const latitudeColumn =
                          mapConfig.fitToData?.latitudeColumn;
                        applyConfig(
                          regenerateMapConfigForTable(
                            {config: mapConfig},
                            sourceDataTable,
                            longitudeColumn,
                            latitudeColumn,
                          ) as DeckMapConfig,
                        );
                      }}
                      disabled={readOnly}
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
