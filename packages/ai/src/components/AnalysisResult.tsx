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
import {StreamMessagePart} from '@openassistant/core';
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
  /** Legacy result. If omitted, component renders current session UI messages. */
  result?: AnalysisResultSchema;
  onDeleteAnalysisResult?: (id: string) => void;
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
export const AnalysisResult: React.FC<AnalysisResultProps> = (props) => {
  const {result, onDeleteAnalysisResult} = props;
  const messages = useStoreWithAi((s) => s.ai.getCurrentSession()?.uiMessages);
  const toolAdditionalData = useStoreWithAi(
    (s) => s.ai.getCurrentSession()?.toolAdditionalData || {},
  );
  const sessionId = useStoreWithAi((s) => s.ai.getCurrentSession()?.id);
  const setSessionUiMessages = useStoreWithAi((s) => s.ai.setSessionUiMessages);
  const analysisResults = useStoreWithAi(
    (s) => s.ai.getCurrentSession()?.analysisResults || [],
  );
  const lastErrorText = (() => {
    for (let i = analysisResults.length - 1; i >= 0; i--) {
      const msg = analysisResults[i]?.errorMessage?.error;
      if (msg) return msg;
    }
    return undefined;
  })();
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Legacy rendering path when a specific analysis result is provided
  if (result) {
    const {id, prompt, errorMessage, streamMessage} = result;
    const parts = streamMessage.parts as StreamMessagePart[];
    return (
      <div className="group flex w-full flex-col gap-2 pb-2 text-sm">
        <div className="mb-2 flex items-center gap-2 rounded-md text-gray-700 dark:text-gray-100">
          <div className="bg-muted flex w-full items-center gap-2 rounded-md border p-2 text-sm">
            <SquareTerminalIcon className="h-4 w-4" />
            <div className="flex-1">{prompt}</div>
            <div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
              <CopyButton
                text={prompt}
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                ariaLabel="Copy prompt"
              />
              {onDeleteAnalysisResult && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setShowDeleteConfirmation(true)}
                >
                  <TrashIcon className="h-4 w-4" />
                </Button>
              )}

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
                    {onDeleteAnalysisResult && (
                      <Button
                        variant="destructive"
                        onClick={() => {
                          onDeleteAnalysisResult(id);
                          setShowDeleteConfirmation(false);
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
        {errorMessage && <ErrorMessage errorMessage={errorMessage.error} />}
      </div>
    );
  }

  // New UI message-based rendering path
  if (!messages || messages.length === 0) return null;

  return (
    <div className="flex w-full flex-col gap-4">
      {messages.map((message) => {
        const isUser = message.role === 'user';
        if (isUser) {
          const userText = message.parts
            .filter((p) => p.type === 'text')
            .map((p) => (p as {text: string}).text)
            .join('');
          return (
            <div
              key={message.id}
              className="group flex w-full flex-col gap-2 pb-2 text-sm"
            >
              <div className="mb-2 flex items-center gap-2 rounded-md text-gray-700 dark:text-gray-100">
                <div className="bg-muted flex w-full items-center gap-2 rounded-md border p-2 text-sm">
                  <div className="flex-1">{userText}</div>
                </div>
              </div>
            </div>
          );
        }

        return (
          <div
            key={message.id}
            className="group flex w-full flex-col gap-2 pb-2 text-sm"
          >
            <div className="flex justify-end">
              <div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  aria-label="Delete analysis"
                  onClick={() => setDeleteTargetId(message.id)}
                >
                  <TrashIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {message.parts.map((part, index) => {
              if (part.type === 'text') {
                return (
                  <AnalysisAnswer
                    key={index}
                    content={(part as {text: string}).text}
                    isAnswer={index === (message.parts?.length || 0) - 1}
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
                    errorMessage={
                      state === 'output-error' ? errorText : undefined
                    }
                  />
                );
              }
              return null;
            })}
          </div>
        );
      })}
      {lastErrorText && <ErrorMessage errorMessage={lastErrorText} />}
      {/* Delete Confirmation Dialog for UI messages */}
      <Dialog
        open={Boolean(deleteTargetId)}
        onOpenChange={(open) => {
          if (!open) setDeleteTargetId(null);
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this analysis result? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTargetId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!sessionId || !messages || !deleteTargetId) return;
                const idx = messages.findIndex((m) => m.id === deleteTargetId);
                if (idx < 0) {
                  setDeleteTargetId(null);
                  return;
                }
                const next = messages.slice();
                next.splice(idx, 1);
                if (idx - 1 >= 0 && next[idx - 1]?.role === 'user') {
                  next.splice(idx - 1, 1);
                }
                setSessionUiMessages(
                  sessionId,
                  next as unknown as import('ai').UIMessage[],
                );
                setDeleteTargetId(null);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
