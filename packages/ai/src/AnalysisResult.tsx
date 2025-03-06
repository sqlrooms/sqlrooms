import {AnalysisResultSchema} from './schemas';
import {SquareTerminalIcon, CodeIcon} from 'lucide-react';
import {Button, Popover, PopoverContent, PopoverTrigger} from '@sqlrooms/ui';
import {ToolResult} from './ToolResult';
import {JsonMonacoEditor} from '@sqlrooms/monaco-editor';
import {ToolCallComponents, ToolCallMessage} from '@openassistant/core';
import {AnalysisAnswer} from './components/AnalysisAnswer';
import {ErrorMessage} from './components/ErrorMessage';

/**
 * Props for the AnalysisResult component
 * @property {AnalysisResultSchema} result - The result of the analysis containing prompt, tool calls, and analysis data
 */
type AnalysisResultProps = {
  result: AnalysisResultSchema;
  toolComponents: ToolCallComponents;
};

/**
 * Stringify the result of the analysis, excluding toolCallMessages.
 * Used to display raw result data in a code view.
 *
 * @param result - The complete analysis result
 * @returns A JSON string representation of the result without toolCallMessages
 */
const stringifyResult = (result: AnalysisResultSchema) => {
  return JSON.stringify(result, null, 2);
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
export const AnalysisResult: React.FC<AnalysisResultProps> = ({
  result,
  toolComponents,
}) => {
  // the toolResults are reasoning steps that the LLM took to achieve the final result
  // by calling function tools to answer the prompt
  const {prompt, errorMessage, streamMessage, isCompleted} = result;
  const toolCallMessages = streamMessage.toolCallMessages || [];

  return (
    <div className="flex flex-col w-full text-sm gap-5 border py-6 px-4 rounded-md">
      <div className="p-2 mb-2 rounded-md text-gray-700 dark:text-gray-100 flex items-center gap-2">
        <SquareTerminalIcon className="w-4 h-4" />
        {/** render prompt */}
        <div className="text-sm flex-1">{prompt}</div>
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
            <JsonMonacoEditor
              value={stringifyResult(result)}
              readOnly={true}
              className="h-[300px]"
              options={{
                minimap: {enabled: false},
                scrollBeyondLastLine: false,
                automaticLayout: true,
                folding: true,
                lineNumbers: false,
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
      {/** render tools */}
      {toolCallMessages.length > 0 && (
        <div className="flex flex-col gap-5 px-4">
          {toolCallMessages.map((toolCallMessage: ToolCallMessage) => (
            <ToolResult
              key={toolCallMessage.toolCallId}
              toolCallMessage={toolCallMessage}
              toolComponents={toolComponents}
            />
          ))}
        </div>
      )}
      {/** render result */}
      {streamMessage.text && <AnalysisAnswer answer={streamMessage.text} />}
      {/** render error message */}
      {errorMessage && <ErrorMessage errorMessage={errorMessage.error} />}
    </div>
  );
};
