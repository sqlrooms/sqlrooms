import {
  blockContextItemId,
  blockDocumentBlockToNode,
} from '@sqlrooms/documents';
import type {StoreApi} from 'zustand';
import {getRunContext} from '../context/getRunContext';
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
        aiSessionArtifacts: {},
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
  it('omits experimental block targets when experimental mode is disabled', () => {
    const {store} = createMockStore();

    expect(
      getRunContext(store, 'session-1')?.items.map((item) => item.type),
    ).toEqual(['chart', 'dashboard']);
  });

  it('includes experimental block targets when experimental mode is enabled', () => {
    const {store} = createMockStore();

    expect(
      getRunContext(store, 'session-1', {experimentalEnabled: true})?.items.map(
        (item) => item.type,
      ),
    ).toEqual(['chart', 'dashboard', 'html-app', 'map']);
  });
});
