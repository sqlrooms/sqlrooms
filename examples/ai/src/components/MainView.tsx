import {useMemo, useState} from 'react';
import {AiConfigPanel, useStoreWithAiChatUi} from '@sqlrooms/ai-chatui';
import {useRoomStore} from '../store';
import {Button, SkeletonPane} from '@sqlrooms/ui';
import {Settings} from 'lucide-react';
import {
  AnalysisResultsContainer,
  SessionControls,
  QueryControls,
  getDefaultInstructions,
} from '@sqlrooms/ai';
import {useBaseRoomShellStore} from '@sqlrooms/room-shell';
import {LLM_MODELS} from '../models';

export const MainView: React.FC = () => {
  const currentSessionId = useRoomStore(
    (s) => s.config.ai.currentSessionId || null,
  );
  const isDataAvailable = useRoomStore((state) => state.room.initialized);
  // Get tables schema from room store
  const tables = useBaseRoomShellStore((s) => s.db.tables);

  const getModelStatus = () => ({
    isReady: true,
    error: undefined,
  });

  const aiConfig = useStoreWithAiChatUi((s) => s.getAiConfig());

  // Memoize the selected model to prevent infinite re-renders
  const selectedModel = useMemo(() => {
    const {models, selectedModelId} = aiConfig;
    if (!selectedModelId) return null;

    // Find the model across all providers
    for (const providerName in models) {
      const provider = models[providerName];
      if (provider) {
        const model = provider.models.find(
          (model) => model.id === selectedModelId,
        );
        if (model) {
          return {
            id: model.id,
            modelName: model.modelName,
            provider: provider.provider,
            baseUrl: provider.baseUrl,
            apiKey: provider.apiKey,
          };
        }
      }
    }
    return null;
  }, [aiConfig]);

  // Wrapper function to handle type conversion for getDefaultInstructions
  const getDefaultInstructionsWrapper = () => {
    return getDefaultInstructions(tables);
  };

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

  const [isConfigPanelOpen, setIsConfigPanelOpen] = useState(false);

  return (
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
            getDefaultInstructions={getDefaultInstructionsWrapper}
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

          {!getModelStatus().isReady ? (
            <div className="flex w-full flex-col items-center justify-center gap-4">
              <p className="p-6 text-left text-sm text-red-500">
                ⚠️ The AI assistant is currently unavailable.{' '}
                {getModelStatus().error && `Error: ${getModelStatus().error}`}{' '}
                Please try restarting the application or{' '}
                <a
                  href={`https://support.sqlrooms.com`}
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
  );
};
