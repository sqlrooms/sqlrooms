import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SkeletonPane,
} from '@sqlrooms/ui';
import {KeyIcon} from 'lucide-react';
import {
  AnalysisResultsContainer,
  SessionControls,
  QueryControls,
} from '@sqlrooms/ai';
import {useProjectStore} from '../store';

export const MainView: React.FC = () => {
  const currentSessionId = useProjectStore((s) => s.config.ai.currentSessionId);
  const currentSession = useProjectStore((s) => {
    const sessions = s.config.ai.sessions;
    return sessions.find((session) => session.id === currentSessionId);
  });

  // Check if data is available
  const isDataAvailable = useProjectStore(
    (state) => state.project.isDataAvailable,
  );

  // Get analysis results from current session
  const analysisResults = currentSession?.analysisResults || [];

  const apiKey = useProjectStore((s) => s.openAiApiKey);
  const setApiKey = useProjectStore((s) => s.setOpenAiApiKey);
  const supportedModels = useProjectStore((s) => s.supportedModels);

  // Get the setAiModel function from the ai slice
  const setAiModel = useProjectStore((s) => s.ai.setAiModel);

  // The current model is from the session
  const currentModel = currentSession?.model || '';

  return (
    <div className="w-full h-full flex flex-col gap-0 overflow-hidden p-4">
      {/* Display SessionControls at the top */}
      <div className="mb-2">
        <SessionControls />
      </div>

      {/* Display AnalysisResultsContainer without the session controls UI */}
      <div className="flex-grow overflow-auto">
        {isDataAvailable ? (
          <AnalysisResultsContainer />
        ) : (
          <div className="flex flex-col items-center justify-center h-full w-full">
            <SkeletonPane className="p-4" />
            <p className="text-muted-foreground mt-4">Loading database...</p>
          </div>
        )}
      </div>

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
          <Select value={currentModel} onValueChange={setAiModel}>
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
