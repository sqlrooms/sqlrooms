import {ToolResultSchema} from './schemas';
import {
  Badge,
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  cn,
} from '@sqlrooms/ui';
import {CheckCircle2Icon, CodeIcon, XCircleIcon} from 'lucide-react';
import {ReactNode} from 'react';
import {
  AnalysisAnswer,
  ChartToolCall,
  isAnalysisAnswer,
  isChartToolParameters,
} from './ToolCall';
import {isQueryToolParameters, QueryToolCall} from './ToolCall';
import React from 'react';

interface ToolResultProps {
  toolResult: ToolResultSchema;
  customMessage?: ReactNode;
}

function getBorderColor(isSuccess: boolean, toolName: string) {
  if (!isSuccess) {
    return 'border-red-500';
  }
  switch (toolName) {
    case 'query':
      return 'border-green-500';
    case 'chart':
      return 'border-blue-500';
    case 'answer':
      return 'border-gray-500';
    default:
      return 'border-gray-500';
  }
}

export const ToolResult: React.FC<ToolResultProps> = ({
  toolResult,
  customMessage,
}) => {
  const {toolName, args, result} = toolResult;
  const isSuccess = result.success;

  return (
    <div
      className={cn(
        'border-2 relative bg-gray-100 dark:bg-gray-900 px-5 py-6 rounded-md text-gray-700 dark:text-gray-300 text-xs',
        getBorderColor(isSuccess, toolName),
      )}
    >
      <Badge
        variant="secondary"
        className={cn(
          'text-xs absolute top-[-12px] left-2 dark:text-gray-100 text-gray-700 flex items-center gap-1 border',
          getBorderColor(isSuccess, toolName),
        )}
      >
        {isSuccess ? (
          <CheckCircle2Icon className="w-3 h-3 text-green-500" />
        ) : (
          <XCircleIcon className="w-3 h-3 text-red-500" />
        )}
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
            className="w-[400px] max-h-[300px] overflow-auto p-4"
            side="right"
            align="start"
          >
            <pre className="whitespace-no-wrap text-xs">
              {JSON.stringify(toolResult, null, 2)}
            </pre>
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex flex-col gap-5">
        {toolName === 'query' && isQueryToolParameters(args) ? (
          <QueryToolCall {...args} customMessage={String(customMessage)} />
        ) : toolName === 'chart' && isChartToolParameters(args) ? (
          <ChartToolCall {...args} />
        ) : toolName === 'answer' && isAnalysisAnswer(result) ? (
          <AnalysisAnswer {...result} />
        ) : (
          Object.keys(args).length > 0 && (
            <pre>{JSON.stringify(args, null, 2)}</pre>
          )
        )}
        {!result.success && (
          <div className="text-red-500 gap-2 flex flex-col">
            <p className="text-sm font-bold">Oops! Something went wrong...</p>
            <p className="text-xs">{result.error}</p>
          </div>
        )}
      </div>
    </div>
  );
};
