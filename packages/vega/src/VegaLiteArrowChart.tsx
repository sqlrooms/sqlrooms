import {ToolErrorMessage} from '@sqlrooms/ai';
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
import {VegaChartContextProvider} from './VegaChartContext';
import {VegaChartActions} from './VegaChartActions';
import {VegaExportAction} from './VegaExportAction';
import {VegaEditAction} from './VegaEditAction';

export type VegaLiteArrowChartProps = {
  className?: string;
  width?: number | 'auto';
  height?: number | 'auto';
  aspectRatio?: number;
  spec: string | VisualizationSpec;
  options?: EmbedOptions;
  arrowTable: arrow.Table | undefined;
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

type FontSizePreset = {
  maxWidth: number;
  axisLabel: number;
  axisTitle: number;
  legendLabel: number;
  legendTitle: number;
  title: number;
};

const RESPONSIVE_FONT_SIZE_PRESETS: readonly FontSizePreset[] = [
  {
    maxWidth: 320,
    axisLabel: 8,
    axisTitle: 9,
    legendLabel: 8,
    legendTitle: 9,
    title: 10,
  },
  {
    maxWidth: 420,
    axisLabel: 9,
    axisTitle: 10,
    legendLabel: 9,
    legendTitle: 10,
    title: 11,
  },
  {
    maxWidth: 520,
    axisLabel: 10,
    axisTitle: 11,
    legendLabel: 10,
    legendTitle: 11,
    title: 12,
  },
];

function getResponsiveFontSizeConfig(containerWidth: number): Partial<Config> {
  const w = Number.isFinite(containerWidth) ? containerWidth : 0;
  const preset = RESPONSIVE_FONT_SIZE_PRESETS.find(
    (p) => w > 0 && w < p.maxWidth,
  );
  if (!preset) return {};

  return {
    axis: {labelFontSize: preset.axisLabel, titleFontSize: preset.axisTitle},
    legend: {
      labelFontSize: preset.legendLabel,
      titleFontSize: preset.legendTitle,
    },
    title: {fontSize: preset.title},
  };
}

const VegaLiteArrowChartBase: React.FC<VegaLiteArrowChartProps> = ({
  className,
  aspectRatio = 16 / 9,
  spec,
  arrowTable,
  options: propsOptions,
  width = 'auto',
  height = 'auto',
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

  const dimensions = useAspectRatioDimensions({
    containerRef,
    width,
    height,
    aspectRatio,
  });

  const responsiveFontConfig = useMemo(
    () => getResponsiveFontSizeConfig(dimensions.width),
    [dimensions.width],
  );

  const data = useMemo(() => {
    if (!arrowTable) return null;
    return {values: arrowTableToJson(arrowTable)};
  }, [arrowTable]);

  const specWithData = useMemo(() => {
    const parsed = typeof spec === 'string' ? safeJsonParse(spec) : spec;
    if (!parsed) {
      setChartError(new Error('Invalid Vega-Lite specification'));
      return null;
    }
    return {
      padding: 10,
      background: 'transparent',
      ...parsed,
      config: {
        ...((parsed as any)?.config ?? {}),
        ...responsiveFontConfig,
      },
      data: data,
      // Override the following props to ensure the chart is responsive
      width: 'container',
      height: 'container',
      autosize: {contains: 'padding'},
    } as VisualizationSpec;
  }, [spec, data, responsiveFontConfig]);

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

  const changeDimensions = useCallback(
    (width: number, height: number) => {
      embed?.view.width(width).height(height).runAsync();
    },
    [embed],
  );
  useEffect(() => {
    changeDimensions(dimensions.width, dimensions.height);
  }, [changeDimensions, dimensions.width, dimensions.height]);

  return (
    <VegaChartContextProvider value={{embed}}>
      <div
        ref={containerRef}
        className={cn('relative flex h-full w-full flex-col gap-2', className)}
      >
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
              <div
                ref={ref}
                // Ensure the Vega SVG title isn't clipped when it shifts upward
                // on small container widths.
                className="[&_svg]:overflow-visible"
              />
            </AspectRatio>
          )
        )}
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
