import type {StoreApi} from '@sqlrooms/room-store';
import {useEffect, useMemo, useState} from 'react';
import type {JsonObject} from '#/lib/json';
import type {WorkspaceRoomState} from './WorkspaceRoomStore';
import {getWorkspaceContentWorksheets} from './workspaceContent';

type WorkspaceRoomSnapshotProjection = {
  artifactsConfig: WorkspaceRoomState['artifacts']['config'];
  blockDocumentsConfig: WorkspaceRoomState['blockDocuments']['config'];
  sqlEditorConfig: WorkspaceRoomState['sqlEditor']['config'];
  mosaicDashboardConfig: WorkspaceRoomState['mosaicDashboard']['config'];
  currentArtifactId: string | undefined;
};

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
    } as unknown as JsonObject;
  }, [roomSnapshotProjection, workspaceContent]);
  const worksheets = useMemo(
    () => getWorkspaceContentWorksheets(workspaceContentSnapshot),
    [workspaceContentSnapshot],
  );

  return {
    workspaceContentSnapshot,
    worksheets,
    selectedWorksheetId: roomSnapshotProjection?.currentArtifactId,
  };
}

function useRoomSnapshotProjection(
  roomStore: StoreApi<WorkspaceRoomState> | null,
) {
  const [snapshot, setSnapshot] =
    useState<WorkspaceRoomSnapshotProjection | null>(() =>
      roomStore ? getRoomSnapshotProjection(roomStore) : null,
    );

  useEffect(() => {
    if (!roomStore) {
      setSnapshot(null);
      return;
    }

    setSnapshot(getRoomSnapshotProjection(roomStore));
    return roomStore.subscribe((state, previousState) => {
      if (
        state.artifacts.config === previousState.artifacts.config &&
        state.blockDocuments.config === previousState.blockDocuments.config &&
        state.sqlEditor.config === previousState.sqlEditor.config &&
        state.mosaicDashboard.config === previousState.mosaicDashboard.config
      ) {
        return;
      }

      setSnapshot(getRoomSnapshotProjection(roomStore));
    });
  }, [roomStore]);

  return snapshot;
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
    currentArtifactId: state.artifacts.config.currentArtifactId,
  };
}
