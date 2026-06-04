import {createStore} from 'zustand';
import {
  createBaseRoomSlice,
  type BaseRoomStoreState,
} from '@sqlrooms/room-store';
import {
  ArtifactsSliceConfig,
  createArtifactTypeFromStatefulBlock,
  createArtifactLayoutNode,
  createArtifactPanelDefinition,
  createArtifactsSlice,
  defineArtifactTypes,
  isArtifactVisibleInTabs,
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

  it('defaults legacy artifacts to workspace visibility', () => {
    const result = ArtifactsSliceConfig.parse({
      artifactsById: {
        a: {id: 'a', type: 'dashboard', title: 'A'},
      },
      artifactOrder: ['a'],
    });

    expect(result.artifactsById.a).toMatchObject({
      id: 'a',
      type: 'dashboard',
      title: 'A',
      visibility: 'workspace',
    });
  });

  it('creates and ensures embedded child artifacts without selecting them', () => {
    const store = createTestStore();

    const parentId = store.getState().artifacts.createArtifact({
      id: 'analysis-1',
      type: 'notebook',
      title: 'Analysis',
    });
    const childId = store.getState().artifacts.createArtifact({
      id: 'dashboard-1',
      type: 'dashboard',
      title: 'Embedded Dashboard',
      visibility: 'embedded',
      parentArtifactId: parentId,
    });

    expect(childId).toBe('dashboard-1');
    expect(store.getState().artifacts.getArtifact(childId)).toMatchObject({
      id: childId,
      type: 'dashboard',
      title: 'Embedded Dashboard',
      visibility: 'embedded',
      parentArtifactId: parentId,
    });
    expect(store.getState().artifacts.config.currentArtifactId).toBe(parentId);

    store.getState().artifacts.ensureArtifact(childId, {
      type: 'dashboard',
      title: 'Embedded Dashboard',
    });

    expect(store.getState().artifacts.getArtifact(childId)).toMatchObject({
      visibility: 'embedded',
      parentArtifactId: parentId,
    });
  });

  it('does not cascade-delete unrelated or embedded child artifacts', () => {
    const store = createTestStore();
    store.getState().artifacts.createArtifact({
      id: 'analysis-1',
      type: 'notebook',
      title: 'Analysis',
    });
    store.getState().artifacts.createArtifact({
      id: 'dashboard-1',
      type: 'dashboard',
      visibility: 'embedded',
      parentArtifactId: 'analysis-1',
    });

    store.getState().artifacts.deleteArtifact('analysis-1');

    expect(
      store.getState().artifacts.getArtifact('analysis-1'),
    ).toBeUndefined();
    expect(store.getState().artifacts.getArtifact('dashboard-1')).toMatchObject(
      {
        id: 'dashboard-1',
        type: 'dashboard',
        visibility: 'embedded',
        parentArtifactId: 'analysis-1',
      },
    );
  });

  it('hides embedded artifacts from tabs unless explicitly included', () => {
    const workspaceArtifact = ArtifactsSliceConfig.parse({
      artifactsById: {
        a: {id: 'a', type: 'dashboard', title: 'A'},
      },
    }).artifactsById.a;
    const embeddedArtifact = ArtifactsSliceConfig.parse({
      artifactsById: {
        b: {
          id: 'b',
          type: 'dashboard',
          title: 'B',
          visibility: 'embedded',
          parentArtifactId: 'a',
        },
      },
    }).artifactsById.b;

    expect(workspaceArtifact).toBeDefined();
    expect(embeddedArtifact).toBeDefined();
    expect(isArtifactVisibleInTabs(workspaceArtifact!)).toBe(true);
    expect(isArtifactVisibleInTabs(embeddedArtifact!)).toBe(false);
    expect(
      isArtifactVisibleInTabs(embeddedArtifact!, {includeEmbedded: true}),
    ).toBe(true);
  });

  it('validates configured artifact types', () => {
    const store = createTestStore();
    expect(() =>
      store.getState().artifacts.createArtifact({type: 'unknown'}),
    ).toThrow('Unknown artifact type "unknown".');
  });

  it('bridges stateful block definitions into artifact type lifecycle hooks', () => {
    const events: string[] = [];
    const artifactTypes = defineArtifactTypes({
      dashboard: createArtifactTypeFromStatefulBlock<TestRoomState>({
        type: 'dashboard-block',
        label: 'Dashboard',
        defaultTitle: 'Dashboard',
        render: () => null,
        ensureState: ({blockId, blockType, title, getState}) => {
          events.push(
            `ensure:${blockId}:${blockType}:${title}:${Boolean(getState().artifacts)}`,
          );
        },
        rename: ({blockId, previousTitle, title}) => {
          events.push(`rename:${blockId}:${previousTitle}:${title}`);
        },
        close: ({blockId}) => {
          events.push(`close:${blockId}`);
        },
        deleteState: ({blockId}) => {
          events.push(`delete:${blockId}`);
        },
      }),
    });
    const store = createStore<TestRoomState>()((...args) => ({
      ...createBaseRoomSlice()(...args),
      ...createArtifactsSlice<TestRoomState>({artifactTypes})(...args),
    }));

    store.getState().artifacts.createArtifact({
      id: 'dashboard-1',
      type: 'dashboard',
    });
    store.getState().artifacts.ensureArtifact('dashboard-1', {
      type: 'dashboard',
      title: 'Dashboard',
    });
    store.getState().artifacts.renameArtifact('dashboard-1', 'Renamed');
    store.getState().artifacts.closeArtifact('dashboard-1');
    store.getState().artifacts.deleteArtifact('dashboard-1');

    expect(events).toEqual([
      'ensure:dashboard-1:dashboard-block:Dashboard:true',
      'ensure:dashboard-1:dashboard-block:Dashboard:true',
      'rename:dashboard-1:Dashboard:Renamed',
      'close:dashboard-1',
      'close:dashboard-1',
      'delete:dashboard-1',
    ]);
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
