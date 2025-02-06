import {
  Button,
  cn,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Textarea,
} from '@sqlrooms/ui';
import {KeyIcon, OctagonXIcon} from 'lucide-react';
import {useProjectStore} from '@/store/store';
import {useCallback} from 'react';

const MODEL_OPTIONS = [
  'gpt-4',
  'gpt-4o',
  'gpt-4o-mini',
  'o3-mini',
  'o3-mini-high',
] as const;

interface QueryControlsProps {
  className?: string;
}

export const QueryControls: React.FC<QueryControlsProps> = ({className}) => {
  const isRunningAnalysis = useProjectStore((s) => s.isRunningAnalysis);
  const runAnalysis = useProjectStore((s) => s.runAnalysis);
  const cancelAnalysis = useProjectStore((s) => s.cancelAnalysis);
  const analysisPrompt = useProjectStore((s) => s.analysisPrompt);
  const setAnalysisPrompt = useProjectStore((s) => s.setAnalysisPrompt);
  const openAiApiKey = useProjectStore((s) => s.openAiApiKey);
  const setOpenAiApiKey = useProjectStore((s) => s.setOpenAiApiKey);
  const aiModel = useProjectStore((s) => s.projectConfig.aiModel);
  const setAiModel = useProjectStore((s) => s.setAiModel);

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
          openAiApiKey &&
          aiModel &&
          analysisPrompt.trim().length
        ) {
          runAnalysis();
        }
      }
    },
    [isRunningAnalysis, openAiApiKey, aiModel, analysisPrompt, runAnalysis],
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

        <div className="flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <div className="relative flex items-center">
              <KeyIcon className="w-4 h-4 absolute left-2 text-gray-400" />
              <Input
                type="password"
                placeholder="OpenAI API Key"
                value={openAiApiKey || ''}
                onChange={(e) => setOpenAiApiKey(e.target.value)}
                className="pl-8 w-[150px] bg-gray-800"
              />
            </div>
            <Select value={aiModel || ''} onValueChange={setAiModel}>
              <SelectTrigger className="w-[140px] bg-gray-800">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {MODEL_OPTIONS.map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
          <Button
            variant="outline"
            onClick={runAnalysis}
            disabled={
              isRunningAnalysis ||
              !openAiApiKey ||
              !aiModel ||
              !analysisPrompt.trim().length
            }
          >
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
