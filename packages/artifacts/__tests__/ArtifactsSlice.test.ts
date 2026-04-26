import {createStore} from 'zustand';
import {
  createBaseRoomSlice,
  type BaseRoomStoreState,
} from '@sqlrooms/room-store';
import {createArtifactsSlice} from '../src';

function createTestStore() {
  return createStore<BaseRoomStoreState & any>()((...args) => ({
    ...createBaseRoomSlice()(...args),
    ...createArtifactsSlice()(...args),
  }));
}

describe('ArtifactsSlice', () => {
  it('adds, ensures, renames, and removes items', () => {
    const store = createTestStore();
    const firstId = store.getState().artifacts.addItem({
      type: 'dashboard',
      title: 'Dashboard',
    });

    expect(store.getState().artifacts.config.itemsById[firstId]).toMatchObject({
      id: firstId,
      type: 'dashboard',
      title: 'Dashboard',
    });
    expect(store.getState().artifacts.config.currentItemId).toBe(firstId);

    store.getState().artifacts.ensureItem('notebook-1', {
      type: 'notebook',
      title: 'Notebook',
    });
    store.getState().artifacts.renameItem('notebook-1', 'Notebook 2');

    expect(store.getState().artifacts.getItem('notebook-1')).toMatchObject({
      id: 'notebook-1',
      type: 'notebook',
      title: 'Notebook 2',
    });

    store.getState().artifacts.removeItem(firstId);

    expect(store.getState().artifacts.getItem(firstId)).toBeUndefined();
    expect(store.getState().artifacts.config.order).toEqual(['notebook-1']);
  });

  it('normalizes order and current item', () => {
    const store = createTestStore();
    store.getState().artifacts.ensureItem('a', {
      type: 'dashboard',
      title: 'A',
    });
    store.getState().artifacts.ensureItem('b', {
      type: 'app',
      title: 'B',
    });

    store.getState().artifacts.setOrder(['b', 'missing', 'a', 'b']);
    expect(store.getState().artifacts.config.order).toEqual(['b', 'a']);

    store.getState().artifacts.setCurrentItem('b');
    expect(store.getState().artifacts.config.currentItemId).toBe('b');

    store.getState().artifacts.setCurrentItem('missing');
    expect(store.getState().artifacts.config.currentItemId).toBeUndefined();
  });
});
