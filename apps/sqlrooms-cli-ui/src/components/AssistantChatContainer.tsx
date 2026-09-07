import {Chat, type ChatTurnSlotProps} from '@sqlrooms/ai';
import {
  Button,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  SkeletonPane,
} from '@sqlrooms/ui';
import {PlusIcon} from 'lucide-react';
import React, {useCallback} from 'react';
import {useRoomStore} from '../roomStoreHooks';
import {AssistantContextSelector} from './AssistantContextSelector';
import {isCreateSessionDisabled} from './sessionCreation';
import {useGenSessionTitle} from './useGenSessionTitle';

interface AssistantChatContainerProps {
  contextDropTarget: {
    id: string;
    canAccept: (data: unknown) => boolean;
    onDrop: (data: unknown) => void;
  };
  debugPanel?: React.ReactNode;
}

const CliChatTurn: React.FC<ChatTurnSlotProps> = ({turn}) => {
  const Prompt = turn.prompt.Content;
  const Timeline = turn.timeline.Content;
  const Error = turn.error?.Content;
  const Actions = turn.actions.Content;

  return (
    <div className="group mb-4 flex w-full flex-col gap-2 pb-2 text-sm">
      <div className="mb-2 flex items-center gap-2 text-gray-700 dark:text-gray-100">
        <Prompt />
      </div>
      <div className="flex w-full flex-col gap-2">
        <Timeline />
        {Error && <Error />}
        <Actions />
      </div>
    </div>
  );
};

const CLI_CHAT_RENDERING_COMPONENTS = {Turn: CliChatTurn};

export const AssistantChatContainer: React.FC<AssistantChatContainerProps> = ({
  contextDropTarget,
  debugPanel,
}) => {
  const currentSessionId = useRoomStore(
    (s) => s.ai.getCurrentSession()?.id || null,
  );
  const currentSession = useRoomStore((s) => s.ai.getCurrentSession());
  const currentArtifactId = useRoomStore(
    (s) => s.artifacts.config.currentArtifactId,
  );
  const isDataAvailable = useRoomStore((state) => state.room.initialized);
  const updateProvider = useRoomStore((s) => s.aiSettings.updateProvider);
  const createArtifactScopedSession = useRoomStore(
    (s) => s.artifactAi.createArtifactScopedSession,
  );
  const createSession = useRoomStore((s) => s.ai.createSession);

  useGenSessionTitle();

  const createSessionDisabled = isCreateSessionDisabled(currentSession);

  const handleCreateSession = useCallback(() => {
    if (createSessionDisabled) {
      return;
    }
    if (currentArtifactId) {
      createArtifactScopedSession();
    } else {
      createSession();
    }
  }, [
    createArtifactScopedSession,
    createSession,
    createSessionDisabled,
    currentArtifactId,
  ]);

  const messagesPane = (
    <div className="print-container h-full min-h-0 grow overflow-hidden">
      {isDataAvailable ? (
        <Chat.Rendering components={CLI_CHAT_RENDERING_COMPONENTS}>
          <Chat.Messages key={currentSessionId} hoistedRenderers={['chart']} />
        </Chat.Rendering>
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
              disabled={createSessionDisabled}
            >
              <PlusIcon className="h-4 w-4" />
              New chat
            </Button>
          </div>
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
        {currentSessionId && (
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
            <Chat.Composer.Attachments />
            <div className="flex min-w-0 items-center justify-end">
              <Chat.ModelSelector />
            </div>
          </Chat.Composer>
        )}
      </div>
    </Chat.Root>
  );
};
