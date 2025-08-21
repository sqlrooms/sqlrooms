import {Input, SkeletonPane, Checkbox, Label} from '@sqlrooms/ui';
import {
  KeyIcon,
  ServerIcon,
  CpuIcon,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import {
  AnalysisResultsContainer,
  SessionControls,
  QueryControls,
  ModelSelector,
  useStoreWithAi,
} from '@sqlrooms/ai';
import {useRoomStore} from '../store';
import {
  LLM_MODELS,
  OLLAMA_DEFAULT_BASE_URL,
  CUSTOM_MODEL_NAME,
} from '../models';
import {capitalize} from '@sqlrooms/utils';
import {useMemo, useState, useEffect} from 'react';

export const MainView: React.FC = () => {
  const currentSessionId = useRoomStore((s) => s.config.ai.currentSessionId);
  const currentSession = useRoomStore((s) => {
    const sessions = s.config.ai.sessions;
    return sessions.find((session) => session.id === currentSessionId);
  });

  // Check if data is available
  const isDataAvailable = useRoomStore((state) => state.room.initialized);

  const apiKeys = useRoomStore((s) => s.apiKeys);
  const setProviderApiKey = useRoomStore((s) => s.setProviderApiKey);

  // Get AI slice functions
  const setOllamaBaseUrl = useStoreWithAi((s) => s.ai.setOllamaBaseUrl);
  const setCustomModelName = useStoreWithAi((s) => s.ai.setCustomModelName);
  const setSendSampleRowsToLLM = useStoreWithAi(
    (s) => s.ai.setSendSampleRowsToLLM,
  );

  // The current model is from the session
  const currentModelProvider =
    currentSession?.modelProvider || LLM_MODELS[0].name;

  const apiKey = apiKeys[currentModelProvider] || '';
  const ollamaBaseUrl =
    currentSession?.ollamaBaseUrl || OLLAMA_DEFAULT_BASE_URL;

  // State for custom model name
  const [customModelNameLocal, setCustomModelNameLocal] = useState('');

  // State for collapsible sample rows section
  const [isSampleRowsExpanded, setIsSampleRowsExpanded] = useState(false);

  // Initialize custom model name from current session
  useEffect(() => {
    if (
      currentSession?.customModelName &&
      currentSession?.model === CUSTOM_MODEL_NAME
    ) {
      setCustomModelNameLocal(currentSession.customModelName);
    } else {
      setCustomModelNameLocal('');
    }
  }, [currentSession]);

  const onApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProviderApiKey(currentModelProvider, e.target.value);
  };

  const onOllamaBaseUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setOllamaBaseUrl(e.target.value);
  };

  const onCustomModelNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const modelName = e.target.value;
    setCustomModelNameLocal(modelName);
  };

  // Debounced effect to update the custom model name in the store after user stops typing
  useEffect(() => {
    if (currentSession?.model === CUSTOM_MODEL_NAME) {
      const timeoutId = setTimeout(() => {
        setCustomModelName(customModelNameLocal);
      }, 500); // 500ms delay

      return () => clearTimeout(timeoutId);
    }
  }, [customModelNameLocal, currentSession, setCustomModelName]);

  const onSendSampleRowsChange = (checked: boolean) => {
    setSendSampleRowsToLLM(checked);
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

  // Check if current provider is ollama
  const isOllamaProvider = currentModelProvider === 'ollama';

  // Check if current model is custom
  const isCustomModel = currentSession?.model === CUSTOM_MODEL_NAME;

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
          {!isOllamaProvider && (
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
          )}
          {isOllamaProvider && (
            <div className="relative flex items-center">
              <ServerIcon className="absolute left-2 h-4 w-4" />
              <Input
                className="w-[200px] pl-8"
                type="text"
                placeholder="Ollama Server URL"
                value={ollamaBaseUrl}
                onChange={onOllamaBaseUrlChange}
              />
            </div>
          )}
          {isOllamaProvider && isCustomModel && (
            <div className="relative flex items-center">
              <CpuIcon className="absolute left-2 h-4 w-4" />
              <Input
                className="w-[200px] pl-8"
                type="text"
                placeholder="e.g., llama2:7b, codellama:7b"
                value={customModelNameLocal}
                onChange={onCustomModelNameChange}
              />
            </div>
          )}
          <ModelSelector models={modelOptions} className="w-[200px]" />
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSampleRowsExpanded(!isSampleRowsExpanded)}
              className="text-muted-foreground hover:text-foreground flex h-6 w-6 items-center justify-center transition-colors"
              aria-label={
                isSampleRowsExpanded
                  ? 'Hide sample rows settings'
                  : 'Show sample rows settings'
              }
            >
              {isSampleRowsExpanded ? (
                <ChevronLeft className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
            {isSampleRowsExpanded && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="sample-rows-checkbox"
                  checked={currentSession?.sendSampleRowsToLLM ?? true}
                  onCheckedChange={onSendSampleRowsChange}
                />
                <Label
                  htmlFor="sample-rows-checkbox"
                  className="text-muted-foreground text-xs"
                >
                  Send Sample Rows to LLM
                </Label>
              </div>
            )}
          </div>
        </div>
      </QueryControls>
    </div>
  );
};
