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
import {SquareTerminalIcon, TrashIcon} from 'lucide-react';
import {useState} from 'react';
import {AnalysisResultSchema} from '../schemas';
import {AnalysisAnswer} from './AnalysisAnswer';
import {ErrorMessage} from './ErrorMessage';
import {ToolResult} from './tools/ToolResult';
import {useStoreWithAi} from '../AiSlice';

/**
 * Props for the AnalysisResult component
 * @property {AnalysisResultSchema} result - The result of the analysis containing prompt, tool calls, and analysis data
 */
type AnalysisResultProps = {
  /** The analysis result data to display */
  result: AnalysisResultSchema;
};

//

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
  const currentSession = useStoreWithAi((s) => s.ai.getCurrentSession());
  const toolAdditionalData = useStoreWithAi(
    (s) => s.ai.getCurrentSession()?.toolAdditionalData || {},
  );
  const deleteAnalysisResult = useStoreWithAi((s) => s.ai.deleteAnalysisResult);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  return (
    <div className="group flex w-full flex-col gap-2 pb-2 text-sm">
      <div className="mb-2 flex items-center gap-2 rounded-md text-gray-700 dark:text-gray-100">
        <div className="bg-muted flex w-full items-center gap-2 rounded-md border p-2 text-sm">
          <SquareTerminalIcon className="h-4 w-4" />
          <div className="flex-1">{result.prompt}</div>
          <div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
            <CopyButton
              text={result.prompt}
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              ariaLabel="Copy prompt"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => {
                setDeleteTargetId(result.id);
                setShowDeleteConfirmation(true);
              }}
            >
              <TrashIcon className="h-4 w-4" />
            </Button>
            <Dialog
              open={showDeleteConfirmation}
              onOpenChange={(open) => {
                setShowDeleteConfirmation(open);
                if (!open) {
                  setDeleteTargetId(null);
                }
              }}
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
                  {currentSession?.id && deleteTargetId && (
                    <Button
                      variant="destructive"
                      onClick={() => {
                        deleteAnalysisResult(
                          currentSession?.id,
                          deleteTargetId,
                        );
                        setShowDeleteConfirmation(false);
                        setDeleteTargetId(null);
                      }}
                    >
                      Delete
                    </Button>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
      <div className="flex w-full flex-col gap-4">
        {/* Render response parts from analysis result */}
        {result.response.map((part, index) => {
          if (part.type === 'text') {
            return (
              <AnalysisAnswer
                key={index}
                content={(part as {text: string}).text}
                isAnswer={index === result.response.length - 1}
              />
            );
          }
          if (part.type === 'reasoning') {
            const text = (part as {text: string}).text;
            return (
              <div key={index} className="text-muted-foreground text-xs">
                {text}
              </div>
            );
          }
          if (part.type.startsWith('tool-')) {
            type ToolUIPart = {
              toolCallId: string;
              state: string;
              input?: unknown;
              output?: unknown;
              errorText?: string;
            };
            const toolPart = part as unknown as ToolUIPart;
            const toolCallId = toolPart.toolCallId;
            const toolName =
              (part.type as string).replace(/^tool-/, '') || 'unknown';
            const state = toolPart.state;
            const input = toolPart.input;
            const output = toolPart.output;
            const errorText = toolPart.errorText;
            const isCompleted =
              state === 'output-available' || state === 'output-error';
            const additionalData = (
              toolAdditionalData as Record<string, unknown>
            )[toolCallId];

            return (
              <ToolResult
                key={toolCallId}
                toolInvocation={{
                  toolCallId,
                  name: toolName,
                  state: state as unknown as
                    | 'input-available'
                    | 'output-available'
                    | 'output-error',
                  args: input,
                  result: output,
                  errorText,
                }}
                additionalData={additionalData}
                isCompleted={isCompleted}
                errorMessage={state === 'output-error' ? errorText : undefined}
              />
            );
          }
          return null;
        })}
        {result.errorMessage && (
          <ErrorMessage errorMessage={result.errorMessage.error} />
        )}
      </div>
    </div>
  );
};
