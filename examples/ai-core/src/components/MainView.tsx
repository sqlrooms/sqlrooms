import {Chat, ModelSelector} from '@sqlrooms/ai-core';
import {AiSettingsPanel} from '@sqlrooms/ai-settings';
import {Button, SkeletonPane, useDisclosure} from '@sqlrooms/ui';
import {Settings} from 'lucide-react';
import {useRoomStore} from '../store';

export const MainView: React.FC = () => {
  const currentSessionId = useRoomStore(
    (s) => s.ai.config.currentSessionId || null,
  );

  const settingsPanelOpen = useDisclosure();

  return (
    <div className="flex h-full w-full flex-col gap-0 overflow-hidden p-4">
      <Chat>
        <div className="relative mb-4">
          <Chat.Sessions className="mr-8 max-w-[calc(100%-3rem)] overflow-hidden" />
          <Button
            variant="outline"
            className="absolute right-0 top-0 flex h-8 w-8 items-center justify-center transition-colors hover:bg-accent"
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
              <Chat.Messages
                key={currentSessionId} // will prevent scrolling to bottom after changing current session
              />
              <div className="flex h-full w-full flex-col items-center justify-center">
                <SkeletonPane className="p-4" />
                <p className="mt-4 text-muted-foreground">
                  Loading database...
                </p>
              </div>
            </div>

            <Chat.Composer placeholder="Type here what would you like to learn about the data? Something like 'What is the max magnitude of the earthquakes by year?'">
              <div className="flex items-center justify-end gap-2">
                <ModelSelector />
              </div>
            </Chat.Composer>
          </>
        )}
      </Chat>
    </div>
  );
};
