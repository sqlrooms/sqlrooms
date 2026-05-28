import {createStore} from 'zustand';
import {
  createBaseRoomSlice,
  type BaseRoomStoreState,
} from '@sqlrooms/room-store';
import {
  AnalysisDocumentsSliceConfig,
  analysisBlockToNode,
  analysisContentToBlocks,
  createAnalysisDocumentsSlice,
  createEmptyAnalysisDocumentContent,
  normalizeAnalysisDocumentContent,
  type AnalysisBlockType,
  type AnalysisDocumentsSliceState,
} from '../src';

type TestRoomState = BaseRoomStoreState & AnalysisDocumentsSliceState;

function createTestStore() {
  let timestamp = 100;
  const now = () => timestamp++;

  return createStore<TestRoomState>()((...args) => ({
    ...createBaseRoomSlice()(...args),
    ...createAnalysisDocumentsSlice<TestRoomState>({now})(...args),
  }));
}

describe('AnalysisDocumentsSlice', () => {
  it('creates, updates, and removes artifact-scoped analysis documents', () => {
    const store = createTestStore();

    store.getState().analysisDocuments.ensureAnalysis('analysis-1');
    expect(
      store.getState().analysisDocuments.getAnalysis('analysis-1'),
    ).toEqual({
      id: 'analysis-1',
      content: {type: 'doc', content: []},
      assets: {},
      updatedAt: 100,
    });

    store.getState().analysisDocuments.setContent('analysis-1', {
      type: 'doc',
      content: [
        analysisBlockToNode({
          id: 'block-1',
          type: 'paragraph',
          text: 'Hello',
        }),
      ],
    });

    expect(
      store.getState().analysisDocuments.getAnalysis('analysis-1'),
    ).toMatchObject({
      id: 'analysis-1',
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

    store.getState().analysisDocuments.removeAnalysis('analysis-1');
    expect(
      store.getState().analysisDocuments.getAnalysis('analysis-1'),
    ).toBeUndefined();
  });

  it('preserves existing content when ensuring an existing analysis', () => {
    const store = createTestStore();

    store.getState().analysisDocuments.ensureAnalysis('analysis-1', {
      type: 'doc',
      content: [
        analysisBlockToNode({
          id: 'block-1',
          type: 'heading',
          level: 2,
          text: 'Original',
        }),
      ],
    });
    store.getState().analysisDocuments.ensureAnalysis('analysis-1', {
      type: 'doc',
      content: [
        analysisBlockToNode({
          id: 'block-2',
          type: 'heading',
          level: 2,
          text: 'Replacement',
        }),
      ],
    });

    expect(store.getState().analysisDocuments.getBlocks('analysis-1')).toEqual([
      {id: 'block-1', type: 'heading', level: 2, text: 'Original'},
    ]);
  });

  it('appends, inserts, updates, removes, and moves top-level blocks', () => {
    const store = createTestStore();

    store.getState().analysisDocuments.appendBlocks('analysis-1', [
      {id: 'heading', type: 'heading', level: 1, text: 'Overview'},
      {id: 'paragraph', type: 'paragraph', text: 'First note'},
    ]);
    store.getState().analysisDocuments.insertBlocks('analysis-1', 1, [
      {
        id: 'chart',
        type: 'chart',
        tableName: 'sales',
        config: {chartType: 'histogram', settings: {field: 'revenue'}},
        selectionGroupId: 'overview',
      },
    ]);

    expect(store.getState().analysisDocuments.getBlocks('analysis-1')).toEqual([
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
        .analysisDocuments.updateBlock('analysis-1', 'paragraph', {
          id: 'ignored-id',
          type: 'paragraph',
          text: 'Updated note',
        }),
    ).toBe(true);
    expect(
      store
        .getState()
        .analysisDocuments.moveBlock('analysis-1', 'paragraph', 0),
    ).toBe(true);
    expect(
      store.getState().analysisDocuments.removeBlock('analysis-1', 'heading'),
    ).toBe(true);

    expect(store.getState().analysisDocuments.getBlocks('analysis-1')).toEqual([
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

  it('returns false for missing block mutations', () => {
    const store = createTestStore();
    store.getState().analysisDocuments.ensureAnalysis('analysis-1');

    const block: AnalysisBlockType = {
      id: 'missing',
      type: 'paragraph',
      text: 'Nope',
    };

    expect(
      store
        .getState()
        .analysisDocuments.updateBlock('analysis-1', 'missing', block),
    ).toBe(false);
    expect(
      store.getState().analysisDocuments.removeBlock('analysis-1', 'missing'),
    ).toBe(false);
    expect(
      store.getState().analysisDocuments.moveBlock('analysis-1', 'missing', 0),
    ).toBe(false);
  });

  it('round-trips supported block DTOs through Tiptap JSON nodes', () => {
    const blocks: AnalysisBlockType[] = [
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
      content: blocks.map(analysisBlockToNode),
    };

    expect(analysisContentToBlocks(content)).toEqual(blocks);
  });

  it('backfills missing top-level block IDs for editor content', () => {
    let nextId = 1;
    const result = normalizeAnalysisDocumentContent(
      {
        type: 'doc',
        content: [
          {type: 'paragraph', content: [{type: 'text', text: 'Missing id'}]},
          {
            type: 'analysisChart',
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
        type: 'analysisChart',
        attrs: {id: 'chart-1', tableName: 'sales', config: {}},
      },
    ]);
  });

  it('defaults content for legacy analysis records', () => {
    const result = AnalysisDocumentsSliceConfig.parse({
      artifacts: {
        'analysis-1': {id: 'analysis-1', updatedAt: 1},
      },
    });

    expect(result.artifacts['analysis-1']?.content).toEqual(
      createEmptyAnalysisDocumentContent(),
    );
  });

  it('rejects analysis records keyed by a different ID', () => {
    const result = AnalysisDocumentsSliceConfig.safeParse({
      artifacts: {
        'analysis-key': {id: 'analysis-value', updatedAt: 1},
      },
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({
      path: ['artifacts', 'analysis-key', 'id'],
      message:
        'Analysis artifact key "analysis-key" does not match artifact id "analysis-value"',
    });
  });
});
