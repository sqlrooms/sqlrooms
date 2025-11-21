import {
  AiSettingsPanel,
  AnalysisResultsContainer,
  ModelSelector,
  QueryControls,
  SessionControls,
  PromptSuggestions,
} from '@sqlrooms/ai';
import {Button, SkeletonPane, useDisclosure} from '@sqlrooms/ui';
import {Settings} from 'lucide-react';
import {useRoomStore} from '../store';

export const MainView: React.FC = () => {
  const currentSessionId = useRoomStore(
    (s) => s.ai.config.currentSessionId || null,
  );
  const isDataAvailable = useRoomStore((state) => state.room.initialized);

  const settingsPanelOpen = useDisclosure();

  return (
    <div className="flex h-full w-full flex-col gap-0 overflow-hidden p-4">
      <div className="relative mb-4">
        <SessionControls className="mr-8 max-w-[calc(100%-3rem)] overflow-hidden" />
        <Button
          variant="outline"
          className="hover:bg-accent absolute right-0 top-0 flex h-8 w-8 items-center justify-center transition-colors"
          onClick={settingsPanelOpen.onToggle}
          title="Configuration"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      {settingsPanelOpen.isOpen ? (
        <div className="flex-grow overflow-auto">
          {currentSessionId && (
            <AiSettingsPanel disclosure={settingsPanelOpen}>
              <AiSettingsPanel.ProvidersSettings />
              <AiSettingsPanel.ModelsSettings />
              <AiSettingsPanel.ModelParametersSettings />
            </AiSettingsPanel>
          )}
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

          <PromptSuggestions.Container>
            <PromptSuggestions.Item text="What questions can I ask to get insights from my data?" />
            <PromptSuggestions.Item text="Show me a summary of the data" />
            <PromptSuggestions.Item text="What are the key trends?" />
            <PromptSuggestions.Item text="Help me understand the data structure" />
          </PromptSuggestions.Container>

          <QueryControls placeholder="What would you like to learn about the data?">
            <div className="flex items-center justify-end gap-2">
              <PromptSuggestions.VisibilityToggle />
              <ModelSelector />
            </div>
          </QueryControls>
        </>
      )}
    </div>
  );
};
