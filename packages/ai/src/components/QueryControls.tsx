import {Button, cn, Spinner, Textarea} from '@sqlrooms/ui';
import {ArrowUpIcon, OctagonXIcon} from 'lucide-react';
import {PropsWithChildren, useCallback, useRef, useEffect} from 'react';
import {useStoreWithAi} from '../AiSlice';

type QueryControlsProps = PropsWithChildren<{
  className?: string;
  placeholder?: string;
}>;

export const QueryControls: React.FC<QueryControlsProps> = ({
  className,
  placeholder = 'Type here what would you like to learn about the data?',
  children,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isRunningAnalysis = useStoreWithAi((s) => s.ai.isRunningAnalysis);
  const runAnalysis = useStoreWithAi((s) => s.ai.startAnalysis);
  const cancelAnalysis = useStoreWithAi((s) => s.ai.cancelAnalysis);
  const analysisPrompt = useStoreWithAi((s) => s.ai.analysisPrompt);
  const isDataAvailable = useStoreWithAi((s) => s.room.isDataAvailable);
  const setAnalysisPrompt = useStoreWithAi((s) => s.ai.setAnalysisPrompt);
  const currentSession = useStoreWithAi((s) => s.ai.getCurrentSession());
  const model = currentSession?.model;

  useEffect(() => {
    if (!isDataAvailable) return;
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
  }, [isDataAvailable]);

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
        if (!isRunningAnalysis && model && analysisPrompt.trim().length) {
          runAnalysis();
        }
      }
    },
    [isRunningAnalysis, model, analysisPrompt, runAnalysis],
  );

  const canStart = Boolean(
    !isRunningAnalysis && model && analysisPrompt.trim().length,
  );
  return (
    <div
      className={cn(
        'flex w-full flex-col items-center justify-center gap-4',
        className,
      )}
    >
      <div className="relative w-full overflow-hidden p-[1px]">
        <div className="flex flex-col">
          <Textarea
            ref={textareaRef}
            disabled={isRunningAnalysis}
            className="bg-muted/50 h-[100px] resize-none"
            value={analysisPrompt}
            onChange={(e) => setAnalysisPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            autoFocus
          />
          <div className="bg-muted/30 flex w-full items-center justify-between gap-2 p-2">
            <div>{children}</div>
            <div className="flex-1" />
            <div>
              {isRunningAnalysis && (
                <Button
                  variant="outline"
                  className="rounded-full"
                  onClick={cancelAnalysis}
                >
                  <OctagonXIcon className="h-4 w-4" />
                  Stop
                </Button>
              )}
              <Button
                className="h-10 w-10 rounded-full"
                variant="default"
                size="icon"
                onClick={runAnalysis}
                disabled={!canStart}
              >
                {isRunningAnalysis ? (
                  <div className="flex items-center gap-2">
                    <Spinner className="h-4 w-4" />
                  </div>
                ) : (
                  <ArrowUpIcon />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
