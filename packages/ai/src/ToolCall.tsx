import {
  AnswerToolParameters,
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
import {Suspense} from 'react';
import Markdown from 'react-markdown';
import {VegaLiteChart} from '@sqlrooms/vega';

interface ToolCallProps {
  toolCall: ToolCallSchema;
}

function isQueryToolParameters(args: unknown): args is QueryToolParameters {
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

function QueryToolCall(args: QueryToolParameters) {
  // check if args is a QueryToolParameters
  return (
    <div className="flex flex-col gap-5">
      <div className="text-xs text-gray-400">{args.reasoning}</div>
      <div className="font-mono">{args.sqlQuery}</div>
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

export function ToolCall({toolCall}: ToolCallProps) {
  const {args, toolName, toolCallId} = toolCall;
  // the 'type' returns from LLM is not expected sometimes, so we need to use toolName
  // const {type} = args;

  return (
    <div
      key={toolCallId}
      className={cn(
        'border-2 relative bg-gray-900 px-5 py-6 rounded-md text-gray-300 text-xs',
        toolName === 'answer' ? 'border-blue-500' : 'border-green-500',
      )}
    >
      <Badge
        variant="secondary"
        className={cn(
          'text-xs absolute top-[-12px] left-2 text-gray-100',
          toolName === 'answer' ? 'bg-blue-500' : 'bg-green-500',
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
        <QueryToolCall {...args} />
      ) : toolName === 'answer' && isAnswerToolParameters(args) ? (
        <AnswerToolCall {...args} />
      ) : (
        <pre>{JSON.stringify(args, null, 2)}</pre>
      )}
    </div>
  );
}
