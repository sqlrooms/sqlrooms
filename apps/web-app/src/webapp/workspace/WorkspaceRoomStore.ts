import {createAiSlice, type AiSliceState} from '@sqlrooms/ai';
import {
  createArtifactsSlice,
  type ArtifactsSliceState,
} from '@sqlrooms/artifacts';
import {createDbSlice, type DbSliceState} from '@sqlrooms/db';
import {type DuckDbConnector} from '@sqlrooms/duckdb';
import {
  createBlockDocumentsSlice,
  type BlockDocumentsSliceState,
} from '@sqlrooms/documents';
import {
  createLayoutSlice,
  type LayoutNode,
  type LayoutSliceState,
  type Panels,
} from '@sqlrooms/layout';
import {
  createDefaultMosaicDashboardPanelRenderers,
  createMosaicDashboardSlice,
  createMosaicSlice,
  defaultAddPanelActions,
  type MosaicDashboardSliceState,
  type MosaicSliceState,
} from '@sqlrooms/mosaic';
import {
  createBaseRoomSlice,
  createRoomStorePersistence,
  createRoomStoreCreator,
  type BaseRoomStoreState,
  type PersistenceSaveMetadata,
  type RoomStorePersistence,
  type StoreApi,
} from '@sqlrooms/room-store';
import {
  createSqlEditorSlice,
  type SqlEditorSliceState,
} from '@sqlrooms/sql-editor';
import type {JsonObject} from '#/lib/json';
import {createWorkspaceBlockDocumentSliceProps} from '../worksheet/worksheetState';
import {
  createAssistantChatHeaders,
  createAssistantInstructions,
  parseWorkspaceAiConfig,
} from './workspaceAi';
import {
  ASSISTANT_MODEL_MODES,
  ASSISTANT_MODEL_PROVIDER,
  DEFAULT_ASSISTANT_MODEL_MODE,
} from '../assistant/modelModes';
import {WORKSPACE_ARTIFACT_TYPES} from './workspaceArtifactTypes';
import {createWorkspaceSlice, type WorkspaceSliceState} from './workspaceSlice';

export const ASSISTANT_PANEL_ID = 'assistant-panel';

export type WorkspaceRoomState = BaseRoomStoreState &
  LayoutSliceState &
  AiSliceState &
  DbSliceState &
  ArtifactsSliceState &
  MosaicSliceState &
  MosaicDashboardSliceState &
  SqlEditorSliceState &
  BlockDocumentsSliceState &
  WorkspaceSliceState;

export type CreateWorkspaceRoomStoreOptions = {
  workspaceKey: string;
  layout: LayoutNode;
  aiConfig: JsonObject;
  panels: Panels;
  token: string | null;
  duckDbConnector: DuckDbConnector;
};

export type WorkspaceRoomSnapshot = {
  content: JsonObject;
  layout: LayoutNode;
  aiConfig: JsonObject;
};

export type WorkspaceRoomPersistence = RoomStorePersistence<
  WorkspaceRoomState,
  WorkspaceRoomSnapshot,
  string
>;

export type CreateWorkspaceRoomPersistenceOptions = {
  roomStore: StoreApi<WorkspaceRoomState>;
  load?: () => Promise<WorkspaceRoomSnapshot | null>;
  save: (
    snapshot: WorkspaceRoomSnapshot,
    metadata?: PersistenceSaveMetadata,
  ) => Promise<void>;
  autosaveDelayMs?: number | null;
};

export function createDefaultWorkspaceLayout(): LayoutNode {
  return {
    type: 'split',
    id: 'workspace-root-layout',
    direction: 'row',
    children: [
      {
        type: 'panel',
        id: ASSISTANT_PANEL_ID,
        panel: 'assistant',
        defaultSize: '320px',
        minSize: '260px',
        maxSize: '560px',
        collapsible: true,
        collapsedSize: 0,
      },
      {
        type: 'panel',
        id: 'worksheet-panel',
        panel: 'worksheet',
        defaultSize: '75%',
        minSize: '360px',
      },
    ],
  };
}

export function createDefaultWorkspaceAiConfig(): JsonObject {
  return {sessions: [], openSessionTabs: []};
}

export function createWorkspaceRoomSnapshot(
  state: WorkspaceRoomState,
): WorkspaceRoomSnapshot {
  return {
    content: state.workspace.serializeContent(),
    layout: state.layout.config ?? createDefaultWorkspaceLayout(),
    aiConfig: state.workspace.serializeAiConfig(),
  };
}

export function createWorkspaceRoomPersistence({
  roomStore,
  load = async () => null,
  save,
  autosaveDelayMs = 900,
}: CreateWorkspaceRoomPersistenceOptions): WorkspaceRoomPersistence {
  return createRoomStorePersistence<
    WorkspaceRoomState,
    WorkspaceRoomSnapshot,
    string
  >({
    store: roomStore,
    partialize: createWorkspaceRoomSnapshot,
    serialize: (snapshot) => JSON.stringify(snapshot),
    deserialize: (snapshot) => JSON.parse(snapshot) as WorkspaceRoomSnapshot,
    autosaveDelayMs,
    markInitialSnapshotSaved: false,
    shouldPersistChange: didWorkspacePersistedStateChange,
    load: async () => {
      const snapshot = await load();
      return snapshot ? JSON.stringify(snapshot) : null;
    },
    save: async (snapshot, metadata) => {
      await save(JSON.parse(snapshot) as WorkspaceRoomSnapshot, metadata);
    },
  });
}

export function createWorkspaceRoomStore({
  workspaceKey,
  layout,
  aiConfig,
  panels,
  token,
  duckDbConnector,
}: CreateWorkspaceRoomStoreOptions): StoreApi<WorkspaceRoomState> {
  const {createRoomStore} = createRoomStoreCreator<WorkspaceRoomState>()(
    () => (set, get, store) => ({
      ...createBaseRoomSlice()(set, get, store),
      ...createLayoutSlice({config: layout, panels})(set, get, store),
      ...createDbSlice({
        duckDb: {connector: duckDbConnector},
        config: {currentRuntime: 'browser'},
      })(set, get, store),
      ...createArtifactsSlice<WorkspaceRoomState>({
        artifactTypes: WORKSPACE_ARTIFACT_TYPES,
      })(set, get, store),
      ...createMosaicSlice()(set, get, store),
      ...createMosaicDashboardSlice({
        addPanelActions: defaultAddPanelActions,
        panelRenderers: createDefaultMosaicDashboardPanelRenderers(),
      })(set, get, store),
      ...createSqlEditorSlice()(set, get, store),
      ...createBlockDocumentsSlice<WorkspaceRoomState>(
        createWorkspaceBlockDocumentSliceProps(),
      )(set, get, store),
      ...createWorkspaceSlice()(set, get, store),
      ...createAiSlice({
        config: parseWorkspaceAiConfig(aiConfig),
        tools: {},
        defaultProvider: ASSISTANT_MODEL_PROVIDER,
        defaultModel: DEFAULT_ASSISTANT_MODEL_MODE,
        getAvailableModels: () => [...ASSISTANT_MODEL_MODES],
        chatEndPoint: '/api/chat',
        chatHeaders: createAssistantChatHeaders(token),
        getInstructions: (args) =>
          createAssistantInstructions(args?.runContext),
      })(set, get, store),
    }),
  );

  return createRoomStore({storeKey: `workspace-room:${workspaceKey}`});
}

function didWorkspacePersistedStateChange(
  state: WorkspaceRoomState,
  previousState: WorkspaceRoomState,
) {
  return (
    state.layout.config !== previousState.layout.config ||
    state.ai.config !== previousState.ai.config ||
    state.artifacts.config !== previousState.artifacts.config ||
    state.blockDocuments.config !== previousState.blockDocuments.config ||
    state.sqlEditor.config !== previousState.sqlEditor.config ||
    state.mosaicDashboard.config !== previousState.mosaicDashboard.config
  );
}
