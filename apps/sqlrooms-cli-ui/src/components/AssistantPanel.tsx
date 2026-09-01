import {
  Button,
  cn,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  useDisclosure,
} from '@sqlrooms/ui';
import {BugIcon, PlusIcon, XIcon} from 'lucide-react';
import React, {Suspense, useEffect, useState} from 'react';
import {useRoomStore} from '../roomStoreHooks';
import {aiDevtoolsEnabled} from '../runtimeEnvironment';
import {CliChatSelector} from './selectors/CliChatSelector';
import {AssistantChatContainer} from './AssistantChatContainer';
import {AssistantSettingsDialog} from './AssistantSettingsDialog';
import {useAssistantContextDropTarget} from './assistantUtils';
import {isCreateSessionDisabled} from './sessionCreation';

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
  const currentSession = useRoomStore((s) => s.ai.getCurrentSession());
  const currentArtifactId = useRoomStore(
    (s) => s.artifacts.config.currentArtifactId,
  );
  const createSession = useRoomStore((s) => s.ai.createSession);
  const createArtifactScopedSession = useRoomStore(
    (s) => s.artifactAi.createArtifactScopedSession,
  );
  const setCollapsed = useRoomStore((s) => s.layout.setCollapsed);
  const settingsPanelOpen = useDisclosure();
  const contextDropTarget = useAssistantContextDropTarget();
  const [debugOpen, setDebugOpen] = useState(false);
  const createSessionDisabled = isCreateSessionDisabled(currentSession);

  const handleCreateSession = () => {
    if (createSessionDisabled) return;
    if (currentArtifactId) {
      createArtifactScopedSession();
    } else {
      createSession();
    }
  };

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
    <div className="flex h-full flex-col overflow-visible">
      <header className="border-border bg-background/95 flex h-12 shrink-0 items-center justify-between gap-3 border-b px-3">
        <div className="flex min-w-0 items-center">
          {currentSession ? (
            <CliChatSelector currentSession={currentSession} />
          ) : (
            <span className="text-muted-foreground px-2 text-sm">
              No chat selected
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 overflow-visible p-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="New chat"
                disabled={createSessionDisabled}
                onClick={handleCreateSession}
              >
                <PlusIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {currentArtifactId ? 'New chat for this artifact' : 'New chat'}
            </TooltipContent>
          </Tooltip>
          {aiDevtoolsEnabled && currentSessionId ? (
            <AssistantDebugButton
              isOpen={debugOpen}
              onToggle={() => setDebugOpen((open) => !open)}
            />
          ) : null}
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
            onClick={() => setCollapsed('assistant-sidebar', true)}
          >
            <XIcon className="h-3.5 w-3.5" />
          </Button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col p-2">
        <AssistantChatContainer
          contextDropTarget={contextDropTarget}
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
                  onClose={() => setDebugOpen(false)}
                />
              </Suspense>
            ) : null
          }
        />
      </div>
    </div>
  );
};
