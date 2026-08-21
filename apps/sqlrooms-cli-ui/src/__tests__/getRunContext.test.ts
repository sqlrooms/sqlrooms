import {
  blockContextItemId,
  blockDocumentBlockToNode,
} from '@sqlrooms/documents';
import type {StoreApi} from 'zustand';
import {getRunContext} from '../context/getRunContext';
import {
  EXPERIMENTAL_CLI_CAPABILITY_PROFILE,
  WORKSHEET_CHARTS_MAPS_CLI_CAPABILITY_PROFILE,
} from '../profiles';
import type {RoomState} from '../store-types';

function createMockStore() {
  const blockDocumentId = 'worksheet-1';
  const targets = [
    {
      blockDocumentId,
      blockId: 'chart-block',
      blockType: 'chart',
    },
    {
      blockDocumentId,
      blockId: 'dashboard-block',
      blockType: 'dashboard',
      blockInstanceId: 'dashboard-1',
    },
    {
      blockDocumentId,
      blockId: 'html-app-block',
      blockType: 'html-app',
      blockInstanceId: 'html-app-1',
    },
    {
      blockDocumentId,
      blockId: 'map-block',
      blockType: 'map',
      blockInstanceId: 'map-1',
    },
  ];
  const state = {
    artifacts: {
      config: {
        artifactsById: {
          [blockDocumentId]: {
            id: blockDocumentId,
            type: 'worksheet',
            title: 'Worksheet',
          },
        },
      },
    },
    artifactAi: {
      config: {
        sessionArtifactLinks: [],
      },
    },
    ai: {
      config: {
        sessions: [
          {
            id: 'session-1',
            draftContextItemIds: targets.map((target) =>
              blockContextItemId(target),
            ),
          },
        ],
      },
    },
    blockDocuments: {
      config: {
        artifacts: {
          [blockDocumentId]: {
            content: {
              type: 'doc',
              content: [
                blockDocumentBlockToNode({
                  id: 'chart-block',
                  type: 'chart',
                  tableName: 'sales',
                  config: {},
                }),
                blockDocumentBlockToNode({
                  id: 'dashboard-block',
                  type: 'statefulBlock',
                  blockType: 'dashboard',
                  blockInstanceId: 'dashboard-1',
                }),
                blockDocumentBlockToNode({
                  id: 'html-app-block',
                  type: 'statefulBlock',
                  blockType: 'html-app',
                  blockInstanceId: 'html-app-1',
                }),
                blockDocumentBlockToNode({
                  id: 'map-block',
                  type: 'statefulBlock',
                  blockType: 'map',
                  blockInstanceId: 'map-1',
                }),
              ],
            },
          },
        },
      },
    },
    db: {
      tables: [],
    },
  } as unknown as RoomState;

  return {
    store: {
      getState: () => state,
    } as StoreApi<RoomState>,
    targets,
  };
}

describe('getRunContext', () => {
  it('omits experimental block targets in the default profile', () => {
    const {store} = createMockStore();

    expect(
      getRunContext(store, 'session-1')?.items.map((item) => item.type),
    ).toEqual(['chart', 'dashboard']);
  });

  it('includes experimental block targets in the experimental profile', () => {
    const {store} = createMockStore();

    expect(
      getRunContext(store, 'session-1', {
        profile: EXPERIMENTAL_CLI_CAPABILITY_PROFILE,
      })?.items.map((item) => item.type),
    ).toEqual(['chart', 'dashboard', 'html-app', 'map']);
  });

  it('keeps only chart and map block targets in the worksheet profile', () => {
    const {store} = createMockStore();

    expect(
      getRunContext(store, 'session-1', {
        profile: WORKSHEET_CHARTS_MAPS_CLI_CAPABILITY_PROFILE,
      })?.items.map((item) => item.type),
    ).toEqual(['chart', 'map']);
  });
});

function createMultiArtifactStore(
  currentArtifactId: string | undefined,
  sessionOverrides: Record<string, unknown> = {},
) {
  const state = {
    artifacts: {
      config: {
        currentArtifactId,
        artifactsById: {
          'worksheet-old': {
            id: 'worksheet-old',
            type: 'worksheet',
            title: 'Older Worksheet',
          },
          'worksheet-new': {
            id: 'worksheet-new',
            type: 'worksheet',
            title: 'Newer Worksheet',
          },
          'dashboard-1': {
            id: 'dashboard-1',
            type: 'dashboard',
            title: 'Dashboard',
          },
          'html-app-1': {
            id: 'html-app-1',
            type: 'html-app',
            title: 'HTML App',
          },
        },
      },
    },
    artifactAi: {
      config: {
        // session-1 is linked to worksheet-old first, then worksheet-new later,
        // so the most recently linked artifact is worksheet-new.
        sessionArtifactLinks: [
          {
            sessionId: 'session-1',
            artifactId: 'worksheet-old',
            linkedAt: 1000,
          },
          {
            sessionId: 'session-1',
            artifactId: 'worksheet-new',
            linkedAt: 2000,
          },
        ],
      },
    },
    ai: {
      config: {
        sessions: [
          {id: 'session-1', draftContextItemIds: [], ...sessionOverrides},
        ],
      },
    },
    blockDocuments: {config: {artifacts: {}}},
    db: {tables: []},
  } as unknown as RoomState;

  return {getState: () => state} as StoreApi<RoomState>;
}

describe('getRunContext primary artifact selection', () => {
  it('directs the run at the currently selected artifact, not the latest link', () => {
    const store = createMultiArtifactStore('worksheet-old');

    expect(getRunContext(store, 'session-1')?.primaryItemId).toBe(
      'worksheet-old',
    );
  });

  it('falls back to the most recently linked artifact when none is selected', () => {
    const store = createMultiArtifactStore(undefined);

    expect(getRunContext(store, 'session-1')?.primaryItemId).toBe(
      'worksheet-new',
    );
  });

  it('updates a cached run context when invoked from another linked artifact', () => {
    const store = createMultiArtifactStore('worksheet-old', {
      draftContextItemIds: undefined,
      runContext: {
        items: [
          {
            kind: 'artifact',
            id: 'worksheet-new',
            type: 'worksheet',
            title: 'Newer Worksheet',
          },
        ],
        primaryItemId: 'worksheet-new',
        primaryItemKind: 'artifact',
        capturedAt: 1000,
      },
    });

    expect(getRunContext(store, 'session-1')).toMatchObject({
      primaryItemId: 'worksheet-old',
      primaryItemKind: 'artifact',
      capturedAt: 1000,
      items: [
        {kind: 'artifact', id: 'worksheet-old'},
        {kind: 'artifact', id: 'worksheet-new'},
      ],
    });
  });

  it('filters disabled artifacts from explicit worksheet-profile context', () => {
    const store = createMultiArtifactStore(undefined, {
      draftContextItemIds: ['worksheet-old', 'dashboard-1', 'html-app-1'],
    });

    expect(
      getRunContext(store, 'session-1', {
        profile: WORKSHEET_CHARTS_MAPS_CLI_CAPABILITY_PROFILE,
      })?.items.map((item) => item.id),
    ).toEqual(['worksheet-new', 'worksheet-old']);
  });

  it('filters disabled artifacts from stored worksheet-profile context', () => {
    const store = createMultiArtifactStore(undefined, {
      draftContextItemIds: undefined,
      runContext: {
        items: [
          {
            kind: 'artifact',
            id: 'dashboard-1',
            type: 'dashboard',
            title: 'Dashboard',
          },
          {
            kind: 'artifact',
            id: 'worksheet-old',
            type: 'worksheet',
            title: 'Older Worksheet',
          },
          {
            kind: 'artifact',
            id: 'html-app-1',
            type: 'html-app',
            title: 'HTML App',
          },
        ],
        primaryItemId: 'dashboard-1',
        primaryItemKind: 'artifact',
        capturedAt: 1000,
      },
    });

    expect(
      getRunContext(store, 'session-1', {
        profile: WORKSHEET_CHARTS_MAPS_CLI_CAPABILITY_PROFILE,
      }),
    ).toMatchObject({
      items: [{kind: 'artifact', id: 'worksheet-old'}],
      primaryItemId: 'worksheet-old',
      capturedAt: 1000,
    });
  });
});
