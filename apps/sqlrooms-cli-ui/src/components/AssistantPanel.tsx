import {RoomPanelHeader} from '@sqlrooms/room-shell';
import {Button, useDisclosure} from '@sqlrooms/ui';
import {XIcon} from 'lucide-react';
import React, {useEffect} from 'react';
import {useRoomStore} from '../store';
import {AssistantChatContainer} from './AssistantChatContainer';
import {AssistantSettingsDialog} from './AssistantSettingsDialog';
import {useAssistantContextDropTarget} from './assistantUtils';

export const AssistantPanel: React.FC = () => {
  const currentSessionId = useRoomStore(
    (s) => s.ai.getCurrentSession()?.id || null,
  );
  const toggleCollapsed = useRoomStore((s) => s.layout.toggleCollapsed);
  const settingsPanelOpen = useDisclosure();
  const [settingsInitialTab, setSettingsInitialTab] = React.useState<
    'connect' | 'providers' | 'models' | 'parameters'
  >('connect');
  const contextDropTarget = useAssistantContextDropTarget();

  const openAssistantSettings = React.useCallback(
    (tab: 'connect' | 'providers' | 'models' | 'parameters' = 'connect') => {
      setSettingsInitialTab(tab);
      settingsPanelOpen.onOpen();
    },
    [settingsPanelOpen],
  );

  useEffect(() => {
    if (!currentSessionId && settingsPanelOpen.isOpen) {
      settingsPanelOpen.onClose();
    }
  }, [currentSessionId, settingsPanelOpen.isOpen, settingsPanelOpen.onClose]);

  return (
    <div className="flex h-full flex-col overflow-visible p-2">
      <RoomPanelHeader>
        <div className="ml-auto flex items-center gap-1 overflow-visible p-0.5">
          {currentSessionId && (
            <AssistantSettingsDialog
              isOpen={settingsPanelOpen.isOpen}
              initialTab={settingsInitialTab}
              onOpenChange={(open) => {
                if (open) {
                  openAssistantSettings(settingsInitialTab);
                } else {
                  settingsPanelOpen.onClose();
                }
              }}
            />
          )}
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground hover:bg-foreground/10 h-6 w-6 shrink-0 focus-visible:ring-offset-0 focus-visible:ring-inset"
            title="Close panel"
            aria-label="Close panel"
            onClick={() => toggleCollapsed('assistant-sidebar')}
          >
            <XIcon className="h-3.5 w-3.5" />
          </Button>
        </div>
      </RoomPanelHeader>
      <AssistantChatContainer
        contextDropTarget={contextDropTarget}
        onOpenSettings={openAssistantSettings}
      />
    </div>
  );
};
