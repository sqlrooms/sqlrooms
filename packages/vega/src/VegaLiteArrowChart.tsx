import {ToolErrorMessage} from '@sqlrooms/ai';
import {arrowTableToJson} from '@sqlrooms/duckdb';
import {AspectRatio, cn, useAspectRatioDimensions} from '@sqlrooms/ui';
import {safeJsonParse} from '@sqlrooms/utils';
import * as arrow from 'apache-arrow';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useVegaEmbed} from 'react-vega';
import {EmbedOptions, VisualizationSpec} from 'vega-embed';

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
  options?: Partial<EmbedOptions>,
): EmbedOptions {
  return {
    mode: 'vega-lite',
    theme: undefined,
    tooltip: true,
    actions: false,
    ...options,
  };
}

export const VegaLiteArrowChart: React.FC<VegaLiteArrowChartProps> = ({
  className,
  width = 'auto',
  height = 'auto',
  aspectRatio = 3 / 2,
  spec,
  arrowTable,
  options: propsOptions,
}) => {
  const options = useMemo(
    () => makeDefaultVegaLiteOptions(propsOptions),
    [propsOptions],
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartError, setChartError] = useState<Error | null>(null);
  const dimensions = useAspectRatioDimensions({
    containerRef,
    width,
    height,
    aspectRatio,
  });

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
      ...parsed,
      data: data,
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

  const changeDimensions = useCallback(
    (width: number, height: number) => {
      console.log('changing dimensions', width, height);
      embed?.view.width(width).height(height).runAsync();
    },
    [embed],
  );

  useEffect(() => {
    changeDimensions(dimensions.width, dimensions.height);
  }, [changeDimensions, dimensions.width, dimensions.height]);

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
