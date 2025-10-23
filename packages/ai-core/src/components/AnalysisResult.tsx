import {AnalysisResultSchema} from '@sqlrooms/ai-config';
import {
  Button,
  CopyButton,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@sqlrooms/ui';
import {SquareTerminalIcon, TrashIcon} from 'lucide-react';
import {useState, useMemo} from 'react';
import {AnalysisAnswer} from './AnalysisAnswer';
import {ErrorMessage} from './ErrorMessage';
import {ToolResult} from './tools/ToolResult';
import {ToolCallInfo} from './ToolCallInfo';
import {useStoreWithAi} from '../AiSlice';
import {isTextPart, isReasoningPart, isToolPart} from '../utils';
import type {UIMessage} from 'ai';

/**
 * Props for the AnalysisResult component
 * @property {AnalysisResultSchema} result - The result of the analysis containing prompt, tool calls, and analysis data
 */
type AnalysisResultProps = {
  analysisResult: AnalysisResultSchema;
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
  analysisResult,
}) => {
  const currentSession = useStoreWithAi((s) => s.ai.getCurrentSession());
  const toolAdditionalData = useStoreWithAi(
    (s) => s.ai.getCurrentSession()?.toolAdditionalData || {},
  );
  const deleteAnalysisResult = useStoreWithAi((s) => s.ai.deleteAnalysisResult);
  const uiMessages = useStoreWithAi(
    (s) => s.ai.getCurrentSession()?.uiMessages as UIMessage[] | undefined,
  );

  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Extract message parts using useMemo to avoid infinite loops
  const uiMessageParts = useMemo(() => {
    if (!uiMessages) return [];

    // Find the user message with analysisResultId
    let userMessageIndex = uiMessages.findIndex(
      (msg) => msg.id === analysisResult.id && msg.role === 'user',
    );

    // If not found (e.g., pending result before onFinish assigns the real ID),
    // fall back to the last user message to enable streaming display.
    if (userMessageIndex === -1) {
      for (let i = uiMessages.length - 1; i >= 0; i--) {
        if (uiMessages[i]?.role === 'user') {
          userMessageIndex = i;
          break;
        }
      }
      if (userMessageIndex === -1) return [];
    }

    // Find the next assistant message after this user message
    for (let i = userMessageIndex + 1; i < uiMessages.length; i++) {
      const msg = uiMessages[i];
      if (msg?.role === 'assistant') {
        return msg.parts;
      }
      if (msg?.role === 'user') {
        // Hit next user message without finding assistant response
        break;
      }
    }
    return [];
  }, [uiMessages, analysisResult.id]);

  return (
    <div className="group flex w-full flex-col gap-2 pb-2 text-sm">
      <div className="mb-2 flex items-center gap-2 rounded-md text-gray-700 dark:text-gray-100">
        <div className="bg-muted flex w-full items-center gap-2 rounded-md border p-2 text-sm">
          <SquareTerminalIcon className="h-4 w-4" />
          {/** render prompt */}
          <div className="flex-1">{analysisResult.prompt}</div>
          <div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
            <CopyButton
              text={analysisResult.prompt}
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
                setDeleteTargetId(analysisResult.id);
                setShowDeleteConfirmation(true);
              }}
            >
              <TrashIcon className="h-4 w-4" />
            </Button>

            {/* Delete Confirmation Dialog */}
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
        {/* Render response parts from uiMessages */}
        {uiMessageParts.map((part, index) => {
          if (isTextPart(part)) {
            return (
              <AnalysisAnswer
                key={index}
                content={part.text}
                isAnswer={index === uiMessageParts.length - 1}
              />
            );
          }
          if (isReasoningPart(part)) {
            return (
              <div key={index} className="text-muted-foreground text-xs">
                {part.text}
              </div>
            );
          }
          if (isToolPart(part)) {
            const toolCallId = part.toolCallId;
            const toolName = part.type.replace(/^tool-/, '') || 'unknown';
            const state = part.state;
            const input = part.input;
            const output =
              state === 'output-available' ? part.output : undefined;
            const errorText =
              state === 'output-error' ? part.errorText : undefined;
            const isCompleted =
              state === 'output-available' || state === 'output-error';
            const additionalData = toolAdditionalData[toolCallId];

            return (
              <div key={`tool-call-${toolCallId}`}>
                <ToolCallInfo
                  toolName={toolName}
                  input={input}
                  isCompleted={isCompleted}
                  state={state}
                />
                <div data-tool-call-id={toolCallId}>
                  <ToolResult
                    toolCallId={toolCallId}
                    toolData={{
                      toolCallId,
                      name: toolName,
                      state: state,
                      args: input,
                      result: output,
                      errorText,
                    }}
                    additionalData={additionalData}
                    isCompleted={isCompleted}
                    errorMessage={
                      state === 'output-error' ? errorText : undefined
                    }
                  />
                </div>
              </div>
            );
          }
          return null;
        })}
        {analysisResult.errorMessage && (
          <ErrorMessage errorMessage={analysisResult.errorMessage.error} />
        )}
      </div>
    </div>
  );
};
