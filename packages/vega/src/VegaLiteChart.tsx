import {ToolErrorMessage} from '@sqlrooms/ai';
import {arrowTableToJson, useSql} from '@sqlrooms/duckdb';
import {AspectRatio, cn, useAspectRatioDimensions} from '@sqlrooms/ui';
import {safeJsonParse} from '@sqlrooms/utils';
import * as arrow from 'apache-arrow';
import {useEffect, useMemo, useRef, useState} from 'react';
import {VegaLite, VisualizationSpec} from 'react-vega';

const DEFAULT_DATA_NAME = 'queryResult';

/**
 * A component that renders a Vega-Lite chart with SQL data and responsive sizing.
 *
 * The chart can be sized in multiple ways:
 * - Fixed dimensions: Provide both width and height as numbers
 * - Fixed width, proportional height: Provide width as number, height as 'auto'
 * - Fixed height, proportional width: Provide height as number, width as 'auto'
 * - Fully responsive: Leave both as 'auto' (default), chart will fill container while maintaining aspect ratio
 *
 * @param props - The component props
 * @param {number | 'auto'} [props.width='auto'] - The chart width in pixels, or 'auto' to use container width
 * @param {number | 'auto'} [props.height='auto'] - The chart height in pixels, or 'auto' to calculate from aspect ratio
 * @param {number} [props.aspectRatio=3/2] - The desired width-to-height ratio when dimensions are auto-calculated
 * @param {string} props.sqlQuery - The SQL query to fetch data for the chart
 * @param {string | VisualizationSpec} props.spec - The Vega-Lite specification for the chart.
 *   Can be either a JSON string or a VisualizationSpec object.
 *   The data and size properties will be overridden by the component.
 *
 * @returns The rendered chart component
 *
 * @example
 * // Fixed size chart
 * <VegaLiteChart
 *   width={600}
 *   height={400}
 *   sqlQuery="SELECT category, count(*) as count FROM sales GROUP BY category"
 *   spec={{
 *     mark: 'bar',
 *     encoding: {
 *       x: {field: 'category', type: 'nominal'},
 *       y: {field: 'count', type: 'quantitative'}
 *     }
 *   }}
 * />
 *
 * @example
 * // Responsive chart with 16:9 aspect ratio
 * <VegaLiteChart
 *   className="max-w-[600px]"
 *   aspectRatio={16/9}
 *   sqlQuery="SELECT date, value FROM metrics"
 *   spec={{
 *     mark: 'line',
 *     encoding: {
 *       x: {field: 'date', type: 'temporal'},
 *       y: {field: 'value', type: 'quantitative'}
 *     }
 *   }}
 * />
 */
const VegaLiteSqlChart: React.FC<{
  className?: string;
  width?: number | 'auto';
  height?: number | 'auto';
  aspectRatio?: number;
  sqlQuery: string;
  spec: string | VisualizationSpec;
  dataName?: string;
  lastRunTime?: number;
  isLoading?: boolean;
}> = ({
  className,
  width = 'auto',
  height = 'auto',
  aspectRatio,
  sqlQuery,
  spec,
  dataName = DEFAULT_DATA_NAME,
  lastRunTime,
  isLoading,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const dimensions = useAspectRatioDimensions({
    containerRef,
    width,
    height,
    aspectRatio,
  });

  const refinedSpec = useMemo(() => {
    const parsed = typeof spec === 'string' ? safeJsonParse(spec) : spec;
    if (!parsed) return null;
    return {
      ...parsed,
      data: {name: dataName},
      width: dimensions.width,
      height: dimensions.height,
      autosize: {
        type: 'fit',
        contains: 'padding',
      },
    } as VisualizationSpec;
  }, [spec, dimensions]);

  const result = useSql({query: sqlQuery, version: lastRunTime});
  const arrowTable = result.data?.arrowTable;
  const data = useMemo(() => {
    if (!arrowTable) return null;
    return {queryResult: arrowTableToJson(arrowTable)};
  }, [arrowTable]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex h-full w-full flex-col gap-2 overflow-hidden',
        className,
      )}
    >
      {isLoading || result.isLoading ? (
        <div className="text-muted-foreground flex items-center justify-center gap-2 p-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
          Running query for chart data…
        </div>
      ) : refinedSpec && data ? (
        <AspectRatio ratio={aspectRatio}>
          <VegaLite spec={refinedSpec} data={data} />
        </AspectRatio>
      ) : result.error ? (
        <div className="whitespace-pre-wrap p-2 font-mono text-sm text-red-500">
          {result.error.message}
        </div>
      ) : null}
    </div>
  );
};

export const ArrowChart: React.FC<{
  className?: string;
  width?: number | 'auto';
  height?: number | 'auto';
  aspectRatio?: number;
  spec: string | VisualizationSpec;
  arrowTable: arrow.Table | undefined;
  dataName?: string;
}> = ({
  className,
  width = 'auto',
  height = 'auto',
  aspectRatio = 3 / 2,
  spec,
  arrowTable,
  dataName = DEFAULT_DATA_NAME,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartError, setChartError] = useState<Error | null>(null);
  const dimensions = useAspectRatioDimensions({
    containerRef,
    width,
    height,
    aspectRatio,
  });

  const refinedSpec = useMemo(() => {
    const parsed = typeof spec === 'string' ? safeJsonParse(spec) : spec;
    if (!parsed) {
      setChartError(new Error('Invalid Vega-Lite specification'));
      return null;
    }
    return {
      ...parsed,
      data: {name: dataName},
      width: dimensions.width,
      height: dimensions.height,
      autosize: {
        type: 'fit',
        contains: 'padding',
      },
    } as VisualizationSpec;
  }, [spec, dimensions]);

  const data = useMemo(() => {
    if (!arrowTable) return null;
    return {queryResult: arrowTableToJson(arrowTable)};
  }, [arrowTable]);

  // Reset chart error whenever spec or data changes
  useEffect(() => {
    setChartError(null);
  }, [spec, data]);

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
        refinedSpec &&
        data && (
          <AspectRatio ratio={aspectRatio}>
            <VegaLite spec={refinedSpec} data={data} onError={setChartError} />
          </AspectRatio>
        )
      )}
    </div>
  );
};

export const VegaLiteChart = Object.assign(VegaLiteSqlChart, {
  SqlChart: VegaLiteSqlChart,
  ArrowChart: ArrowChart,
});
