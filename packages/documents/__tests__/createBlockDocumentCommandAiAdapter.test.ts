import {
  BLOCK_DOCUMENT_AGENT_ACTOR,
  BLOCK_DOCUMENT_APPEND_BLOCKS_COMMAND_ID,
  createBlockDocumentCommandAiAdapter,
  type BlockDocumentBlock,
} from '../src';

function createMockStore({
  artifactType = 'block-document',
  invokeCommand,
}: {
  artifactType?: string;
  invokeCommand?: (...args: any[]) => Promise<unknown>;
} = {}) {
  const ensureBlockDocumentCalls: unknown[][] = [];
  const invokeCommandCalls: unknown[][] = [];
  const setCurrentArtifactCalls: unknown[][] = [];
  const ensureBlockDocument = (...args: unknown[]) => {
    ensureBlockDocumentCalls.push(args);
  };
  const setCurrentArtifact = (...args: unknown[]) => {
    setCurrentArtifactCalls.push(args);
  };
  const invokeCommandImpl =
    invokeCommand ??
    (async (_commandId, input: any) => ({
      success: true,
      commandId: BLOCK_DOCUMENT_APPEND_BLOCKS_COMMAND_ID,
      data: {
        blockId: input.blocks[0].id,
      },
    }));
  const trackedInvokeCommand = async (...args: any[]) => {
    invokeCommandCalls.push(args);
    return invokeCommandImpl(...args);
  };
  const state = {
    artifacts: {
      getArtifact: (artifactId: string) =>
        artifactId === 'doc-1'
          ? {id: artifactId, type: artifactType, title: 'Document'}
          : undefined,
      setCurrentArtifact,
    },
    blockDocuments: {
      ensureBlockDocument,
      config: {
        artifacts: {
          'doc-1': {
            content: {
              content: [{id: 'existing', type: 'paragraph', text: 'Hi'}],
            },
          },
        },
      },
    },
    commands: {
      invokeCommand: trackedInvokeCommand,
    },
  };

  return {
    store: {
      getState: () => state,
    } as any,
    ensureBlockDocument,
    ensureBlockDocumentCalls,
    invokeCommand: trackedInvokeCommand,
    invokeCommandCalls,
    setCurrentArtifact,
    setCurrentArtifactCalls,
  };
}

describe('createBlockDocumentCommandAiAdapter', () => {
  it('sets the current block document through the artifact slice', () => {
    const {store, setCurrentArtifactCalls} = createMockStore();
    const adapter = createBlockDocumentCommandAiAdapter({store});

    adapter.setCurrentBlockDocument('doc-1');

    expect(setCurrentArtifactCalls).toEqual([['doc-1']]);
  });

  it('appends blocks through the canonical block document command', async () => {
    const {store, ensureBlockDocumentCalls, invokeCommandCalls} =
      createMockStore();
    const adapter = createBlockDocumentCommandAiAdapter({store});
    const block: BlockDocumentBlock = {
      id: 'paragraph-1',
      type: 'paragraph',
      text: 'Summary',
    };

    await expect(adapter.addBlock('doc-1', block)).resolves.toBe('paragraph-1');

    expect(ensureBlockDocumentCalls).toEqual([['doc-1']]);
    expect(invokeCommandCalls).toEqual([
      [
        BLOCK_DOCUMENT_APPEND_BLOCKS_COMMAND_ID,
        {
          artifactId: 'doc-1',
          blocks: [block],
        },
        {
          surface: 'ai',
          actor: BLOCK_DOCUMENT_AGENT_ACTOR,
        },
      ],
    ]);
  });

  it('allows hosts to recognize compatible block-document artifact types', () => {
    const {store} = createMockStore({artifactType: 'analysis-doc'});
    const adapter = createBlockDocumentCommandAiAdapter({
      store,
      isBlockDocumentArtifact: (artifact) => artifact.type === 'analysis-doc',
    });

    expect(adapter.getBlocks('doc-1')).toEqual([
      {id: 'existing', type: 'paragraph', text: 'Hi'},
    ]);
  });

  it('throws when ensuring an incompatible artifact type', () => {
    const {store} = createMockStore({artifactType: 'dashboard'});
    const adapter = createBlockDocumentCommandAiAdapter({store});

    expect(() => adapter.ensureBlockDocument('doc-1')).toThrow(
      'Artifact doc-1 is not a block document',
    );
  });

  it('rejects addBlock before invoking commands for incompatible artifact types', async () => {
    const {store, invokeCommandCalls} = createMockStore({
      artifactType: 'dashboard',
    });
    const adapter = createBlockDocumentCommandAiAdapter({store});

    await expect(
      adapter.addBlock('doc-1', {
        id: 'paragraph-1',
        type: 'paragraph',
        text: 'Summary',
      }),
    ).rejects.toThrow('Artifact doc-1 is not a block document');
    expect(invokeCommandCalls).toEqual([]);
  });

  it('throws command errors when append command invocation fails', async () => {
    const {store} = createMockStore({
      invokeCommand: async () => ({
        success: false,
        commandId: BLOCK_DOCUMENT_APPEND_BLOCKS_COMMAND_ID,
        error: 'Append failed',
      }),
    });
    const adapter = createBlockDocumentCommandAiAdapter({store});

    await expect(
      adapter.addBlock('doc-1', {
        id: 'paragraph-1',
        type: 'paragraph',
        text: 'Summary',
      }),
    ).rejects.toThrow('Append failed');
  });
});
