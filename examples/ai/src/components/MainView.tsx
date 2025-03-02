import {AnalysisResultsContainer, QueryControls} from '@sqlrooms/ai';
import {
  cn,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sqlrooms/ui';
import {KeyIcon} from 'lucide-react';
import {useProjectStore} from '../store';

export const MainView: React.FC = () => {
  const analysisResults = useProjectStore((s) => s.config.ai.analysisResults);
  const apiKey = useProjectStore((s) => s.openAiApiKey);
  const setApiKey = useProjectStore((s) => s.setOpenAiApiKey);
  const selectedModel = useProjectStore((s) => s.selectedModel);
  const setSelectedModel = useProjectStore((s) => s.setSelectedModel);
  const supportedModels = useProjectStore((s) => s.supportedModels);

  return (
    <div className="w-full h-full flex flex-col gap-0 overflow-hidden">
      {analysisResults.length > 0 && <AnalysisResultsContainer />}
      <div
        className={cn(
          'w-full min-h-[200px] transition-all duration-300 ease-in-out pb-12',
          analysisResults.length > 0 ? 'border-t' : 'flex-1 max-w-5xl mx-auto',
        )}
      >
        <QueryControls />
        <div className="flex items-center justify-end gap-2 px-4">
          <div className="flex items-center relative">
            <KeyIcon className="w-4 h-4 absolute left-2 " />
            <Input
              type="password"
              placeholder="OpenAI API Key"
              value={apiKey || ''}
              onChange={(e) => setApiKey(e.target.value)}
              className="pl-8 w-[200px]"
            />
          </div>
          <Select value={selectedModel || ''} onValueChange={setSelectedModel}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              {supportedModels.map((model) => (
                <SelectItem key={model} value={model}>
                  {model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};
