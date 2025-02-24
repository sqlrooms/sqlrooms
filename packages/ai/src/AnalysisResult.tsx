import {AnalysisResultSchema} from './schemas';
import {ToolCall} from './ToolCall';
import {SquareTerminalIcon, CodeIcon} from 'lucide-react';
import {Button, Popover, PopoverContent, PopoverTrigger} from '@sqlrooms/ui';
import Markdown from 'react-markdown';
import {ToolResult} from './ToolResult';

/**
 * Props for the AnalysisResult component
 * @property {AnalysisResultSchema} result - The result of the analysis containing prompt, tool calls, and analysis data
 */
type AnalysisResultProps = {
  result: AnalysisResultSchema;
};

/**
 * Stringify the result of the analysis, excluding toolCallMessages.
 * Used to display raw result data in a code view.
 *
 * @param result - The complete analysis result
 * @returns A JSON string representation of the result without toolCallMessages
 */
const stringifyResult = (result: AnalysisResultSchema) => {
  // remove toolCallMessages from the result
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const {toolCallMessages, ...rest} = result;
  return JSON.stringify(rest);
};

/**
 * Component that displays the results of an AI analysis.
 * Shows the original prompt, intermediate tool calls, final analysis text,
 * and any tool results.
 *
 * @component
 * @param props - Component props
 * @param props.result - The analysis result data to display
 * @returns A React component displaying the analysis results
 */
export const AnalysisResult: React.FC<AnalysisResultProps> = ({result}) => {
  // the toolCalls are reasoning steps that the LLM took to achieve the final result
  // therefore, the last toolCall should be the last toolCall that produced the final result
  // the rest of the toolCalls are intermediate 'analysis' steps
  const analysisToolCalls = result.toolCalls.slice(0, -1);
  const finalToolCall = result.toolCalls.slice(-1)[0];

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
            <pre className="text-xs">{stringifyResult(result)}</pre>
          </PopoverContent>
        </Popover>
      </div>
      <div className="flex flex-col gap-5 px-4">
        {analysisToolCalls.map((toolCall) => {
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
        {result.isCompleted && finalToolCall && (
          <ToolCall
            key={finalToolCall.toolCallId}
            toolCall={finalToolCall}
            customMessage={
              result.toolCallMessages.find(
                (message) => message.toolCallId === finalToolCall.toolCallId,
              )?.element
            }
          />
        )}
      </div>
      <div className="flex flex-col gap-5 px-4">
        {result.toolResults.map((toolResult) => {
          return (
            <ToolResult key={toolResult.toolName} toolResult={toolResult} />
          );
        })}
      </div>
    </div>
  );
};
