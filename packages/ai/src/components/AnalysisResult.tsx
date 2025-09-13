import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  CopyButton,
} from '@sqlrooms/ui';
import {shorten} from '@sqlrooms/utils';
import {StreamMessagePart} from '@openassistant/core';
import {
  SquareTerminalIcon,
  TrashIcon,
  Wrench,
  Loader2,
  CircleArrowRightIcon,
} from 'lucide-react';
import {useState} from 'react';
import {AnalysisResultSchema} from '../schemas';
import {AnalysisAnswer} from './AnalysisAnswer';
import {ErrorMessage} from './ErrorMessage';
import {ToolResult} from './tools/ToolResult';

/**
 * Props for the AnalysisResult component
 * @property {AnalysisResultSchema} result - The result of the analysis containing prompt, tool calls, and analysis data
 */
type AnalysisResultProps = {
  result: AnalysisResultSchema;
  onDeleteAnalysisResult: (id: string) => void;
};

/**
 * Truncates tool invocation arguments for display
 * @param args - The tool invocation arguments object
 * @param maxLength - Maximum length for the displayed string (default: 50)
 * @returns Truncated JSON string representation of the arguments
 */
const truncateArgs = (args: unknown, maxLength: number = 50): string => {
  const jsonString = JSON.stringify(args, null, 2);
  return shorten(jsonString, maxLength);
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
  onDeleteAnalysisResult,
}) => {
  // the toolResults are reasoning steps that the LLM took to achieve the final result
  // by calling function tools to answer the prompt
  const {id, prompt, errorMessage, streamMessage} = result;
  const parts = streamMessage.parts as StreamMessagePart[];
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

  return (
    <div className="group flex w-full flex-col gap-2 pb-2 text-sm">
      <div className="mb-2 flex items-center gap-2 rounded-md text-gray-700 dark:text-gray-100">
        <div className="bg-muted flex w-full items-center gap-2 rounded-md border p-2 text-sm">
          <SquareTerminalIcon className="h-4 w-4" />
          {/** render prompt */}
          <div className="flex-1">{prompt}</div>
          <div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
            <CopyButton
              text={prompt}
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              ariaLabel="Copy prompt"
            />
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
      {parts?.map((part, index) => (
        <div key={index}>
          {part.type === 'text' && (
            <AnalysisAnswer
              content={part.text}
              isAnswer={index === (streamMessage.parts?.length || 0) - 1}
            />
          )}
          {part.type === 'tool-invocation' && (
            <div>
              <div className="flex items-center gap-2 pl-2 text-xs text-gray-100">
                {!result.isCompleted && part.toolInvocation.state === 'call' ? (
                  <Loader2 className="h-4 w-4 animate-spin text-gray-200" />
                ) : (
                  <CircleArrowRightIcon className="h-4 w-4" />
                )}
                <span className="text-gray-200">
                  {part.toolInvocation.toolName}
                </span>
                <span className="text-gray-200">
                  {truncateArgs(part.toolInvocation.args)}
                </span>
              </div>
              <ToolResult
                key={part.toolInvocation.toolCallId}
                toolInvocation={part.toolInvocation}
                additionalData={part.additionalData}
                isCompleted={result.isCompleted}
              />
            </div>
          )}
        </div>
      ))}
      {/** render error message */}
      {errorMessage && <ErrorMessage errorMessage={errorMessage.error} />}
    </div>
  );
};
