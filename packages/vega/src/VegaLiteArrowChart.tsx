import {ToolErrorMessage} from '@sqlrooms/ai-core';
import {arrowTableToJson} from '@sqlrooms/duckdb';
import {cn, useAspectRatioDimensions, useTheme} from '@sqlrooms/ui';
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

const VegaLiteArrowChartBase: React.FC<VegaLiteArrowChartProps> = (props) => {
  const {
    className,
    spec,
    arrowTable,
    options: propsOptions,
    width = 'auto',
    height = 'auto',
    children,
  } = props;
  const aspectRatio = Object.hasOwn(props, 'aspectRatio')
    ? props.aspectRatio
    : 16 / 9;
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

  const specWithData = useMemo(() => {
    const parsed = typeof spec === 'string' ? safeJsonParse(spec) : spec;
    if (!parsed) {
      return null;
    }
    return {
      padding: 10,
      background: 'transparent',
      ...parsed,
      data: data,
      // Override the following props to ensure the chart is responsive
      width: 'container',
      height: 'container',
      autosize: {contains: 'padding'},
    } as VisualizationSpec;
  }, [spec, data]);
  const specError = specWithData
    ? null
    : new Error('Invalid Vega-Lite specification');
  const displayError = specError ?? chartError;

  // Reset chart error whenever spec or data changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    aspectRatio:
      height === 'auto' || width !== 'auto' ? aspectRatio : undefined,
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
      <div className={cn('relative flex w-full flex-col gap-2', className)}>
        <div
          className={cn(
            'peer relative',
            height === 'auto' && aspectRatio === undefined && 'h-full',
          )}
        >
          {displayError ? (
            <ToolErrorMessage
              error={displayError}
              triggerLabel="Chart rendering failed"
              title="Chart error"
              align="start"
              details={spec}
            />
          ) : (
            specWithData &&
            data && (
              <div
                ref={containerRef}
                style={{
                  ...(height === 'auto' && aspectRatio !== undefined
                    ? {aspectRatio}
                    : height !== 'auto'
                      ? {height}
                      : {}),
                  ...(width !== 'auto' ? {width} : {}),
                }}
                className={cn(
                  'overflow-visible',
                  width === 'auto' && 'w-full',
                  height === 'auto' && aspectRatio === undefined && 'h-full',
                )}
              >
                <div
                  ref={ref}
                  className="h-full w-full [&_svg]:overflow-visible"
                />
              </div>
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
