import {
  createSlice,
  type BaseRoomStoreState,
  type SliceFunctions,
} from '@sqlrooms/room-store';
import type {AiSliceState} from '@sqlrooms/ai';
import type {LayoutNode, LayoutSliceState} from '@sqlrooms/layout';
import type {JsonObject} from '#/lib/json';
import {
  createAssistantChatHeaders,
  parseWorkspaceAiConfig,
} from './workspaceAi';
import {
  getWorkspaceContentWorksheets,
  hydrateWorkspaceContent,
  serializeWorkspaceRoomContent,
  type WorkspaceContentRoomState,
  type WorkspaceWorksheet,
} from './workspaceContent';

type WorkspaceSliceRootState = BaseRoomStoreState &
  WorkspaceContentRoomState &
  LayoutSliceState &
  AiSliceState;

export type WorkspaceSliceState = {
  workspace: SliceFunctions & {
    hydrateContent: (
      content?: JsonObject,
      currentWorksheetId?: string,
    ) => JsonObject;
    serializeContent: () => JsonObject;
    getWorksheets: () => WorkspaceWorksheet[];
    setCurrentWorksheet: (worksheetId?: string) => void;
    hydrateLayout: (layout: LayoutNode) => void;
    hydrateAiConfig: (aiConfig: JsonObject) => void;
    serializeAiConfig: () => JsonObject;
    setAssistantToken: (token: string | null) => void;
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
      hydrateLayout(layout) {
        get().layout.setConfig(layout);
      },
      hydrateAiConfig(aiConfig) {
        get().ai.setConfig(parseWorkspaceAiConfig(aiConfig));
      },
      serializeAiConfig() {
        return get().ai.config as unknown as JsonObject;
      },
      setAssistantToken(token) {
        _set((state) => ({
          ...state,
          ai: {
            ...state.ai,
            chatHeaders: createAssistantChatHeaders(token),
          },
        }));
      },
    },
  }));
}
