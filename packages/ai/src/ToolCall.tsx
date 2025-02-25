import {
  ChartToolParameters,
  QueryToolParameters,
  ToolResultSchema,
} from './schemas';
import {Spinner} from '@sqlrooms/ui';
import {Suspense, ReactNode} from 'react';
import Markdown from 'react-markdown';
import {VegaLiteChart} from '@sqlrooms/vega';
import React from 'react';

/**
 * Props for the QueryToolCall component
 * @interface QueryToolCallProps
 * @extends {QueryToolParameters}
 * @property {ReactNode} [customMessage] - Optional custom message to display with the query
 */
type QueryToolCallProps = QueryToolParameters & {
  customMessage?: ReactNode;
};

/**
 * Type guard to check if an argument object matches QueryToolParameters
 * @param {unknown} args - The arguments to check
 * @returns {boolean} True if args matches QueryToolParameters structure
 */
export function isQueryToolParameters(
  args: unknown,
): args is QueryToolParameters {
  return (
    typeof args === 'object' &&
    args !== null &&
    'reasoning' in args &&
    'sqlQuery' in args
  );
}

/**
 * Type guard to check if an argument object matches ChartToolParameters
 * @param {unknown} args - The arguments to check
 * @returns {boolean} True if args matches ChartToolParameters structure
 */
export function isChartToolParameters(
  args: unknown,
): args is ChartToolParameters {
  return typeof args === 'object' && args !== null && 'vegaLiteSpec' in args;
}

/**
 * Renders a SQL query tool call with reasoning and query text
 * @param {QueryToolCallProps} props - The component props
 * @returns {JSX.Element} The rendered query tool call
 */
export const QueryToolCall = React.memo(function QueryToolCall({
  reasoning,
  sqlQuery,
  customMessage,
}: QueryToolCallProps) {
  return (
    <div className="flex flex-col gap-5">
      <div className="text-xs text-gray-400">{reasoning}</div>
      <div className="font-mono">{sqlQuery}</div>
      {customMessage}
    </div>
  );
});

/**
 * Renders a chart tool call with visualization using Vega-Lite
 * @param {ChartToolParameters} props - The component props
 * @returns {JSX.Element} The rendered chart tool call
 */
export const ChartToolCall = React.memo(function ChartToolCall({
  reasoning,
  sqlQuery,
  vegaLiteSpec,
}: ChartToolParameters) {
  return (
    <div className="flex flex-col gap-5">
      <div className="text-sm">
        <Markdown>{reasoning}</Markdown>
      </div>
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
    </div>
  );
});

/**
 * Type guard to check if a result object matches AnalysisAnswerProps
 * @param {unknown} result - The result to check
 * @returns {boolean} True if result matches AnalysisAnswerProps structure
 */
type AnalysisAnswerProps = {
  success: true;
  data: {
    analysis: string;
  };
};

/**
 * Type guard to check if a result object matches AnalysisAnswerProps
 * @param {unknown} result - The result to check
 * @returns {boolean} True if result matches AnalysisAnswerProps structure
 */
export function isAnalysisAnswer(
  result: ToolResultSchema['result'],
): result is AnalysisAnswerProps {
  return result.success && result.data.analysis !== undefined;
}

/**
 * Renders an analysis answer with markdown content of the final streaming response.
 *
 * @param {AnalysisAnswerProps} props - The component props. See {@link AnalysisAnswerProps} for more details.
 * @returns {JSX.Element} The rendered answer tool call
 */
export const AnalysisAnswer = React.memo(function AnalysisAnswer(
  props: AnalysisAnswerProps,
) {
  return (
    <div className="flex flex-col gap-5">
      <div className="text-xs">
        <Markdown className="whitespace-pre-wrap break-words">
          {props.data.analysis}
        </Markdown>
      </div>
    </div>
  );
});
