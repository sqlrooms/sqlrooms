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
  // const analysisResults = useProjectStore((s) => s.config.ai.analysisResults);
  const apiKey = useProjectStore((s) => s.openAiApiKey);
  const setApiKey = useProjectStore((s) => s.setOpenAiApiKey);
  const selectedModel = useProjectStore((s) => s.selectedModel);
  const setSelectedModel = useProjectStore((s) => s.setSelectedModel);
  const supportedModels = useProjectStore((s) => s.supportedModels);

  return (
    <div className="w-full h-full flex flex-col gap-0 overflow-hidden p-4">
      <AnalysisResultsContainer />
      <QueryControls placeholder="Type here what would you like to learn about the data? Something like 'What is the max magnitude of the earthquakes by year?'">
        <div className="flex items-center justify-end gap-2">
          <div className="flex items-center relative">
            <KeyIcon className="w-4 h-4 absolute left-2 " />
            <Input
              className="pl-8 w-[150px] placeholder:text-xs h-8"
              type="password"
              placeholder="OpenAI API Key"
              value={apiKey || ''}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <Select value={selectedModel || ''} onValueChange={setSelectedModel}>
            <SelectTrigger className="w-[140px] text-xs h-8">
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
      </QueryControls>
    </div>
  );
};
