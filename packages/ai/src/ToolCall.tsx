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

type ToolCallProps = {
  toolCall: ToolCallSchema;
  customMessage?: ReactNode;
};

type QueryToolCallProps = QueryToolParameters & {
  customMessage?: ReactNode;
};

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

function isAnswerToolParameters(args: unknown): args is AnswerToolParameters {
  return typeof args === 'object' && args !== null && 'answer' in args;
}

export function isChartToolParameters(
  args: unknown,
): args is ChartToolParameters {
  return typeof args === 'object' && args !== null && 'vegaLiteSpec' in args;
}

function QueryToolCall({
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
}

function ChartToolCall(args: ChartToolParameters) {
  const {reasoning, sqlQuery, vegaLiteSpec} = args;

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
}

function AnswerToolCall(args: AnswerToolParameters) {
  return (
    <div className="flex flex-col gap-5">
      <div className="text-sm">
        <Markdown>{args.answer}</Markdown>
      </div>
      {args.chart && (
        <div className="flex flex-col gap-2">
          <div className="text-xs text-muted-foreground font-mono">
            {args.chart.sqlQuery}
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
              sqlQuery={args.chart.sqlQuery}
              spec={args.chart.vegaLiteSpec}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}

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
      ) : toolName === 'answer' && isAnswerToolParameters(args) ? (
        <AnswerToolCall {...args} />
      ) : (
        <pre>{JSON.stringify(args, null, 2)}</pre>
      )}
    </div>
  );
}
