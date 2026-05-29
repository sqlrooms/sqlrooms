import {createStore} from 'zustand';
import {
  createBaseRoomSlice,
  type BaseRoomStoreState,
} from '@sqlrooms/room-store';
import {
  BlocksDocumentsSliceConfig,
  blocksDocumentBlockToNode,
  blocksDocumentContentToBlocks,
  createBlocksDocumentsSlice,
  createEmptyBlocksDocumentContent,
  normalizeBlocksDocumentContent,
  type BlocksDocumentBlockType,
  type BlocksDocumentsSliceState,
} from '../src';

type TestRoomState = BaseRoomStoreState & BlocksDocumentsSliceState;

function createTestStore() {
  let timestamp = 100;
  const now = () => timestamp++;

  return createStore<TestRoomState>()((...args) => ({
    ...createBaseRoomSlice()(...args),
    ...createBlocksDocumentsSlice<TestRoomState>({now})(...args),
  }));
}

describe('BlocksDocumentsSlice', () => {
  it('creates, updates, and removes artifact-scoped blocks documents', () => {
    const store = createTestStore();

    store.getState().blocksDocuments.ensureBlocksDocument('blocks-document-1');
    expect(
      store.getState().blocksDocuments.getBlocksDocument('blocks-document-1'),
    ).toEqual({
      id: 'blocks-document-1',
      content: {type: 'doc', content: []},
      assets: {},
      updatedAt: 100,
    });

    store.getState().blocksDocuments.setContent('blocks-document-1', {
      type: 'doc',
      content: [
        blocksDocumentBlockToNode({
          id: 'block-1',
          type: 'paragraph',
          text: 'Hello',
        }),
      ],
    });

    expect(
      store.getState().blocksDocuments.getBlocksDocument('blocks-document-1'),
    ).toMatchObject({
      id: 'blocks-document-1',
      updatedAt: 101,
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            attrs: {id: 'block-1'},
            content: [{type: 'text', text: 'Hello'}],
          },
        ],
      },
    });

    store.getState().blocksDocuments.removeBlocksDocument('blocks-document-1');
    expect(
      store.getState().blocksDocuments.getBlocksDocument('blocks-document-1'),
    ).toBeUndefined();
  });

  it('preserves existing content when ensuring an existing blocks document', () => {
    const store = createTestStore();

    store.getState().blocksDocuments.ensureBlocksDocument('blocks-document-1', {
      type: 'doc',
      content: [
        blocksDocumentBlockToNode({
          id: 'block-1',
          type: 'heading',
          level: 2,
          text: 'Original',
        }),
      ],
    });
    store.getState().blocksDocuments.ensureBlocksDocument('blocks-document-1', {
      type: 'doc',
      content: [
        blocksDocumentBlockToNode({
          id: 'block-2',
          type: 'heading',
          level: 2,
          text: 'Replacement',
        }),
      ],
    });

    expect(
      store.getState().blocksDocuments.getBlocks('blocks-document-1'),
    ).toEqual([{id: 'block-1', type: 'heading', level: 2, text: 'Original'}]);
  });

  it('appends, inserts, updates, removes, and moves top-level blocks', () => {
    const store = createTestStore();

    store.getState().blocksDocuments.appendBlocks('blocks-document-1', [
      {id: 'heading', type: 'heading', level: 1, text: 'Overview'},
      {id: 'paragraph', type: 'paragraph', text: 'First note'},
    ]);
    store.getState().blocksDocuments.insertBlocks('blocks-document-1', 1, [
      {
        id: 'chart',
        type: 'chart',
        tableName: 'sales',
        config: {chartType: 'histogram', settings: {field: 'revenue'}},
        selectionGroupId: 'overview',
      },
    ]);

    expect(
      store.getState().blocksDocuments.getBlocks('blocks-document-1'),
    ).toEqual([
      {id: 'heading', type: 'heading', level: 1, text: 'Overview'},
      {
        id: 'chart',
        type: 'chart',
        tableName: 'sales',
        config: {chartType: 'histogram', settings: {field: 'revenue'}},
        selectionGroupId: 'overview',
      },
      {id: 'paragraph', type: 'paragraph', text: 'First note'},
    ]);

    expect(
      store
        .getState()
        .blocksDocuments.updateBlock('blocks-document-1', 'paragraph', {
          id: 'ignored-id',
          type: 'paragraph',
          text: 'Updated note',
        }),
    ).toBe(true);
    expect(
      store
        .getState()
        .blocksDocuments.moveBlock('blocks-document-1', 'paragraph', 0),
    ).toBe(true);
    expect(
      store
        .getState()
        .blocksDocuments.removeBlock('blocks-document-1', 'heading'),
    ).toBe(true);

    expect(
      store.getState().blocksDocuments.getBlocks('blocks-document-1'),
    ).toEqual([
      {id: 'paragraph', type: 'paragraph', text: 'Updated note'},
      {
        id: 'chart',
        type: 'chart',
        tableName: 'sales',
        config: {chartType: 'histogram', settings: {field: 'revenue'}},
        selectionGroupId: 'overview',
      },
    ]);
  });

  it('tracks local sync metadata separately from persisted blocks document content', () => {
    const store = createTestStore();

    store.getState().blocksDocuments.setContent(
      'blocks-document-1',
      {
        type: 'doc',
        content: [
          blocksDocumentBlockToNode({
            id: 'paragraph',
            type: 'paragraph',
            text: 'Draft',
          }),
        ],
      },
      {origin: 'editor', sourceId: 'editor-1'},
    );

    expect(
      store.getState().blocksDocuments.getSyncMetadata('blocks-document-1'),
    ).toEqual({
      revision: 1,
      origin: 'editor',
      sourceId: 'editor-1',
    });
    expect(
      store.getState().blocksDocuments.getBlocksDocument('blocks-document-1'),
    ).not.toHaveProperty('syncMetadata');

    store
      .getState()
      .blocksDocuments.appendBlocks('blocks-document-1', [
        {id: 'heading', type: 'heading', level: 1, text: 'External edit'},
      ]);

    expect(
      store.getState().blocksDocuments.getSyncMetadata('blocks-document-1'),
    ).toEqual({
      revision: 2,
      origin: 'external',
    });
  });

  it('returns false for missing block mutations', () => {
    const store = createTestStore();
    store.getState().blocksDocuments.ensureBlocksDocument('blocks-document-1');

    const block: BlocksDocumentBlockType = {
      id: 'missing',
      type: 'paragraph',
      text: 'Nope',
    };

    expect(
      store
        .getState()
        .blocksDocuments.updateBlock('blocks-document-1', 'missing', block),
    ).toBe(false);
    expect(
      store.getState().blocksDocuments.removeBlock('blocks-document-1', 'missing'),
    ).toBe(false);
    expect(
      store.getState().blocksDocuments.moveBlock('blocks-document-1', 'missing', 0),
    ).toBe(false);
  });

  it('round-trips supported block DTOs through Tiptap JSON nodes', () => {
    const blocks: BlocksDocumentBlockType[] = [
      {id: 'heading', type: 'heading', level: 3, text: 'Findings'},
      {id: 'paragraph', type: 'paragraph', text: 'A note'},
      {id: 'rich', type: 'richText', markdown: '**Bold** note'},
      {id: 'list', type: 'list', ordered: true, items: ['One', 'Two']},
      {id: 'todo', type: 'todo', checked: true, text: 'Review'},
      {id: 'image', type: 'image', assetId: 'asset-1', caption: 'Image'},
      {
        id: 'chart-image',
        type: 'chartImage',
        assetId: 'asset-2',
        caption: 'Chart image',
      },
      {
        id: 'chart',
        type: 'chart',
        tableName: 'sales',
        config: {chartType: 'count-plot', settings: {field: 'region'}},
        selectionGroupId: 'group-1',
        caption: 'Live chart',
      },
      {
        id: 'dashboard',
        type: 'artifactEmbed',
        artifactId: 'dashboard-1',
        artifactType: 'dashboard',
        caption: 'Dashboard',
      },
    ];
    const content = {
      type: 'doc' as const,
      content: blocks.map(blocksDocumentBlockToNode),
    };

    expect(blocksDocumentContentToBlocks(content)).toEqual(blocks);
  });

  it('backfills missing top-level block IDs for editor content', () => {
    let nextId = 1;
    const result = normalizeBlocksDocumentContent(
      {
        type: 'doc',
        content: [
          {type: 'paragraph', content: [{type: 'text', text: 'Missing id'}]},
          {
            type: 'blocksDocumentChart',
            attrs: {id: 'chart-1', tableName: 'sales', config: {}},
          },
        ],
      },
      () => `block-${nextId++}`,
    );

    expect(result.content).toEqual([
      {
        type: 'paragraph',
        attrs: {id: 'block-1'},
        content: [{type: 'text', text: 'Missing id'}],
      },
      {
        type: 'blocksDocumentChart',
        attrs: {id: 'chart-1', tableName: 'sales', config: {}},
      },
    ]);
  });

  it('defaults content for legacy blocks document records', () => {
    const result = BlocksDocumentsSliceConfig.parse({
      artifacts: {
        'blocks-document-1': {id: 'blocks-document-1', updatedAt: 1},
      },
    });

    expect(result.artifacts['blocks-document-1']?.content).toEqual(
      createEmptyBlocksDocumentContent(),
    );
  });

  it('rejects blocks document records keyed by a different ID', () => {
    const result = BlocksDocumentsSliceConfig.safeParse({
      artifacts: {
        'blocks-document-key': {id: 'blocks-document-value', updatedAt: 1},
      },
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({
      path: ['artifacts', 'blocks-document-key', 'id'],
      message:
        'Blocks document key "blocks-document-key" does not match document id "blocks-document-value"',
    });
  });
});
