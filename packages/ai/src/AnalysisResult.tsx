import {AnalysisResultSchema} from './schemas';
import {ToolCall} from './ToolCall';
import {ToolResult} from './ToolResult';
import {SquareTerminalIcon, CodeIcon} from 'lucide-react';
import {Button, Popover, PopoverContent, PopoverTrigger} from '@sqlrooms/ui';

interface AnalysisResultProps {
  result: AnalysisResultSchema;
}

export const AnalysisResult: React.FC<AnalysisResultProps> = ({result}) => {
  return (
    <div className="flex flex-col w-full text-sm gap-5 border py-6 px-4 rounded-md">
      <div className="p-2 mb-2 rounded-md text-gray-700 dark:text-gray-100 flex items-center gap-2">
        <SquareTerminalIcon className="w-4 h-4" />
        <div className="text-sm flex-1">{result.prompt}</div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="w-6 h-6">
              <CodeIcon className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[400px] max-h-[400px] overflow-auto"
            align="end"
            side="right"
          >
            <pre className="text-xs">{JSON.stringify(result, null, 2)}</pre>
          </PopoverContent>
        </Popover>
      </div>
      <div className="flex flex-col gap-5 px-4">
        {result.toolResults.map((toolResult) => (
          <ToolResult key={toolResult.toolCallId} toolResult={toolResult} />
        ))}
      </div>
      <div className="flex flex-col gap-5 px-4">
        {result.toolCalls
          .filter((toolCall) => toolCall.toolName === 'answer')
          .map((toolCall) => (
            <ToolCall key={toolCall.toolCallId} toolCall={toolCall} />
          ))}
      </div>
    </div>
  );
};
