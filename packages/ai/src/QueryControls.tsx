import {Button, cn, Spinner, Textarea} from '@sqlrooms/ui';
import {ArrowUpIcon, OctagonXIcon} from 'lucide-react';
import {PropsWithChildren, useCallback, useRef, useEffect} from 'react';
import {useStoreWithAi} from './AiSlice';

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
  const isDataAvailable = useStoreWithAi((s) => s.project.isDataAvailable);
  const setAnalysisPrompt = useStoreWithAi((s) => s.ai.setAnalysisPrompt);
  const currentSession = useStoreWithAi((s) => s.ai.getCurrentSession());
  const model = currentSession?.model;

  useEffect(() => {
    // Focus the textarea when the component mounts
    // Using a small timeout ensures the component is fully rendered
    const timer = setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }, 100);

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
        'flex flex-col items-center justify-center gap-4 w-full',
        className,
      )}
    >
      <div className="relative w-full overflow-hidden p-[1px]">
        <div className="flex flex-col">
          <Textarea
            ref={textareaRef}
            disabled={isRunningAnalysis}
            className="h-[100px] bg-muted/50 resize-none"
            value={analysisPrompt}
            onChange={(e) => setAnalysisPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            autoFocus
          />
          <div className="flex items-center w-full justify-between gap-2 p-2 bg-muted/30">
            <div>{children}</div>
            <div className="flex-1" />
            <div>
              {isRunningAnalysis && (
                <Button
                  variant="outline"
                  className="rounded-full"
                  onClick={cancelAnalysis}
                >
                  <OctagonXIcon className="w-4 h-4" />
                  Stop
                </Button>
              )}
              <Button
                className="rounded-full w-10 h-10"
                variant="default"
                size="icon"
                onClick={runAnalysis}
                disabled={!canStart}
              >
                {isRunningAnalysis ? (
                  <div className="flex items-center gap-2">
                    <Spinner className="w-4 h-4" />
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
