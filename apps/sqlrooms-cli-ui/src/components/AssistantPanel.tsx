import {RoomPanelHeader} from '@sqlrooms/room-shell';
import {Button, cn, useDisclosure} from '@sqlrooms/ui';
import {BugIcon, XIcon} from 'lucide-react';
import React, {Suspense, useEffect, useState} from 'react';
import {aiDevtoolsEnabled, useRoomStore} from '../store';
import {AssistantChatContainer} from './AssistantChatContainer';
import {AssistantSettingsDialog} from './AssistantSettingsDialog';
import {useAssistantContextDropTarget} from './assistantUtils';

const ChatSessionDebugView = React.lazy(() =>
  import('@sqlrooms/ai/devtools').then((mod) => ({
    default: mod.ChatSessionDebugView,
  })),
);

const AssistantDebugButton: React.FC<{
  isOpen: boolean;
  onToggle: () => void;
}> = ({isOpen, onToggle}) => (
  <Button
    variant="ghost"
    size="sm"
    className={cn('h-8 px-2', isOpen && 'bg-muted text-foreground')}
    title="AI session debug view"
    aria-label="AI session debug view"
    aria-pressed={isOpen}
    onClick={onToggle}
  >
    <BugIcon className="h-4 w-4" />
  </Button>
);

export const AssistantPanel: React.FC = () => {
  const currentSessionId = useRoomStore(
    (s) => s.ai.getCurrentSession()?.id || null,
  );
  const toggleCollapsed = useRoomStore((s) => s.layout.toggleCollapsed);
  const settingsPanelOpen = useDisclosure();
  const contextDropTarget = useAssistantContextDropTarget();
  const [debugOpen, setDebugOpen] = useState(false);

  useEffect(() => {
    if (!currentSessionId && settingsPanelOpen.isOpen) {
      settingsPanelOpen.onClose();
    }
  }, [currentSessionId, settingsPanelOpen.isOpen, settingsPanelOpen.onClose]);

  useEffect(() => {
    if (!currentSessionId || !aiDevtoolsEnabled) {
      setDebugOpen(false);
    }
  }, [currentSessionId]);

  return (
    <div className="flex h-full flex-col overflow-visible p-2">
      <RoomPanelHeader>
        <div className="ml-auto flex items-center gap-1 overflow-visible p-0.5">
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
      <div className="flex min-h-0 flex-1 flex-col">
        <AssistantChatContainer
          contextDropTarget={contextDropTarget}
          beforeCreateSessionAction={
            aiDevtoolsEnabled && currentSessionId ? (
              <AssistantDebugButton
                isOpen={debugOpen}
                onToggle={() => setDebugOpen((open) => !open)}
              />
            ) : null
          }
          debugPanel={
            aiDevtoolsEnabled && currentSessionId && debugOpen ? (
              <Suspense
                fallback={
                  <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
                    Loading debug view...
                  </div>
                }
              >
                <ChatSessionDebugView
                  sessionId={currentSessionId}
                  className="h-full"
                />
              </Suspense>
            ) : null
          }
        />
      </div>
    </div>
  );
};
