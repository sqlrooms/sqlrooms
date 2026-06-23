import {
  blockDocumentBlockToNode,
  createBlockDocumentCommandIds,
  createAddBlockDocumentTextBlockTool,
  createListBlockDocumentBlocksTool,
  type BlockDocumentAiAdapter,
  type BlockDocumentBlock,
} from '../src';

describe('block document AI helpers', () => {
  it('describes the command surface used by block document authoring agents', () => {
    expect(createBlockDocumentCommandIds()).toContain('block-document.create');
    expect(createBlockDocumentCommandIds()).toContain(
      'block-document.create-chart-block',
    );
    expect(createBlockDocumentCommandIds()).toContain(
      'block-document.create-stateful-block',
    );
    expect(createBlockDocumentCommandIds()).not.toContain(
      'block-document.embed-dashboard',
    );
  });

  it('adds generic text blocks through the block document adapter', async () => {
    const addedBlocks: BlockDocumentBlock[] = [];
    const ensuredBlockDocumentIds: string[] = [];
    const blockDocumentAdapter: BlockDocumentAiAdapter = {
      ensureBlockDocument: (blockDocumentId) => {
        ensuredBlockDocumentIds.push(blockDocumentId);
      },
      setCurrentBlockDocument: () => {},
      getBlocks: () => [],
      addBlock: (_blockDocumentId, block) => {
        addedBlocks.push(block);
        return block.id;
      },
    };

    const tool = createAddBlockDocumentTextBlockTool({
      blockDocumentAdapter,
      blockDocumentId: 'document-1',
    });

    const result = await (tool as any).execute({
      reasoning: 'Add a short summary.',
      type: 'paragraph',
      text: 'A compact summary.',
    });

    expect(result).toEqual({
      success: true,
      blockId: expect.any(String),
      message: 'Added paragraph block to block document',
    });
    expect(ensuredBlockDocumentIds).toEqual(['document-1']);
    expect(addedBlocks).toEqual([
      expect.objectContaining({
        id: result.blockId,
        type: 'paragraph',
        text: 'A compact summary.',
      }),
    ]);
  });

  it('does not create text blocks when the target document is missing', async () => {
    let addBlockCalled = false;
    const blockDocumentAdapter: BlockDocumentAiAdapter = {
      ensureBlockDocument: () => {
        throw new Error('Block document was deleted');
      },
      getBlocks: () => [],
      addBlock: (_blockDocumentId, block) => {
        addBlockCalled = true;
        return block.id;
      },
    };

    const tool = createAddBlockDocumentTextBlockTool({
      blockDocumentAdapter,
      blockDocumentId: 'missing-document',
    });

    const result = await (tool as any).execute({
      reasoning: 'Add a short summary.',
      type: 'paragraph',
      text: 'A compact summary.',
    });

    expect(result).toEqual({
      success: false,
      errorMessage: 'Block document was deleted',
    });
    expect(addBlockCalled).toBe(false);
  });

  it('summarizes stateful blocks with generic stateful block metadata', async () => {
    const blockDocumentAdapter: BlockDocumentAiAdapter = {
      setCurrentBlockDocument: () => {},
      ensureBlockDocument: () => {},
      getBlocks: () => [
        blockDocumentBlockToNode({
          type: 'statefulBlock',
          id: 'block-1',
          blockType: 'dashboard',
          blockInstanceId: 'dashboard-1',
          ownership: 'owned',
          caption: 'Dashboard',
        }),
        blockDocumentBlockToNode({
          type: 'statefulBlock',
          id: 'block-2',
          blockType: 'html-app',
          blockInstanceId: 'html-app-1',
          title: 'Country Explorer',
        }),
      ],
      addBlock: (_blockDocumentId, block) => block.id,
    };

    const tool = createListBlockDocumentBlocksTool({
      blockDocumentAdapter,
      blockDocumentId: 'document-1',
    });

    const result = await (tool as any).execute({});

    expect(result).toEqual({
      success: true,
      blocks: [
        {
          blockId: 'block-1',
          type: 'statefulBlock',
          caption: 'Dashboard',
          statefulBlock: {
            blockType: 'dashboard',
            blockInstanceId: 'dashboard-1',
            ownership: 'owned',
          },
        },
        {
          blockId: 'block-2',
          type: 'statefulBlock',
          title: 'Country Explorer',
          statefulBlock: {
            blockType: 'html-app',
            blockInstanceId: 'html-app-1',
          },
        },
      ],
    });
    expect(result.blocks[0]).not.toHaveProperty('dashboardId');
    expect(result.blocks[1]).not.toHaveProperty('htmlAppId');
  });
});
