import {createStore} from 'zustand';
import {
  createBaseRoomSlice,
  type BaseRoomStoreState,
} from '@sqlrooms/room-store';
import {
  BlockDocumentsSliceConfig,
  blockDocumentBlockToNode,
  blockDocumentContentToBlocks,
  createBlockDocumentsSlice,
  createEmptyBlockDocumentContent,
  normalizeBlockDocumentContent,
  type BlockDocumentBlockType,
  type BlockDocumentsSliceState,
  type CreateBlockDocumentsSliceProps,
} from '../src';

type TestRoomState = BaseRoomStoreState & BlockDocumentsSliceState;

function createTestStore(
  props: Omit<CreateBlockDocumentsSliceProps<TestRoomState>, 'now'> = {},
) {
  let timestamp = 100;
  const now = () => timestamp++;

  return createStore<TestRoomState>()((...args) => ({
    ...createBaseRoomSlice()(...args),
    ...createBlockDocumentsSlice<TestRoomState>({now, ...props})(...args),
  }));
}

describe('BlockDocumentsSlice', () => {
  it('creates, updates, and removes artifact-scoped block documents', () => {
    const store = createTestStore();

    store.getState().blockDocuments.ensureBlockDocument('block-document-1');
    expect(
      store.getState().blockDocuments.getBlockDocument('block-document-1'),
    ).toEqual({
      id: 'block-document-1',
      content: {type: 'doc', content: []},
      assets: {},
      updatedAt: 100,
    });

    store.getState().blockDocuments.setContent('block-document-1', {
      type: 'doc',
      content: [
        blockDocumentBlockToNode({
          id: 'block-1',
          type: 'paragraph',
          text: 'Hello',
        }),
      ],
    });

    expect(
      store.getState().blockDocuments.getBlockDocument('block-document-1'),
    ).toMatchObject({
      id: 'block-document-1',
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

    store.getState().blockDocuments.removeBlockDocument('block-document-1');
    expect(
      store.getState().blockDocuments.getBlockDocument('block-document-1'),
    ).toBeUndefined();
  });

  it('preserves existing content when ensuring an existing block document', () => {
    const store = createTestStore();

    store.getState().blockDocuments.ensureBlockDocument('block-document-1', {
      type: 'doc',
      content: [
        blockDocumentBlockToNode({
          id: 'block-1',
          type: 'heading',
          level: 2,
          text: 'Original',
        }),
      ],
    });
    store.getState().blockDocuments.ensureBlockDocument('block-document-1', {
      type: 'doc',
      content: [
        blockDocumentBlockToNode({
          id: 'block-2',
          type: 'heading',
          level: 2,
          text: 'Replacement',
        }),
      ],
    });

    expect(
      store.getState().blockDocuments.getBlocks('block-document-1'),
    ).toEqual([{id: 'block-1', type: 'heading', level: 2, text: 'Original'}]);
  });

  it('appends, inserts, updates, removes, and moves top-level blocks', () => {
    const store = createTestStore();

    store.getState().blockDocuments.appendBlocks('block-document-1', [
      {id: 'heading', type: 'heading', level: 1, text: 'Overview'},
      {id: 'paragraph', type: 'paragraph', text: 'First note'},
    ]);
    store.getState().blockDocuments.insertBlocks('block-document-1', 1, [
      {
        id: 'chart',
        type: 'chart',
        tableName: 'sales',
        config: {chartType: 'histogram', settings: {field: 'revenue'}},
        selectionGroupId: 'overview',
      },
    ]);

    expect(
      store.getState().blockDocuments.getBlocks('block-document-1'),
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
        .blockDocuments.updateBlock('block-document-1', 'paragraph', {
          id: 'ignored-id',
          type: 'paragraph',
          text: 'Updated note',
        }),
    ).toBe(true);
    expect(
      store
        .getState()
        .blockDocuments.moveBlock('block-document-1', 'paragraph', 0),
    ).toBe(true);
    expect(
      store
        .getState()
        .blockDocuments.removeBlock('block-document-1', 'heading'),
    ).toBe(true);

    expect(
      store.getState().blockDocuments.getBlocks('block-document-1'),
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

  it('tracks local sync metadata separately from persisted block document content', () => {
    const store = createTestStore();

    store.getState().blockDocuments.setContent(
      'block-document-1',
      {
        type: 'doc',
        content: [
          blockDocumentBlockToNode({
            id: 'paragraph',
            type: 'paragraph',
            text: 'Draft',
          }),
        ],
      },
      {origin: 'editor', sourceId: 'editor-1'},
    );

    expect(
      store.getState().blockDocuments.getSyncMetadata('block-document-1'),
    ).toEqual({
      revision: 1,
      origin: 'editor',
      sourceId: 'editor-1',
    });
    expect(
      store.getState().blockDocuments.getBlockDocument('block-document-1'),
    ).not.toHaveProperty('syncMetadata');

    store
      .getState()
      .blockDocuments.appendBlocks('block-document-1', [
        {id: 'heading', type: 'heading', level: 1, text: 'External edit'},
      ]);

    expect(
      store.getState().blockDocuments.getSyncMetadata('block-document-1'),
    ).toEqual({
      revision: 2,
      origin: 'external',
    });
  });

  it('returns false for missing block mutations', () => {
    const store = createTestStore();
    store.getState().blockDocuments.ensureBlockDocument('block-document-1');

    const block: BlockDocumentBlockType = {
      id: 'missing',
      type: 'paragraph',
      text: 'Nope',
    };

    expect(
      store
        .getState()
        .blockDocuments.updateBlock('block-document-1', 'missing', block),
    ).toBe(false);
    expect(
      store
        .getState()
        .blockDocuments.removeBlock('block-document-1', 'missing'),
    ).toBe(false);
    expect(
      store
        .getState()
        .blockDocuments.moveBlock('block-document-1', 'missing', 0),
    ).toBe(false);
  });

  it('cleans up removed owned stateful block references', () => {
    const deletedBlocks: Array<{
      documentId: string;
      blockId: string;
      blockType: string;
      blockInstanceId: string;
    }> = [];
    const store = createTestStore({
      onDeleteOwnedStatefulBlock: ({
        documentId,
        blockId,
        blockType,
        blockInstanceId,
      }) => {
        deletedBlocks.push({
          documentId,
          blockId,
          blockType,
          blockInstanceId,
        });
      },
    });

    store.getState().blockDocuments.appendBlocks('block-document-1', [
      {
        id: 'owned-dashboard',
        type: 'statefulBlock',
        blockType: 'dashboard',
        blockInstanceId: 'dashboard-1',
        ownership: 'owned',
      },
      {
        id: 'shared-dashboard',
        type: 'statefulBlock',
        blockType: 'dashboard',
        blockInstanceId: 'dashboard-2',
        ownership: 'shared',
      },
    ]);

    expect(
      store
        .getState()
        .blockDocuments.removeBlock('block-document-1', 'owned-dashboard'),
    ).toBe(true);
    expect(
      store
        .getState()
        .blockDocuments.removeBlock('block-document-1', 'shared-dashboard'),
    ).toBe(true);

    expect(deletedBlocks).toEqual([
      {
        documentId: 'block-document-1',
        blockId: 'owned-dashboard',
        blockType: 'dashboard',
        blockInstanceId: 'dashboard-1',
      },
    ]);
  });

  it('initializes newly added owned stateful block references', () => {
    const createdBlocks: Array<{
      documentId: string;
      blockId: string;
      blockType: string;
      blockInstanceId: string;
      title?: string;
    }> = [];
    const store = createTestStore({
      onCreateOwnedStatefulBlock: ({
        documentId,
        blockId,
        blockType,
        blockInstanceId,
        title,
      }) => {
        createdBlocks.push({
          documentId,
          blockId,
          blockType,
          blockInstanceId,
          title,
        });
      },
    });

    store.getState().blockDocuments.appendBlocks('block-document-1', [
      {
        id: 'owned-dashboard',
        type: 'statefulBlock',
        blockType: 'dashboard',
        blockInstanceId: 'dashboard-1',
        ownership: 'owned',
        title: 'Dashboard',
      },
      {
        id: 'shared-dashboard',
        type: 'statefulBlock',
        blockType: 'dashboard',
        blockInstanceId: 'dashboard-2',
        ownership: 'shared',
        title: 'Shared Dashboard',
      },
    ]);

    expect(createdBlocks).toEqual([
      {
        documentId: 'block-document-1',
        blockId: 'owned-dashboard',
        blockType: 'dashboard',
        blockInstanceId: 'dashboard-1',
        title: 'Dashboard',
      },
    ]);
  });

  it('cleans up owned stateful block references removed by content replacement', () => {
    const deletedBlockIds: string[] = [];
    const store = createTestStore({
      onDeleteOwnedStatefulBlock: ({blockInstanceId}) => {
        deletedBlockIds.push(blockInstanceId);
      },
    });

    store.getState().blockDocuments.appendBlocks('block-document-1', [
      {
        id: 'pivot-block',
        type: 'statefulBlock',
        blockType: 'pivot',
        blockInstanceId: 'pivot-1',
        ownership: 'owned',
      },
    ]);
    store.getState().blockDocuments.setContent('block-document-1', {
      type: 'doc',
      content: [
        blockDocumentBlockToNode({
          id: 'paragraph',
          type: 'paragraph',
          text: 'Replacement',
        }),
      ],
    });

    expect(deletedBlockIds).toEqual(['pivot-1']);
  });

  it('keeps owned stateful block state while another owned reference remains', () => {
    const deletedBlockIds: string[] = [];
    const store = createTestStore({
      onDeleteOwnedStatefulBlock: ({blockInstanceId}) => {
        deletedBlockIds.push(blockInstanceId);
      },
    });

    store.getState().blockDocuments.appendBlocks('block-document-1', [
      {
        id: 'dashboard-a',
        type: 'statefulBlock',
        blockType: 'dashboard',
        blockInstanceId: 'dashboard-1',
        ownership: 'owned',
      },
      {
        id: 'dashboard-b',
        type: 'statefulBlock',
        blockType: 'dashboard',
        blockInstanceId: 'dashboard-1',
        ownership: 'owned',
      },
    ]);

    store
      .getState()
      .blockDocuments.removeBlock('block-document-1', 'dashboard-a');
    expect(deletedBlockIds).toEqual([]);

    store.getState().blockDocuments.removeBlockDocument('block-document-1');
    expect(deletedBlockIds).toEqual(['dashboard-1']);
  });

  it('renames owned stateful block references when title changes', () => {
    const renamedBlocks: Array<{
      blockInstanceId: string;
      previousTitle: string;
      title: string;
    }> = [];
    const store = createTestStore({
      onRenameOwnedStatefulBlock: ({blockInstanceId, previousTitle, title}) => {
        renamedBlocks.push({blockInstanceId, previousTitle, title});
      },
    });

    store.getState().blockDocuments.appendBlocks('block-document-1', [
      {
        id: 'pivot-block',
        type: 'statefulBlock',
        blockType: 'pivot',
        blockInstanceId: 'pivot-1',
        ownership: 'owned',
        title: 'Original Pivot',
      },
      {
        id: 'shared-pivot-block',
        type: 'statefulBlock',
        blockType: 'pivot',
        blockInstanceId: 'pivot-2',
        ownership: 'shared',
        title: 'Original Shared Pivot',
      },
    ]);

    expect(
      store
        .getState()
        .blockDocuments.updateBlock('block-document-1', 'pivot-block', {
          id: 'ignored',
          type: 'statefulBlock',
          blockType: 'pivot',
          blockInstanceId: 'pivot-1',
          ownership: 'owned',
          title: 'Renamed Pivot',
        }),
    ).toBe(true);
    store
      .getState()
      .blockDocuments.updateBlock('block-document-1', 'shared-pivot-block', {
        id: 'ignored',
        type: 'statefulBlock',
        blockType: 'pivot',
        blockInstanceId: 'pivot-2',
        ownership: 'shared',
        title: 'Renamed Shared Pivot',
      });

    expect(renamedBlocks).toEqual([
      {
        blockInstanceId: 'pivot-1',
        previousTitle: 'Original Pivot',
        title: 'Renamed Pivot',
      },
    ]);
  });

  it('round-trips supported block DTOs through Tiptap JSON nodes', () => {
    const blocks: BlockDocumentBlockType[] = [
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
        id: 'pivot-block',
        type: 'statefulBlock',
        blockType: 'pivot',
        blockInstanceId: 'pivot-instance-1',
        ownership: 'owned',
        title: 'Embedded Pivot Table',
        caption: 'Pivot',
      },
    ];
    const content = {
      type: 'doc' as const,
      content: blocks.map(blockDocumentBlockToNode),
    };

    expect(blockDocumentContentToBlocks(content)).toEqual(blocks);
  });

  it('backfills missing top-level block IDs for editor content', () => {
    let nextId = 1;
    const result = normalizeBlockDocumentContent(
      {
        type: 'doc',
        content: [
          {type: 'paragraph', content: [{type: 'text', text: 'Missing id'}]},
          {
            type: 'blockDocumentChart',
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
        type: 'blockDocumentChart',
        attrs: {id: 'chart-1', tableName: 'sales', config: {}},
      },
    ]);
  });

  it('rewrites duplicate block and owned stateful instance IDs for editor content', () => {
    let nextId = 1;
    const result = normalizeBlockDocumentContent(
      {
        type: 'doc',
        content: [
          {
            type: 'blockDocumentStatefulBlock',
            attrs: {
              id: 'dashboard-block',
              blockType: 'dashboard',
              blockInstanceId: 'dashboard-1',
              ownership: 'owned',
              title: 'Dashboard',
            },
          },
          {
            type: 'blockDocumentStatefulBlock',
            attrs: {
              id: 'dashboard-block',
              blockType: 'dashboard',
              blockInstanceId: 'dashboard-1',
              ownership: 'owned',
              title: 'Dashboard copy',
            },
          },
          {
            type: 'blockDocumentStatefulBlock',
            attrs: {
              id: 'shared-dashboard-block',
              blockType: 'dashboard',
              blockInstanceId: 'dashboard-1',
              ownership: 'shared',
            },
          },
        ],
      },
      () => `block-${nextId++}`,
    );

    expect(result.content).toEqual([
      {
        type: 'blockDocumentStatefulBlock',
        attrs: {
          id: 'dashboard-block',
          blockType: 'dashboard',
          blockInstanceId: 'dashboard-1',
          ownership: 'owned',
          title: 'Dashboard',
        },
      },
      {
        type: 'blockDocumentStatefulBlock',
        attrs: {
          id: 'block-1',
          blockType: 'dashboard',
          blockInstanceId: 'block-1',
          ownership: 'owned',
          title: 'Dashboard copy',
        },
      },
      {
        type: 'blockDocumentStatefulBlock',
        attrs: {
          id: 'shared-dashboard-block',
          blockType: 'dashboard',
          blockInstanceId: 'dashboard-1',
          ownership: 'shared',
        },
      },
    ]);
  });

  it('defaults content for legacy block document records', () => {
    const result = BlockDocumentsSliceConfig.parse({
      artifacts: {
        'block-document-1': {id: 'block-document-1', updatedAt: 1},
      },
    });

    expect(result.artifacts['block-document-1']?.content).toEqual(
      createEmptyBlockDocumentContent(),
    );
  });

  it('rejects block document records keyed by a different ID', () => {
    const result = BlockDocumentsSliceConfig.safeParse({
      artifacts: {
        'block-document-key': {id: 'block-document-value', updatedAt: 1},
      },
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({
      path: ['artifacts', 'block-document-key', 'id'],
      message:
        'Block document key "block-document-key" does not match document id "block-document-value"',
    });
  });
});
