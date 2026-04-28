import {createStore} from 'zustand';
import {
  createBaseRoomSlice,
  type BaseRoomStoreState,
} from '@sqlrooms/room-store';
import {
  createArtifactLayoutNode,
  createArtifactPanelDefinition,
  createArtifactsSlice,
  defineArtifactTypes,
  type ArtifactsSliceState,
} from '../src';

type TestRoomState = BaseRoomStoreState & ArtifactsSliceState;

function createTestStore(events: string[] = []) {
  const artifactTypes = defineArtifactTypes({
    notebook: {
      label: 'Notebook',
      defaultTitle: 'Notebook',
      onCreate: ({artifactId}) => events.push(`create:${artifactId}`),
      onEnsure: ({artifactId}) => events.push(`ensure:${artifactId}`),
      onRename: ({artifactId, previousTitle, artifact}) =>
        events.push(`rename:${artifactId}:${previousTitle}:${artifact.title}`),
      onClose: ({artifactId}) => events.push(`close:${artifactId}`),
      onDelete: ({artifactId}) => events.push(`delete:${artifactId}`),
    },
    dashboard: {
      label: 'Dashboard',
      defaultTitle: 'Dashboard',
    },
  });

  return createStore<TestRoomState>()((...args) => ({
    ...createBaseRoomSlice()(...args),
    ...createArtifactsSlice<TestRoomState>({artifactTypes})(...args),
  }));
}

describe('ArtifactsSlice', () => {
  it('creates, ensures, renames, closes, and deletes artifacts', () => {
    const events: string[] = [];
    const store = createTestStore(events);
    const firstId = store.getState().artifacts.createArtifact({
      type: 'notebook',
    });

    expect(
      store.getState().artifacts.config.artifactsById[firstId],
    ).toMatchObject({
      id: firstId,
      type: 'notebook',
      title: 'Notebook',
    });
    expect(store.getState().artifacts.config.currentArtifactId).toBe(firstId);

    store.getState().artifacts.ensureArtifact('notebook-1', {
      type: 'notebook',
      title: 'Notebook 1',
    });
    store.getState().artifacts.renameArtifact('notebook-1', 'Notebook 2');
    store.getState().artifacts.closeArtifact('notebook-1');

    expect(store.getState().artifacts.getArtifact('notebook-1')).toMatchObject({
      id: 'notebook-1',
      type: 'notebook',
      title: 'Notebook 2',
    });

    store.getState().artifacts.deleteArtifact(firstId);

    expect(store.getState().artifacts.getArtifact(firstId)).toBeUndefined();
    expect(store.getState().artifacts.config.artifactOrder).toEqual([
      'notebook-1',
    ]);
    expect(events).toEqual([
      `create:${firstId}`,
      'ensure:notebook-1',
      'rename:notebook-1:Notebook 1:Notebook 2',
      'close:notebook-1',
      `close:${firstId}`,
      `delete:${firstId}`,
    ]);
  });

  it('normalizes artifactOrder and current artifact', () => {
    const store = createTestStore();
    store.getState().artifacts.ensureArtifact('a', {
      type: 'dashboard',
      title: 'A',
    });
    store.getState().artifacts.ensureArtifact('b', {
      type: 'notebook',
      title: 'B',
    });

    store.getState().artifacts.setArtifactOrder(['b', 'missing', 'a', 'b']);
    expect(store.getState().artifacts.config.artifactOrder).toEqual(['b', 'a']);

    store.getState().artifacts.setCurrentArtifact('b');
    expect(store.getState().artifacts.config.currentArtifactId).toBe('b');

    store.getState().artifacts.setCurrentArtifact('missing');
    expect(store.getState().artifacts.config.currentArtifactId).toBeUndefined();
  });

  it('validates configured artifact types', () => {
    const store = createTestStore();
    expect(() =>
      store.getState().artifacts.createArtifact({type: 'unknown'}),
    ).toThrow('Unknown artifact type "unknown".');
  });

  it('creates artifact layout nodes and panel definitions', () => {
    const store = createTestStore();
    const artifactId = store
      .getState()
      .artifacts.createArtifact({type: 'dashboard'});
    const node = createArtifactLayoutNode(artifactId);
    expect(node).toMatchObject({
      type: 'panel',
      id: artifactId,
      panel: {key: 'artifact', meta: {artifactId}},
    });

    const panelDefinition = createArtifactPanelDefinition(
      store.getState().artifacts.artifactTypes,
      store,
    );
    const panelInfo =
      typeof panelDefinition === 'function'
        ? panelDefinition({
            panelId: 'artifact',
            meta: {artifactId},
          })
        : panelDefinition;

    expect(panelInfo.title).toBe('Dashboard');
  });
});
