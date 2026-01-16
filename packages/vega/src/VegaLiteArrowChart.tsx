import {ToolErrorMessage} from '@sqlrooms/ai';
import {arrowTableToJson} from '@sqlrooms/duckdb';
import {AspectRatio, cn, useTheme} from '@sqlrooms/ui';
import {safeJsonParse} from '@sqlrooms/utils';
import * as arrow from 'apache-arrow';
import {useEffect, useMemo, useRef, useState} from 'react';
import {useVegaEmbed} from 'react-vega';
import {EmbedOptions, VisualizationSpec} from 'vega-embed';
import {Config} from 'vega-lite';
import {darkTheme} from './themes/darkTheme';
import {lightTheme} from './themes/lightTheme';

export type VegaLiteArrowChartProps = {
  className?: string;
  width?: number | 'auto';
  height?: number | 'auto';
  aspectRatio?: number;
  spec: string | VisualizationSpec;
  options?: EmbedOptions;
  arrowTable: arrow.Table | undefined;
};

export function makeDefaultVegaLiteOptions(
  options?: EmbedOptions,
): EmbedOptions {
  return {
    mode: 'vega-lite',
    theme: undefined,
    tooltip: true,
    ...options,
    actions:
      options?.actions === false
        ? false
        : {
            export: true,
            source: false,
            compiled: false,
            editor: false,
            ...(typeof options?.actions === 'object' ? options.actions : {}),
          },
  };
}

export const VegaLiteArrowChart: React.FC<VegaLiteArrowChartProps> = ({
  className,
  aspectRatio = 3 / 2,
  spec,
  arrowTable,
  options: propsOptions,
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
      data: data,
      // Override the following props to ensure the chart is responsive
      width: 'container',
      height: 'container',
      autosize: {contains: 'padding'},
    } as VisualizationSpec;
  }, [spec, data]);

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

  // const dimensions = useAspectRatioDimensions({
  //   containerRef,
  //   width,
  //   height,
  //   aspectRatio,
  // });

  // const changeDimensions = useCallback(
  //   (width: number, height: number) => {
  //     embed?.view.width(width).height(height).runAsync();
  //   },
  //   [embed],
  // );

  // useEffect(() => {
  //   changeDimensions(dimensions.width, dimensions.height);
  // }, [changeDimensions, dimensions.width, dimensions.height]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex h-full w-full flex-col gap-2 overflow-hidden',
        className,
      )}
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
          <AspectRatio ratio={aspectRatio} className="overflow-auto" asChild>
            <div ref={ref} />
          </AspectRatio>
        )
      )}
    </div>
  );
};
