import type {StoreApi} from '@sqlrooms/room-store';
import {useEffect, useMemo, useState} from 'react';
import type {JsonObject} from '#/lib/json';
import type {WorkspaceRoomState} from './WorkspaceRoomStore';
import {
  getActiveRoomSnapshotProjection,
  type RoomSnapshotState,
  type WorkspaceRoomSnapshotProjection,
} from './roomSnapshotProjection';
import {getWorkspaceContentDocuments} from './workspaceContent';

export function useWorkspaceRoomSnapshot({
  roomStore,
  workspaceContent,
}: {
  roomStore: StoreApi<WorkspaceRoomState> | null;
  workspaceContent: JsonObject | undefined;
}) {
  const roomSnapshotProjection = useRoomSnapshotProjection(roomStore);
  const workspaceContentSnapshot = useMemo(() => {
    if (!roomSnapshotProjection) return workspaceContent;
    return {
      artifacts: roomSnapshotProjection.artifactsConfig,
      blockDocuments: roomSnapshotProjection.blockDocumentsConfig,
      sqlEditor: roomSnapshotProjection.sqlEditorConfig,
      mosaicDashboard: roomSnapshotProjection.mosaicDashboardConfig,
      artifactAi: roomSnapshotProjection.artifactAiConfig,
    } as unknown as JsonObject;
  }, [roomSnapshotProjection, workspaceContent]);
  const documents = useMemo(
    () => getWorkspaceContentDocuments(workspaceContentSnapshot),
    [workspaceContentSnapshot],
  );

  return {
    workspaceContentSnapshot,
    documents,
    selectedDocumentId: roomSnapshotProjection?.currentArtifactId,
  };
}

function useRoomSnapshotProjection(
  roomStore: StoreApi<WorkspaceRoomState> | null,
) {
  const [snapshot, setSnapshot] = useState<RoomSnapshotState>(() => ({
    roomStore,
    projection: roomStore ? getRoomSnapshotProjection(roomStore) : null,
  }));

  useEffect(() => {
    if (!roomStore) {
      setSnapshot({roomStore: null, projection: null});
      return;
    }

    setSnapshot({roomStore, projection: getRoomSnapshotProjection(roomStore)});
    return roomStore.subscribe((state, previousState) => {
      if (
        state.artifacts.config === previousState.artifacts.config &&
        state.blockDocuments.config === previousState.blockDocuments.config &&
        state.sqlEditor.config === previousState.sqlEditor.config &&
        state.mosaicDashboard.config === previousState.mosaicDashboard.config &&
        state.artifactAi.config === previousState.artifactAi.config
      ) {
        return;
      }

      setSnapshot({
        roomStore,
        projection: getRoomSnapshotProjection(roomStore),
      });
    });
  }, [roomStore]);

  return getActiveRoomSnapshotProjection(snapshot, roomStore);
}

function getRoomSnapshotProjection(
  roomStore: StoreApi<WorkspaceRoomState>,
): WorkspaceRoomSnapshotProjection {
  const state = roomStore.getState();
  return {
    artifactsConfig: state.artifacts.config,
    blockDocumentsConfig: state.blockDocuments.config,
    sqlEditorConfig: state.sqlEditor.config,
    mosaicDashboardConfig: state.mosaicDashboard.config,
    artifactAiConfig: state.artifactAi.config,
    currentArtifactId: state.artifacts.config.currentArtifactId,
  };
}
