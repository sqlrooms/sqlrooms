import {
  blockDocumentBlockToNode,
  createBlockDocumentCommandIds,
  createAddBlockDocumentTextBlockTool,
  createCopyBlockDocumentBlocksTool,
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
      blockDocumentId: 'document-1',
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

  it('lists blocks from an explicitly requested block document', async () => {
    const requestedBlockDocumentIds: string[] = [];
    const blockDocumentAdapter: BlockDocumentAiAdapter = {
      setCurrentBlockDocument: () => {},
      ensureBlockDocument: () => {},
      getBlocks: (blockDocumentId) => {
        requestedBlockDocumentIds.push(blockDocumentId);
        return [
          blockDocumentBlockToNode({
            type: 'heading',
            id: 'source-heading',
            level: 2,
            text: 'Source heading',
          }),
        ];
      },
      addBlock: (_blockDocumentId, block) => block.id,
    };

    const tool = createListBlockDocumentBlocksTool({
      blockDocumentAdapter,
      blockDocumentId: 'current-document',
    });

    const result = await (tool as any).execute({
      blockDocumentId: 'source-document',
    });

    expect(requestedBlockDocumentIds).toEqual(['source-document']);
    expect(result).toEqual({
      success: true,
      blockDocumentId: 'source-document',
      blocks: [
        {
          blockId: 'source-heading',
          index: 0,
          type: 'heading',
          title: 'Source heading',
        },
      ],
    });
  });

  it('copies selected blocks between block documents', async () => {
    const addedBlocks: Array<{
      blockDocumentId: string;
      block: BlockDocumentBlock;
    }> = [];
    const ensuredBlockDocumentIds: string[] = [];
    const blockDocumentAdapter: BlockDocumentAiAdapter = {
      setCurrentBlockDocument: () => {},
      ensureBlockDocument: (blockDocumentId) => {
        ensuredBlockDocumentIds.push(blockDocumentId);
      },
      getBlocks: (blockDocumentId) =>
        blockDocumentId === 'source-document'
          ? [
              blockDocumentBlockToNode({
                type: 'chart',
                id: 'source-chart',
                tableName: '"main"."cars"',
                config: {chartType: 'scatter'},
                caption: 'MPG vs Weight',
              }),
              blockDocumentBlockToNode({
                type: 'statefulBlock',
                id: 'source-dashboard',
                blockType: 'dashboard',
                blockInstanceId: 'dashboard-1',
                ownership: 'owned',
              }),
            ]
          : [],
      addBlock: (blockDocumentId, block) => {
        addedBlocks.push({blockDocumentId, block});
        return `added:${block.id}`;
      },
    };

    const tool = createCopyBlockDocumentBlocksTool({
      blockDocumentAdapter,
      blockDocumentId: 'target-document',
    });

    const result = await (tool as any).execute({
      sourceBlockDocumentId: 'source-document',
      blockIds: ['source-chart', 'source-dashboard'],
    });

    expect(result).toEqual({
      success: true,
      sourceBlockDocumentId: 'source-document',
      targetBlockDocumentId: 'target-document',
      copiedBlocks: [
        {
          sourceBlockId: 'source-chart',
          blockId: expect.stringMatching(/^added:/),
          type: 'chart',
        },
        {
          sourceBlockId: 'source-dashboard',
          blockId: expect.stringMatching(/^added:/),
          type: 'statefulBlock',
        },
      ],
      message: 'Copied 2 blocks to block document',
    });
    expect(ensuredBlockDocumentIds).toEqual([
      'source-document',
      'target-document',
    ]);
    expect(addedBlocks).toEqual([
      {
        blockDocumentId: 'target-document',
        block: expect.objectContaining({
          id: expect.not.stringMatching(/^source-/),
          type: 'chart',
          tableName: '"main"."cars"',
          caption: 'MPG vs Weight',
        }),
      },
      {
        blockDocumentId: 'target-document',
        block: expect.objectContaining({
          id: expect.not.stringMatching(/^source-/),
          type: 'statefulBlock',
          blockType: 'dashboard',
          blockInstanceId: 'dashboard-1',
          ownership: 'shared',
        }),
      },
    ]);
  });

  it('duplicates blocks when source and target block document IDs match', async () => {
    const addedBlocks: BlockDocumentBlock[] = [];
    const blockDocumentAdapter: BlockDocumentAiAdapter = {
      setCurrentBlockDocument: () => {},
      ensureBlockDocument: () => {},
      getBlocks: () => [
        blockDocumentBlockToNode({
          type: 'paragraph',
          id: 'paragraph-1',
          text: 'Duplicate me.',
        }),
      ],
      addBlock: (_blockDocumentId, block) => {
        addedBlocks.push(block);
        return block.id;
      },
    };

    const tool = createCopyBlockDocumentBlocksTool({
      blockDocumentAdapter,
      blockDocumentId: 'document-1',
    });

    const result = await (tool as any).execute({
      sourceBlockDocumentId: 'document-1',
      targetBlockDocumentId: 'document-1',
      blockIds: ['paragraph-1'],
    });

    expect(result).toEqual({
      success: true,
      sourceBlockDocumentId: 'document-1',
      targetBlockDocumentId: 'document-1',
      copiedBlocks: [
        {
          sourceBlockId: 'paragraph-1',
          blockId: expect.any(String),
          type: 'paragraph',
        },
      ],
      message: 'Copied 1 block to block document',
    });
    expect(addedBlocks).toEqual([
      expect.objectContaining({
        id: expect.not.stringMatching(/^paragraph-1$/),
        type: 'paragraph',
        text: 'Duplicate me.',
      }),
    ]);
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
