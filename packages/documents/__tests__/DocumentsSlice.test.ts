import {createStore} from 'zustand';
import {
  createBaseRoomSlice,
  type BaseRoomStoreState,
} from '@sqlrooms/room-store';
import {
  createDocumentsSlice,
  DocumentsSliceConfig,
  type DocumentsSliceState,
} from '../src';

type TestRoomState = BaseRoomStoreState & DocumentsSliceState;

function createTestStore() {
  let timestamp = 100;
  const now = () => timestamp++;

  return createStore<TestRoomState>()((...args) => ({
    ...createBaseRoomSlice()(...args),
    ...createDocumentsSlice<TestRoomState>({now})(...args),
  }));
}

describe('DocumentsSlice', () => {
  it('creates, updates, and removes artifact-scoped documents', () => {
    const store = createTestStore();

    store.getState().documents.ensureDocument('doc-1', '# Hello');
    expect(store.getState().documents.getDocument('doc-1')).toEqual({
      id: 'doc-1',
      markdown: '# Hello',
      assets: {},
      updatedAt: 100,
    });

    store.getState().documents.setMarkdown('doc-1', '# Updated');
    expect(store.getState().documents.getDocument('doc-1')).toEqual({
      id: 'doc-1',
      markdown: '# Updated',
      assets: {},
      updatedAt: 101,
    });

    store.getState().documents.removeDocument('doc-1');
    expect(store.getState().documents.getDocument('doc-1')).toBeUndefined();
  });

  it('preserves existing markdown when ensuring an existing document', () => {
    const store = createTestStore();

    store.getState().documents.ensureDocument('doc-1', '# Original');
    store.getState().documents.ensureDocument('doc-1', '# Replacement');

    expect(store.getState().documents.getDocument('doc-1')).toEqual({
      id: 'doc-1',
      markdown: '# Original',
      assets: {},
      updatedAt: 100,
    });
  });

  it('creates missing documents on setMarkdown', () => {
    const store = createTestStore();

    store.getState().documents.setMarkdown('doc-1', '# Created');

    expect(store.getState().documents.getDocument('doc-1')).toEqual({
      id: 'doc-1',
      markdown: '# Created',
      assets: {},
      updatedAt: 100,
    });
  });

  it('upserts, updates, reads, and removes document assets', () => {
    const store = createTestStore();

    store.getState().documents.ensureDocument('doc-1', '# Chart');
    store.getState().documents.upsertAsset('doc-1', {
      id: 'chart-1',
      mediaType: 'image/svg+xml',
      encoding: 'utf8',
      data: '<svg />',
      alt: 'Chart',
    });

    expect(store.getState().documents.getAsset('doc-1', 'chart-1')).toEqual({
      id: 'chart-1',
      mediaType: 'image/svg+xml',
      encoding: 'utf8',
      data: '<svg />',
      alt: 'Chart',
      createdAt: 101,
      updatedAt: 101,
    });
    expect(store.getState().documents.getDocument('doc-1')?.updatedAt).toBe(
      101,
    );

    store.getState().documents.upsertAsset('doc-1', {
      id: 'chart-1',
      mediaType: 'image/svg+xml',
      encoding: 'utf8',
      data: '<svg><text>Updated</text></svg>',
      alt: 'Updated chart',
    });

    expect(store.getState().documents.getAsset('doc-1', 'chart-1')).toEqual({
      id: 'chart-1',
      mediaType: 'image/svg+xml',
      encoding: 'utf8',
      data: '<svg><text>Updated</text></svg>',
      alt: 'Updated chart',
      createdAt: 101,
      updatedAt: 102,
    });

    store.getState().documents.removeAsset('doc-1', 'chart-1');
    expect(
      store.getState().documents.getAsset('doc-1', 'chart-1'),
    ).toBeUndefined();
    expect(store.getState().documents.getDocument('doc-1')?.updatedAt).toBe(
      103,
    );
  });

  it('defaults assets for legacy document records', () => {
    const result = DocumentsSliceConfig.parse({
      artifacts: {
        'doc-1': {id: 'doc-1', markdown: '# Legacy', updatedAt: 1},
      },
    });

    expect(result.artifacts['doc-1']?.assets).toEqual({});
  });

  it('rejects PNG assets that are not base64 encoded', () => {
    const result = DocumentsSliceConfig.safeParse({
      artifacts: {
        'doc-1': {
          id: 'doc-1',
          markdown: '# Image',
          assets: {
            'image-1': {
              id: 'image-1',
              mediaType: 'image/png',
              encoding: 'utf8',
              data: 'not png bytes',
            },
          },
          updatedAt: 1,
        },
      },
    });

    expect(result.success).toBe(false);
  });

  it('rejects document artifact records keyed by a different ID', () => {
    const result = DocumentsSliceConfig.safeParse({
      artifacts: {
        'doc-key': {id: 'doc-value', markdown: '# Mismatch', updatedAt: 1},
      },
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({
      path: ['artifacts', 'doc-key', 'id'],
      message: 'Artifact key "doc-key" does not match artifact id "doc-value"',
    });
  });
});
