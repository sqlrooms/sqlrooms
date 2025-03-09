import {Input, SkeletonPane} from '@sqlrooms/ui';
import {KeyIcon} from 'lucide-react';
import {
  AnalysisResultsContainer,
  SessionControls,
  QueryControls,
  ModelSelector,
} from '@sqlrooms/ai';
import {useProjectStore} from '../store';
import {LLM_MODELS} from './constant';
import {capitalize} from '@sqlrooms/utils';

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

  const token = useProjectStore((s) => s.token);
  const setToken = useProjectStore((s) => s.setToken);

  // The current model is from the session
  const currentModelProvider =
    currentSession?.modelProvider || LLM_MODELS[0].name;
  const currentModel = currentSession?.model || LLM_MODELS[0].models[0];

  const apiKey = token[currentModelProvider] || '';

  const onApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const token = e.target.value;
    setToken(token, currentModelProvider);
  };

  // Transform LLM_MODELS into the format expected by ModelSelector
  const modelOptions = LLM_MODELS.flatMap((provider) =>
    provider.models.map((model) => ({
      provider: provider.name,
      label: model,
      value: model,
    })),
  );

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
              className="pl-8 w-[165px]"
              type="password"
              placeholder={`${capitalize(currentModelProvider)} API Key`}
              value={apiKey}
              onChange={onApiKeyChange}
            />
          </div>
          <ModelSelector models={modelOptions} className="w-[200px]" />
        </div>
      </QueryControls>
    </div>
  );
};
