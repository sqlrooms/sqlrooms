import {Chat, useStoreWithAi} from '@sqlrooms/ai';
import {useBaseRoomStore, useRoomStoreApi} from '@sqlrooms/room-store';
import {Button} from '@sqlrooms/ui';
import {MessageSquarePlusIcon} from 'lucide-react';
import {useCallback} from 'react';
import {WorkspaceChatSelector} from '../workspace/WorkspaceSelectors';
import type {WorkspaceRoomState} from '../workspace/WorkspaceRoomStore';
import {
  ASSISTANT_MODEL_MODES,
  ASSISTANT_MODEL_PROVIDER,
  DEFAULT_ASSISTANT_MODEL_MODE,
} from './modelModes';
import {syncSessionDocumentRunContext} from './sessionDocumentContext';

/** AI assistant aligned with the CLI app's current-chat surface. */
export function AssistantPanel() {
  const roomStore = useRoomStoreApi<WorkspaceRoomState>();
  const currentSession = useStoreWithAi((state) =>
    state.ai.getCurrentSession(),
  );
  const artifactsConfig = useBaseRoomStore<
    WorkspaceRoomState,
    WorkspaceRoomState['artifacts']['config']
  >((state) => state.artifacts.config);
  const createArtifactScopedSession = useBaseRoomStore<
    WorkspaceRoomState,
    WorkspaceRoomState['artifactAi']['createArtifactScopedSession']
  >((state) => state.artifactAi.createArtifactScopedSession);
  const currentDocumentId = artifactsConfig.currentArtifactId;
  const currentDocument = currentDocumentId
    ? artifactsConfig.artifactsById[currentDocumentId]
    : undefined;

  const startChat = useCallback(() => {
    const sessionId = createArtifactScopedSession(
      'New chat',
      ASSISTANT_MODEL_PROVIDER,
      DEFAULT_ASSISTANT_MODEL_MODE,
    );
    if (!sessionId) return;
    syncSessionDocumentRunContext(
      roomStore.getState(),
      sessionId,
      currentDocumentId,
    );
  }, [createArtifactScopedSession, currentDocumentId, roomStore]);

  return (
    <aside className="assistant-panel">
      <Chat.Root>
        <div className="assistant-header">
          <div className="min-w-0 flex-1">
            <WorkspaceChatSelector />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="topbar-icon shrink-0"
            type="button"
            onClick={startChat}
            disabled={!currentDocument || currentSession?.isRunning}
          >
            <MessageSquarePlusIcon className="size-4" aria-hidden />
            <span className="sr-only">New document chat</span>
          </Button>
        </div>

        {currentSession ? (
          <div className="assistant-chat">
            <div className="assistant-chat-body">
              <Chat.Messages key={currentSession.id} />
            </div>
            <Chat.PromptSuggestions>
              <Chat.PromptSuggestions.Item text="Summarize what this document should analyze." />
              <Chat.PromptSuggestions.Item text="Suggest a query for the selected tables." />
              <Chat.PromptSuggestions.Item text="What chart would be useful here?" />
            </Chat.PromptSuggestions>
            <Chat.Composer
              className="assistant-chat-composer"
              placeholder={`Ask about ${currentDocument?.title ?? 'this document'}`}
            >
              <Chat.ModelSelector models={[...ASSISTANT_MODEL_MODES]} />
            </Chat.Composer>
          </div>
        ) : (
          <div className="assistant-empty-state flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <p>Start a chat about the selected document.</p>
            <Button
              type="button"
              variant="secondary"
              onClick={startChat}
              disabled={!currentDocument}
            >
              <MessageSquarePlusIcon className="size-4" aria-hidden />
              New chat
            </Button>
          </div>
        )}
      </Chat.Root>
    </aside>
  );
}
