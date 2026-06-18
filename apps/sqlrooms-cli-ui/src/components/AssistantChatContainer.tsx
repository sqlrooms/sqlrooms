import {Chat, isChatSessionEmpty} from '@sqlrooms/ai';
import {isAiSessionVisibleForArtifact} from '@sqlrooms/artifacts/ai';
import {
  Button,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  SkeletonPane,
} from '@sqlrooms/ui';
import {PlusIcon} from 'lucide-react';
import React, {useCallback, useMemo, useState} from 'react';
import {useRoomStore} from '../store';
import {AssistantContextSelector} from './AssistantContextSelector';
import {
  isDefaultAssistantSessionName,
  useGenSessionTitle,
} from './useGenSessionTitle';

interface AssistantChatContainerProps {
  contextDropTarget: {
    id: string;
    canAccept: (data: unknown) => boolean;
    onDrop: (data: unknown) => void;
  };
  beforeCreateSessionAction?: React.ReactNode;
  debugPanel?: React.ReactNode;
}

export const AssistantChatContainer: React.FC<AssistantChatContainerProps> = ({
  contextDropTarget,
  beforeCreateSessionAction,
  debugPanel,
}) => {
  const currentSessionId = useRoomStore(
    (s) => s.ai.getCurrentSession()?.id || null,
  );
  const currentSession = useRoomStore((s) => s.ai.getCurrentSession());
  const currentArtifactId = useRoomStore(
    (s) => s.artifacts.config.currentArtifactId,
  );
  const sessions = useRoomStore((s) => s.ai.config.sessions);
  const aiSessionArtifacts = useRoomStore(
    (s) => s.artifactAi.config.aiSessionArtifacts,
  );
  const isDataAvailable = useRoomStore((state) => state.room.initialized);
  const updateProvider = useRoomStore((s) => s.aiSettings.updateProvider);
  const createArtifactScopedSession = useRoomStore(
    (s) => s.artifactAi.createArtifactScopedSession,
  );

  const [showHistory, setShowHistory] = useState(false);
  useGenSessionTitle();

  const createSessionDisabled = Boolean(
    currentSession &&
    isChatSessionEmpty(currentSession) &&
    isDefaultAssistantSessionName(currentSession.name),
  );

  const handleCreateSession = useCallback(() => {
    if (createSessionDisabled) {
      return;
    }
    createArtifactScopedSession();
  }, [createArtifactScopedSession, createSessionDisabled]);

  const filterSession = useCallback(
    (session: (typeof sessions)[number]) =>
      isAiSessionVisibleForArtifact(
        aiSessionArtifacts,
        session.id,
        currentArtifactId,
      ),
    [aiSessionArtifacts, currentArtifactId],
  );

  const historyIsRunning = useMemo(() => {
    if (!currentArtifactId || currentSession?.isRunning) {
      return false;
    }
    return sessions.some(
      (session) =>
        session.isRunning &&
        session.id !== currentSession?.id &&
        isAiSessionVisibleForArtifact(
          aiSessionArtifacts,
          session.id,
          currentArtifactId,
        ),
    );
  }, [aiSessionArtifacts, currentArtifactId, currentSession, sessions]);

  const messagesPane = (
    <div className="print-container h-full min-h-0 grow overflow-auto">
      {isDataAvailable ? (
        <Chat.Messages key={currentSessionId} hoistedRenderers={['chart']} />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center">
          <SkeletonPane className="p-4" />
          <p className="text-muted-foreground mt-4">Loading database...</p>
        </div>
      )}
    </div>
  );

  return (
    <Chat.Root>
      <div className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden">
        {!currentSessionId ? (
          <div className="flex h-full w-full items-center justify-center">
            <Button
              type="button"
              variant="outline"
              className="h-12 gap-2 px-4"
              onClick={handleCreateSession}
              disabled={!currentArtifactId}
            >
              <PlusIcon className="h-4 w-4" />
              New session
            </Button>
          </div>
        ) : (
          <>
            {!showHistory && (
              <Chat.Header
                onHistoryClick={() => setShowHistory(true)}
                onCreateSession={handleCreateSession}
                createSessionDisabled={createSessionDisabled}
                historyIsRunning={historyIsRunning}
                beforeCreateSessionAction={beforeCreateSessionAction}
                className={debugPanel ? 'mb-2' : 'mb-4'}
              />
            )}
            {showHistory ? (
              <Chat.History
                onBack={() => setShowHistory(false)}
                onCreateSession={handleCreateSession}
                createSessionDisabled={createSessionDisabled}
                filterSession={filterSession}
                emptyLabel="No chats for this artifact yet"
                onSelectChat={(sessionId) => {
                  const switchSession =
                    useRoomStore.getState().ai.switchSession;
                  switchSession(sessionId);
                  setShowHistory(false);
                }}
                className="flex-1"
              />
            ) : (
              <div className="min-h-0 flex-1">
                {debugPanel ? (
                  <ResizablePanelGroup
                    orientation="vertical"
                    className="h-full min-h-0"
                  >
                    <ResizablePanel
                      id="ai-debug-panel"
                      defaultSize={50}
                      minSize={20}
                      className="min-h-0 overflow-hidden"
                    >
                      {debugPanel}
                    </ResizablePanel>
                    <ResizableHandle withHandle className="my-1" />
                    <ResizablePanel
                      id="ai-chat-panel"
                      defaultSize={50}
                      minSize={20}
                      className="min-h-0 pt-2"
                    >
                      {messagesPane}
                    </ResizablePanel>
                  </ResizablePanelGroup>
                ) : (
                  messagesPane
                )}
              </div>
            )}
          </>
        )}
        {currentSessionId && !showHistory && (
          <>
            <Chat.PromptSuggestions>
              <Chat.PromptSuggestions.Item text="What questions can I ask to get insights from my data?" />
              <Chat.PromptSuggestions.Item text="Show me a summary of the data" />
              <Chat.PromptSuggestions.Item text="What are the key trends?" />
              <Chat.PromptSuggestions.Item text="Help me understand the data structure" />
            </Chat.PromptSuggestions>
            <Chat.Composer
              placeholder="What would you like to learn about the data?"
              contextDropTarget={contextDropTarget}
            >
              <Chat.InlineApiKeyInput
                onSaveApiKey={(provider, apiKey) => {
                  updateProvider(provider, {apiKey});
                }}
              />
              <AssistantContextSelector />
              <div className="flex items-center justify-end gap-2">
                <Chat.PromptSuggestions.VisibilityToggle />
                <Chat.ModelSelector />
              </div>
            </Chat.Composer>
          </>
        )}
      </div>
    </Chat.Root>
  );
};
