import {RoomPanelHeader} from '@sqlrooms/room-shell';
import {Button, useDisclosure} from '@sqlrooms/ui';
import {BugIcon, XIcon} from 'lucide-react';
import React, {useEffect} from 'react';
import {useRoomStore} from '../store';
import {AssistantChatContainer} from './AssistantChatContainer';
import {AssistantSettingsDialog} from './AssistantSettingsDialog';
import {useAssistantContextDropTarget} from './assistantUtils';

const AI_SDK_DEVTOOLS_URL =
  import.meta.env.VITE_AI_SDK_DEVTOOLS_URL || 'http://localhost:4983';

export const AssistantPanel: React.FC = () => {
  const currentSessionId = useRoomStore(
    (s) => s.ai.getCurrentSession()?.id || null,
  );
  const toggleCollapsed = useRoomStore((s) => s.layout.toggleCollapsed);
  const settingsPanelOpen = useDisclosure();
  const contextDropTarget = useAssistantContextDropTarget();

  useEffect(() => {
    if (!currentSessionId && settingsPanelOpen.isOpen) {
      settingsPanelOpen.onClose();
    }
  }, [currentSessionId, settingsPanelOpen.isOpen, settingsPanelOpen.onClose]);

  return (
    <div className="flex h-full flex-col overflow-visible p-2">
      <RoomPanelHeader>
        <div className="ml-auto flex items-center gap-1 overflow-visible p-0.5">
          {import.meta.env.DEV && (
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground hover:bg-foreground/10 h-6 w-6 shrink-0 focus-visible:ring-offset-0 focus-visible:ring-inset"
              title="Open AI SDK DevTools"
              aria-label="Open AI SDK DevTools"
              onClick={() => {
                window.open(
                  AI_SDK_DEVTOOLS_URL,
                  '_blank',
                  'noopener,noreferrer',
                );
              }}
            >
              <BugIcon className="h-3.5 w-3.5" />
            </Button>
          )}
          {currentSessionId && (
            <AssistantSettingsDialog
              isOpen={settingsPanelOpen.isOpen}
              onOpenChange={(open) => {
                if (open) {
                  settingsPanelOpen.onOpen();
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
      <AssistantChatContainer contextDropTarget={contextDropTarget} />
    </div>
  );
};
