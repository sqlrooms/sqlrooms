import {ToolErrorMessage} from '@sqlrooms/ai-core';
import {arrowTableToJson} from '@sqlrooms/duckdb';
import {
  AspectRatio,
  cn,
  useAspectRatioDimensions,
  useTheme,
} from '@sqlrooms/ui';
import {safeJsonParse} from '@sqlrooms/utils';
import * as arrow from 'apache-arrow';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useVegaEmbed} from 'react-vega';
import {EmbedOptions, VisualizationSpec} from 'vega-embed';
import {Config} from 'vega-lite';
import {darkTheme} from './themes/darkTheme';
import {lightTheme} from './themes/lightTheme';
import {VegaChartActions} from './VegaChartActions';
import {VegaChartContextProvider} from './VegaChartContext';
import {VegaEditAction} from './VegaEditAction';
import {VegaExportAction} from './VegaExportAction';

/**
 * Brush selection ranges emitted by the Vega signal listener.
 * Keys are field names; values are either numeric ranges or categorical arrays.
 */
export type VegaBrushSelectionRanges = Record<
  string,
  [number, number] | string[]
>;

export type VegaLiteArrowChartProps = {
  className?: string;
  width?: number | 'auto';
  height?: number | 'auto';
  aspectRatio?: number;
  spec: string | VisualizationSpec;
  options?: EmbedOptions;
  arrowTable: arrow.Table | undefined;
  /**
   * Optional callback invoked when the user interacts with data in the chart.
   * When provided, a selection param is automatically injected into the
   * Vega-Lite spec: interval (drag) for continuous axes, point (click) for
   * nominal/ordinal axes (bar charts, pie charts, heatmaps, etc.).
   * Pass `undefined`/omit to disable.
   */
  onBrushSelection?: (selectedRanges: VegaBrushSelectionRanges) => void;
  /**
   * Children for composing actions and other elements.
   * Use VegaLiteArrowChart.Actions to add action buttons.
   *
   * @example
   * ```tsx
   * <VegaLiteArrowChart spec={spec} arrowTable={data}>
   *   <VegaLiteArrowChart.Actions>
   *     <VegaExportAction />
   *   </VegaLiteArrowChart.Actions>
   * </VegaLiteArrowChart>
   * ```
   */
  children?: React.ReactNode;
};

export function makeDefaultVegaLiteOptions(
  options?: EmbedOptions,
): EmbedOptions {
  return {
    mode: 'vega-lite',
    renderer: 'svg',
    theme: undefined,
    tooltip: true,
    actions: false,
    padding: {
      top: 20,
      right: 10,
      bottom: 10,
      left: 10,
    },
    ...options,
  };
}

const BRUSH_PARAM_NAME = 'brush';

type EncodingType = 'quantitative' | 'temporal' | 'nominal' | 'ordinal';

/**
 * Inspect the top-level encoding of a parsed Vega-Lite spec and return the
 * types of the x and y channels. Returns `undefined` for missing channels.
 */
function getEncodingTypes(spec: Record<string, unknown>): {
  x?: EncodingType;
  y?: EncodingType;
} {
  const encoding = spec.encoding as Record<string, {type?: string}> | undefined;
  if (!encoding) return {};
  return {
    x: encoding.x?.type as EncodingType | undefined,
    y: encoding.y?.type as EncodingType | undefined,
  };
}

function isContinuousType(t: EncodingType | undefined): boolean {
  return t === 'quantitative' || t === 'temporal';
}

type BrushMode = 'interval' | 'point';

/**
 * Build the brush selection param appropriate for the chart's encoding.
 * - If both axes are continuous → plain interval selection (2D drag).
 * - If only one axis is continuous → interval restricted to that encoding.
 * - If neither axis is continuous (bar w/ nominal, pie, heatmap) → point
 *   selection (click) so the user can still select marks.
 * - If there's no encoding at all (layered/concat specs) → `null`.
 */
function buildBrushParam(
  spec: Record<string, unknown>,
): {name: string; select: unknown; mode: BrushMode} | null {
  const encoding = spec.encoding as Record<string, unknown> | undefined;
  if (!encoding) return null;

  const {x, y} = getEncodingTypes(spec);
  const xCont = isContinuousType(x);
  const yCont = isContinuousType(y);

  if (xCont && yCont) {
    return {name: BRUSH_PARAM_NAME, select: 'interval', mode: 'interval'};
  }
  if (xCont) {
    return {
      name: BRUSH_PARAM_NAME,
      select: {type: 'interval', encodings: ['x']},
      mode: 'interval',
    };
  }
  if (yCont) {
    return {
      name: BRUSH_PARAM_NAME,
      select: {type: 'interval', encodings: ['y']},
      mode: 'interval',
    };
  }
  // No continuous axis — fall back to click-based point selection.
  // toggle: true allows shift-click to accumulate; clear resets on background.
  return {
    name: BRUSH_PARAM_NAME,
    select: {type: 'point', toggle: true},
    mode: 'point',
  };
}

/**
 * Normalize a point selection signal value into {@link VegaBrushSelectionRanges}.
 *
 * Point selection signals emit individual field values (e.g.
 * `{risk_category: "Critical"}`) rather than ranges.  We wrap each scalar
 * value in a single-element array so the downstream pipeline treats it as a
 * categorical selection.
 */
function normalizePointSignal(
  value: Record<string, unknown>,
): VegaBrushSelectionRanges {
  const ranges: VegaBrushSelectionRanges = {};
  for (const [key, val] of Object.entries(value)) {
    // Skip internal Vega selection metadata fields
    if (key.startsWith('vlPoint') || key.startsWith('_vgsid')) continue;
    if (val == null) continue;
    if (typeof val === 'number') {
      ranges[key] = [val, val];
    } else {
      ranges[key] = [String(val)];
    }
  }
  return ranges;
}

const VegaLiteArrowChartBase: React.FC<VegaLiteArrowChartProps> = ({
  className,
  aspectRatio = 16 / 9,
  spec,
  arrowTable,
  options: propsOptions,
  width = 'auto',
  height = 'auto',
  onBrushSelection,
  children,
}) => {
  const {theme} = useTheme();

  const options = useMemo(
    () =>
      makeDefaultVegaLiteOptions({
        config: {
          ...(theme === 'dark' ? darkTheme : lightTheme),
          ...(typeof propsOptions?.config === 'object'
            ? (propsOptions.config as Config)
            : {}),
        },

        ...propsOptions,
      }),
    [theme, propsOptions],
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const [chartError, setChartError] = useState<Error | null>(null);

  const data = useMemo(() => {
    if (!arrowTable) return null;
    return {values: arrowTableToJson(arrowTable)};
  }, [arrowTable]);

  // Determine the brush mode that was injected into the spec.
  const brushMode = useMemo((): BrushMode | null => {
    if (!onBrushSelection) return null;
    const parsed = typeof spec === 'string' ? safeJsonParse(spec) : spec;
    if (!parsed) return null;
    const param = buildBrushParam(parsed as Record<string, unknown>);
    return param?.mode ?? null;
  }, [spec, onBrushSelection]);

  const specWithData = useMemo(() => {
    const parsed = typeof spec === 'string' ? safeJsonParse(spec) : spec;
    if (!parsed) {
      setChartError(new Error('Invalid Vega-Lite specification'));
      return null;
    }
    const base = {
      padding: 10,
      background: 'transparent',
      ...parsed,
      data: data,
      // Override the following props to ensure the chart is responsive
      width: 'container',
      height: 'container',
      autosize: {contains: 'padding'},
    } as VisualizationSpec & Record<string, unknown>;

    if (onBrushSelection) {
      const brushParam = buildBrushParam(base as Record<string, unknown>);
      if (brushParam) {
        const existingParams = Array.isArray(base.params) ? base.params : [];
        const hasBrush = existingParams.some(
          (p: {name?: string}) => p.name === BRUSH_PARAM_NAME,
        );
        if (!hasBrush) {
          base.params = [...existingParams, brushParam];
        }
      }
    }

    return base as VisualizationSpec;
  }, [spec, data, onBrushSelection]);

  // Reset chart error whenever spec or data changes
  useEffect(() => {
    setChartError(null);
  }, [spec, data]);

  const ref = useRef<HTMLDivElement>(null);
  const embed = useVegaEmbed({
    ref,
    spec: specWithData ?? '',
    onError: () => setChartError,
    options,
  });

  const dimensions = useAspectRatioDimensions({
    containerRef,
    width,
    height,
    aspectRatio,
  });
  const changeDimensions = useCallback(
    (width: number, height: number) => {
      embed?.view.width(width).height(height).runAsync();
    },
    [embed],
  );
  useEffect(() => {
    changeDimensions(dimensions.width, dimensions.height);
  }, [changeDimensions, dimensions.width, dimensions.height]);

  // Attach brush signal listener when onBrushSelection is provided.
  // The handler is debounced so that rapid brush drags only trigger a single
  // downstream update (e.g. Kepler map re-render) once the user settles.
  useEffect(() => {
    if (!embed?.view || !onBrushSelection || !brushMode) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const DEBOUNCE_MS = 150;

    const debouncedCallback = (ranges: VegaBrushSelectionRanges) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => onBrushSelection(ranges), DEBOUNCE_MS);
    };

    if (brushMode === 'interval') {
      const handler = (_name: string, value: unknown) => {
        debouncedCallback(
          (value && typeof value === 'object'
            ? value
            : {}) as VegaBrushSelectionRanges,
        );
      };
      try {
        embed.view.addSignalListener(BRUSH_PARAM_NAME, handler);
      } catch {
        return;
      }
      return () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        try {
          embed.view.removeSignalListener(BRUSH_PARAM_NAME, handler);
        } catch {
          // View may already be finalized
        }
      };
    }

    // Point selection: the signal value contains field values of the clicked
    // mark.  We normalize it into the VegaBrushSelectionRanges shape so the
    // downstream map-highlighting logic works unchanged.
    const handler = (_name: string, value: unknown) => {
      if (value && typeof value === 'object') {
        const raw = value as Record<string, unknown>;
        const ranges = normalizePointSignal(raw);
        debouncedCallback(ranges);
      } else {
        debouncedCallback({});
      }
    };
    try {
      embed.view.addSignalListener(BRUSH_PARAM_NAME, handler);
    } catch {
      return;
    }
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      try {
        embed.view.removeSignalListener(BRUSH_PARAM_NAME, handler);
      } catch {
        // View may already be finalized
      }
    };
  }, [embed, onBrushSelection, brushMode]);

  return (
    <VegaChartContextProvider value={{embed}}>
      <div
        ref={containerRef}
        className={cn('relative flex h-full w-full flex-col gap-2', className)}
      >
        <div className="peer relative">
          {chartError ? (
            <ToolErrorMessage
              error={chartError}
              triggerLabel="Chart rendering failed"
              title="Chart error"
              align="start"
              details={spec}
            />
          ) : (
            specWithData &&
            data && (
              <AspectRatio
                ratio={aspectRatio}
                className="overflow-visible"
                asChild
              >
                <div ref={ref} className="[&_svg]:overflow-visible" />
              </AspectRatio>
            )
          )}
        </div>
        {children}
      </div>
    </VegaChartContextProvider>
  );
};

/**
 * Composable Vega-Lite chart component with support for custom actions.
 *
 * @example
 * ```tsx
 * // Basic usage without actions (backwards compatible)
 * <VegaLiteArrowChart spec={spec} arrowTable={data} />
 *
 * // With export action
 * <VegaLiteArrowChart spec={spec} arrowTable={data}>
 *   <VegaLiteArrowChart.Actions>
 *     <VegaExportAction />
 *   </VegaLiteArrowChart.Actions>
 * </VegaLiteArrowChart>
 *
 * // Custom actions with separator
 * <VegaLiteArrowChart spec={spec} arrowTable={data}>
 *   <VegaLiteArrowChart.Actions>
 *     <VegaExportAction pngScale={3} />
 *     <Separator orientation="vertical" className="h-4" />
 *     <Button size="xs" variant="ghost" onClick={handleRefresh}>
 *       <RefreshCw className="h-4 w-4" />
 *     </Button>
 *   </VegaLiteArrowChart.Actions>
 * </VegaLiteArrowChart>
 * ```
 */
export const VegaLiteArrowChart = Object.assign(VegaLiteArrowChartBase, {
  /**
   * Container for action buttons, positioned as an overlay
   */
  Actions: VegaChartActions,
  /**
   * Built-in export action with PNG/SVG download
   */
  ExportAction: VegaExportAction,
  /**
   * Built-in edit action with spec/SQL editor popover
   */
  EditAction: VegaEditAction,
});
