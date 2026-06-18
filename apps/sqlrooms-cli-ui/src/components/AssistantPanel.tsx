import {RoomPanelHeader} from '@sqlrooms/room-shell';
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  useDisclosure,
} from '@sqlrooms/ui';
import {BugIcon, XIcon} from 'lucide-react';
import React, {Suspense, useEffect} from 'react';
import {aiDevtoolsEnabled, useRoomStore} from '../store';
import {AssistantChatContainer} from './AssistantChatContainer';
import {AssistantSettingsDialog} from './AssistantSettingsDialog';
import {useAssistantContextDropTarget} from './assistantUtils';

const ChatSessionDebugView = React.lazy(() =>
  import('@sqlrooms/ai/devtools').then((mod) => ({
    default: mod.ChatSessionDebugView,
  })),
);

const AssistantDebugPopover: React.FC<{sessionId: string}> = ({sessionId}) => (
  <Popover>
    <PopoverTrigger asChild>
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-foreground hover:bg-foreground/10 h-6 w-6 shrink-0 focus-visible:ring-offset-0 focus-visible:ring-inset"
        title="AI session debug view"
        aria-label="AI session debug view"
      >
        <BugIcon className="h-3.5 w-3.5" />
      </Button>
    </PopoverTrigger>
    <PopoverContent
      align="end"
      side="bottom"
      className="h-[75vh] w-[760px] max-w-[calc(100vw-2rem)] overflow-hidden p-0"
    >
      <Suspense
        fallback={
          <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
            Loading debug view...
          </div>
        }
      >
        <ChatSessionDebugView sessionId={sessionId} className="h-full" />
      </Suspense>
    </PopoverContent>
  </Popover>
);

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
          {aiDevtoolsEnabled && currentSessionId && (
            <AssistantDebugPopover sessionId={currentSessionId} />
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
