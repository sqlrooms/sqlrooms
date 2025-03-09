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
import {useMemo} from 'react';

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

  const token = useProjectStore((s) => s.token);
  const setToken = useProjectStore((s) => s.setToken);

  // The current model is from the session
  const currentModelProvider =
    currentSession?.modelProvider || LLM_MODELS[0].name;

  const apiKey = token[currentModelProvider] || '';

  const onApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const token = e.target.value;
    setToken(token, currentModelProvider);
  };

  // Transform LLM_MODELS into the format expected by ModelSelector
  const modelOptions = useMemo(
    () =>
      LLM_MODELS.flatMap((provider) =>
        provider.models.map((model) => ({
          provider: provider.name,
          label: model,
          value: model,
        })),
      ),
    [],
  );

  return (
    <div className="flex h-full w-full flex-col gap-0 overflow-hidden p-4">
      {/* Display SessionControls at the top */}
      <div className="mb-4">
        <SessionControls />
      </div>

      {/* Display AnalysisResultsContainer without the session controls UI */}
      <div className="flex-grow overflow-auto">
        {isDataAvailable ? (
          <AnalysisResultsContainer
            key={currentSessionId} // will prevent scrolling to bottom after changing current session
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center">
            <SkeletonPane className="p-4" />
            <p className="text-muted-foreground mt-4">Loading database...</p>
          </div>
        )}
      </div>

      <QueryControls placeholder="Type here what would you like to learn about the data? Something like 'What is the max magnitude of the earthquakes by year?'">
        <div className="flex items-center justify-end gap-2">
          <div className="relative flex items-center">
            <KeyIcon className="absolute left-2 h-4 w-4" />
            <Input
              className="w-[165px] pl-8"
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
