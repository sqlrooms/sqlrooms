import {
  createSlice,
  type BaseRoomStoreState,
  type SliceFunctions,
} from '@sqlrooms/room-store';
import type {JsonObject} from '#/lib/json';
import {
  getWorkspaceContentWorksheets,
  hydrateWorkspaceContent,
  serializeWorkspaceRoomContent,
  type WorkspaceContentRoomState,
  type WorkspaceWorksheet,
} from './workspaceContent';

type WorkspaceSliceRootState = BaseRoomStoreState & WorkspaceContentRoomState;

export type WorkspaceSliceState = {
  workspace: SliceFunctions & {
    hydrateContent: (
      content?: JsonObject,
      currentWorksheetId?: string,
    ) => JsonObject;
    serializeContent: () => JsonObject;
    getWorksheets: () => WorkspaceWorksheet[];
    setCurrentWorksheet: (worksheetId?: string) => void;
  };
};

export function createWorkspaceSlice() {
  return createSlice<
    WorkspaceSliceState,
    WorkspaceSliceRootState & WorkspaceSliceState
  >((_set, get) => ({
    workspace: {
      hydrateContent(content, currentWorksheetId) {
        hydrateWorkspaceContent({
          store: {getState: get},
          content,
          currentWorksheetId,
        });
        return get().workspace.serializeContent();
      },
      serializeContent() {
        return serializeWorkspaceRoomContent(get());
      },
      getWorksheets() {
        return getWorkspaceContentWorksheets(
          get().workspace.serializeContent(),
        );
      },
      setCurrentWorksheet(worksheetId) {
        get().artifacts.setCurrentArtifact(worksheetId);
      },
    },
  }));
}
