import {AnalysisResultSchema} from './schemas';
import {SquareTerminalIcon, CodeIcon} from 'lucide-react';
import {Button, Popover, PopoverContent, PopoverTrigger} from '@sqlrooms/ui';
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
 * Find a custom message element for a given tool call ID
 * @param toolCallMessages - Array of tool call messages
 * @param toolCallId - The ID of the tool call to find a message for
 * @returns The custom message element if found, undefined otherwise
 */
const findCustomMessage = (
  toolCallMessages: AnalysisResultSchema['toolCallMessages'],
  toolCallId: string,
) => {
  return toolCallMessages.find((message) => message.toolCallId === toolCallId)
    ?.element;
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
  // the toolResults are reasoning steps that the LLM took to achieve the final result
  // by calling function tools to answer the prompt
  const analysisToolResults = result.toolResults;

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
      {analysisToolResults.length > 0 && (
        <div className="flex flex-col gap-5 px-4">
          {analysisToolResults.map((toolResult) => (
            <ToolResult
              key={toolResult.toolCallId}
              toolResult={toolResult}
              customMessage={findCustomMessage(
                result.toolCallMessages,
                toolResult.toolCallId,
              )}
            />
          ))}
        </div>
      )}
      {result.analysis.length > 0 && (
        <div className="flex flex-col gap-5 px-4">
          <ToolResult
            key={result.id + '-streaming-result'}
            toolResult={{
              toolName: 'answer',
              toolCallId: result.id,
              args: {},
              result: {success: true, data: {analysis: result.analysis}},
            }}
          />
        </div>
      )}
    </div>
  );
};
