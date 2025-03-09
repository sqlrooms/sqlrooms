import {Spinner} from '@sqlrooms/ui';
import {VegaLiteChart} from '@sqlrooms/vega';
import {Suspense} from 'react';
import {ToolQuery} from './ToolQuery';

type ToolChartProps = {
  reasoning: string;
  sqlQuery: string;
  vegaLiteSpec: string;
};

/**
 * Renders a chart tool call with visualization using Vega-Lite
 * @param {ChartToolParameters} props - The component props
 * @returns {JSX.Element} The rendered chart tool call
 */
export function ToolChart({sqlQuery, vegaLiteSpec}: ToolChartProps) {
  return (
    <>
      {vegaLiteSpec && (
        <div className="flex flex-col gap-2">
          <ToolQuery title="Query Result" sqlQuery={sqlQuery} />
          <Suspense
            fallback={
              <div className="flex h-full w-full items-center justify-center">
                <Spinner className="h-4 w-4" />
              </div>
            }
          >
            <VegaLiteChart
              className="max-w-[600px]"
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
