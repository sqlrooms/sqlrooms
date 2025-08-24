import {useSql} from '@sqlrooms/duckdb';
import {AspectRatio, cn, useAspectRatioDimensions} from '@sqlrooms/ui';
import {safeJsonParse} from '@sqlrooms/utils';
import {useMemo, useRef} from 'react';
import {VegaLite, VisualizationSpec} from 'react-vega';

const DATA_NAME = 'queryResult';

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
export const VegaLiteChart: React.FC<{
  className?: string;
  width?: number | 'auto';
  height?: number | 'auto';
  aspectRatio?: number;
  sqlQuery: string;
  spec: string | VisualizationSpec;
}> = ({
  className,
  width = 'auto',
  height = 'auto',
  aspectRatio = 3 / 2,
  sqlQuery,
  spec,
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
      data: {name: DATA_NAME},
      width: dimensions.width,
      height: dimensions.height,
      autosize: {
        type: 'fit',
        contains: 'padding',
      },
    } as VisualizationSpec;
  }, [spec, dimensions]);

  const result = useSql({query: sqlQuery});
  const data = useMemo(() => {
    if (!result.data) return null;
    return {[DATA_NAME]: result.data.toArray()};
  }, [result.data]);
  console.log(result.data?.toArray());

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex h-full w-full flex-col gap-2 overflow-hidden',
        className,
      )}
    >
      {result.error && (
        <div className="whitespace-pre-wrap font-mono text-sm text-red-500">
          {result.error.message}
        </div>
      )}
      <AspectRatio ratio={aspectRatio}>
        {refinedSpec && data && <VegaLite spec={refinedSpec} data={data} />}
      </AspectRatio>
    </div>
  );
};
