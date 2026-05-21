import {createStore} from 'zustand';
import {
  createBaseRoomSlice,
  type BaseRoomStoreState,
} from '@sqlrooms/room-store';
import {
  createArtifactContextAiTools,
  type ArtifactContextToolExecutionContext,
} from '../src/ai';
import {
  createArtifactsSlice,
  defineArtifactTypes,
  type ArtifactsSliceState,
} from '../src';
import type {AiRunContext} from '@sqlrooms/ai-config';

type TestRoomState = BaseRoomStoreState & ArtifactsSliceState;

function createTestStore() {
  const artifactTypes = defineArtifactTypes({
    document: {
      label: 'Document',
      defaultTitle: 'Document',
    },
    dashboard: {
      label: 'Dashboard',
      defaultTitle: 'Dashboard',
    },
  });

  const store = createStore<TestRoomState>()((...args) => ({
    ...createBaseRoomSlice()(...args),
    ...createArtifactsSlice<TestRoomState>({artifactTypes})(...args),
  }));

  store.getState().artifacts.ensureArtifact('doc-1', {
    type: 'document',
    title: 'Doc',
  });
  store.getState().artifacts.ensureArtifact('dashboard-1', {
    type: 'dashboard',
    title: 'Dashboard',
  });
  store.getState().artifacts.ensureArtifact('doc-2', {
    type: 'document',
    title: 'Other Doc',
  });

  return store;
}

describe('createArtifactContextAiTools', () => {
  it('lists context artifacts and moves the primary artifact', async () => {
    const store = createTestStore();
    let runContext: AiRunContext | undefined = {
      items: [
        {
          kind: 'artifact',
          id: 'doc-1',
          type: 'document',
          title: 'Doc',
        },
        {
          kind: 'artifact',
          id: 'dashboard-1',
          type: 'dashboard',
          title: 'Dashboard',
        },
      ],
      primaryItemId: 'doc-1',
      capturedAt: 1,
    };
    let selectedContextIds: string[] = [];
    const executionContext: ArtifactContextToolExecutionContext = {
      getAiRunContext: () => runContext,
      setAiRunContext: (nextContext) => {
        runContext = nextContext;
      },
    };
    const tools = createArtifactContextAiTools({
      store,
      onContextItemsChanged: ({items}) => {
        selectedContextIds = items.map((item) => item.id);
      },
    });

    const listResult = await (tools.list_context_artifacts as any).execute(
      {},
      executionContext,
    );
    expect(listResult.llmResult.artifacts).toMatchObject([
      {artifactId: 'doc-1', role: 'primary'},
      {artifactId: 'dashboard-1', role: 'reference'},
    ]);

    const setResult = await (tools.set_primary_context_artifact as any).execute(
      {artifactId: 'dashboard-1'},
      executionContext,
    );

    expect(setResult.llmResult).toMatchObject({
      success: true,
      primaryArtifactId: 'dashboard-1',
    });
    expect(runContext?.primaryItemId).toBe('dashboard-1');
    expect(runContext?.items.map((item) => item.id)).toEqual([
      'dashboard-1',
      'doc-1',
    ]);
    expect(selectedContextIds).toEqual(['dashboard-1', 'doc-1']);
  });

  it('reads only artifacts that are present in run context', async () => {
    const store = createTestStore();
    const runContext: AiRunContext = {
      items: [
        {
          kind: 'artifact',
          id: 'doc-1',
          type: 'document',
          title: 'Doc',
        },
      ],
      primaryItemId: 'doc-1',
      capturedAt: 1,
    };
    const tools = createArtifactContextAiTools({
      store,
      readArtifact: ({artifact}) => ({
        success: true,
        artifact: {
          artifactId: artifact.id,
          title: artifact.title,
          type: artifact.type,
        },
        payload: {kind: 'test-reader'},
      }),
    });

    const readPrimaryResult = await (
      tools.read_context_artifact as any
    ).execute({}, {getAiRunContext: () => runContext});
    expect(readPrimaryResult.llmResult).toMatchObject({
      success: true,
      artifact: {artifactId: 'doc-1'},
      payload: {kind: 'test-reader'},
    });

    const readOutsideContextResult = await (
      tools.read_context_artifact as any
    ).execute({artifactId: 'doc-2'}, {getAiRunContext: () => runContext});
    expect(readOutsideContextResult.llmResult).toMatchObject({
      success: false,
      errorMessage:
        'Artifact "doc-2" is not in the current run context. Use set_primary_context_artifact before reading it as context.',
    });
  });
});
