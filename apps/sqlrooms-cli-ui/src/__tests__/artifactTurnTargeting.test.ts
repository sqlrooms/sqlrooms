import {
  createAiSlice,
  createCommandTools,
  type AiRunContext,
  type AiSliceState,
} from '@sqlrooms/ai';
import {jest} from '@jest/globals';
import {
  createArtifactsSlice,
  defineArtifactTypes,
  type ArtifactsSliceState,
} from '@sqlrooms/artifacts';
import {createArtifactContextAiTools} from '@sqlrooms/artifacts/ai';
import {
  createDocumentCommands,
  createDocumentsSlice,
  type DocumentsSliceState,
} from '@sqlrooms/documents';
import {
  createBaseRoomSlice,
  createCommandSlice,
  type BaseRoomStoreState,
  type CommandSliceState,
} from '@sqlrooms/room-store';
import {createStore} from 'zustand';

type TestState = BaseRoomStoreState &
  AiSliceState &
  ArtifactsSliceState &
  DocumentsSliceState &
  CommandSliceState<any>;

function createTestStore() {
  const artifactTypes = defineArtifactTypes({
    document: {label: 'Document', defaultTitle: 'Document'},
  });
  return createStore<TestState>()((set, get, store) => ({
    ...createBaseRoomSlice()(set, get, store),
    ...createCommandSlice<TestState>()(set, get, store),
    ...createArtifactsSlice({artifactTypes})(set, get, store),
    ...createDocumentsSlice<TestState>()(set, get, store),
    ...createAiSlice({
      tools: {} as any,
      getInstructions: () => 'test',
      getRunContext: () => {
        const state = get();
        const artifactId = state.artifacts.config.currentArtifactId;
        const artifact = artifactId
          ? state.artifacts.config.artifactsById[artifactId]
          : undefined;
        if (!artifact) return undefined;
        return {
          items: [
            {
              kind: 'artifact' as const,
              id: artifact.id,
              type: artifact.type,
              title: artifact.title,
            },
          ],
          primaryItemId: artifact.id,
          primaryItemKind: 'artifact',
          capturedAt: Date.now(),
        };
      },
      config: {
        currentSessionId: 'session-a',
        sessions: [
          {
            id: 'session-a',
            name: 'Session A',
            modelProvider: 'openai',
            model: 'gpt-4.1',
            createdAt: new Date(0),
            uiMessages: [],
            messagesRevision: 0,
            prompt: '',
            isRunning: false,
          },
        ],
      },
    })(set, get, store),
  }));
}

describe('per-turn artifact command targeting', () => {
  it('keeps a headless turn scoped while live artifact and session change', async () => {
    const store = createTestStore();
    store
      .getState()
      .commands.registerCommands(
        'documents',
        createDocumentCommands<TestState>(),
      );
    const artifactA = store.getState().artifacts.createArtifact({
      type: 'document',
      title: 'Document A',
    });
    store.getState().documents.ensureDocument(artifactA);
    store.getState().documents.setMarkdown(artifactA, 'Content A');
    const artifactB = store.getState().artifacts.createArtifact({
      type: 'document',
      title: 'Document B',
    });
    store.getState().documents.ensureDocument(artifactB);
    store.getState().documents.setMarkdown(artifactB, 'Content B');

    store.getState().artifacts.setCurrentArtifact(artifactA);
    jest
      .spyOn(store.getState().ai.getSessionChat('session-a')!, 'sendMessage')
      .mockResolvedValue(undefined);
    store.getState().ai.setPrompt('session-a', 'Work on A');
    await store.getState().ai.startAnalysis('session-a');
    let runContext = store.getState().ai.getSessionRunContext('session-a');

    const commandTools = createCommandTools(store);
    const toolExecutionContext = {
      toolCallId: 'test-command-call',
      messages: [],
      sessionId: 'session-a',
      aiRunContext: runContext,
      getAiRunContext: () => runContext,
      setAiRunContext: (nextRunContext: AiRunContext | undefined) => {
        runContext = nextRunContext;
      },
    };

    store.getState().artifacts.setCurrentArtifact(artifactB);
    store.getState().ai.createSession('Session B');
    const firstResult = (await commandTools.execute_command?.execute?.(
      {commandId: 'document.get', confirmed: false},
      toolExecutionContext,
    )) as any;

    expect(firstResult.result.data).toMatchObject({
      artifactId: artifactA,
      markdown: 'Content A',
    });

    const artifactContextTools = createArtifactContextAiTools({store});
    await (artifactContextTools.set_primary_context_artifact as any).execute(
      {artifactId: artifactB},
      toolExecutionContext,
    );
    const retargetedResult = (await commandTools.execute_command?.execute?.(
      {commandId: 'document.get', confirmed: false},
      toolExecutionContext,
    )) as any;
    expect(retargetedResult.result.data).toMatchObject({
      artifactId: artifactB,
      markdown: 'Content B',
    });

    store.getState().ai.setPrompt('session-a', 'Now work on B');
    await store.getState().ai.startAnalysis('session-a');
    runContext = store.getState().ai.getSessionRunContext('session-a');
    expect(runContext?.primaryItemId).toBe(artifactB);
  });
});
