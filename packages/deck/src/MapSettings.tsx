import {
  FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
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
  setDeckMapLayerColorScale,
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
  withoutDeckMapLayerOpacityIfUnused,
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

/** Pick a color-scale type that matches the selected field's column kind. */
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

/** First column that the color-field selector can show for this scale type. */
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

/**
 * Choose field first, then coerce type to match that field (avoids sequential
 * scales on string/boolean-only tables).
 */
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

/** Sample CSS colors for a named scheme, used as dropdown ramp previews. */
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

/** Build a CSS gradient that covers edge-to-edge without light fringe gaps. */
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

/**
 * Theme-aware color control: shows the selected color as a swatch with the app
 * border/focus styles. The native `<input type="color">` chrome is hidden so it
 * does not flash a white OS control on dark themes.
 */
const ColorSwatchInput: FC<{
  value: string;
  onChange: (hex: string) => void;
  disabled?: boolean;
  'aria-label': string;
}> = ({value, onChange, disabled, 'aria-label': ariaLabel}) => (
  <label
    className={cn(
      'border-input relative h-8 w-10 shrink-0 overflow-hidden rounded-md border',
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

function alphaToOpacityPercent(alpha: number): number {
  return Math.round((Math.max(0, Math.min(255, alpha)) / 255) * 100);
}

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

const AppearanceOpacitySlider: FC<{
  valuePercent: number;
  onChange: (percent: number) => void;
  disabled?: boolean;
}> = ({valuePercent, onChange, disabled}) => (
  <Field label={`Opacity: ${valuePercent}%`}>
    <div className="pt-0.5">
      <Slider
        min={0}
        max={100}
        step={1}
        value={[valuePercent]}
        disabled={disabled}
        onValueChange={(values) => onChange(values[0] ?? valuePercent)}
      />
    </div>
  </Field>
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
  /** Optional enable switch (stroke on/off). */
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

/**
 * Color controls for one Appearance channel: optional enable, scale toggle,
 * flat color or scale settings, and optional width/radius sliders.
 */
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
  radiusMin = 1,
  radiusMax = 50,
  radiusStep = 1,
}) => {
  const colorScale = getDeckMapLayerColorScale(layer, accessor);
  const flatColor = getDeckMapLayerFlatColor(layer, accessor) ?? [
    ...defaultFlatColor,
  ];
  const colorScaleType = colorScale?.type ?? 'sequential';
  const schemeOptions = getSchemeOptions(colorScaleType);
  // Prefer ref-backed last field only in event handlers — reading refs during
  // render trips react-hooks/refs. First matching column is enough for enable.
  const defaultField = getDefaultColorScaleField(columns, colorScaleType);
  const showControls = enabled !== false;
  const opacityPercent = colorScale
    ? getLayerOpacityPercent(layer)
    : alphaToOpacityPercent(flatColor[3] ?? 255);

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
      setDeckMapLayerColorScale(
        mapConfig,
        layerIndex,
        accessor,
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
        <Field label={`${widthLabel}: ${widthPixels}px`}>
          <div className="pt-0.5">
            <Slider
              min={1}
              max={20}
              step={1}
              value={[widthPixels]}
              onValueChange={(values) => onWidthChange(values[0] ?? 1)}
            />
          </div>
        </Field>
      ) : null}

      {showControls && onRadiusChange && radiusValue !== undefined ? (
        <Field label={`${radiusLabel}: ${radiusValue}${radiusUnit}`}>
          <div className="pt-0.5">
            <Slider
              min={radiusMin}
              max={radiusMax}
              step={radiusStep}
              value={[radiusValue]}
              onValueChange={(values) =>
                onRadiusChange(values[0] ?? radiusValue)
              }
            />
          </div>
        </Field>
      ) : null}

      {showControls ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium">Color scale</span>
            <Switch
              checked={Boolean(colorScale)}
              disabled={!defaultField || readOnly}
              aria-label="Color scale"
              onCheckedChange={(checked) => {
                if (checked) {
                  updateColorScale({});
                  return;
                }
                if (colorScale?.field) {
                  lastColorScaleFieldsRef.current[accessor] = colorScale.field;
                }
                // Drop scale-owned layer.opacity only if no other channel still
                // needs it (e.g. fill scale + flat stroke).
                applyConfig(
                  updateDeckMapLayer(
                    clearDeckMapLayerColorScale(
                      mapConfig,
                      layerIndex,
                      accessor,
                    ),
                    layerIndex,
                    (nextLayer) =>
                      withoutDeckMapLayerOpacityIfUnused(nextLayer),
                  ),
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
              if (colorScale) {
                applyConfig(
                  updateDeckMapLayer(mapConfig, layerIndex, (nextLayer) => ({
                    ...nextLayer,
                    opacity: percent / 100,
                  })),
                );
                return;
              }
              // Flat-color alpha owns opacity for this channel; keep layer.opacity
              // when another accessor still uses a color scale.
              applyConfig(
                updateDeckMapLayer(mapConfig, layerIndex, (nextLayer) =>
                  withoutDeckMapLayerOpacityIfUnused(
                    {
                      ...nextLayer,
                      [accessor]: [
                        flatColor[0],
                        flatColor[1],
                        flatColor[2],
                        opacityPercentToAlpha(percent),
                      ],
                    },
                    accessor,
                  ),
                ),
              );
            }}
          />
        </>
      ) : null}
    </div>
  );
};

/**
 * Arc colors: one Color scale toggle. Off → source + target pickers.
 * On → a single shared color-scale configurator applied to both ends.
 */
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
  // Prefer ref-backed last field only in event handlers — reading refs during
  // render trips react-hooks/refs. First matching column is enough for enable.
  const defaultField = getDefaultColorScaleField(columns, colorScaleType);
  const sourceFlat = getDeckMapLayerFlatColor(layer, 'getSourceColor') ?? [
    ...DECK_MAP_DEFAULT_LAYER_COLOR,
  ];
  const targetFlat = getDeckMapLayerFlatColor(layer, 'getTargetColor') ?? [
    ...DECK_MAP_DEFAULT_LAYER_COLOR,
  ];
  const opacityPercent = colorScale
    ? getLayerOpacityPercent(layer)
    : alphaToOpacityPercent(
        Math.round(((sourceFlat[3] ?? 255) + (targetFlat[3] ?? 255)) / 2),
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
    const nextScale = createDeckMapLayerColorScale({
      field,
      type,
      scheme,
      title: field,
    });

    applyConfig(
      updateDeckMapLayer(mapConfig, layerIndex, (nextLayer) => ({
        ...nextLayer,
        getSourceColor: nextScale,
        getTargetColor: nextScale,
      })),
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
          disabled={!defaultField || readOnly}
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
              updateDeckMapLayer(mapConfig, layerIndex, (nextLayer) =>
                withoutDeckMapLayerOpacityIfUnused({
                  ...nextLayer,
                  getSourceColor: [...DECK_MAP_DEFAULT_LAYER_COLOR],
                  getTargetColor: [...DECK_MAP_DEFAULT_LAYER_COLOR],
                }),
              ),
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
          if (colorScale) {
            applyConfig(
              updateDeckMapLayer(mapConfig, layerIndex, (nextLayer) => ({
                ...nextLayer,
                opacity: percent / 100,
              })),
            );
            return;
          }
          const alpha = opacityPercentToAlpha(percent);
          applyConfig(
            updateDeckMapLayer(mapConfig, layerIndex, (nextLayer) =>
              withoutDeckMapLayerOpacityIfUnused(
                {
                  ...nextLayer,
                  getSourceColor: [
                    sourceFlat[0],
                    sourceFlat[1],
                    sourceFlat[2],
                    alpha,
                  ],
                  getTargetColor: [
                    targetFlat[0],
                    targetFlat[1],
                    targetFlat[2],
                    alpha,
                  ],
                },
                ['getSourceColor', 'getTargetColor'],
              ),
            ),
          );
        }}
      />
    </div>
  );
};

/** Extrusion controls for the Appearance Extrusion tab. */
const AppearanceExtrusionPanel: FC<{
  layer: DeckMapLayerRecord | undefined;
  columns: DataTable['columns'];
  mapConfig: DeckMapConfig;
  layerIndex: number;
  applyConfig: (config: DeckMapConfig) => void;
  readOnly?: boolean;
}> = ({layer, columns, mapConfig, layerIndex, applyConfig, readOnly}) => {
  // H3 defaults extruded when omitted — match DeckH3HexagonLayer.defaultProps.
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
        <Field
          label={`Elevation scale: ${(layer?.elevationScale as number | undefined) ?? 1}x`}
        >
          <div className="pt-1.5">
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
          </div>
        </Field>
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
}) => {
  const [layerIndex, setLayerIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'settings' | 'code'>('settings');
  // Remember the last color-scale field per accessor so re-enabling the scale
  // can restore it when the column is still available.
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
  const showCode = viewMode === 'code';
  const layers = getDeckMapLayerRecords(mapConfig);
  const activeLayerIndex = Math.min(layerIndex, Math.max(layers.length - 1, 0));
  const activeLayer = layers[activeLayerIndex];
  const activeLayerDatasetId = getDeckMapLayerDatasetId(activeLayer);
  const activeLayerDataset = activeLayerDatasetId
    ? mapConfig.datasets?.[activeLayerDatasetId]
    : undefined;

  // Resolve the structured source table separately from the compiled dataset
  // output. Coordinate selectors edit the source transform, while render
  // bindings such as geometry/color/elevation target output columns.
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

  // Heal Column layers that still carry scatterplot/heatmap radius units.
  // Otherwise the UI says "Nm" while deck interprets radius as pixels.
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

  // Heal path/arc/trips widths where widthMaxPixels < widthMinPixels. That caps
  // rendered width below the slider max (e.g. max 10 while the slider goes to 20).
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

    const getWidth =
      typeof activeLayer.getWidth === 'number' ? activeLayer.getWidth : 0;
    const value = Math.max(min, max, getWidth);
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
        // Path/Arc/Trips use getWidth as the stroke width; keep it in sync with
        // the slider so widthMaxPixels cannot silently clamp above ~10px.
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
        radiusMin: 1,
        radiusMax: 50,
        radiusStep: 1,
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
          <DeckMapCodeViewToggleButton
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
                      {DECK_MAP_LAYER_TYPE_OPTIONS.map((option) => (
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
                          <Field
                            label={`Radius: ${(activeLayer?.radiusPixels as number | undefined) ?? 30}px`}
                          >
                            <div className="pt-0.5">
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
                            </div>
                          </Field>
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
                            <Field label={`Line width: ${lineWidthPixels}px`}>
                              <div className="pt-0.5">
                                <Slider
                                  min={1}
                                  max={20}
                                  step={1}
                                  value={[lineWidthPixels]}
                                  onValueChange={(values) =>
                                    setLineWidth(values[0] ?? lineWidthPixels)
                                  }
                                />
                              </div>
                            </Field>
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
                            <Field
                              label={`Trail length: ${Math.round(((activeLayer?._trailLengthFactor as number | undefined) ?? 0.4) * 100)}%`}
                            >
                              <div className="pt-0.5">
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
                              </div>
                            </Field>
                          ) : null}

                          {hasFillColor && hasLineColor && showStrokeSetting ? (
                            <Tabs defaultValue="fill" className="w-full">
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
                                        (layer) => ({
                                          ...layer,
                                          stroked: checked,
                                        }),
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
                            <Tabs defaultValue="fill" className="w-full">
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
