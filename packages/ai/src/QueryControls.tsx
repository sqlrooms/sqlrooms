import {Button, cn, Spinner, Textarea} from '@sqlrooms/ui';
import {OctagonXIcon} from 'lucide-react';
import {useCallback} from 'react';
import {useStoreWithAi} from './AiSlice';

interface QueryControlsProps {
  className?: string;
}

export const QueryControls: React.FC<QueryControlsProps> = ({className}) => {
  const isRunningAnalysis = useStoreWithAi((s) => s.ai.isRunningAnalysis);
  const runAnalysis = useStoreWithAi((s) => s.ai.startAnalysis);
  const cancelAnalysis = useStoreWithAi((s) => s.ai.cancelAnalysis);
  const analysisPrompt = useStoreWithAi((s) => s.ai.analysisPrompt);
  const setAnalysisPrompt = useStoreWithAi((s) => s.ai.setAnalysisPrompt);
  const model = useStoreWithAi((s) => s.project.config.ai.model);

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
        'flex flex-col items-center justify-center gap-4 w-full p-4',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-4 w-full">
        <div className="font-semibold text-lg pl-1">
          What would you like to learn about the data?
        </div>
      </div>

      <div className="relative w-full">
        <Textarea
          disabled={isRunningAnalysis}
          className="h-[100px] bg-gray-800"
          value={analysisPrompt}
          onChange={(e) => setAnalysisPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className="absolute top-1 right-1 flex items-center gap-2">
          {isRunningAnalysis && (
            <Button variant="outline" onClick={cancelAnalysis}>
              <OctagonXIcon className="w-4 h-4" />
              Stop
            </Button>
          )}
          <Button variant="outline" onClick={runAnalysis} disabled={!canStart}>
            {isRunningAnalysis ? (
              <div className="flex items-center gap-2">
                <Spinner className="w-4 h-4" /> Running…
              </div>
            ) : (
              'Start Analysis'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
