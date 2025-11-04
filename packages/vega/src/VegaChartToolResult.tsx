import {QueryToolResult} from '@sqlrooms/ai';
import {useSql} from '@sqlrooms/duckdb';
import {cn} from '@sqlrooms/ui';
import {Suspense} from 'react';
import {VisualizationSpec} from 'react-vega';
import {VegaLiteChart} from './VegaLiteChart';

type VegaChartToolResultProps = {
  className?: string;
  reasoning: string;
  sqlQuery: string;
  vegaLiteSpec: VisualizationSpec;
};

/**
 * Renders a chart tool call with visualization using Vega-Lite
 * @param {VegaChartToolResultProps} props - The component props
 * @returns {JSX.Element} The rendered chart tool call
 */
export function VegaChartToolResult({
  className,
  sqlQuery,
  vegaLiteSpec,
}: VegaChartToolResultProps) {
  const result = useSql({query: sqlQuery});
  return (
    <>
      {vegaLiteSpec && (
        <div className="flex flex-col gap-2">
          <QueryToolResult
            title=""
            arrowTable={result.data?.arrowTable}
            sqlQuery={sqlQuery}
          />
          {result.error ? (
            <div className="whitespace-pre-wrap font-mono text-sm text-red-500">
              {result.error?.message}
            </div>
          ) : result.isLoading ? (
            <div className="text-muted-foreground align-center flex gap-2 px-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
              Running query for chart data…
            </div>
          ) : (
            <VegaLiteChart.ArrowChart
              className={cn('max-w-[600px]', className)}
              aspectRatio={16 / 9}
              arrowTable={result.data?.arrowTable}
              spec={vegaLiteSpec}
            />
          )}
        </div>
      )}
    </>
  );
}
