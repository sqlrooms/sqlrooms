import {AnalysisResultSchema} from '@sqlrooms/ai-config';
import {Button, CopyButton} from '@sqlrooms/ui';
import {SquareTerminalIcon, TrashIcon} from 'lucide-react';
import {useState, useRef, useEffect} from 'react';
import {Components} from 'react-markdown';
import {ErrorMessage} from './ErrorMessage';
import {GroupedMessageParts} from './GroupedMessageParts';
import {MessagePartsList} from './MessagePartsList';
import {useStoreWithAi} from '../AiSlice';
import {useToolGrouping} from '../hooks/useToolGrouping';
import {useAssistantMessageParts} from '../hooks/useAssistantMessageParts';
import type {UIMessage} from 'ai';
import {DeleteConfirmationDialog} from './DeleteConfirmationDialog';

/**
 * Props for the AnalysisResult component
 * @property {AnalysisResultSchema} result - The result of the analysis containing prompt, tool calls, and analysis data
 * @property {boolean} enableReasoningBox - Whether to group consecutive tool parts into a collapsible ReasoningBox
 * @property {Partial<Components>} customMarkdownComponents - Optional custom components for markdown rendering
 * @property {string[]} userTools - Array of tool names that should not be grouped and must be rendered separately
 */
type AnalysisResultProps = {
  analysisResult: AnalysisResultSchema;
  enableReasoningBox?: boolean;
  customMarkdownComponents?: Partial<Components>;
  userTools?: string[];
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
  enableReasoningBox = false,
  customMarkdownComponents,
  userTools,
}) => {
  const currentSession = useStoreWithAi((s) => s.ai.getCurrentSession());
  const deleteAnalysisResult = useStoreWithAi((s) => s.ai.deleteAnalysisResult);
  const uiMessages = useStoreWithAi(
    (s) => s.ai.getCurrentSession()?.uiMessages as UIMessage[] | undefined,
  );
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [divWidth, setDivWidth] = useState<number>(0);
  const divRef = useRef<HTMLDivElement>(null);

  const uiMessageParts = useAssistantMessageParts(
    uiMessages,
    analysisResult.id,
  );

  // Measure div width using ResizeObserver
  useEffect(() => {
    const element = divRef.current;
    if (!element) return;

    // Set initial width immediately
    setDivWidth(element.getBoundingClientRect().width);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Use borderBoxSize if available (modern API), fallback to contentRect
        const width =
          entry.borderBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
        setDivWidth(width);
      }
    });

    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Group consecutive tool parts together for rendering in ReasoningBox (only if enabled)
  const groupedParts = useToolGrouping(uiMessageParts, divWidth, userTools);

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
      <div ref={divRef} className="flex w-full flex-col gap-4">
        {enableReasoningBox ? (
          <GroupedMessageParts
            groupedParts={groupedParts}
            totalPartsCount={uiMessageParts.length}
            customMarkdownComponents={customMarkdownComponents}
          />
        ) : (
          <MessagePartsList
            parts={uiMessageParts}
            customMarkdownComponents={customMarkdownComponents}
          />
        )}
        {analysisResult.errorMessage && (
          <ErrorMessage errorMessage={analysisResult.errorMessage.error} />
        )}
      </div>
    </div>
  );
};
