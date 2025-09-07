import {
  SessionControls,
  AnalysisResultsContainer,
  QueryControls,
} from '@sqlrooms/ai';
import {RoomPanel} from '@sqlrooms/room-shell';
import {SkeletonPane, Button} from '@sqlrooms/ui';
import {Settings} from 'lucide-react';
import {useState, FC, useMemo} from 'react';
import {AiConfigPanel} from './AiConfigPanel';
import {ModelUsageData} from '../types';
import {useStoreWithAiChatUi} from '../AiConfigSlice';

interface AssistantPanelProps {
  currentSessionId: string | null;
  // chat data available
  isDataAvailable: boolean;
  supportUrl: string;
  // Model options
  modelOptions: Array<{provider: string; label: string; value: string}>;
  // Optional model usage data
  modelUsage?: ModelUsageData;
  // Optional proxy base URL function
  getProxyBaseUrl?: () => string;
  // Optional model status function
  getModelStatus?: () => {isReady: boolean; error?: string};
  // Optional hide apiKey input for default models
  hideApiKeyInputForDefaultModels?: boolean;
}

export const AssistantPanel: FC<AssistantPanelProps> = ({
  currentSessionId,
  isDataAvailable,
  supportUrl,
  modelOptions,
  modelUsage,
  getProxyBaseUrl,
  getModelStatus,
  hideApiKeyInputForDefaultModels,
}) => {
  // Get AI configuration state
  const aiConfig = useStoreWithAiChatUi((s) => s.getAiConfig());
  const selectedModel = useStoreWithAiChatUi((s) => s.getSelectedModel());

  // Get model status e.g. from proxy - default to ready if not provided
  const {isReady, error: modelError} = getModelStatus?.() ?? {isReady: true};

  const [isConfigPanelOpen, setIsConfigPanelOpen] = useState(false);

  // Determine button variant based on model type and API key
  const buttonVariant = useMemo(() => {
    if (
      aiConfig.type === 'default' &&
      selectedModel &&
      (!selectedModel.apiKey || selectedModel.apiKey.trim() === '')
    ) {
      return 'destructive';
    }
    return 'outline';
  }, [aiConfig.type, selectedModel]);

  return (
    <RoomPanel type="assistant" className="overflow-hidden">
      <div className="flex h-full w-full flex-col gap-0 overflow-hidden p-4">
        <div className="relative mb-4">
          <SessionControls className="mr-8 max-w-[calc(100%-3rem)] overflow-hidden" />
          <Button
            variant={buttonVariant}
            className="hover:bg-accent absolute right-0 top-0 flex h-8 w-8 items-center justify-center transition-colors"
            onClick={() => setIsConfigPanelOpen(!isConfigPanelOpen)}
            title="Configuration"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>

        {isConfigPanelOpen ? (
          <div className="flex-grow overflow-auto">
            <AiConfigPanel
              isOpen={true}
              setIsOpen={setIsConfigPanelOpen}
              modelOptions={modelOptions}
              modelUsage={modelUsage}
              getProxyBaseUrl={getProxyBaseUrl}
              hideApiKeyInputForDefaultModels={hideApiKeyInputForDefaultModels}
            />
          </div>
        ) : (
          <>
            <div className="flex-grow overflow-auto">
              {isDataAvailable ? (
                <AnalysisResultsContainer
                  key={currentSessionId} // will prevent scrolling to bottom after changing current session
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center">
                  <SkeletonPane className="p-4" />
                  <p className="text-muted-foreground mt-4">
                    Loading database...
                  </p>
                </div>
              )}
            </div>

            {!isReady ? (
              <div className="flex w-full flex-col items-center justify-center gap-4">
                <p className="p-6 text-left text-sm text-red-500">
                  ⚠️ The AI assistant is currently unavailable.{' '}
                  {modelError && `Error: ${modelError}`} Please try restarting
                  the application or{' '}
                  <a
                    href={supportUrl}
                    className="underline hover:text-red-600"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    contact support
                  </a>{' '}
                  if the issue persists.
                </p>
              </div>
            ) : (
              <QueryControls placeholder="Type here what would you like to learn about the data? Something like 'What is the max magnitude of the earthquakes by year?'" />
            )}
          </>
        )}
      </div>
    </RoomPanel>
  );
};
