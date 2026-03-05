'use client';

import {Chat} from '@sqlrooms/ai-core';
import {AiSettingsPanel} from '@sqlrooms/ai-settings';
import {Button, SkeletonPane, ThemeProvider, useDisclosure} from '@sqlrooms/ui';
import {Settings} from 'lucide-react';
import {useRoomStore} from '../app/store';

export const MainView: React.FC = () => {
  const currentSessionId = useRoomStore(
    (s) => s.ai.config.currentSessionId || null,
  );

  const settingsPanelOpen = useDisclosure();

  return (
    <ThemeProvider defaultTheme="dark" storageKey="sqlrooms-ai-nextjs-theme">
      <div className="flex h-screen w-full flex-col gap-0 overflow-hidden p-4">
        <Chat>
          <div className="relative mb-4">
            <Chat.Sessions className="mr-8 max-w-[calc(100%-3rem)] overflow-hidden" />
            <Button
              variant="outline"
              className="hover:bg-accent absolute top-0 right-0 flex h-8 w-8 items-center justify-center transition-colors"
              onClick={settingsPanelOpen.onToggle}
              title="Configuration"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>

          {settingsPanelOpen.isOpen ? (
            <div className="grow overflow-auto">
              {currentSessionId && (
                <AiSettingsPanel disclosure={settingsPanelOpen}>
                  <AiSettingsPanel.ModelParametersSettings />
                </AiSettingsPanel>
              )}
            </div>
          ) : (
            <>
              <div className="grow overflow-auto">
                <Chat.Messages
                  key={currentSessionId} // will prevent scrolling to bottom after changing current session
                />
                {!currentSessionId && (
                  <div className="flex h-full w-full flex-col items-center justify-center">
                    <SkeletonPane className="p-4" />
                    <p className="text-muted-foreground mt-4">
                      Starting AI chat...
                    </p>
                  </div>
                )}
              </div>

              <Chat.Composer placeholder="Ask me anything! For example: 'Search the web for the latest news on AI'">
                <div className="flex items-center justify-end gap-2">
                  <Chat.ModelSelector />
                </div>
              </Chat.Composer>
            </>
          )}
        </Chat>
      </div>
    </ThemeProvider>
  );
};
