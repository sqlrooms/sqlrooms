import React, {Suspense} from 'react';
import Markdown from 'react-markdown';
import {Spinner} from '@sqlrooms/ui';
import {VegaLiteChart} from '@sqlrooms/vega';

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
          <div className="text-xs text-muted-foreground font-mono">
            {sqlQuery}
          </div>
          <Suspense
            fallback={
              <div className="w-full h-full flex items-center justify-center">
                <Spinner className="w-4 h-4" />
              </div>
            }
          >
            <VegaLiteChart
              width={400}
              height={250}
              sqlQuery={sqlQuery}
              spec={vegaLiteSpec}
            />
          </Suspense>
        </div>
      )}
    </>
  );
}
