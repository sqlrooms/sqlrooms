import {AnalysisResultSchema} from '../schemas';
import {SquareTerminalIcon, CodeIcon, TrashIcon} from 'lucide-react';
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@sqlrooms/ui';
import {ToolResult} from './tools/ToolResult';
import {JsonMonacoEditor} from '@sqlrooms/monaco-editor';
import {ToolCallComponents} from '@openassistant/core';
import {AnalysisAnswer} from './AnalysisAnswer';
import {ErrorMessage} from './ErrorMessage';
import {useState} from 'react';

/**
 * Props for the AnalysisResult component
 * @property {AnalysisResultSchema} result - The result of the analysis containing prompt, tool calls, and analysis data
 */
type AnalysisResultProps = {
  result: AnalysisResultSchema;
  toolComponents: ToolCallComponents;
  onDeleteAnalysisResult: (id: string) => void;
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
  onDeleteAnalysisResult,
}) => {
  // the toolResults are reasoning steps that the LLM took to achieve the final result
  // by calling function tools to answer the prompt
  const {id, prompt, errorMessage, streamMessage} = result;
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

  return (
    <div className="group flex w-full flex-col gap-2 text-sm">
      <div className="mb-2 flex items-center gap-2 rounded-md text-gray-700 dark:text-gray-100">
        <div className="flex w-full items-center gap-2 rounded-md border p-4 text-sm">
          <SquareTerminalIcon className="h-4 w-4" />
          {/** render prompt */}
          <div className="flex-1">{prompt}</div>
          <div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <CodeIcon className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="max-h-[400px] w-[400px] overflow-auto"
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
                    wordWrap: 'on',
                  }}
                />
              </PopoverContent>
            </Popover>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setShowDeleteConfirmation(true)}
            >
              <TrashIcon className="h-4 w-4" />
            </Button>

            {/* Delete Confirmation Dialog */}
            <Dialog
              open={showDeleteConfirmation}
              onOpenChange={setShowDeleteConfirmation}
            >
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Confirm Deletion</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to delete this analysis result? This
                    action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setShowDeleteConfirmation(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      onDeleteAnalysisResult(id);
                      setShowDeleteConfirmation(false);
                    }}
                  >
                    Delete
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
      {/** render parts */}
      {streamMessage.parts?.map((part, index) => (
        <div key={index}>
          {part.type === 'text' && (
            <AnalysisAnswer
              content={part.text}
              isAnswer={index === (streamMessage.parts?.length || 0) - 1}
            />
          )}
          {part.type === 'tool' && (
            <div>
              {part.toolCallMessages.map((toolCallMessage) => (
                <ToolResult
                  key={toolCallMessage.toolCallId}
                  toolCallMessage={toolCallMessage}
                  toolComponents={toolComponents}
                />
              ))}
            </div>
          )}
        </div>
      ))}
      {/** render error message */}
      {errorMessage && <ErrorMessage errorMessage={errorMessage.error} />}
    </div>
  );
};
