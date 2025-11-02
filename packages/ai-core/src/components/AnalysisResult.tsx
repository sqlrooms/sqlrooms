import {AnalysisResultSchema} from '@sqlrooms/ai-config';
import {Button, CopyButton} from '@sqlrooms/ui';
import {SquareTerminalIcon, TrashIcon} from 'lucide-react';
import {useState} from 'react';
import {AnalysisAnswer} from './AnalysisAnswer';
import {ErrorMessage} from './ErrorMessage';
import {ToolResult} from './tools/ToolResult';
import {ToolCallInfo} from './ToolCallInfo';
import {useStoreWithAi} from '../AiSlice';
import {isTextPart, isReasoningPart, isToolPart} from '../utils';
import {DeleteConfirmationDialog} from './DeleteConfirmationDialog';

/**
 * Props for the AnalysisResult component
 * @property {AnalysisResultSchema} result - The result of the analysis containing prompt, tool calls, and analysis data
 * @property {string | null} floatingPromptId - ID of the prompt currently shown in the floating overlay
 */
type AnalysisResultProps = {
  analysisResult: AnalysisResultSchema;
  floatingPromptId?: string | null;
};

/**
 * Component that displays the results of an AI analysis.
 * Shows the original prompt, intermediate tool calls, final analysis text,
 * and any tool results.
 *
 * @component
 * @param props - Component props
 * @param props.result - The analysis result data to display
 * @param props.floatingPromptId - ID of the prompt currently shown in the floating overlay
 * @returns A React component displaying the analysis results
 */
export const AnalysisResult: React.FC<AnalysisResultProps> = ({
  analysisResult,
  floatingPromptId,
}) => {
  const currentSession = useStoreWithAi((s) => s.ai.getCurrentSession());
  const toolAdditionalData = useStoreWithAi(
    (s) => s.ai.getCurrentSession()?.toolAdditionalData || {},
  );
  const deleteAnalysisResult = useStoreWithAi((s) => s.ai.deleteAnalysisResult);
  const getAssistantMessageParts = useStoreWithAi(
    (s) => s.ai.getAssistantMessageParts,
  );

  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const uiMessageParts = getAssistantMessageParts(analysisResult.id);

  const isFloating = floatingPromptId === analysisResult.id;

  return (
    <div className="group flex w-full flex-col gap-2 pb-2 text-sm">
      <div
        className={`mb-2 flex items-center gap-2 rounded-md text-gray-700 dark:text-gray-100 ${isFloating ? 'invisible' : ''}`}
        data-prompt-header
        data-result-id={analysisResult.id}
        data-prompt-text={analysisResult.prompt}
      >
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

            <DeleteConfirmationDialog
              open={showDeleteConfirmation}
              onOpenChange={(open) => {
                setShowDeleteConfirmation(open);
                if (!open) {
                  setDeleteTargetId(null);
                }
              }}
              onConfirm={() => {
                if (currentSession?.id && deleteTargetId) {
                  deleteAnalysisResult(currentSession.id, deleteTargetId);
                }
                setShowDeleteConfirmation(false);
                setDeleteTargetId(null);
              }}
              canConfirm={Boolean(currentSession?.id && deleteTargetId)}
              contentClassName="sm:max-w-[425px]"
            />
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
