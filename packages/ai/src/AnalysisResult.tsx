import {AnalysisResultSchema} from './schemas';
import {ToolCall} from './ToolCall';
import {SquareTerminalIcon, CodeIcon} from 'lucide-react';
import {Button, Popover, PopoverContent, PopoverTrigger} from '@sqlrooms/ui';
import Markdown from 'react-markdown';

interface AnalysisResultProps {
  result: AnalysisResultSchema;
}

/**
 * Stringify the result of the analysis.
 *
 * @param result - The result of the analysis
 * @returns The stringified result
 */
const stringifyResult = (result: AnalysisResultSchema) => {
  // remove toolCallMessages from the result
  const {toolCallMessages, ...rest} = result;
  return JSON.stringify(rest);
};

export const AnalysisResult: React.FC<AnalysisResultProps> = ({result}) => {
  return (
    <div className="flex flex-col w-full text-sm gap-5 border py-6 px-4 rounded-md">
      <div className="bg-gray-700 p-2 mb-2 rounded-md text-gray-100 flex items-center gap-2">
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
            <pre className="text-xs">{stringifyResult(result)}</pre>
          </PopoverContent>
        </Popover>
      </div>
      <div className="flex flex-col gap-5 px-4">
        {result.toolCalls
          .filter((toolCall) => toolCall.toolName !== 'chart')
          .map((toolCall) => {
            const customMessage = result.toolCallMessages.find(
              (message) => message.toolCallId === toolCall.toolCallId,
            )?.element;
            return (
              <ToolCall
                key={toolCall.toolCallId}
                toolCall={toolCall}
                customMessage={customMessage}
              />
            );
          })}
      </div>
      <div className="flex flex-col gap-5 px-4">
        <div className="text-xs overflow-y-auto p-4">
          <Markdown className="whitespace-pre-wrap break-words">
            {result.analysis}
          </Markdown>
        </div>
      </div>
      <div className="flex flex-col gap-5 px-4">
        {result.isCompleted &&
          result.toolCalls
            .filter((toolCall) => toolCall.toolName === 'chart')
            .map((toolCall) => (
              <ToolCall key={toolCall.toolCallId} toolCall={toolCall} />
            ))}
      </div>
    </div>
  );
};
