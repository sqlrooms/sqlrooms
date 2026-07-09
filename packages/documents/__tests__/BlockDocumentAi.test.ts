import {
  blockDocumentBlockToNode,
  createBlockDocumentCommandIds,
  createAddBlockDocumentTextBlockTool,
  createListBlockDocumentBlocksTool,
  createMoveBlockDocumentBlockTool,
  type BlockDocumentAiAdapter,
  type BlockDocumentBlock,
  type BlockDocumentMoveBlockAiAdapter,
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
      setCurrentBlockDocument: () => {},
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

  it('awaits command-backed adapters when adding generic text blocks', async () => {
    const addedBlocks: BlockDocumentBlock[] = [];
    const blockDocumentAdapter: BlockDocumentAiAdapter = {
      ensureBlockDocument: () => {},
      setCurrentBlockDocument: () => {},
      getBlocks: () => [],
      addBlock: async (_blockDocumentId, block) => {
        addedBlocks.push(block);
        return `command:${block.id}`;
      },
    };

    const tool = createAddBlockDocumentTextBlockTool({
      blockDocumentAdapter,
      blockDocumentId: 'document-1',
    });

    const result = await (tool as any).execute({
      reasoning: 'Add a short heading.',
      type: 'heading',
      level: 2,
      text: 'Summary',
    });

    expect(result).toEqual({
      success: true,
      blockId: expect.stringMatching(/^command:/),
      message: 'Added heading block to block document',
    });
    expect(addedBlocks).toEqual([
      expect.objectContaining({
        type: 'heading',
        text: 'Summary',
      }),
    ]);
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
          caption: 'Country Explorer',
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
          index: 0,
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
          index: 1,
          type: 'statefulBlock',
          caption: 'Country Explorer',
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

  it('allows hosts to augment block summaries with runtime metadata', async () => {
    const blockDocumentAdapter: BlockDocumentAiAdapter = {
      setCurrentBlockDocument: () => {},
      ensureBlockDocument: () => {},
      getBlocks: () => [
        blockDocumentBlockToNode({
          type: 'statefulBlock',
          id: 'block-1',
          blockType: 'map',
          blockInstanceId: 'map-1',
        }),
      ],
      addBlock: (_blockDocumentId, block) => block.id,
    };

    const tool = createListBlockDocumentBlocksTool({
      blockDocumentAdapter,
      blockDocumentId: 'document-1',
      augmentBlockSummary: ({block}) =>
        block.type === 'statefulBlock' && block.blockType === 'map'
          ? {
              runtimeIssues: [
                {
                  kind: 'render-error',
                  message: 'Layer failed to render',
                },
              ],
            }
          : undefined,
    });

    const result = await (tool as any).execute({});

    expect(result).toEqual({
      success: true,
      blocks: [
        {
          blockId: 'block-1',
          index: 0,
          type: 'statefulBlock',
          statefulBlock: {
            blockType: 'map',
            blockInstanceId: 'map-1',
          },
          runtimeIssues: [
            {
              kind: 'render-error',
              message: 'Layer failed to render',
            },
          ],
        },
      ],
    });
  });

  it('moves a top-level block through the block document adapter', async () => {
    const moveCalls: unknown[][] = [];
    const ensuredBlockDocumentIds: string[] = [];
    const blockDocumentAdapter: BlockDocumentMoveBlockAiAdapter = {
      ensureBlockDocument: (blockDocumentId) => {
        ensuredBlockDocumentIds.push(blockDocumentId);
      },
      moveBlock: (blockDocumentId, blockId, toIndex) => {
        moveCalls.push([blockDocumentId, blockId, toIndex]);
        return true;
      },
    };

    const moveTool = createMoveBlockDocumentBlockTool({
      blockDocumentAdapter,
      blockDocumentId: 'document-1',
    });

    const result = await (moveTool as any).execute({
      reasoning: 'Move the joke to the top.',
      blockId: 'joke-block',
      toIndex: 0,
    });

    expect(result).toEqual({
      success: true,
      blockId: 'joke-block',
      toIndex: 0,
      message: 'Moved block joke-block to index 0',
    });
    expect(ensuredBlockDocumentIds).toEqual(['document-1']);
    expect(moveCalls).toEqual([['document-1', 'joke-block', 0]]);
  });

  it('rejects negative move indexes at the tool schema boundary', () => {
    const blockDocumentAdapter: BlockDocumentMoveBlockAiAdapter = {
      ensureBlockDocument: () => {},
      moveBlock: () => true,
    };

    const moveTool = createMoveBlockDocumentBlockTool({
      blockDocumentAdapter,
      blockDocumentId: 'document-1',
    });

    expect(
      (moveTool as any).inputSchema.safeParse({
        blockId: 'joke-block',
        toIndex: -1,
      }).success,
    ).toBe(false);
  });

  it('reports missing blocks when the adapter cannot move a block', async () => {
    const blockDocumentAdapter: BlockDocumentMoveBlockAiAdapter = {
      ensureBlockDocument: () => {},
      moveBlock: () => false,
    };

    const moveTool = createMoveBlockDocumentBlockTool({
      blockDocumentAdapter,
      blockDocumentId: 'document-1',
    });

    const result = await (moveTool as any).execute({
      blockId: 'missing-block',
      toIndex: 0,
    });

    expect(result).toEqual({
      success: false,
      errorMessage: 'Block "missing-block" was not found.',
    });
  });
});
