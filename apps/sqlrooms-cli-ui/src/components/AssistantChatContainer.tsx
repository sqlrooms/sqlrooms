import {
  AiConnectDialog,
  AiProviderConnectButton,
  AiQuickLoginButton,
  AiQuickLoginDialog,
  Chat,
  isChatSessionEmpty,
  resolveLoginTargetsFromProviders,
} from '@sqlrooms/ai';
import {isAiSessionVisibleForArtifact} from '@sqlrooms/artifacts/ai';
import {Button, SkeletonPane} from '@sqlrooms/ui';
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
  onOpenSettings?: (
    tab?: 'connect' | 'providers' | 'models' | 'parameters',
  ) => void;
}

export const AssistantChatContainer: React.FC<AssistantChatContainerProps> = ({
  contextDropTarget,
  onOpenSettings,
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
  const currentProviderId = useRoomStore(
    (s) =>
      s.ai.getCurrentSession()?.modelProvider ||
      s.aiSettings.config.defaultProvider ||
      null,
  );
  const providers = useRoomStore((s) => s.aiSettings.config.providers);
  const loginTargets = useRoomStore((s) => s.aiQuickLogin.loginTargets);
  const providerLoginTargets = useMemo(
    () =>
      resolveLoginTargetsFromProviders(providers, loginTargets).filter(
        (target) => target.providerId === currentProviderId,
      ),
    [currentProviderId, providers, loginTargets],
  );
  const currentProvider = currentProviderId
    ? providers[currentProviderId]
    : undefined;
  const currentProviderHasCredentials = Boolean(
    currentProvider?.status?.hasCredentials ||
    currentProvider?.hasCredentials ||
    currentProvider?.apiKey,
  );
  const canConnectCurrentProvider = Boolean(
    currentProviderId && currentProvider?.authMethods?.length,
  );
  const hasConfiguredProvider = useMemo(
    () =>
      Object.values(providers).some((provider) => {
        const credentialType =
          provider.status?.credentialType || provider.credentialType;
        const hasSavedCredentials =
          Boolean(provider.status?.hasCredentials || provider.hasCredentials) &&
          credentialType !== 'local';
        return Boolean(
          provider.configured || provider.apiKey || hasSavedCredentials,
        );
      }),
    [providers],
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

  return (
    <Chat.Root>
      <AiConnectDialog />
      <AiQuickLoginDialog />
      <div className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden">
        {!currentSessionId ? (
          <div className="flex h-full w-full items-center justify-center">
            {hasConfiguredProvider ? (
              <Button
                type="button"
                variant="outline"
                className="h-12 gap-2 px-4"
                onClick={handleCreateSession}
                disabled={!currentArtifactId || createSessionDisabled}
              >
                <PlusIcon className="h-4 w-4" />
                New session
              </Button>
            ) : (
              <AiProviderConnectButton
                variant="outline"
                className="h-12 gap-2 px-4"
              />
            )}
          </div>
        ) : (
          <>
            {!showHistory && (
              <Chat.Header
                onHistoryClick={() => setShowHistory(true)}
                onCreateSession={handleCreateSession}
                createSessionDisabled={createSessionDisabled}
                historyIsRunning={historyIsRunning}
                className="mb-4"
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
              <div className="print-container grow overflow-auto">
                {isDataAvailable ? (
                  <Chat.Messages
                    key={currentSessionId}
                    hoistedRenderers={['chart']}
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center">
                    <SkeletonPane className="p-4" />
                    <p className="text-muted-foreground mt-4">
                      Loading database...
                    </p>
                  </div>
                )}
              </div>
            )}
            {!showHistory && (
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
                    {!currentProviderHasCredentials &&
                      canConnectCurrentProvider && (
                        <AiProviderConnectButton
                          providerId={currentProviderId || undefined}
                          variant="outline"
                          size="sm"
                        />
                      )}
                    {!currentProviderHasCredentials &&
                      providerLoginTargets.length > 0 && (
                        <AiQuickLoginButton
                          targetId={providerLoginTargets[0]?.id}
                          variant="outline"
                          size="sm"
                        />
                      )}
                    <Chat.PromptSuggestions.VisibilityToggle />
                    <Chat.ModelSelector
                      onOpenSettings={() => onOpenSettings?.('models')}
                    />
                  </div>
                </Chat.Composer>
              </>
            )}
          </>
        )}
      </div>
    </Chat.Root>
  );
};
