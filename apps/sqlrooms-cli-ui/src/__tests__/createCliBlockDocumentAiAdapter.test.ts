import {jest} from '@jest/globals';
import {
  BLOCK_DOCUMENT_AGENT_ACTOR,
  BLOCK_DOCUMENT_APPEND_BLOCKS_COMMAND_ID,
  type BlockDocumentBlock,
} from '@sqlrooms/documents';
import type {StoreApi} from 'zustand';
import {createCliBlockDocumentAiAdapter} from '../createCliBlockDocumentAiAdapter';
import type {RoomState} from '../store-types';

function createMockStore({
  invokeCommand = jest.fn(async (_commandId, input: any) => ({
    success: true,
    commandId: BLOCK_DOCUMENT_APPEND_BLOCKS_COMMAND_ID,
    data: {
      blockId: input.blocks[0].id,
    },
  })),
}: {
  invokeCommand?: jest.Mock;
} = {}) {
  const ensureBlockDocument = jest.fn();
  const setCurrentArtifact = jest.fn();
  const state = {
    artifacts: {
      getArtifact: (artifactId: string) =>
        artifactId === 'worksheet-1'
          ? {id: artifactId, type: 'worksheet', title: 'Worksheet'}
          : undefined,
      setCurrentArtifact,
    },
    blockDocuments: {
      ensureBlockDocument,
      config: {
        artifacts: {},
      },
    },
    commands: {
      invokeCommand,
    },
  } as unknown as RoomState;

  return {
    store: {
      getState: () => state,
    } as StoreApi<RoomState>,
    ensureBlockDocument,
    invokeCommand,
    setCurrentArtifact,
  };
}

describe('createCliBlockDocumentAiAdapter', () => {
  it('adds blocks through the block document append command', async () => {
    const {store, ensureBlockDocument, invokeCommand} = createMockStore();
    const adapter = createCliBlockDocumentAiAdapter(store);
    const block: BlockDocumentBlock = {
      id: 'paragraph-1',
      type: 'paragraph',
      text: [{type: 'text', text: 'Summary'}],
    };

    await expect(adapter.addBlock('worksheet-1', block)).resolves.toBe(
      'paragraph-1',
    );

    expect(ensureBlockDocument).toHaveBeenCalledWith('worksheet-1');
    expect(invokeCommand).toHaveBeenCalledWith(
      BLOCK_DOCUMENT_APPEND_BLOCKS_COMMAND_ID,
      {
        artifactId: 'worksheet-1',
        blocks: [block],
      },
      {
        surface: 'ai',
        actor: BLOCK_DOCUMENT_AGENT_ACTOR,
      },
    );
  });

  it('throws when the append command fails', async () => {
    const {store} = createMockStore({
      invokeCommand: jest.fn(async () => ({
        success: false,
        commandId: BLOCK_DOCUMENT_APPEND_BLOCKS_COMMAND_ID,
        error: 'Command failed',
      })),
    });
    const adapter = createCliBlockDocumentAiAdapter(store);

    await expect(
      adapter.addBlock('worksheet-1', {
        id: 'paragraph-1',
        type: 'paragraph',
        text: [{type: 'text', text: 'Summary'}],
      }),
    ).rejects.toThrow('Command failed');
  });
});
