import type {StoreApi} from '@sqlrooms/room-store';
import {describe, expect, test} from 'vitest';
import type {WorkspaceRoomState} from './WorkspaceRoomStore';
import {getActiveRoomSnapshotProjection} from './roomSnapshotProjection';

describe('getActiveRoomSnapshotProjection', () => {
  test('does not expose a projection from the previous store', () => {
    const firstStore = {} as StoreApi<WorkspaceRoomState>;
    const secondStore = {} as StoreApi<WorkspaceRoomState>;
    const firstProjection = {
      artifactsConfig: {
        artifactsById: {},
        artifactOrder: [],
        pinnedArtifactIds: [],
      },
      blockDocumentsConfig: {artifacts: {}},
      sqlEditorConfig: {queries: [], selectedQueryId: '', openTabs: []},
      mosaicDashboardConfig: {dashboardsById: {}},
      currentArtifactId: 'first',
    };

    expect(
      getActiveRoomSnapshotProjection(
        {roomStore: firstStore, projection: firstProjection},
        secondStore,
      ),
    ).toBeNull();
  });
});
