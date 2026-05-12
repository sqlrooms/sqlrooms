import {
  AiSettingsPanel,
  CHAT_CONTEXT_SELECTOR_SLOT,
  Chat,
  getAiRunContextItems,
  type ContextSelectorItem,
} from '@sqlrooms/ai';
import {RoomPanelHeader} from '@sqlrooms/room-shell';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  SkeletonPane,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useDisclosure,
} from '@sqlrooms/ui';
import {Settings} from 'lucide-react';
import React, {useCallback, useEffect, useMemo} from 'react';
import {CLI_ARTIFACT_TYPES} from '../artifactTypes';
import {useRoomStore} from '../store';

export const AssistantPanel: React.FC = () => {
  const currentSessionId = useRoomStore(
    (s) => s.ai.config.currentSessionId || null,
  );
  const isDataAvailable = useRoomStore((state) => state.room.initialized);
  const updateProvider = useRoomStore((s) => s.aiSettings.updateProvider);
  const settingsPanelOpen = useDisclosure();
  const contextDropTarget = useAssistantContextDropTarget();

  return (
    <div className="flex h-full flex-col p-2">
      <RoomPanelHeader />
      <Chat.Root>
        <div className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden">
          <div className="mb-4 flex items-center justify-between gap-2">
            <Chat.Sessions className="w-full" />
            {currentSessionId && (
              <Dialog
                open={settingsPanelOpen.isOpen}
                onOpenChange={(open) => {
                  if (open) {
                    settingsPanelOpen.onOpen();
                  } else {
                    settingsPanelOpen.onClose();
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="hover:bg-accent flex items-center justify-center transition-colors"
                    title="Configuration"
                    size="sm"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="flex h-[80vh] w-[90vw] max-w-3xl flex-col overflow-hidden">
                  <DialogHeader>
                    <DialogTitle>AI Assistant Settings</DialogTitle>
                  </DialogHeader>
                  <Tabs
                    defaultValue="providers"
                    className="flex min-h-0 flex-1 flex-col"
                  >
                    <TabsList className="grid w-full shrink-0 grid-cols-3">
                      <TabsTrigger value="providers">Providers</TabsTrigger>
                      <TabsTrigger value="models">Models</TabsTrigger>
                      <TabsTrigger value="parameters">Parameters</TabsTrigger>
                    </TabsList>
                    <TabsContent
                      value="providers"
                      className="flex-1 overflow-y-auto"
                    >
                      <AiSettingsPanel.ProvidersSettings />
                    </TabsContent>
                    <TabsContent
                      value="models"
                      className="flex-1 overflow-y-auto"
                    >
                      <AiSettingsPanel.ModelsSettings />
                    </TabsContent>
                    <TabsContent
                      value="parameters"
                      className="flex-1 overflow-y-auto"
                    >
                      <AiSettingsPanel.ModelParametersSettings />
                    </TabsContent>
                  </Tabs>
                </DialogContent>
              </Dialog>
            )}
          </div>
          <div className="print-container grow overflow-auto">
            {!currentSessionId ? (
              <div className="flex h-full w-full flex-col items-center justify-center">
                <p className="text-muted-foreground mt-4">
                  No session selected
                </p>
              </div>
            ) : isDataAvailable ? (
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
          </div>{' '}
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
        </div>
      </Chat.Root>
    </div>
  );
};

const SUPPORTED_CONTEXT_ARTIFACT_TYPES = new Set<string>(CLI_ARTIFACT_TYPES);

type ArtifactDragPayload = {
  kind: 'artifact';
  id: string;
  type: string;
  title?: string;
};

function isArtifactDragPayload(data: unknown): data is ArtifactDragPayload {
  if (!data || typeof data !== 'object') return false;
  const payload = data as Record<string, unknown>;
  return (
    payload.kind === 'artifact' &&
    typeof payload.id === 'string' &&
    typeof payload.type === 'string'
  );
}

function isContextArtifactType(type: string) {
  return SUPPORTED_CONTEXT_ARTIFACT_TYPES.has(type);
}

function useAssistantContextDropTarget() {
  const artifactsById = useRoomStore((s) => s.artifacts.config.artifactsById);
  const aiContextItemIds = useRoomStore((s) => s.aiContextItemIds);
  const setAiContextItemIds = useRoomStore((s) => s.setAiContextItemIds);

  return useMemo(
    () => ({
      id: 'assistant-context-drop-target',
      canAccept: (data: unknown) => {
        if (!isArtifactDragPayload(data)) return false;
        const artifact = artifactsById[data.id];
        return Boolean(artifact && isContextArtifactType(artifact.type));
      },
      onDrop: (data: unknown) => {
        if (!isArtifactDragPayload(data)) return;
        const artifact = artifactsById[data.id];
        if (!artifact || !isContextArtifactType(artifact.type)) return;
        const nextIds = aiContextItemIds.includes(data.id)
          ? [data.id, ...aiContextItemIds.filter((id) => id !== data.id)]
          : [...aiContextItemIds, data.id];
        setAiContextItemIds(nextIds, 'manual');
      },
    }),
    [aiContextItemIds, artifactsById, setAiContextItemIds],
  );
}

function AssistantContextSelector() {
  const sessionIsRunning = useRoomStore(
    (s) => s.ai.getCurrentSession()?.isRunning ?? false,
  );
  const runContext = useRoomStore((s) => s.ai.getCurrentSession()?.runContext);
  const currentPrompt = useRoomStore(
    (s) => s.ai.getCurrentSession()?.prompt ?? '',
  );
  const sessionIsEmpty = useRoomStore((s) => {
    const session = s.ai.getCurrentSession();
    if (!session) return true;
    const hasMessages = session.uiMessages.length > 0;
    const hasCompletedResults = session.analysisResults.some(
      (result) => result.id !== '__pending__',
    );
    return !hasMessages && !hasCompletedResults;
  });
  const currentArtifactId = useRoomStore(
    (s) => s.artifacts.config.currentArtifactId,
  );
  const artifactOrder = useRoomStore((s) => s.artifacts.config.artifactOrder);
  const artifactsById = useRoomStore((s) => s.artifacts.config.artifactsById);
  const aiContextMode = useRoomStore((s) => s.aiContextMode);
  const aiContextItemIds = useRoomStore((s) => s.aiContextItemIds);
  const setAiContextItemIds = useRoomStore((s) => s.setAiContextItemIds);
  const replaceAiContextWithArtifact = useRoomStore(
    (s) => s.replaceAiContextWithArtifact,
  );
  const currentArtifact = currentArtifactId
    ? artifactsById[currentArtifactId]
    : undefined;
  const artifacts = useMemo(
    () =>
      artifactOrder
        .map((id) => artifactsById[id])
        .filter(
          (artifact): artifact is NonNullable<(typeof artifactsById)[string]> =>
            Boolean(artifact) && isContextArtifactType(artifact.type),
        ),
    [artifactOrder, artifactsById],
  );
  const items = useMemo<ContextSelectorItem[]>(() => {
    const artifactItems = artifacts.map((artifact) => ({
      id: artifact.id,
      kind: 'artifact',
      title: artifact.title,
      type: artifact.type,
      keywords: [artifact.title, artifact.type],
    }));
    const missingRunningItems = getAiRunContextItems(runContext)
      .filter(
        (item) =>
          item.kind === 'artifact' &&
          !artifactsById[item.id] &&
          item.type &&
          isContextArtifactType(item.type),
      )
      .map((item) => ({
        id: item.id,
        kind: item.kind,
        title: item.title,
        type: item.type,
        missing: true,
        disabled: true,
        subtitle: 'Deleted',
        keywords: [item.title, item.type ?? ''],
      }));
    return [...artifactItems, ...missingRunningItems];
  }, [artifacts, artifactsById, runContext]);

  useEffect(() => {
    if (
      aiContextMode === 'auto' &&
      sessionIsEmpty &&
      currentPrompt.trim().length === 0 &&
      currentArtifactId &&
      currentArtifact &&
      isContextArtifactType(currentArtifact.type)
    ) {
      replaceAiContextWithArtifact(currentArtifactId);
    }
  }, [
    aiContextMode,
    sessionIsEmpty,
    currentPrompt,
    currentArtifactId,
    currentArtifact,
    replaceAiContextWithArtifact,
  ]);

  const selectedIds = useMemo(() => {
    return aiContextItemIds.filter((id) => {
      const artifact = artifactsById[id];
      return artifact && isContextArtifactType(artifact.type);
    });
  }, [aiContextItemIds, artifactsById]);

  const runningContextIds = sessionIsRunning
    ? getAiRunContextItems(runContext).map((item) => item.id)
    : undefined;

  const handleSelectedIdsChange = useCallback(
    (nextIds: string[]) => {
      setAiContextItemIds(nextIds, 'manual');
    },
    [setAiContextItemIds],
  );

  if (items.length === 0 && selectedIds.length === 0) return null;

  return (
    <Chat.ContextSelector
      items={items}
      selectedIds={selectedIds}
      onSelectedIdsChange={handleSelectedIdsChange}
      runningContextIds={runningContextIds}
    >
      <Chat.ContextSelector.Badge tooltip="Add context" />
      <Chat.ContextSelector.SearchDropdown
        searchPlaceholder="Search artifacts..."
        emptyLabel="No artifact found."
      />
    </Chat.ContextSelector>
  );
}

Object.assign(AssistantContextSelector, {
  [CHAT_CONTEXT_SELECTOR_SLOT]: true,
});
