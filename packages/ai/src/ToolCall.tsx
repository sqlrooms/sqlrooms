import {
  AnswerToolParameters,
  ChartToolParameters,
  QueryToolParameters,
  ToolCallSchema,
} from './schemas';
import {
  Badge,
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Spinner,
  cn,
} from '@sqlrooms/ui';
import {CodeIcon} from 'lucide-react';
import {Suspense, ReactNode} from 'react';
import Markdown from 'react-markdown';
import {VegaLiteChart} from '@sqlrooms/vega';
import React from 'react';

/**
 * Props for the ToolCall component
 * @interface ToolCallProps
 * @property {ToolCallSchema} toolCall - The tool call data containing arguments and metadata
 * @property {ReactNode} [customMessage] - Optional custom message to display with the tool call
 */
type ToolCallProps = {
  toolCall: ToolCallSchema;
  customMessage?: ReactNode;
};

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
 * Type guard to check if an argument object matches AnswerToolParameters
 * @param {unknown} args - The arguments to check
 * @returns {boolean} True if args matches AnswerToolParameters structure
 */
function isAnswerToolParameters(args: unknown): args is AnswerToolParameters {
  return typeof args === 'object' && args !== null && 'answer' in args;
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
const QueryToolCall = React.memo(function QueryToolCall({
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
const ChartToolCall = React.memo(function ChartToolCall({
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

type MapToolParameters = {
  mapType: string;
  customMessage?: ReactNode;
};

function isMapToolParameters(args: unknown): args is MapToolParameters {
  return typeof args === 'object' && args !== null && 'mapType' in args;
}

const MapToolCall = React.memo(function MapToolCall({
  mapType,
  customMessage,
}: MapToolParameters) {
  return (
    <div className="flex flex-col gap-5">
      <div className="text-sm">
        <Markdown>{mapType}</Markdown>
      </div>
      {customMessage}
    </div>
  );
});

/**
 * Renders an answer tool call with optional chart visualization
 * Note: with the new design, this component is only used by displaying error messages
 *
 * @param {AnswerToolParameters} props - The component props
 * @returns {JSX.Element} The rendered answer tool call
 */
const AnswerToolCall = React.memo(function AnswerToolCall({
  answer,
  chart,
}: AnswerToolParameters) {
  return (
    <div className="flex flex-col gap-5">
      <div className="text-sm">
        <Markdown>{answer}</Markdown>
      </div>
      {chart && (
        <div className="flex flex-col gap-2">
          <div className="text-xs text-muted-foreground font-mono">
            {chart.sqlQuery}
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
              sqlQuery={chart.sqlQuery}
              spec={chart.vegaLiteSpec}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
});

/**
 * Main component that renders different types of tool calls based on the tool name
 *
 * @param {ToolCallProps} props - The component props
 * @returns {JSX.Element} The rendered tool call
 */
export function ToolCall({toolCall, customMessage}: ToolCallProps) {
  const {args, toolName, toolCallId} = toolCall;
  // the 'type' returns from LLM is not expected sometimes, so we need to use toolName
  // const {type} = args;

  return (
    <div
      key={toolCallId}
      className={cn(
        'border-2 relative px-5 py-6 rounded-md dark:bg-gray-900 dark:text-gray-300 bg-gray-100 text-gray-700 text-xs',
        toolName === 'chart' ? 'border-blue-500' : 'border-green-500',
      )}
    >
      <Badge
        variant="secondary"
        className={cn(
          'text-xs absolute top-[-12px] left-2 dark:text-gray-100 text-gray-700',
          toolName === 'chart' ? 'bg-blue-500' : 'bg-green-500',
        )}
      >
        {toolName}
      </Badge>

      <div className="absolute top-2 right-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" className="w-6 h-6">
              <CodeIcon className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[400px] max-h-[400px] overflow-auto"
            align="start"
            side="right"
          >
            <pre className="text-xs">{JSON.stringify(toolCall, null, 2)}</pre>
          </PopoverContent>
        </Popover>
      </div>
      {toolName === 'query' && isQueryToolParameters(args) ? (
        <QueryToolCall {...args} customMessage={customMessage} />
      ) : toolName === 'chart' && isChartToolParameters(args) ? (
        <ChartToolCall {...args} />
      ) : toolName === 'createMap' && isMapToolParameters(args) ? (
        <MapToolCall {...args} customMessage={customMessage} />
      ) : toolName === 'answer' && isAnswerToolParameters(args) ? (
        <AnswerToolCall {...args} />
      ) : (
        <pre>{JSON.stringify(args, null, 2)}</pre>
      )}
    </div>
  );
}
