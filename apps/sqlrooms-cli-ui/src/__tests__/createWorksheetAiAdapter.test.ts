import {jest} from '@jest/globals';
import type {BlockDocumentBlock} from '@sqlrooms/documents';
import type {StoreApi} from 'zustand';
import {createWorksheetAiAdapter} from '../createWorksheetAiAdapter';
import type {RoomState} from '../store-types';

function createMockStore({
  invokeCommand = jest.fn(async (_commandId, input: any) => ({
    success: true,
    commandId: 'worksheet.append-blocks',
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

describe('createWorksheetAiAdapter', () => {
  it('adds worksheet blocks through the worksheet append command', async () => {
    const {store, ensureBlockDocument, invokeCommand} = createMockStore();
    const adapter = createWorksheetAiAdapter(store);
    const block: BlockDocumentBlock = {
      id: 'paragraph-1',
      type: 'paragraph',
      text: 'Summary',
    };

    await expect(adapter.addBlock('worksheet-1', block)).resolves.toBe(
      'paragraph-1',
    );

    expect(ensureBlockDocument).toHaveBeenCalledWith('worksheet-1');
    expect(invokeCommand).toHaveBeenCalledWith(
      'worksheet.append-blocks',
      {
        artifactId: 'worksheet-1',
        blocks: [block],
      },
      {
        surface: 'ai',
        actor: 'worksheet-agent',
      },
    );
  });

  it('throws when the append command fails', async () => {
    const {store} = createMockStore({
      invokeCommand: jest.fn(async () => ({
        success: false,
        commandId: 'worksheet.append-blocks',
        error: 'Command failed',
      })),
    });
    const adapter = createWorksheetAiAdapter(store);

    await expect(
      adapter.addBlock('worksheet-1', {
        id: 'paragraph-1',
        type: 'paragraph',
        text: 'Summary',
      }),
    ).rejects.toThrow('Command failed');
  });
});
