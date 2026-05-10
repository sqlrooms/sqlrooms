import {createStore} from 'zustand';
import {
  createBaseRoomSlice,
  type BaseRoomStoreState,
} from '@sqlrooms/room-store';
import {createDocumentsSlice, type DocumentsSliceState} from '../src';

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
      updatedAt: 100,
    });

    store.getState().documents.setMarkdown('doc-1', '# Updated');
    expect(store.getState().documents.getDocument('doc-1')).toEqual({
      id: 'doc-1',
      markdown: '# Updated',
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
      updatedAt: 100,
    });
  });

  it('creates missing documents on setMarkdown', () => {
    const store = createTestStore();

    store.getState().documents.setMarkdown('doc-1', '# Created');

    expect(store.getState().documents.getDocument('doc-1')).toEqual({
      id: 'doc-1',
      markdown: '# Created',
      updatedAt: 100,
    });
  });
});
