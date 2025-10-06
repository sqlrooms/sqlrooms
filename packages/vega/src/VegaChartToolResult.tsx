import {Suspense} from 'react';
import {VegaLiteChart} from './VegaLiteChart';
import {QueryToolResult} from '@sqlrooms/ai';
import {VisualizationSpec} from 'react-vega';
import {AspectRatio, cn} from '@sqlrooms/ui';

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
  return (
    <>
      {vegaLiteSpec && (
        <div className="flex flex-col gap-2">
          <QueryToolResult title="Query" sqlQuery={sqlQuery} />
          <Suspense
            fallback={
              <div className="flex h-full w-full items-center justify-center">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
              </div>
            }
          >
            <VegaLiteChart
              className={cn('max-w-[600px]', className)}
              aspectRatio={16 / 9}
              sqlQuery={sqlQuery}
              spec={vegaLiteSpec}
            />
          </Suspense>
        </div>
      )}
    </>
  );
}
