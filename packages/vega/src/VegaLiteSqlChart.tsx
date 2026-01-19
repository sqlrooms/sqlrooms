import {useSql} from '@sqlrooms/duckdb';
import {cn} from '@sqlrooms/ui';
import {
  VegaLiteArrowChart,
  VegaLiteArrowChartProps,
} from './VegaLiteArrowChart';

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
export const VegaLiteSqlChart: React.FC<
  Omit<VegaLiteArrowChartProps, 'arrowTable'> & {sqlQuery: string}
> = ({className, sqlQuery, ...props}) => {
  const result = useSql({query: sqlQuery});
  const arrowTable = result.data?.arrowTable;

  return (
    <div
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
      {result.isLoading ? (
        <div className="text-muted-foreground align-center flex gap-2 px-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
          Running query for chart data…
        </div>
      ) : (
        arrowTable && <VegaLiteArrowChart {...props} arrowTable={arrowTable} />
      )}
    </div>
  );
};
