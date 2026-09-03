import type {StoreApi} from '@sqlrooms/room-store';
import type {WorkspaceRoomState} from './WorkspaceRoomStore';

export type WorkspaceRoomSnapshotProjection = {
  artifactsConfig: WorkspaceRoomState['artifacts']['config'];
  blockDocumentsConfig: WorkspaceRoomState['blockDocuments']['config'];
  sqlEditorConfig: WorkspaceRoomState['sqlEditor']['config'];
  mosaicDashboardConfig: WorkspaceRoomState['mosaicDashboard']['config'];
  artifactAiConfig: WorkspaceRoomState['artifactAi']['config'];
  currentArtifactId: string | undefined;
};

export type RoomSnapshotState = {
  roomStore: StoreApi<WorkspaceRoomState> | null;
  projection: WorkspaceRoomSnapshotProjection | null;
};

export function getActiveRoomSnapshotProjection(
  snapshot: RoomSnapshotState,
  roomStore: StoreApi<WorkspaceRoomState> | null,
) {
  return snapshot.roomStore === roomStore ? snapshot.projection : null;
}
