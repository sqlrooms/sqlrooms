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
    ...createArtifactsSlice({artifactTypes})(...args),
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

  it('enforces artifact eligibility across every context operation', async () => {
    const store = createTestStore();
    const runContext: AiRunContext = {
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
      primaryItemId: 'dashboard-1',
      capturedAt: 1,
    };
    const readArtifactCalls: string[] = [];
    const readArtifact = ({artifactId}: {artifactId: string}) => {
      readArtifactCalls.push(artifactId);
      return {
        success: true as const,
        artifact: {
          artifactId,
          title: 'Doc',
          type: 'document',
        },
        payload: undefined,
      };
    };
    const tools = createArtifactContextAiTools({
      store,
      isArtifactAllowed: ({artifact}) => artifact.type === 'document',
      readArtifact,
    });
    const executionContext = {getAiRunContext: () => runContext};

    const listResult = await (tools.list_context_artifacts as any).execute(
      {},
      executionContext,
    );
    expect(listResult.llmResult.artifacts).toMatchObject([
      {artifactId: 'doc-1', role: 'primary'},
    ]);
    expect(listResult.llmResult.primaryArtifactId).toBe('doc-1');

    await (tools.read_context_artifact as any).execute({}, executionContext);
    expect(readArtifactCalls).toEqual(['doc-1']);
    readArtifactCalls.length = 0;

    const setResult = await (tools.set_primary_context_artifact as any).execute(
      {artifactId: 'dashboard-1'},
      executionContext,
    );
    expect(setResult.llmResult).toEqual({
      success: false,
      errorMessage: 'Artifact "dashboard-1" is not available as AI context.',
    });

    const allowedSetResult = await (
      tools.set_primary_context_artifact as any
    ).execute({artifactId: 'doc-1'}, executionContext);
    expect(allowedSetResult.llmResult).toMatchObject({
      success: true,
      primaryArtifactId: 'doc-1',
      contextItems: [{id: 'doc-1'}],
    });

    const readResult = await (tools.read_context_artifact as any).execute(
      {artifactId: 'dashboard-1'},
      executionContext,
    );
    expect(readResult.llmResult).toMatchObject({
      success: false,
      errorMessage: expect.stringContaining(
        'is not in the current run context',
      ),
    });
    expect(readArtifactCalls).toEqual([]);
  });

  it('preserves non-artifact context when changing the primary artifact', async () => {
    const store = createTestStore();
    let runContext: AiRunContext | undefined = {
      items: [
        {
          kind: 'artifact',
          id: 'dashboard-1',
          type: 'dashboard',
          title: 'Dashboard',
        },
        {
          kind: 'table',
          id: 'main.sales',
          type: 'table',
          title: 'Sales',
        },
        {
          kind: 'block',
          id: 'doc-1:chart-1',
          type: 'chart',
          title: 'Revenue chart',
        },
      ],
      primaryItemId: 'dashboard-1',
      capturedAt: 1,
    };
    const tools = createArtifactContextAiTools({
      store,
      isArtifactAllowed: ({artifact}) => artifact.type === 'document',
    });

    const result = await (tools.set_primary_context_artifact as any).execute(
      {artifactId: 'doc-1'},
      {
        getAiRunContext: () => runContext,
        setAiRunContext: (nextContext: AiRunContext) => {
          runContext = nextContext;
        },
      },
    );

    expect(result.llmResult).toMatchObject({
      success: true,
      primaryArtifactId: 'doc-1',
    });
    expect(runContext?.items.map(({kind, id}) => ({kind, id}))).toEqual([
      {kind: 'artifact', id: 'doc-1'},
      {kind: 'table', id: 'main.sales'},
      {kind: 'block', id: 'doc-1:chart-1'},
    ]);
  });
});
