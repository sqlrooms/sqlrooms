import {Button, cn, Textarea} from '@sqlrooms/ui';
import {ArrowUpIcon, OctagonXIcon} from 'lucide-react';
import {
  PropsWithChildren,
  useCallback,
  useRef,
  useEffect,
  ReactNode,
} from 'react';
import {useStoreWithAi} from '../AiSlice';
import {useAiChat} from '../hooks/useAiChat';

type QueryControlsProps = PropsWithChildren<{
  className?: string;
  placeholder?: string;
  onRun?: () => void;
  onCancel?: () => void;
}>;

export const QueryControls: React.FC<QueryControlsProps> = ({
  className,
  placeholder = 'What would you like to learn about the data?',
  children,
  onRun,
  onCancel,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const currentSession = useStoreWithAi((s) => s.ai.getCurrentSession());
  const sessionId = currentSession?.id;
  const model = currentSession?.model;

  // Use per-session running state
  const isSessionRunning = useStoreWithAi((s) => s.ai.isSessionRunning);
  const isRunningAnalysis = sessionId ? isSessionRunning(sessionId) : false;

  const runAnalysis = useStoreWithAi((s) => s.ai.startAnalysis);
  const cancelSession = useStoreWithAi((s) => s.ai.cancelSession);
  const analysisPrompt = useStoreWithAi((s) => s.ai.analysisPrompt);
  const setAnalysisPrompt = useStoreWithAi((s) => s.ai.setAnalysisPrompt);

  // Use the custom hook for chat functionality
  const {sendMessage} = useAiChat();

  useEffect(() => {
    // Focus the textarea when the component mounts
    // Using a small timeout ensures the data is loaded and
    // add timeout to prevent aria hidden warning caused by the
    // loading progress dialog being still open
    const timer = setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (
        e.key === 'Enter' &&
        !e.shiftKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.metaKey
      ) {
        e.preventDefault();
        if (
          !isRunningAnalysis &&
          model &&
          analysisPrompt.trim().length &&
          sessionId
        ) {
          runAnalysis(sessionId, sendMessage);
        }
      }
    },
    [
      isRunningAnalysis,
      model,
      analysisPrompt,
      runAnalysis,
      sendMessage,
      sessionId,
    ],
  );

  const canStart = Boolean(model && analysisPrompt.trim().length && sessionId);

  const handleClickRunOrCancel = useCallback(() => {
    if (!sessionId) return;
    if (isRunningAnalysis) {
      cancelSession(sessionId);
      onCancel?.();
    } else {
      runAnalysis(sessionId, sendMessage);
      onRun?.();
    }
  }, [
    sessionId,
    isRunningAnalysis,
    cancelSession,
    onCancel,
    runAnalysis,
    sendMessage,
    onRun,
  ]);

  return (
    <div
      className={cn(
        'flex w-full flex-col items-center justify-center gap-2',
        className,
      )}
    >
      <div className="bg-muted/50 flex h-full w-full flex-row items-center gap-2 rounded-md border">
        <div className="flex w-full flex-col gap-1 overflow-hidden">
          <Textarea
            ref={textareaRef}
            className="max-h-[min(300px,40vh)] min-h-[30px] resize-none border-none p-2 text-sm outline-none focus-visible:ring-0"
            autoResize
            value={analysisPrompt}
            onChange={(e) => setAnalysisPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            autoFocus
          />
          <div className="align-stretch flex w-full items-center gap-2 overflow-hidden">
            <div className="flex h-full w-full min-w-0 items-center gap-2 overflow-hidden">
              <div className="min-w-0 flex-1 overflow-hidden">
                <div className="flex flex-nowrap items-center gap-2 overflow-x-auto py-1 pl-2">
                  {children}
                </div>
              </div>
              <div className="ml-auto shrink-0 gap-2 pr-2">
                <Button
                  className="h-8 w-8 rounded-full"
                  variant="default"
                  size="icon"
                  onClick={handleClickRunOrCancel}
                  disabled={!isRunningAnalysis && !canStart}
                >
                  {isRunningAnalysis ? <OctagonXIcon /> : <ArrowUpIcon />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
